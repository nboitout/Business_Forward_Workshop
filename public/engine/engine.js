/*
 * Engine : moteur commun des pages « animation interactive ».
 *
 * Une page = une coquille HTML minuscule (<div id="app" data-spec="/specs/xxx.json">) + ce fichier + le module du type
 * de graphique demandé par la spec (engine/charts/<type>.js). Tout le reste (texte FR/EN, chapitres, données, couleurs)
 * vit dans la spec.
 *
 * Module de graphique (Engine.registerChart(type, { create(ctx) })), l'instance retournée expose :
 *   duration, readyTime, chapters: [{ t, chip, num }], chapterTotal
 *   setTime(t)            position de la lecture (secondes), appelée à chaque image
 *   frame(dt)             (option) animations propres au graphique (ressorts, survol)
 *   readout(t)            { value, unit, chapter, text?, personal? }  : bloc « année / âge » et chapitre
 *   nowLabel(t), endLabel  libellés de la barre de progression
 *   values(t)             (option) { clé: valeur }  : légende
 *   ranking(t)            (option) [{ key, value }] : classement en direct
 *   timeFor(v), setPersonal(v)   (option) formulaire « ton âge »
 *   setFocus(k), getFocus()      (option) pays / complément suivi
 *   refresh()             taille ou langue modifiées
 */
