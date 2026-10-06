/*
 * Step-flow : second mode de lecture, séquentiel. En « pas à pas », l'animation ne tourne plus en continu : le bouton Suivant la joue jusqu'à la carte
 * (arrêt sur image) suivante, où elle attend aussi longtemps qu'il le faut ; Précédent revient à la carte d'avant (puis à l'introduction).
 * Module optionnel : une page l'active avec "uses": ["step-flow"] dans sa spec (chart). Le graphique fournit la liste des arrêts (chart.stops() :
 * [{ t, id, title, hold }]) ; le module n'utilise que Engine.player (seek / play / pause / stop / state / t) et expose Engine.flow
 * { mode, index, total, t(), next(), back(), set() } que le graphique lit pour dessiner Précédent / Suivant sur la carte.
 * Interface : choix du flux sur la carte d'ouverture (.flowpick), barre Précédent / Suivant dans le panneau de commandes (.flowbar), flèches du clavier.
 */
(function () {
  "use strict";
  const E = window.Engine;
  const TXT = {
    en: { pick: "How do you want to follow it?", auto: "Continuous", step: "Step by step", start: "Start", back: "Back", next: "Next", restart: "Start over", keys: "← → keys", stepOf: "Step {n} / {N}", intro: "Introduction" },
    fr: { pick: "Comment veux-tu la suivre ?", auto: "En continu", step: "Pas à pas", start: "Commencer", back: "Précédent", next: "Suivant", restart: "Recommencer", keys: "touches ← →", stepOf: "Étape {n} / {N}", intro: "Introduction" },
  };
  const lang = () => (document.documentElement.lang === "fr" ? "fr" : "en");
  const tr = (k, v) => String(TXT[lang()][k] || k).replace(/\{(\w+)\}/g, (m, x) => (v && v[x] !== undefined ? v[x] : ""));
  const flow = (E.flow = { mode: "auto", index: -1, total: 0, t: tr, next, back, set });
  let P = null, chart = null, stops = [], lastT = 0, sig = "", pickEl = null, barEl = null;
  try { if (localStorage.getItem("ccv-flow") === "step") flow.mode = "step"; } catch (e) {}

  // ── position dans la séquence : dernier arrêt atteint (-1 avant le premier ou à l'introduction)
  function cur() {
    if (!P || P.state === "stopped") return -1;
    let i = -1; stops.forEach((s, k) => { if (P.t >= s.t - 0.02) i = k; }); return i;
  }
  function holdAt(t) { return chart.beats.find((b) => t >= b.t0 && t < b.t1) || null; }

  // ── Suivant : joue jusqu'à l'arrêt suivant (saute ce qui reste de l'arrêt en cours)
  function next() {
    if (!P) return;
    if (P.state === "stopped") { P.seek(0); P.play(true); return; }
    if (cur() >= stops.length - 1) { P.stop(); return; }   // dernier arrêt : on recommence à l'introduction
    const h = holdAt(P.t); if (h) P.seek(h.t1);
    P.play(true);
  }
  // ── Précédent : arrêt d'avant ; depuis le premier, retour à l'introduction
  function back() {
    if (!P || P.state === "stopped") return;
    const i = cur(); if (i < 0) { P.stop(); return; }
    const target = Math.abs(P.t - stops[i].t) < 0.15 || P.t < stops[i].t ? i - 1 : i;   // entre deux arrêts : retour au dernier atteint
    if (target < 0) { P.stop(); return; }
    P.seek(stops[target].t); P.pause();
  }
  function set(mode) {
    if (mode === flow.mode) return;
    flow.mode = mode; try { localStorage.setItem("ccv-flow", mode); } catch (e) {}
    sync(true);
  }

  // ── lecture : en pas à pas, la lecture s'arrête d'elle-même au premier arrêt franchi (jamais après un saut de l'utilisateur)
  function tick() {
    requestAnimationFrame(tick);
    if (!P) return;
    const t = P.t, dt = t - lastT;
    if (flow.mode === "step" && P.state === "playing" && dt > 0 && dt < 0.6) {
      const c = stops.find((s) => lastT < s.t && s.t <= t);
      if (c) { P.seek(c.t); P.pause(); }
    }
    lastT = P.t; sync(false);
  }

  // ── interface
  const icon = (d) => `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="${d}"/></svg>`;
  function build() {
    const copy = document.querySelector(".copy"), controls = document.querySelector(".controls"), readout = document.getElementById("ccv-readout");
    pickEl = document.createElement("div"); pickEl.className = "flowpick"; pickEl.setAttribute("role", "group");
    pickEl.innerHTML = `<span class="flowpick__label"></span><div class="flowpick__btns"><button type="button" data-flow="auto">${icon("M4 2.5v11l9-5.5z")}<b></b></button><button type="button" data-flow="step">${icon("M2.5 2.5v11l7-5.5zM10 2.5h2.5v11H10z")}<b></b></button></div>`;
    readout.insertAdjacentElement("afterend", pickEl);
    pickEl.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      set(b.dataset.flow);
      if (P.state === "stopped") { if (b.dataset.flow === "step") next(); else P.play(); }   // le choix lance aussi l'animation
    }));
    barEl = document.createElement("div"); barEl.className = "flowbar";
    barEl.innerHTML = `<button type="button" class="btn" data-act="back">${icon("M10.5 2.5v11l-8-5.5z")}<span></span></button><button type="button" class="btn btn--primary" data-act="next"><span></span>${icon("M3 2.5v11l7-5.5zM9 2.5v11l7-5.5z")}</button><p class="flowbar__n" aria-live="polite"></p>`;
    controls.insertAdjacentElement("afterend", barEl);
    barEl.querySelector('[data-act="back"]').addEventListener("click", back); barEl.querySelector('[data-act="next"]').addEventListener("click", next);
  }
  function sync(force) {
    flow.index = cur(); flow.total = stops.length;
    const s = [flow.mode, flow.index, P.state, lang()].join("|"); if (s === sig && !force) return; sig = s;
    document.querySelector(".ccv").classList.toggle("ccv--step", flow.mode === "step");
    pickEl.querySelector(".flowpick__label").textContent = tr("pick");
    pickEl.querySelectorAll("button").forEach((b) => { b.setAttribute("aria-pressed", String(b.dataset.flow === flow.mode)); b.querySelector("b").textContent = tr(b.dataset.flow); });
    const i = flow.index, atEnd = i >= stops.length - 1 && P.state !== "stopped", lab = barEl.querySelectorAll(".btn span");
    lab[0].textContent = tr("back"); lab[1].textContent = tr(P.state === "stopped" ? "start" : atEnd ? "restart" : "next");
    barEl.querySelector('[data-act="back"]').disabled = P.state === "stopped";
    const st = chart.stops(); barEl.querySelector(".flowbar__n").textContent = P.state === "stopped" ? tr("intro") : (i >= 0 ? tr("stepOf", { n: i + 1, N: stops.length }) + " · " + (st[i] ? st[i].title : "") : "");
  }

  function setup() {
    P = E.player; chart = P.chart; stops = chart.stops();
    build(); sync(true); lastT = P.t;
    // flèches du clavier (et Espace / Entrée) = Précédent / Suivant, seulement en pas à pas et hors champ de saisie
    window.addEventListener("keydown", (e) => {
      if (flow.mode !== "step" || e.altKey || e.ctrlKey || e.metaKey) return;
      const tag = (e.target.tagName || "").toLowerCase(); if (["input", "textarea", "select", "button", "a"].includes(tag)) return;
      if (e.key === "ArrowRight" || e.code === "Space" || e.key === "Enter") { e.preventDefault(); e.stopImmediatePropagation(); next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); e.stopImmediatePropagation(); back(); }
    }, true);
    new MutationObserver(() => { stops = chart.stops(); sync(true); }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });   // langue changée : titres et libellés
    requestAnimationFrame(tick);
  }
  const wait = setInterval(() => {
    if (E && E.player && E.player.chart && E.player.chart.stops && document.querySelector(".copy") && document.querySelector(".controls") && document.getElementById("ccv-readout")) { clearInterval(wait); setup(); }
  }, 50);
  setTimeout(() => clearInterval(wait), 15000);
})();