(function () {
  "use strict";
  const E = window.Engine = { charts: {}, registerChart(type, mod) { E.charts[type] = mod; } };

  // ───────────────────────── Outils communs ─────────────────────────
  const u = E.util = {
    clamp01: (x) => Math.max(0, Math.min(1, x)),
    easeOut: (x) => 1 - (1 - Math.max(0, Math.min(1, x))) ** 3,
    easeInOut: (x) => 0.5 - 0.5 * Math.cos(Math.PI * Math.max(0, Math.min(1, x))),
    rgb: (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`,
    mix: (a, b, t) => a.map((v, i) => v + (b[i] - v) * t),
    hex: (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)],
    tpl: (s, v) => String(s).replace(/\{(\w+)\}/g, (_, k) => (v[k] === undefined ? "" : v[k])),
    ordinal(lang, n) {
      if (lang === "fr") return n === 1 ? "1er" : n + "e";
      return n + ((n % 100 >= 11 && n % 100 <= 13) ? "th" : ({ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th"));
    },
    // interpolation cubique monotone (Fritsch-Carlson) sur des points (x, y) quelconques
    pchip(pts, x) {
      const n = pts.length, xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), h = [], d = [], m = new Array(n).fill(0);
      for (let i = 0; i < n - 1; i++) { h[i] = xs[i + 1] - xs[i]; d[i] = (ys[i + 1] - ys[i]) / h[i]; }
      for (let i = 1; i < n - 1; i++) if (d[i - 1] * d[i] > 0) { const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1]; m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]); }
      m[0] = d[0]; m[n - 1] = d[n - 2];
      x = Math.min(Math.max(x, xs[0]), xs[n - 1]);
      let k = 0; while (k < n - 2 && xs[k + 1] < x) k++;
      const t = (x - xs[k]) / h[k];
      return (2 * t ** 3 - 3 * t ** 2 + 1) * ys[k] + (t ** 3 - 2 * t ** 2 + t) * h[k] * m[k] + (-2 * t ** 3 + 3 * t ** 2) * ys[k + 1] + (t ** 3 - t ** 2) * h[k] * m[k + 1];
    },
    // découpe un texte en lignes qui tiennent dans maxW (canvas)
    wrap(ctx, text, maxW) {
      const words = String(text).split(" "), lines = []; let cur = "";
      words.forEach((w) => { const t = cur ? cur + " " + w : w; if (ctx.measureText(t).width <= maxW || !cur) cur = t; else { lines.push(cur); cur = w; } });
      if (cur) lines.push(cur); return lines;
    },
  };

  // ───────────────────────── Hôte canvas : taille, résolution, visibilité, pointeur, info-bulle ─────────────────────────
  E.host = function (canvas, opts) {
    opts = opts || {};
    const parent = canvas.parentElement, ctx = canvas.getContext("2d"), tip = document.createElement("div");
    tip.className = "lr-tip"; tip.setAttribute("role", "status"); parent.appendChild(tip);
    const h = { ctx, W: 0, H: 0, dpr: 1, visible: true, dirty: true, mouse: null, onResize: null, onMove: null, onLeave: null, onClick: null };
    h.resize = () => {
      const b = parent.getBoundingClientRect();
      h.W = Math.max(240, Math.floor(b.width)); h.H = Math.max(320, Math.floor(b.height));
      h.dpr = Math.min(2.5, window.devicePixelRatio || 1);
      canvas.width = Math.round(h.W * h.dpr); canvas.height = Math.round(h.H * h.dpr);
      h.dirty = true; h.onResize && h.onResize();
    };
    h.begin = () => { ctx.setTransform(h.dpr, 0, 0, h.dpr, 0, 0); ctx.clearRect(0, 0, h.W, h.H); };
    h.showTip = (html, x, y) => {
      tip.innerHTML = html;
      const tw = tip.offsetWidth || 200, th = tip.offsetHeight || 60;
      let lx = x + 14, ly = y - 12; if (lx + tw > h.W - 6) lx = x - tw - 14; if (ly + th > h.H - 6) ly = h.H - th - 6;
      tip.style.left = Math.max(6, lx) + "px"; tip.style.top = Math.max(6, ly) + "px"; tip.classList.add("on");
    };
    h.hideTip = () => tip.classList.remove("on");
    const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    canvas.style.touchAction = "pan-y";
    canvas.addEventListener("pointermove", (e) => { h.mouse = pos(e); h.onMove && h.onMove(h.mouse.x, h.mouse.y, e); });
    canvas.addEventListener("pointerdown", (e) => { if (e.pointerType !== "mouse") { h.mouse = pos(e); h.onMove && h.onMove(h.mouse.x, h.mouse.y, e); } });
    canvas.addEventListener("pointerleave", () => { h.mouse = null; h.hideTip(); h.onLeave && h.onLeave(); });
    canvas.addEventListener("click", (e) => { const p = pos(e); h.onClick && h.onClick(p.x, p.y, e); });
    new ResizeObserver(() => h.resize()).observe(parent);
    if ("IntersectionObserver" in window) new IntersectionObserver((en) => { h.visible = en[0].isIntersecting; if (h.visible) h.dirty = true; }).observe(canvas);
    h.resize();
    return h;
  };

  // ───────────────────────── Coquille de page ─────────────────────────
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function shellHTML(site, spec, dataHref) {
    const has = (p) => (spec.panels || []).includes(p);
    const tabs = site.tabs.map((t) =>
      `<a href="${t.href}" data-tab="${t.id}"${t.id === spec.id ? ' aria-current="page"' : ""}><span class="long" data-tab-label="${t.id}"></span><span class="short" data-tab-short="${t.id}"></span></a>`).join("");
    return `
<header class="topnav">
  <a class="topnav__brand" href="/">${esc(site.brand)}</a>
  <nav class="tabs" id="nav" aria-label="">${tabs}</nav>
</header>
<section class="ccv${spec.layout ? " ccv--" + spec.layout : ""}" aria-labelledby="ccv-title">
  <div class="ccv__inner">
    <div class="side">
      <div class="transport">
        <div class="controls">
          <button class="btn btn--primary" id="ccv-play" type="button">
            <svg viewBox="0 0 16 16" aria-hidden="true"><path id="ccv-play-icon" d="M4 2.5v11l9-5.5z"/></svg><span id="ccv-play-label"></span>
          </button>
          <button class="btn" id="ccv-stop" type="button" disabled>
            <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3" y="3" width="10" height="10" rx="1.5"/></svg><span data-ui="stop"></span>
          </button>
        </div>
        <div class="scrub"><div class="scrub__segs" id="ccv-segs"></div>
          <input type="range" id="ccv-scrub" min="0" max="30" step="0.01" value="0" data-aria="scrubLabel"></div>
        <div class="time"><span id="ccv-now"></span><span id="ccv-dur"></span></div>
      </div>
      <nav class="chapters" aria-labelledby="ccv-chapters-title">
        <p class="label" id="ccv-chapters-title" data-ui="chaptersTitle"></p>
        <ul class="chips" id="ccv-chips"></ul>
        <div class="chapters__foot">
          <label class="toggle" for="ccv-loop"><input type="checkbox" id="ccv-loop"><span aria-hidden="true"></span><b data-ui="loop" style="font-weight:inherit"></b></label>
          <p class="keys" data-ui-html="keys"></p>
        </div>
      </nav>
    </div>
    <div class="player"><div class="screen">
      <canvas id="ccv-chart" role="img" data-aria="chartLabel"></canvas>
      <span class="screen__badge" id="ccv-badge" data-state="stopped"></span>
    </div></div>
    <div class="copy">
      <div class="copy__top"><p class="kicker" data-i="kicker"></p>
        <div class="lang" role="group" aria-label="Langue / Language">
          <button type="button" data-lang="fr" lang="fr" aria-pressed="true" title="Français">FR</button>
          <button type="button" data-lang="en" lang="en" aria-pressed="false" title="English">EN</button>
        </div></div>
      <h1 id="ccv-title" data-i="title"></h1>
      <p class="lede" data-i="lede"></p>
      ${has("ageForm") ? `<form class="myage" id="ccv-age-form" novalidate>
        <label for="ccv-myage" data-i="ageLabel"></label>
        <input id="ccv-myage" type="number" inputmode="numeric" min="${spec.form.min}" max="${spec.form.max}" step="1" placeholder="${spec.form.placeholder}" autocomplete="off">
        <button type="submit" class="btn" data-i="ageBtn"></button><p class="myage__msg" id="ccv-age-msg" aria-live="polite"></p></form>` : ""}
      <div class="readout" id="ccv-readout" aria-live="polite">
        <div class="readout__age"><span id="ccv-value"></span><small id="ccv-unit"></small></div>
        <div class="readout__chap"><div class="readout__num" id="ccv-chap-num"></div><div class="readout__title" id="ccv-chap-title"></div><p class="readout__text" id="ccv-chap-text"></p></div>
      </div>
      ${has("legend") ? `<ul class="legend" id="ccv-legend"></ul>` : ""}
      ${has("board") ? `<form class="pick" id="ccv-pick-form"><label for="ccv-pick" data-i="pickLabel"></label><select id="ccv-pick"></select></form>
        <p class="focus" id="ccv-focus" aria-live="polite"></p><ol class="board" id="ccv-board"></ol>` : ""}
      <a class="cta" id="ccv-cta" href="${esc(spec.cta.href)}" data-i="cta"></a>
      <p class="note"><span data-i="note"></span>${dataHref ? ` <a href="${dataHref}" data-i="dataLink"></a>` : ""}</p>
    </div>
  </div>
</section>`;
  }

  async function boot() {
    const app = $("app"), getJSON = (url) => fetch(url).then((r) => r.json());
    const [site, spec] = await Promise.all([getJSON(app.dataset.site), getJSON(app.dataset.spec)]);
    const dataHref = spec.dataUrl ? spec.dataUrl + (app.dataset.dv ? "?v=" + app.dataset.dv : "") : null;
    const data = dataHref ? await getJSON(dataHref) : spec.data;
    const mod = E.charts[spec.chart.type];
    if (!mod) throw new Error("Type de graphique inconnu : " + spec.chart.type);
    app.innerHTML = shellHTML(site, spec, dataHref);
    app.className = "engine-app";

    let lang = "fr", L = {}, state = "stopped", started = false, t = 0, playing = false, lastNow = 0, dragging = false, chart = null;
    const ui = () => site.ui[lang], spc = () => spec.i18n[lang];
    const merged = () => ({ ...ui(), ...spc() });
    const tick = { last: -1, board: 0, sig: "" };
    const badge = $("ccv-badge"), scrub = $("ccv-scrub"), segsEl = $("ccv-segs"), chipsEl = $("ccv-chips"), stopBtn = $("ccv-stop"), loop = $("ccv-loop");
    const fmtValue = (v) => {
      const f = spec.format || { kind: "int" };
      if (f.kind === "pct") return Math.round(v) + (lang === "fr" ? " %" : "%");
      if (f.kind === "dec") { const n = v.toFixed(f.digits == null ? 1 : f.digits); return (lang === "fr" ? n.replace(".", ",") : n) + ((f.suffix && f.suffix[lang]) || ""); }
      return Math.round(v).toLocaleString(lang === "fr" ? "fr-FR" : "en-US").replace(/ /g, " ");
    };

    chart = mod.create({
      canvas: $("ccv-chart"), spec, data, lang: () => ({ code: lang, L: merged(), fmt: fmtValue }),
      seek: (sec) => { started = true; if (state === "stopped" || state === "ended") setState("paused"); seek(sec); }, onFocus: (k) => { if (picker) picker.value = k || ""; tick.sig = ""; },
    });
    const dur = chart.duration;
    scrub.max = dur; $("ccv-dur").textContent = chart.endLabel;

    // segments de la barre + puces de chapitre
    const chs = chart.chapters, segs = chs.map((c, i) => {
      const end = i < chs.length - 1 ? chs[i + 1].t : dur, seg = document.createElement("div");
      seg.className = "scrub__seg"; seg.style.flex = String(Math.max(0.01, end - c.t)); seg.appendChild(document.createElement("i")); segsEl.appendChild(seg);
      return { el: seg.firstChild, start: c.t, end };
    });
    const chips = [];
    chs.forEach((c, i) => { if (!c.chip) return; const li = document.createElement("li"), b = document.createElement("button");
      b.type = "button"; b.className = "chip"; b.dataset.i = i; b.addEventListener("click", () => { started = true; seek(c.t + 0.05); if (i === chs.length - 1) { playing = false; setState("paused"); } else if (!playing) play(true); });
      li.appendChild(b); chipsEl.appendChild(li); chips.push(b); });
    const chapterAt = (tt) => { let i = 0; chs.forEach((c, k) => { if (tt >= c.t) i = k; }); return i; };

    // ── lecture ──
    function setState(s) {
      state = s; badge.dataset.state = s; badge.textContent = ui().badge[s];
      $("ccv-play-label").textContent = s === "playing" ? ui().pause : s === "paused" ? ui().resume : s === "ended" ? ui().replay : ui().play;
      $("ccv-play-icon").setAttribute("d", s === "playing" ? "M3.5 2.5h3.2v11H3.5zM9.3 2.5h3.2v11H9.3z" : "M4 2.5v11l9-5.5z");
      stopBtn.disabled = s === "stopped";
    }
    function play(keepT) { if (!keepT && (t >= dur - 0.02 || state === "stopped")) t = 0; started = true; playing = true; setState("playing"); tick.sig = ""; }
    function pause() { playing = false; setState("paused"); }
    function stop() { playing = false; started = false; t = chart.readyTime; setState("stopped"); tick.sig = ""; if (personal) { personal = null; chart.setPersonal && chart.setPersonal(null); } }
    function seek(sec) { t = Math.max(0, Math.min(dur, sec)); tick.sig = ""; }
    let personal = null;
    $("ccv-play").addEventListener("click", () => (playing ? pause() : play()));
    stopBtn.addEventListener("click", stop);
    scrub.addEventListener("input", () => { dragging = true; started = true; seek(parseFloat(scrub.value)); if (state === "stopped" || state === "ended") setState("paused"); });
    scrub.addEventListener("change", () => { dragging = false; });
    document.addEventListener("keydown", (e) => {
      const tag = (e.target.tagName || "").toLowerCase(); if (["input", "textarea", "select", "button"].includes(tag)) return;
      if (e.code === "Space") { e.preventDefault(); playing ? pause() : play(); } else if (e.key === "Escape") stop();
    });

    // ── formulaire « ton âge » ──
    if ((spec.panels || []).includes("ageForm")) {
      const input = $("ccv-myage"), msg = $("ccv-age-msg");
      try { const sv = localStorage.getItem("ccv-age"); if (sv) input.value = sv; } catch (e) {}
      $("ccv-age-form").addEventListener("submit", (e) => {
        e.preventDefault();
        const v = Math.round(Number(input.value));
        if (input.value === "" || !Number.isFinite(v) || v < spec.form.min || v > spec.form.max) { msg.textContent = spc().ageErr; input.focus(); return; }
        msg.textContent = ""; try { localStorage.setItem("ccv-age", String(v)); } catch (err) {}
        playing = false; started = true; personal = v; chart.setPersonal(v); seek(chart.timeFor(v)); setState("paused");
      });
      input.addEventListener("input", () => { msg.textContent = ""; });
    }

    // ── classement en direct + sélecteur ──
    const picker = $("ccv-pick"), boardEl = $("ccv-board");
    if (picker) {
      picker.addEventListener("change", () => { chart.setFocus(picker.value || null); try { picker.value ? localStorage.setItem("focus-" + spec.id, picker.value) : localStorage.removeItem("focus-" + spec.id); } catch (e) {} tick.sig = ""; });
      $("ccv-pick-form").addEventListener("submit", (e) => e.preventDefault());
      try { const sv = localStorage.getItem("focus-" + spec.id); if (sv && spec.colors[sv]) chart.setFocus(sv); } catch (e) {}
    }
    function fillPicker() {
      if (!picker) return; const names = L.names, keys = Object.keys(spec.colors).sort((a, b) => names[a].localeCompare(names[b], lang));
      picker.innerHTML = `<option value="">${ui().pickNone}</option>` + keys.map((k) => `<option value="${k}">${names[k]}</option>`).join("");
      picker.value = chart.getFocus() || "";
    }
    function renderBoard(tt) {
      if (!boardEl) return; const rk = chart.ranking(tt), fk = chart.getFocus(), rows = rk.slice(0, 5).map((r, i) => [r, i + 1]), fr = fk ? rk.findIndex((r) => r.key === fk) : -1;
      if (fr >= 5) rows.push([rk[fr], fr + 1]);
      boardEl.innerHTML = rows.map(([r, n], i) => `<li data-focus="${r.key === fk}" data-gap="${i === 5}"><span class="r">${n}</span><span class="dot" style="background:${spec.colors[r.key]}"></span><span>${L.names[r.key]}</span><span class="v">${fmtValue(r.value)}</span></li>`).join("");
      const f = $("ccv-focus");
      if (fr < 0) { f.textContent = L.focusHint; return; }
      const total = rk.reduce((s, r) => s + r.value, 0);
      f.innerHTML = u.tpl(L.focus, { name: L.names[fk], value: fmtValue(rk[fr].value), rank: u.ordinal(lang, fr + 1), year: chart.readout(tt).value,
        share: total ? Math.round(rk[fr].value / total * 100) + (lang === "fr" ? " %" : "%") : "" });
    }
    function renderLegend(tt) {
      const el = $("ccv-legend"); if (!el) return; const vals = chart.values(tt);
      if (!el.children.length) el.innerHTML = spec.legend.map((k) => `<li style="--dot:${spec.colors[k]}"><span data-legend="${k}"></span><b class="legend__val" data-val="${k}"></b></li>`).join("");
      el.querySelectorAll("[data-legend]").forEach((s) => { s.innerHTML = L.legend[s.dataset.legend]; });
      el.querySelectorAll("[data-val]").forEach((s) => { s.textContent = vals && vals[s.dataset.val] !== undefined && started ? fmtValue(vals[s.dataset.val]) : ""; });
    }

    // ── mise à jour de l'interface à chaque image ──
    function updateUI() {
      const ch = chapterAt(t), ro = chart.readout(t), now = performance.now();
      segs.forEach((s) => { s.el.style.width = (Math.max(0, Math.min(1, (t - s.start) / (s.end - s.start))) * 100) + "%"; });
      if (!dragging) scrub.value = t;
      $("ccv-now").textContent = chart.nowLabel(t);
      chips.forEach((b) => b.setAttribute("aria-current", String(started && Number(b.dataset.i) === ch)));
      const sig = [ro.value, ro.unit, ch, started, lang, ro.personal, ro.text || "", state].join("|");
      if (sig !== tick.sig) {
        tick.sig = sig;
        $("ccv-value").textContent = ro.value; $("ccv-unit").textContent = L[ro.unit] || ro.unit;
        $("ccv-readout").dataset.personal = String(!!ro.personal);
        if (!started) { $("ccv-chap-num").textContent = `00 / ${chart.chapterTotal}`; $("ccv-chap-title").textContent = ui().readyTitle; $("ccv-chap-text").textContent = L.readyText; }
        else { const c = chs[ch], txt = L.chapters[ch];
          $("ccv-chap-num").textContent = c.num ? `${c.num} / ${chart.chapterTotal}` : ui().end; $("ccv-chap-title").textContent = txt[0]; $("ccv-chap-text").textContent = ro.text || txt[2]; }
        if (picker && document.activeElement !== picker) picker.value = chart.getFocus() || "";
      }
      if (now - tick.board > 100) { tick.board = now; renderBoard && boardEl && renderBoard(t); renderLegend(t); }
    }

    function frame(now) {
      const dt = Math.min(1, (now - lastNow) / 1000) || 0; lastNow = now;
      if (playing) { t += dt; if (t >= dur) { t = dur; playing = false; setState("ended"); if (loop.checked) setTimeout(() => { if (state === "ended") { t = 0; play(); } }, 900); } }
      chart.setTime(t); chart.frame && chart.frame(dt); updateUI();
      requestAnimationFrame(frame);
    }

    // ── langue, navigation, taille ──
    function applyLang(next) {
      lang = next; L = merged(); document.documentElement.lang = next; document.title = L.docTitle;
      document.querySelector('meta[name="description"]').content = L.docDesc;
      document.querySelectorAll("[data-i]").forEach((el) => { if (L[el.dataset.i] !== undefined) el.textContent = L[el.dataset.i]; });
      document.querySelectorAll("[data-ui]").forEach((el) => { el.textContent = ui()[el.dataset.ui]; });
      document.querySelectorAll("[data-ui-html]").forEach((el) => { el.innerHTML = ui()[el.dataset.uiHtml]; });
      document.querySelectorAll("[data-aria]").forEach((el) => el.setAttribute("aria-label", L[el.dataset.aria]));
      $("nav").setAttribute("aria-label", ui().navLabel);
      site.tabs.forEach((tb) => { document.querySelector(`[data-tab-label="${tb.id}"]`).textContent = tb.label[next]; document.querySelector(`[data-tab-short="${tb.id}"]`).textContent = tb.short[next];
        document.querySelector(`.tabs a[data-tab="${tb.id}"]`).href = tb.href + "#" + next; });
      document.querySelectorAll(".lang button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.lang === next)));
      const here = document.querySelector('.tabs a[aria-current="page"]'), strip = $("nav");   // onglet courant visible quand la barre défile
      if (here) strip.scrollLeft = here.offsetLeft - (strip.clientWidth - here.offsetWidth) / 2;
      chips.forEach((b) => { const i = Number(b.dataset.i), c = chs[i], [name, range] = L.chapters[i]; b.innerHTML = `<b>${c.num || "—"}</b><span>${name}</span><small>${range}</small>`; });
      $("ccv-now").textContent = chart.nowLabel(t); $("ccv-dur").textContent = chart.endLabel;
      setState(state); tick.sig = ""; fillPicker(); chart.refresh(); renderLegend(t);
      try { localStorage.setItem("ccv-lang", next); } catch (e) {}
      try { history.replaceState(null, "", "#" + next); } catch (e) {}
    }
    document.querySelectorAll(".lang button").forEach((b) => b.addEventListener("click", () => { if (b.dataset.lang !== lang) applyLang(b.dataset.lang); }));
    const initialLang = () => { const h = location.hash.replace("#", "").split(",")[0]; if (site.ui[h]) return h;
      try { const s = localStorage.getItem("ccv-lang"); if (site.ui[s]) return s; } catch (e) {}
      return (navigator.language || "fr").toLowerCase().startsWith("fr") ? "fr" : "en"; };
    window.addEventListener("hashchange", () => { const h = location.hash.replace("#", "").split(",")[0]; if (site.ui[h] && h !== lang) applyLang(h); });

    const section = document.querySelector(".ccv"), inner = document.querySelector(".ccv__inner"), player = document.querySelector(".player");
    function fitPlayer() {
      if (innerWidth < 1024) { player.style.removeProperty("--video-h"); return; }
      const cs = getComputedStyle(section), gap = parseFloat(getComputedStyle(inner).columnGap) || 0;
      const hAvail = innerHeight - document.querySelector(".topnav").offsetHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - 2;
      const wAvail = section.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - 220 - 300 - 2 * gap;
      player.style.setProperty("--video-h", Math.max(320, Math.min(hAvail, wAvail * 16 / 9)) + "px");
    }
    window.addEventListener("resize", fitPlayer);
    if (document.fonts) document.fonts.ready.then(() => { fitPlayer(); chart.refresh(); });
    fitPlayer();

    t = chart.readyTime; applyLang(initialLang()); setState("stopped");
    requestAnimationFrame(frame);
    E.player = { seek, play, pause, stop, chart, get t() { return t; }, get state() { return state; } };   // pour les tests et l'intégration
  }

  // Démarrage une fois TOUS les scripts différés exécutés (moteur, modules annexes, module de graphique) : DOMContentLoaded les suit tous.
  if (document.readyState === "complete") boot();
  else { let started = false; const go = () => { if (!started) { started = true; boot(); } };
    document.addEventListener("DOMContentLoaded", go, { once: true }); window.addEventListener("load", go, { once: true }); }
})();
