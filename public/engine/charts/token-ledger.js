/*
 * token-ledger : la facture d'un agent IA, appel après appel. Chaque ligne = un appel au modèle ; chaque carré = un paquet d'environ
 * 1 000 tokens : entrée neuve (bleu), sortie (rose), entrée en cache = déjà vue, renvoyée telle quelle (gris).
 * Une tête de lecture balaie la ligne : le gris défile vite et ne coûte presque rien, le bleu coûte, le rose coûte le plus.
 * Module de graphique du moteur commun. Données : caching/data.json (tools/caching_data.py) :
 *   { toy: [ { hdr } | { id, tool, in: [[segment, n]], out: [[segment, n]], hold, miss?, edited?, mark? } | { pause, mark? } ],
 *     sub: { agents: [ { key, calls } ], pre, step, post }, real: [[contexte, cache lu, cache écrit, sortie], ...] }
 * Prix relatifs (spec.chart.price) : entrée neuve 1, sortie 5, cache lu 0,1, écriture du cache 1,25 (ordres de grandeur d'une API Claude).
 */
(function () {
  "use strict";
  const E = window.Engine, U = E.util, { clamp01, easeOut, easeInOut, rgb } = U;
  const TEXT = [250, 250, 245], MUTED = [183, 193, 169], ACCENT = [243, 237, 87], AMBER = [255, 190, 80], CORAL = [255, 122, 110], BGTOP = [32, 43, 36];
  const SANS = '"Source Sans 3","Segoe UI",system-ui,sans-serif', MONO = '"IBM Plex Mono",ui-monospace,monospace';
  const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); };
  const mmss = (s) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  const fitText = (c, s, maxW) => { if (c.measureText(s).width <= maxW) return s; while (s.length > 1 && c.measureText(s + "…").width > maxW) s = s.slice(0, -1); return s + "…"; };
  const qpt = (p0, p1, p2, u) => [(1 - u) * (1 - u) * p0[0] + 2 * (1 - u) * u * p1[0] + u * u * p2[0], (1 - u) * (1 - u) * p0[1] + 2 * (1 - u) * u * p1[1] + u * u * p2[1]];

  E.registerChart("token-ledger", {
    create(ctx) {
      const P = ctx.spec.chart, D = ctx.data, PR = P.price, TOK = P.tokPerSq, COL = ctx.spec.colors;
      const CL = { in: U.hex(COL.input), out: U.hex(COL.output), cache: U.hex(COL.cached) }; CL.redo = CL.in;
      const pW = (k) => (k === "cache" ? PR.read : k === "out" ? PR.out : PR.write);   // prix d'un carré, avec cache
      const pN = (k) => (k === "out" ? PR.out : PR.in);                               // prix d'un carré, sans cache

      // ───────────── appels : un objet par appel au modèle, dans l'ordre du temps ─────────────
      const calls = [], items = [], marks = {};
      function build(def, agent, seq) {
        const prefix = seq.map((s) => ({ seg: s, kind: def.miss ? "redo" : "cache" })), ins = [], outs = [];
        for (let i = 0; i < (def.edited || 0); i++) prefix[i].edited = true;
        def.in.forEach(([seg, n]) => { for (let i = 0; i < n; i++) ins.push({ seg, kind: "in" }); });
        def.out.forEach(([seg, n]) => { for (let i = 0; i < n; i++) outs.push({ seg, kind: "out" }); });
        seq.push(...ins.map((s) => s.seg), ...outs.map((s) => s.seg));
        const sq = [...prefix, ...ins, ...outs], g = prefix.length, nb = ins.length, np = outs.length;
        return { ...def, agent, sq, g, nb, np, len: sq.length,
          costW: g * (def.miss ? PR.write : PR.read) + nb * PR.write + np * PR.out, costN: (g + nb) * PR.in + np * PR.out };
      }
      function sched(cl, T0, H, beats) {   // instants d'apparition des carrés : relecture (gris) vite, puis entrée neuve (bleu), puis sortie (rose)
        const a = cl.g ? Math.min(0.42 * H, 0.16 + 0.03 * cl.g) : 0, rest = H * 0.9 - a, b = cl.nb ? (cl.np ? rest * 0.5 : rest) : 0, c = cl.np ? rest - b : 0;
        // arrêts sur image : l'animation se fige à l'instant de contenu u pendant d secondes (le reste du dessin continue de vivre), puis repart
        const fz = (beats || []).map((x) => ({ id: x.id, d: x.dur, u: x.at === "start" ? 0 : x.at === "sweep" ? a : x.at === "pink" ? a + b : H })).sort((p, q) => p.u - q.u);
        let acc = 0; fz.forEach((f) => { f.t0 = T0 + f.u + acc; f.t1 = f.t0 + f.d; acc += f.d; });
        const real = (u) => u + fz.reduce((n, f) => n + (f.u < u ? f.d : 0), 0);
        cl.T0 = T0; cl.Hc = H; cl.H = H + acc; cl.ph = { a, b, c }; cl.fz = fz; const f0 = fz.find((f) => f.u === 0); cl.tA = f0 ? f0.t1 : T0;
        cl.toC = (tau) => { let o = 0; for (const f of fz) { const r0 = f.u + o; if (tau < r0) return tau - o; if (tau < r0 + f.d) return f.u === 0 ? -0.5 : f.u; o += f.d; } return tau - o; };   // temps réel -> temps de contenu
        cl.ts = cl.sq.map((q, i) => T0 + real(i < cl.g ? a * (i / Math.max(1, cl.g)) : i < cl.g + cl.nb ? a + b * ((i - cl.g + 0.3) / cl.nb) : a + b + c * ((i - cl.g - cl.nb + 0.3) / cl.np)));
      }
      const tauOf = (cl, tt) => (cl.toC ? cl.toC(tt - cl.T0) : tt - cl.T0);
      // registre des arrêts sur image : liés à un appel (avant, après la relecture, sortie, fin) ou à un créneau autonome
      const BEATS = [], BYCALL = {}, BYSLOT = {};
      P.beats.forEach((b) => { if (b.call) (BYCALL[b.call] = BYCALL[b.call] || []).push(b); else BYSLOT[b.slot] = b; });
      let t0 = P.tIntro; const seq = [];
      const slot = (name) => { const b = BYSLOT[name]; if (!b) return; BEATS.push({ id: b.id, t0, t1: t0 + b.dur }); t0 += b.dur; };
      const ch4 = {};
      D.toy.forEach((def) => {
        if (def.mark) marks[def.mark] = t0;
        if (def.pause) { (def.before || []).forEach(slot); const first = def.mark === "ch4"; if (first) ch4.start = t0; t0 += def.pause; if (first) ch4.flip = t0; (def.after || []).forEach(slot); t0 += def.tail || 0; if (first) ch4.ready = t0; return; }
        if (def.hdr) { items.push({ type: "hdr", key: def.hdr, T: t0 }); return; }
        const cl = build(def, null, seq); sched(cl, t0, def.hold, BYCALL[def.id]); calls.push(cl); cl.fz.forEach((f) => BEATS.push({ id: f.id, t0: f.t0, t1: f.t1 }));
        if (cl.tA > t0 && items.length && items[items.length - 1].type === "hdr") items[items.length - 1].T = cl.tA; items.push({ type: "row", cl, T: cl.tA }); t0 += cl.H;
      });
      const nMain = calls.length;
      marks.ch6 = t0; t0 += D.sub.pre; slot("ch6a");
      const agents = D.sub.agents.map((a) => ({ key: a.key, defs: a.calls, seq: [], cls: [] })), nSteps = Math.max(...agents.map((a) => a.defs.length));
      for (let s = 0; s < nSteps; s++) {
        agents.forEach((a, ai) => { if (a.defs[s]) { const cl = build(a.defs[s], ai, a.seq); cl.row = s; sched(cl, t0, D.sub.step); calls.push(cl); a.cls.push(cl); } });
        t0 += D.sub.step;
      }
      slot("ch6b"); t0 += D.sub.post; marks.ch7 = t0;
      const tR0 = t0 + 0.9, tFirst = tR0 + 0.9; t0 = tFirst; slot("ch7a"); const tRs = t0; t0 += P.tReal; slot("ch7b"); slot("ch7c"); t0 += P.tRealHold; marks.ch8 = t0;
      BEATS.sort((p, q) => p.t0 - q.t0);
      const beatAt = (tt) => BEATS.find((f) => tt >= f.t0 && tt < f.t1) || null, beatT = (id) => (BEATS.find((f) => f.id === id) || { t0: 0 }).t0;
      const TG = {};   // cibles des projecteurs, mises à jour par les fonctions de dessin à chaque image
      const duration = t0 + P.tConc, nSub = calls.length - nMain;
      const subStart = calls[nMain].T0, byId = Object.fromEntries(calls.filter((c) => c.id).map((c) => [c.id, c]));

      // ───────────── la vraie trace : coûts cumulés ─────────────
      const REAL = D.real, NR = REAL.length, R = { w: [], n: [], cr: [], ctx: [], max: Math.max(...REAL.map((r) => r[0] + r[3])) };
      { let w = 0, n = 0, cr = 0, cx = 0; REAL.forEach(([ctxT, rd, wr, out]) => {
          w += rd * PR.read + wr * PR.write + (ctxT - rd - wr) * PR.in + out * PR.out; n += ctxT * PR.in + out * PR.out; cr += rd; cx += ctxT;
          R.w.push(w); R.n.push(n); R.cr.push(cr); R.ctx.push(cx); }); }
      const realIn = REAL.reduce((s, r) => s + r[0] - r[1], 0), realOut = REAL.reduce((s, r) => s + r[3], 0);
      const toyMain = calls.slice(0, nMain).filter((c) => /^[AB]/.test(c.id));
      const toySave = 1 - toyMain.reduce((s, c) => s + c.costW, 0) / toyMain.reduce((s, c) => s + c.costN, 0), realSave = 1 - R.w[NR - 1] / R.n[NR - 1];
      const bill = { n: toyMain.reduce((s, c) => s + c.costN, 0), w: toyMain.reduce((s, c) => s + c.costW, 0) };

      // ───────────── chapitres ─────────────
      const chapters = [{ t: 0, chip: false, num: null }];
      ["ch1", "ch2", "ch3", "ch4", "ch5", "ch6", "ch7"].forEach((k, i) => chapters.push({ t: marks[k], chip: true, num: String(i + 1).padStart(2, "0") }));
      chapters.push({ t: marks.ch8, chip: true, num: null });
      const chapterAt = (t) => { let i = 0; chapters.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
      const readyTime = ch4.ready - 0.8;

      // ───────────── état à l'instant t (coûts cumulés, compteurs) ─────────────
      const memo = { t: null, s: null };
      function stateAt(t) {
        if (memo.t === t) return memo.s;
        const s = { calls: 0, cw: 0, cn: 0, tin: 0, tout: 0, tcache: 0, pts: [[0, 0, 0]] };
        for (const cl of calls) {
          if (cl.tA > t) break;
          let cnt = 0, rw = 0, rn = 0;
          cl.sq.forEach((q, i) => { if (t >= cl.ts[i]) { cnt++; rw += pW(q.kind); rn += pN(q.kind); if (q.kind === "out") s.tout++; else if (q.kind === "cache") s.tcache++; else s.tin++; } });
          s.cw += rw; s.cn += rn; s.pts.push([s.calls + cnt / cl.len, s.cw, s.cn]); s.calls++;
        }
        memo.t = t; memo.s = s; return s;
      }
      const realCount = (t) => (t < tFirst ? clamp01((t - tR0) / 0.9) : t < tRs ? 1 : 1 + (NR - 1) * easeInOut(clamp01((t - tRs) / P.tReal))), inReal = (t) => t >= marks.ch7 + 0.4;
      function realState(t) {
        const f = realCount(t), k = Math.floor(f), fr = f - k, at = (a, i) => (i < 0 ? 0 : a[Math.min(i, NR - 1)]), pts = [[0, 0, 0]];
        for (let i = 0; i < k; i++) pts.push([i + 1, R.w[i], R.n[i]]);
        if (k < NR && fr > 0) pts.push([f, at(R.w, k - 1) + (R.w[k] - at(R.w, k - 1)) * fr, at(R.n, k - 1) + (R.n[k] - at(R.n, k - 1)) * fr]);
        const last = pts[pts.length - 1], i = Math.min(NR, Math.max(0, Math.round(f)));
        return { f, pts, cw: last[1], cn: last[2], share: i ? R.cr[i - 1] / R.ctx[i - 1] : 0 };
      }

      // ───────────── mise en page ─────────────
      const host = E.host(ctx.canvas);
      let t = readyTime, lay = null, hov = null, geom = [], cardGeom = null, cardOff = { k: -1, dx: 0, dy: 0 };
      let K = 1;   // échelle du contenu : plus la zone est grande, plus textes et formes grossissent (au lieu de seulement s'espacer)
      const dim = () => ({ W: host.W / K, H: host.H / K });
      const setLay = () => {
        K = P.scale || Math.max(1, Math.min(1.5, 0.95 * Math.sqrt(host.W * host.H / (564 * 1003))));   // P.scale : échelle imposée (rendu vidéo, tools/caching_video.py)
        const { W, H } = dim(), small = W < 420, wide = !small && W >= H * 0.8, pad = small ? 10 : 12, tileH = small ? 42 : 48, tileY = small ? 34 : 38, topY = tileY + tileH + 4;
        const topH = wide ? Math.max(150, H * 0.24) : Math.max(124, H * 0.235), ledY = topY + topH + 6, ledH = wide ? Math.max(150, Math.min(H * 0.42, H - 32 - 112 - ledY)) : H * 0.36, curY = ledY + ledH + 8;
        lay = { sz: small ? 1.15 : wide ? 1.45 : 1.3, small, wide, pad, fs: small ? 10 : 12, tileH, tileY, top: { y: topY, h: topH }, led: { y: ledY, h: ledH }, cur: { y: curY, h: H - 24 - curY }, gutL: small ? 46 : 58, gutR: small ? 0 : 36,
          pMax: small ? 28 : wide ? 46 : 36, sMax: small ? 24 : wide ? 44 : 30, subS: wide ? 24 : 14, subP: small ? 20 : wide ? 36 : 26 };
      };
      host.onResize = setLay;
      host.onLeave = () => { hov = null; host.dirty = true; };
      const ledgerOn = (tt) => tt < marks.ch6 + 0.4;
      host.onMove = (px, py) => {
        const { L, fmt } = ctx.lang(), x = px / K, y = py / K; let h = null;
        if (beatAt(t)) { if (hov) { hov = null; host.dirty = true; } host.hideTip(); if (!dragging) ctx.canvas.style.cursor = cardGeom && inRect(x, y, cardGeom) ? (onBtn(x, y) ? "pointer" : "grab") : ""; return; }
        ctx.canvas.style.cursor = "";
        if (ledgerOn(t) && t < marks.ch8 - 0.2) geom.forEach((g) => {
          if (Math.abs(y - g.y) < g.pitch / 2 && x >= g.x0 && x < g.x0 + g.cl.len * g.s) { const i = Math.floor((x - g.x0) / g.s); if (t >= g.cl.ts[i]) h = { cl: g.cl, i }; } });
        if ((h && h.cl.id) !== (hov && hov.cl.id) || (h && h.i) !== (hov && hov.i)) { hov = h; host.dirty = true; }
        if (!h) { host.hideTip(); return; }
        const q = h.cl.sq[h.i], after = q.kind === "cache" || q.kind === "redo" ? h.cl.g - 1 - h.i : 0, extra = after * (PR.write - PR.read);
        const price = { cache: PR.read, in: PR.write, redo: PR.write, out: PR.out }[q.kind];
        host.showTip(`<b>${L.tip.call} #${calls.indexOf(h.cl) + 1} · ${L.seg[q.seg]}</b><div class="dim">${L.kind[q.kind]} · ×${String(price).replace(".", ["fr", "ro"].includes(ctx.lang().code) ? "," : ".")}</div>` +
          (q.kind === "cache" ? `<div class="dim">${U.tpl(L.tip.what, { n: after, k: after * TOK / 1000, x: extra.toFixed(1).replace(".", ["fr", "ro"].includes(ctx.lang().code) ? "," : ".") })}</div>` : "") +
          `<div class="dim">${L.tip.click}</div>`, px, py);
      };
      host.onClick = () => { if (!beatAt(t) && hov) ctx.seek(hov.cl.T0 + 0.02); };
      // carte des pauses : déplaçable à la souris, boutons Pause / Reprendre et Continuer
      let dragging = null;
      const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h, onBtn = (x, y) => (cardGeom && (inRect(x, y, cardGeom.bPause) ? "pause" : inRect(x, y, cardGeom.bSkip) ? "skip" : null)) || null;
      const logical = (e) => { const r = ctx.canvas.getBoundingClientRect(); return [(e.clientX - r.left) / K, (e.clientY - r.top) / K]; };
      function pressButton(which) {
        const P = E.player; if (!P || !cardGeom) return;
        if (E.flow && E.flow.mode === "step") { if (which === "pause") E.flow.back(); else E.flow.next(); host.dirty = true; return; }   // flux pas à pas (engine/step-flow.js)
        if (which === "pause") { if (P.state === "playing") P.pause(); else P.play(true); }
        else { ctx.seek(cardGeom.b.t1 + 0.01); if (P.state !== "playing") P.play(true); }
        host.dirty = true;
      }
      ctx.canvas.addEventListener("pointerdown", (e) => {
        if (!cardGeom || !beatAt(t) || (e.pointerType === "mouse" && e.button !== 0)) return;
        const [x, y] = logical(e); if (!inRect(x, y, cardGeom)) return;
        const btn = onBtn(x, y); if (!btn && e.pointerType !== "mouse") return;   // au doigt : boutons seulement (le glisser garde le défilement de la page)
        e.preventDefault(); try { ctx.canvas.setPointerCapture(e.pointerId); } catch (err) {}
        dragging = { btn, sx: x, sy: y, ox: cardOff.dx, oy: cardOff.dy }; if (!btn) ctx.canvas.style.cursor = "grabbing";
      });
      ctx.canvas.addEventListener("pointermove", (e) => {
        if (!dragging || dragging.btn) return; const [x, y] = logical(e); cardOff.dx = dragging.ox + x - dragging.sx; cardOff.dy = dragging.oy + y - dragging.sy; host.dirty = true;
      });
      const endDrag = (e) => {
        if (!dragging) return; const d = dragging; dragging = null; ctx.canvas.style.cursor = "";
        if (d.btn) { const [x, y] = logical(e); if (onBtn(x, y) === d.btn) pressButton(d.btn); }
      };
      ctx.canvas.addEventListener("pointerup", endDrag); ctx.canvas.addEventListener("pointercancel", () => { dragging = null; ctx.canvas.style.cursor = ""; });

      // ───────────── dessin : tuiles ─────────────
      function tiles(c, al, st, rs, real, L, code) {
        const { W } = dim(), { pad, tileH, tileY, small } = lay, gap = 6, tw = (W - 2 * pad - 2 * gap) / 3, dec = ["fr", "ro"].includes(code) ? "," : ".";
        const n = real ? Math.round(rs.f) : st.calls, cached = real ? rs.share : (st.tcache + st.tin ? st.tcache / (st.tcache + st.tin) : 0), cw = real ? rs.cw : st.cw, cn = real ? rs.cn : st.cn;
        const sav = cn > 0 ? 1 - cw / cn : 0, savTxt = (sav >= 0 ? "−" : "+") + Math.abs(Math.round(sav * 100)) + (code === "fr" ? " %" : "%");
        const vals = [[String(n), TEXT, L.tiles[0]], [Math.round(cached * 100) + (code === "fr" ? " %" : "%"), [150, 168, 186], L.tiles[1]], [cn > 0 ? savTxt : "–", sav >= 0 ? ACCENT : CORAL, L.tiles[2]]];
        vals.forEach(([v, col, lab], i) => { const x = pad + i * (tw + gap), h = tileH - 6;
          c.fillStyle = rgb([255, 255, 255], 0.05 * al); c.strokeStyle = rgb([255, 255, 255], 0.09 * al); c.lineWidth = 1; rr(c, x, tileY, tw, h, 10); c.fill(); c.stroke();
          c.textAlign = "center"; c.font = `700 ${small ? 17 : 21}px ${MONO}`; c.fillStyle = rgb(col, al); c.fillText(v, x + tw / 2, tileY + h * 0.42);
          c.font = `400 ${small ? 9 : 10.5}px ${SANS}`; c.fillStyle = rgb(MUTED, al); c.fillText(lab, x + tw / 2, tileY + h * 0.8); });
      }

      // ───────────── dessin : scène de l'agent (invite → harnais / modèle ↔ outil) ─────────────
      const hexPath = (c, cx, cy, r) => { c.beginPath(); for (let i = 0; i < 6; i++) { const a = -Math.PI / 2 + i * Math.PI / 3; i ? c.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a)) : c.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a)); } c.closePath(); };
      const fitFont = (c, txt, maxW, size, weight) => { let f = size; c.font = `${weight} ${f}px ${SANS}`; while (f > 8 && c.measureText(txt).width > maxW) { f -= 0.5; c.font = `${weight} ${f}px ${SANS}`; } return f; };   // taille de police maximale qui tient dans maxW
      function flow(c, p0, p1, p2, color, light, tt, rev, z) {
        z = z || 1;
        c.save(); c.strokeStyle = rgb(color, 0.16 + 0.84 * light); c.lineWidth = 1.5 * z; c.setLineDash([5 * z, 4 * z]); c.lineDashOffset = (rev ? 1 : -1) * tt * 22;
        c.beginPath(); c.moveTo(p0[0], p0[1]); c.quadraticCurveTo(p1[0], p1[1], p2[0], p2[1]); c.stroke(); c.restore();
        if (light > 0.05) for (let i = 0; i < 4; i++) { const u0 = ((tt * 0.9 + i / 4) % 1), u = rev ? 1 - u0 : u0, p = qpt(p0, p1, p2, u); c.fillStyle = rgb(color, light * Math.sin(Math.PI * u0)); c.fillRect(p[0] - 2.5 * z, p[1] - 2.5 * z, 5 * z, 5 * z); }
        const e = rev ? p0 : p2, d = rev ? [p0[0] - p1[0], p0[1] - p1[1]] : [p2[0] - p1[0], p2[1] - p1[1]], an = Math.atan2(d[1], d[0]), h = 7 * z;
        c.fillStyle = rgb(color, 0.3 + 0.7 * light); c.beginPath(); c.moveTo(e[0], e[1]); c.lineTo(e[0] - h * Math.cos(an - 0.4), e[1] - h * Math.sin(an - 0.4)); c.lineTo(e[0] - h * Math.cos(an + 0.4), e[1] - h * Math.sin(an + 0.4)); c.closePath(); c.fill();
      }
      function scene(c, tt, al, L) {
        const { W: WW } = dim(), W = lay.wide ? Math.min(WW, 860) : WW, X0 = (WW - W) / 2, S = lay.top, { pad, small } = lay, z = lay.sz;   // z : facteur de taille de la scène (textes, formes, traits)
        c.save(); c.translate(X0, 0);
        const cx = W * 0.5, cy = S.y + S.h * 0.46, r = Math.min(24 * z, S.h * 0.2), bw = Math.min(106 * z, W * 0.27), bh = (small ? 20 : 24) * z, fs = (small ? 10 : 11.5) * z;
        const intro = easeOut(tt / 0.8), harA = easeOut((tt - beatT("harness")) / 0.6), loopA = easeOut((tt - beatT("loop")) / 0.5);
        let cl = null; for (let i = 0; i < nMain; i++) if (calls[i].T0 <= tt) cl = calls[i];
        const k = cl ? calls.indexOf(cl) : -1, tau = cl ? tauOf(cl, tt) : -1, ph = cl ? cl.ph : { a: 0, b: 0, c: 0 }, beatNow = beatAt(tt);
        const act = (s, e) => cl ? clamp01((tau - s + 0.12) / 0.2) * clamp01((e + 0.5 - tau) / 0.5) : 0;
        const aRe = act(0, ph.a), aIn = beatNow && beatNow.id === "result" ? 1 : cl && cl.nb ? act(ph.a, ph.a + ph.b) : 0, aOut = act(ph.a + ph.b, ph.a + ph.b + ph.c);
        const fromPrompts = cl && cl.id === "A1", fromUser = cl && cl.id === "B1", fromTool = cl && !fromPrompts && !fromUser;
        const prevTool = k > 0 ? calls[k - 1].tool : "read";
        // harnais
        const hw = W * (small ? 0.4 : lay.wide ? 0.36 : 0.4), hh = S.h * 0.9, hx = cx - hw / 2, hy = S.y + (S.h - hh) / 2;
        Object.assign(TG, { model: { x: X0 + cx, y: cy - 4 * z, r: r + 16 * z }, harness: { x: X0 + hx - 6, y: hy - 6, w: hw + 12, h: hh + 12 } });
        c.globalAlpha = al * harA; c.fillStyle = rgb([255, 255, 255], 0.045); c.strokeStyle = rgb([255, 255, 255], 0.2); c.lineWidth = 1; rr(c, hx, hy, hw, hh, 10 * z); c.fill(); c.stroke();
        c.fillStyle = rgb(MUTED, 1); c.font = `600 ${(small ? 8.5 : 9.5) * z}px ${SANS}`; c.textAlign = "center"; if ("letterSpacing" in c) c.letterSpacing = `${1.5 * z}px`; c.fillText(L.harness, cx, hy + 12 * z); if ("letterSpacing" in c) c.letterSpacing = "0px";
        c.globalAlpha = al;
        // invites (gauche)
        const boxes = [[L.sysPrompt, S.y + S.h * 0.2, fromPrompts ? aIn : 0], [L.userPrompt, S.y + S.h * 0.58, fromPrompts || fromUser ? aIn : 0]];
        boxes.forEach(([lab, y, lit], i) => {
          const ghost = cl && !(fromPrompts || (fromUser && i === 1)) ? 0.3 : 1; c.globalAlpha = al * intro * ghost; c.fillStyle = rgb([255, 255, 255], 0.08 + 0.1 * lit); c.strokeStyle = rgb(CL.in, 0.25 + 0.7 * lit); c.lineWidth = 1.2; rr(c, pad, y - bh / 2, bw, bh, 7 * z); c.fill(); c.stroke();
          c.fillStyle = rgb(TEXT, 0.95); c.textAlign = "center"; fitFont(c, lab, bw - 10, fs * 0.95, 500); c.fillText(lab, pad + bw / 2, y);
          c.globalAlpha = al * intro * (cl && ghost < 1 ? 0.35 : 1); flow(c, [pad + bw, y], [cx - hw * 0.45, y], [cx - r - 3 * z, cy - 5 * z + i * 10 * z], CL.in, lit, tt, false, z); });
        c.globalAlpha = al;
        // modèle
        c.globalAlpha = al * intro; hexPath(c, cx, cy - 4 * z, r); c.fillStyle = "#000"; c.fill(); c.strokeStyle = rgb([255, 255, 255], 0.3); c.lineWidth = 1.5; c.stroke();
        c.fillStyle = "#fff"; c.font = `700 ${(small ? 9.5 : 11) * z}px ${SANS}`; c.textAlign = "center"; c.fillText(L.model, cx, cy - 3 * z);
        // raisonnement (boucle rose) : étiquette à droite de la boucle (sous la boucle sur téléphone, faute de place)
        const bt = beatAt(tt), think = (bt && bt.id === "loop") || (cl && cl.sq.some((q) => q.seg === "think" && tt >= cl.ts[cl.sq.indexOf(q)])) ? 1 : 0.2, ax = cx + r * 0.85, ay = cy + r * 0.75, ar = 8 * z;
        c.globalAlpha = al * intro * loopA * (0.25 + 0.75 * think); c.strokeStyle = rgb(CL.out, 1); c.lineWidth = 1.4 * z; c.setLineDash([3 * z, 3 * z]); c.lineDashOffset = -tt * 14;
        c.beginPath(); c.arc(ax, ay, ar, -1.2, 3.6); c.stroke(); c.setLineDash([]);
        c.fillStyle = rgb(CL.out, 1); c.font = `600 ${(small ? 9 : 10.5) * z}px ${SANS}`; c.textAlign = "left";
        if (small) { c.fillText(L.reasoning, cx - r * 0.2, cy + r + 11 * z); TG.loop = { x: X0 + cx - r * 0.5, y: cy + r * 0.1, w: Math.max(r * 2, 76 * z), h: r * 0.9 + 18 * z }; }
        else { const lw = c.measureText(L.reasoning).width, lx = ax + ar + 7 * z; c.fillText(L.reasoning, lx, ay + 1); TG.loop = { x: X0 + ax - ar - 8 * z, y: ay - ar - 8 * z, w: lx + lw - ax + ar + 16 * z, h: 2 * ar + 16 * z }; }
        c.globalAlpha = al;
        // outil / réponse (droite)
        const tx = W - pad - bw, ty = cy - 4 * z; TG.tool = { x: X0 + cx + r + 2, y: ty - bh / 2 - 16 * z, w: tx + bw - cx - r + 6, h: bh + 38 * z }; const toolKey = aIn > aOut && fromTool ? prevTool : cl ? cl.tool : "read", ansBox = cl ? (aIn > aOut && fromTool ? prevTool : cl.tool) === "answer" : false;
        const toolA = cl ? (cl.id === "A1" ? clamp01((tau - (ph.a + ph.b) + 0.4) / 0.5) : 1) : 0; c.globalAlpha = al * toolA;
        c.fillStyle = ansBox ? rgb(AMBER, 0.2) : "#000"; c.strokeStyle = rgb(ansBox ? AMBER : [255, 255, 255], ansBox ? 0.8 : 0.3); c.lineWidth = 1.2; rr(c, tx, ty - bh / 2 - 3 * z, bw, bh + 6 * z, 7 * z); c.fill(); c.stroke();
        c.fillStyle = ansBox ? rgb(AMBER, 1) : "#fff"; c.font = `500 ${fs * 0.95}px ${SANS}`; c.textAlign = "center";
        const tl = ansBox ? L.response : L.tools[toolKey], ls = tl.split("|"); ls.forEach((s, i) => { fitFont(c, s, bw - 8, fs * 0.95, 500); c.fillText(s, tx + bw / 2, ty + (i - (ls.length - 1) / 2) * fs * 1.1); });
        c.globalAlpha = al * toolA;
        flow(c, [cx + r + 3 * z, cy - 9 * z], [tx - (tx - cx - r) * 0.5, cy - 12 * z], [tx - 4 * z, cy - 9 * z], CL.out, fromTool || cl ? aOut : 0, tt, false, z);
        flow(c, [tx - 4 * z, cy + 7 * z], [tx - (tx - cx - r) * 0.5, cy + 10 * z], [cx + r + 3 * z, cy + 7 * z], CL.in, fromTool ? aIn : 0, tt, false, z);
        // commentaire de la phase en cours (relecture / nouveau / écrit)
        let cap = "", capCol = MUTED;
        if (cl && tau >= 0) { const a = cl.g ? aRe : 0;
          if (a >= aIn && a >= aOut && a > 0.05) { cap = U.tpl(L.phase.reread, { n: cl.g * TOK / 1000 }); capCol = [170, 186, 202]; }
          else if (aIn >= aOut && aIn > 0.05) { cap = U.tpl(L.phase.new, { n: cl.nb * TOK / 1000 }); capCol = CL.in; }
          else if (aOut > 0.05) { cap = U.tpl(L.phase.written, { n: cl.np * TOK / 1000 }); capCol = CL.out; } }
        c.globalAlpha = al; c.fillStyle = rgb(capCol, 1); c.font = `600 ${(small ? 9 : 10.5) * z}px ${MONO}`; c.textAlign = "center"; c.fillText(cap, cx, hy + hh - 11 * z);
        c.globalAlpha = 1; c.restore();
      }

      // ───────────── dessin : bandeau des prix + message ─────────────
      function message(tt, code) {
        if (tt >= marks.ch7) return ["real", { p: Math.round(R.cr[NR - 1] / R.ctx[NR - 1] * 100), r: (R.n[NR - 1] / R.w[NR - 1]).toFixed(1).replace(".", ["fr", "ro"].includes(code) ? "," : ".") }];
        if (tt >= marks.ch5) { const e2 = byId.E2.T0, e3 = byId.E3.T0; return tt < e2 ? ["edit", { k: byId.E1.g * TOK / 1000, x: (byId.E1.g * (PR.write - PR.read)).toFixed(0) }] : tt < e3 ? ["back", {}] : ["idle", {}]; }
        return tt < ch4.flip ? ["first", {}] : ["bill", { n: Math.round(bill.n), w: Math.round(bill.w), s: Math.round(toySave * 100) }];
      }
      function prices(c, tt, al, L, code) {
        const { W } = dim(), S = lay.top, { pad, small } = lay, dec = ["fr", "ro"].includes(code) ? "," : ".", gap = 6, cw = (W - 2 * pad - 2 * gap) / 3, chH = small ? 38 : 48;
        c.globalAlpha = al; TG.chips = { x: pad - 4, y: S.y, w: W - 2 * pad + 8, h: chH + 8 };
        [["in", PR.in, L.priceNames[0]], ["out", PR.out, L.priceNames[1]], ["cache", PR.read, L.priceNames[2]]].forEach(([k, v, name], i) => { const x = pad + i * (cw + gap), y = S.y + 4;
          c.fillStyle = rgb(CL[k], 0.12); c.strokeStyle = rgb(CL[k], 0.6); c.lineWidth = 1; rr(c, x, y, cw, chH, 9); c.fill(); c.stroke();
          c.fillStyle = rgb(CL[k], 1); const sq = small ? 9 : 11; c.fillRect(x + 9, y + chH / 2 - sq / 2, sq, sq);
          c.textAlign = "left"; c.font = `700 ${small ? 15 : 19}px ${MONO}`; c.fillStyle = rgb(TEXT, 1); c.fillText("×" + String(v).replace(".", dec), x + 9 + sq + 6, y + chH * 0.4);
          c.font = `500 ${small ? 8.5 : 10}px ${SANS}`; c.fillStyle = rgb(MUTED, 1); c.fillText(name, x + 9 + sq + 6, y + chH * 0.75); });
        const [mk, mv] = message(tt, code), msg = U.tpl(L.msg[mk], mv), my = S.y + 4 + chH + 8, mh = S.h - chH - 12;
        const warm = mk === "edit" || mk === "idle" ? CORAL : mk === "back" ? ACCENT : AMBER, since = mk === "first" ? tt - ch4.start : mk === "bill" ? tt - ch4.flip : mk === "edit" ? tt - marks.ch5 : mk === "back" ? tt - byId.E2.T0 : mk === "idle" ? tt - byId.E3.T0 : tt - marks.ch7, k = easeOut(since / 0.35);
        c.fillStyle = rgb([36, 44, 37], 0.96); c.strokeStyle = rgb(warm, 0.75 * k); c.lineWidth = 1.5; rr(c, pad, my, W - 2 * pad, mh, 12); c.fill(); c.stroke();
        c.font = `600 ${small ? 11.5 : lay.wide ? 18 : 15}px ${SANS}`; c.fillStyle = rgb(warm, k); c.textAlign = "left"; const lines = U.wrap(c, msg, W - 2 * pad - 24), lh = small ? 16 : lay.wide ? 25 : 21, y0 = my + mh / 2 - (lines.length - 1) * lh / 2;
        lines.forEach((ln, i) => c.fillText(ln, pad + 12, y0 + i * lh));
        c.globalAlpha = 1;
      }

      // ───────────── dessin : carrés ─────────────
      function drawSquare(c, q, x, y, s, ts, tt, isHover, dimPrefix) {
        const pop = easeOut((tt - ts) / 0.18); if (pop <= 0) return;
        const gap = s > 10 ? 1.8 : 1.1, side = Math.max(2, (s - gap) * (0.55 + 0.45 * pop)), glow = clamp01(1 - (tt - ts) / 0.4);
        let col = CL[q.kind]; if (q.seg === "sys") col = U.mix(col, [8, 20, 32], 0.32); if (glow > 0) col = U.mix(col, [255, 255, 255], 0.55 * glow);
        c.fillStyle = rgb(col, pop); c.fillRect(x + (s - gap - side) / 2, y - side / 2, side, side);
        if (q.kind === "redo") { c.strokeStyle = rgb([255, 255, 255], 0.45 * pop); c.lineWidth = 1; c.strokeRect(x + (s - gap - side) / 2 + 0.5, y - side / 2 + 0.5, side - 1, side - 1); }
        if (q.edited) { c.strokeStyle = rgb(AMBER, pop); c.lineWidth = 2; c.strokeRect(x + (s - gap - side) / 2 - 1, y - side / 2 - 1, side + 2, side + 2); }
        if (dimPrefix) { c.fillStyle = rgb([255, 255, 255], 0.22); c.fillRect(x + (s - gap - side) / 2, y - side / 2, side, side); }
        if (isHover) { c.strokeStyle = "#fff"; c.lineWidth = 1.6; c.strokeRect(x + (s - gap - side) / 2 - 1, y - side / 2 - 1, side + 2, side + 2); }
      }
      function ledgerHead(c, al, L) {
        const { W } = dim(), { pad, small, fs } = lay, y = lay.led.y + 6; c.globalAlpha = al; c.textBaseline = "middle";
        if (!small) { c.textAlign = "left"; c.font = `600 ${fs - 2}px ${SANS}`; c.fillStyle = rgb(MUTED, 1); c.fillText(L.ledgerTitle, pad, y); }
        let lx = W - pad; c.textAlign = "right"; c.font = `400 ${fs - 2.5}px ${SANS}`;
        [["cache", L.legendShort[2]], ["out", L.legendShort[1]], ["in", L.legendShort[0]]].forEach(([k, lab]) => { c.fillStyle = rgb(MUTED, 1); c.fillText(lab, lx, y); const w = c.measureText(lab).width; c.fillStyle = rgb(CL[k], 1); c.fillRect(lx - w - 11, y - 3.5, 7, 7); lx -= w + 22; });
        c.globalAlpha = 1;
      }
      function toyLedger(c, tt, al, L, st) {
        const { W } = dim(), { pad, small, fs, gutL, gutR } = lay, top = lay.led.y + 18, H = lay.led.h - 18, availW = W - 2 * pad - gutL - gutR;
        geom = []; let nv = 0, lenF = 6; const A = items.map((it) => easeOut((tt - it.T) / 0.35));
        items.forEach((it, i) => { nv += A[i]; if (it.type === "row") lenF = Math.max(lenF, it.cl.len * easeOut((tt - it.T) / 0.7)); });
        const pitch = Math.max(small ? 11 : 12, Math.min(lay.pMax, H / Math.max(nv, 3))), s = Math.max(4, Math.min(lay.sMax, availW / lenF, pitch - 2.5));
        let pos = 0; c.globalAlpha = al; c.textBaseline = "middle";
        items.forEach((it, i) => {
          if (A[i] <= 0.01) return; const y = top + (pos + 0.5) * pitch; pos += A[i];
          if (it.type === "hdr") {
            c.font = `500 ${small ? 9.5 : 11}px ${SANS}`; const txt = "▸ " + L.req[it.key], w = Math.min(W - 2 * pad, c.measureText(txt).width + 18), a = A[i];
            c.fillStyle = rgb([255, 255, 255], 0.06 * a); rr(c, pad, y - Math.min(pitch, 20) / 2, w, Math.min(pitch, 20) - 2, 7); c.fill();
            c.textAlign = "left"; c.fillStyle = rgb(TEXT, 0.9 * a); c.fillText(fitText(c, txt, W - 2 * pad - 14), pad + 8, y - 1); return; }
          const cl = it.cl, x0 = pad + gutL, a = A[i], isH = hov && hov.cl === cl; geom.push({ cl, y, x0, s, pitch });
          if (isH) { c.fillStyle = rgb([255, 255, 255], 0.06); rr(c, 2, y - pitch / 2 + 1, W - 4, pitch - 2, 5); c.fill(); }
          c.textAlign = "left"; c.font = `400 ${small ? 8.5 : 10}px ${MONO}`; c.fillStyle = rgb(cl.miss ? CORAL : MUTED, a); c.fillText(fitText(c, L.tools[cl.tool].split("|")[0], gutL - 4), pad, y);
          cl.sq.forEach((q, j) => drawSquare(c, q, x0 + j * s, y, s, cl.ts[j], tt, isH && hov.i === j, isH && hov.i < j && (q.kind === "cache" || q.kind === "redo")));
          const head = cl.g ? clamp01(tauOf(cl, tt) / Math.max(0.01, cl.ph.a)) : 1;
          if (cl.g && head > 0 && head < 1) { const hx = x0 + cl.g * s * head; c.fillStyle = rgb([255, 255, 255], 0.9); c.fillRect(hx - 1, y - s / 2 - 2, 2, s + 4); }
          if (!small && gutR) { const done = clamp01(tauOf(cl, tt) / cl.Hc), v = cl.costW * easeOut(done * 1.15); c.textAlign = "right"; c.font = `500 ${fs - 2}px ${MONO}`; c.fillStyle = rgb(cl.miss ? CORAL : ACCENT, 0.9 * a); c.fillText("+" + (v >= 10 ? Math.round(v) : v.toFixed(1)).toString().replace(".", ["fr", "ro"].includes(ctx.lang().code) ? "," : "."), W - pad, y); }
        });
        c.globalAlpha = 1;
      }
      function subLedger(c, tt, al, L) {
        const { W } = dim(), { pad, small, fs } = lay, top = lay.led.y + 18, H = lay.led.h - 18, gap = 8, cw = (W - 2 * pad - 2 * gap) / 3, maxLen = 13, s = Math.min(lay.subS, (cw - 2) / maxLen), pitch = Math.min(lay.subP, H / 6.5);
        c.globalAlpha = al; c.textBaseline = "middle"; TG.subs = { x: pad - 6, y: top - 8, w: W - 2 * pad + 12, h: Math.min(H, 28 + 5 * pitch + 8) + 8 };
        agents.forEach((a, ai) => { const x0 = pad + ai * (cw + gap), ap = easeOut((tt - subStart + 0.2) / 0.4);
          c.fillStyle = rgb([255, 255, 255], 0.05 * ap); c.strokeStyle = rgb([255, 255, 255], 0.1 * ap); c.lineWidth = 1; rr(c, x0 - 3, top - 4, cw + 6, Math.min(H, 28 + 5 * pitch + 8), 8); c.fill(); c.stroke();
          c.textAlign = "left"; c.font = `600 ${small ? 8.5 : 10}px ${SANS}`; c.fillStyle = rgb(TEXT, 0.9 * ap); c.fillText(fitText(c, L.subs[a.key], cw - 2), x0, top + 6);
          a.cls.forEach((cl, j) => { const y = top + 22 + j * pitch; cl.sq.forEach((q, i) => drawSquare(c, q, x0 + i * s, y, s, cl.ts[i], tt, false, false)); }); });
        c.globalAlpha = 1;
      }
      function fan(c, tt, al, L) {
        const { W } = dim(), S = lay.top, { pad, small } = lay, bw = Math.min(W * 0.7, 270), bh = small ? 34 : 42, cw = (W - 2 * pad - 16) / 3, k = easeOut((tt - marks.ch6) / 0.5);
        c.globalAlpha = al; c.textBaseline = "middle"; TG.fan = { x: W / 2 - bw / 2 - 6, y: S.y + 1, w: bw + 12, h: bh + 10 };
        for (let i = 0; i < 3; i++) { const x = pad + cw / 2 + i * (cw + 8), y0 = S.y + 6 + bh, y1 = lay.led.y + 18; c.strokeStyle = rgb(AMBER, 0.55 * k); c.lineWidth = 1.2; c.setLineDash([4, 4]); c.lineDashOffset = -tt * 20; c.beginPath(); c.moveTo(W / 2, y0); c.quadraticCurveTo(x, y0 + (y1 - y0) * 0.45, x, y1); c.stroke(); c.setLineDash([]); }
        c.fillStyle = rgb([36, 44, 37], 1); c.strokeStyle = rgb(AMBER, 0.6); c.lineWidth = 1.2; rr(c, W / 2 - bw / 2, S.y + 6, bw, bh, 9); c.fill(); c.stroke();
        c.textAlign = "center"; c.fillStyle = rgb(AMBER, 1); c.font = `600 ${small ? 9 : 10.5}px ${SANS}`; c.fillText(L.mainAgent, W / 2, S.y + 6 + bh * 0.3);
        c.fillStyle = rgb(TEXT, 0.95); c.font = `500 ${small ? 10 : 11.5}px ${SANS}`; c.fillText(fitText(c, L.req.C, bw - 14), W / 2, S.y + 6 + bh * 0.68);
        c.font = `600 ${small ? 10 : 12}px ${SANS}`; const lines = U.wrap(c, L.parallel, W - 2 * pad - 20), lh = small ? 14 : 16, ly = S.y + S.h - 8 - lines.length * lh / 2;
        c.fillStyle = rgb(BGTOP, 0.95 * k); rr(c, pad, ly - lh / 2 - 3, W - 2 * pad, lines.length * lh + 6, 8); c.fill();
        c.fillStyle = rgb(MUTED, k); lines.forEach((ln, i) => c.fillText(ln, W / 2, ly + i * lh)); c.globalAlpha = 1;
      }

      // ───────────── dessin : la vraie trace en barres ─────────────
      function realBars(c, tt, al, L, code) {
        const { W } = dim(), { pad, small, fs } = lay, top = lay.led.y + 22, H = lay.led.h - 24, availW = W - 2 * pad, f = realCount(tt), pitch = H / NR, th = Math.max(1.3, pitch - 1);
        c.globalAlpha = al; c.textBaseline = "middle"; c.textAlign = "left"; c.font = `600 ${fs - 2}px ${SANS}`; c.fillStyle = rgb(MUTED, 1); c.fillText(L.realTitle, pad, lay.led.y + 6);
        let lx = W - pad; c.textAlign = "right"; c.font = `400 ${fs - 2.5}px ${SANS}`;
        [["cache", L.legendShort[2]], ["in", L.legendShort[0]]].forEach(([k, lab]) => { c.fillStyle = rgb(MUTED, 1); c.fillText(lab, lx, lay.led.y + 6); const w = c.measureText(lab).width; c.fillStyle = rgb(CL[k], 1); c.fillRect(lx - w - 11, lay.led.y + 2.5, 7, 7); lx -= w + 22; });
        TG.realBars = { x: pad - 4, y: top - 4, w: availW + 8, h: NR * pitch + 8 }; TG.realFirst = { x: pad - 4, y: top - 3, w: Math.min(availW + 8, REAL[0][0] * availW / R.max + (lay.small ? 120 : 150)), h: pitch + 6 };
        for (let i = 0; i < NR; i++) {
          const a = clamp01(f - i); if (a <= 0) break; const [ctxT, rd, wr, out] = REAL[i], y = top + i * pitch, k = availW / R.max, wc = rd * k * a, wn = (ctxT - rd) * k * a;
          c.fillStyle = rgb(CL.cache, 1); c.fillRect(pad, y, wc, th); c.fillStyle = rgb(CL.in, 1); c.fillRect(pad + wc, y, Math.max(1, wn), th); c.fillStyle = rgb(CL.out, 1); c.fillRect(pad + wc + wn, y, Math.max(1.4, out * k * a), th);
        }
        if (f >= 1) { const a = clamp01((f - 0.9) / 0.1), x = pad + REAL[0][0] * availW / R.max + 8; c.textAlign = "left"; c.font = `500 ${fs - 1.5}px ${SANS}`; c.fillStyle = rgb(AMBER, a); c.fillText(U.tpl(L.realFirst, { n: Math.round(REAL[0][0] / 1000) }), x, top + pitch * 0.5); }
        c.globalAlpha = 1;
      }

      // ───────────── dessin : courbes de coût cumulé ─────────────
      function drawSeries(c, ser, al, L, code) {
        const { W, H } = dim(), { pad, small, fs } = lay, cu = lay.cur, px0 = pad + 4, px1 = W - pad - (ser.big ? 58 : 40), py0 = cu.y + 40, py1 = cu.y + cu.h - 16;
        const pts = ser.pts, last = pts[pts.length - 1], xmax = ser.xmax, ymax = Math.max(1, last[2] * 1.1), X = (x) => px0 + (px1 - px0) * x / xmax, Y = (v) => py1 - (py1 - py0) * v / ymax;
        c.globalAlpha = al; c.strokeStyle = rgb([255, 255, 255], 0.2); c.lineWidth = 1; c.beginPath(); c.moveTo(px0, py1 + 0.5); c.lineTo(px1, py1 + 0.5); c.stroke();
        if (pts.length > 1) {
          c.fillStyle = rgb(ACCENT, 0.16); c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(X(p[0]), Y(p[2])) : c.moveTo(X(p[0]), Y(p[2])))); for (let i = pts.length - 1; i >= 0; i--) c.lineTo(X(pts[i][0]), Y(pts[i][1])); c.closePath(); c.fill();
          c.lineJoin = "round"; c.lineWidth = 2; c.strokeStyle = rgb(CORAL, 1); c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(X(p[0]), Y(p[2])) : c.moveTo(X(p[0]), Y(p[2])))); c.stroke();
          c.lineWidth = 2.6; c.strokeStyle = rgb(ACCENT, 1); c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(X(p[0]), Y(p[1])) : c.moveTo(X(p[0]), Y(p[1])))); c.stroke();
          const num = (v) => { const r = v >= 1e4 ? Math.round(v / 1000) + " k" : Math.round(v).toLocaleString(code === "ro" ? "ro-RO" : code === "fr" ? "fr-FR" : "en-US").replace(/ /g, " "); return ser.big ? (v / 1e6).toFixed(1).replace(".", ["fr", "ro"].includes(code) ? "," : ".") + " M" : r; };
          c.textAlign = "left"; c.font = `700 ${fs - 0.5}px ${MONO}`; c.fillStyle = rgb(CORAL, 1); c.fillText(num(last[2]), X(last[0]) + 6, Y(last[2]) - 3); c.fillStyle = rgb(ACCENT, 1); c.fillText(num(last[1]), X(last[0]) + 6, Y(last[1]) + 4);
        }
        c.font = `500 ${fs - 2.5}px ${MONO}`; c.fillStyle = rgb(MUTED, 0.8); c.textAlign = "left"; c.fillText("#1", px0, py1 + 11); c.textAlign = "right"; c.fillText("#" + Math.round(xmax), px1, py1 + 11); c.globalAlpha = 1;
      }
      function curves(c, tt, al, L, code, st, rs) {
        const { W } = dim(), { pad, fs } = lay, cu = lay.cur, mixR = easeInOut((tt - marks.ch7 - 0.5) / 0.7); TG.curves = { x: pad - 4, y: cu.y - 4, w: W - 2 * pad + 8, h: cu.h + 4 };
        c.textAlign = "left"; c.textBaseline = "middle"; c.font = `600 ${fs - 2}px ${SANS}`; c.fillStyle = rgb(MUTED, al); c.fillText(L.curveTitle, pad, cu.y + 8);
        let lx = W - pad; c.textAlign = "right"; c.font = `400 ${fs - 2.5}px ${SANS}`;
        [[L.curveWith, ACCENT], [L.curveWithout, CORAL]].forEach(([lab, col]) => { c.fillStyle = rgb(MUTED, al); c.fillText(lab, lx, cu.y + 8); const w = c.measureText(lab).width; c.fillStyle = rgb(col, al); c.fillRect(lx - w - 13, cu.y + 6.5, 9, 3); lx -= w + 26; });
        if (mixR < 0.99) drawSeries(c, { pts: st.pts, xmax: Math.max(5, st.pts[st.pts.length - 1][0] + 0.5) }, al * (1 - mixR), L, code);
        if (mixR > 0.01) drawSeries(c, { pts: rs.pts, xmax: NR, big: true }, al * mixR, L, code);
      }

      // ───────────── conclusion ─────────────
      function conclusion(c, tt, L, code) {
        const { W, H } = dim(), ti = tt - marks.ch8, k = easeOut(ti / 0.6), dec = ["fr", "ro"].includes(code) ? "," : ".", f1 = (v) => v.toFixed(1).replace(".", dec);
        const v = { a: Math.round(R.cr[NR - 1] / realIn), cr: f1(R.cr[NR - 1] / 1e6), nw: f1(realIn / 1e6), s1: Math.round(toySave * 100), s2: Math.round(realSave * 100), r: f1(R.n[NR - 1] / R.w[NR - 1]) };
        c.globalAlpha = k; c.fillStyle = rgb(BGTOP, 1); c.fillRect(0, 0, W, H); c.textAlign = "left"; c.textBaseline = "middle";
        c.font = `600 ${lay.small ? 11 : 13}px ${SANS}`; c.fillStyle = rgb(ACCENT, 1); c.fillText(L.insKicker, 16, 30 + (1 - k) * 10);
        const ch = (H - 64) / 3 - 10, cols = [[150, 168, 186], ACCENT, CORAL];
        L.insights.forEach(([big, lab, sub], i) => { const ka = easeOut((ti - 0.4 - i * 0.55) / 0.5), y0 = 52 + i * (ch + 10) + (1 - ka) * 16; c.globalAlpha = ka;
          c.fillStyle = rgb([255, 255, 255], 0.05); c.strokeStyle = rgb([255, 255, 255], 0.09); c.lineWidth = 1; rr(c, 10, y0, W - 20, ch, 14); c.fill(); c.stroke();
          c.font = `700 ${lay.small ? 32 : 44}px ${MONO}`; c.fillStyle = rgb(cols[i], 1); c.fillText(U.tpl(big, v), 24, y0 + ch * 0.3);
          c.font = `600 ${lay.small ? 14 : 17}px ${SANS}`; c.fillStyle = rgb(TEXT, 1); c.fillText(fitText(c, U.tpl(lab, v), W - 48), 24, y0 + ch * 0.6);
          c.font = `400 ${lay.small ? 11 : 13}px ${SANS}`; c.fillStyle = rgb(MUTED, 1); U.wrap(c, U.tpl(sub, v), W - 48).slice(0, 2).forEach((ln, j) => c.fillText(ln, 24, y0 + ch * 0.8 + j * (lay.small ? 13 : 16) - (lay.small ? 6 : 8))); });
        c.globalAlpha = 1;
      }

      // ───────────── arrêts sur image : le reste s'assombrit, un projecteur cerne la cible, une légende dit quoi regarder ─────────────
      const GREY = [170, 186, 202], BCOL = { model: [255, 255, 255], loop: CL.out, harness: AMBER, result: CL.in, reread: GREY, answer: AMBER, request2: GREY, snowball: ACCENT, prices: AMBER, gap: ACCENT,
        sys: AMBER, redo: CORAL, rebuilt: ACCENT, ttl: CORAL, fan: AMBER, subs: AMBER, first: AMBER, mass: GREY, rbill: ACCENT };
      const rowRect = (cl, i0, i1) => { const g = geom.find((q) => q.cl === cl); return g ? { x: g.x0 + i0 * g.s - 4, y: g.y - g.pitch / 2 + 1, w: (i1 - i0) * g.s + 8, h: g.pitch - 2 } : null; };
      const rowsRect = (cls) => { const gs = cls.map((cl) => geom.find((q) => q.cl === cl)).filter(Boolean); if (!gs.length) return null;
        const x0 = Math.min(...gs.map((g) => g.x0)) - 4, x1 = Math.max(...gs.map((g) => g.x0 + g.cl.len * g.s)) + 4, y0 = Math.min(...gs.map((g) => g.y - g.pitch / 2)) + 1, y1 = Math.max(...gs.map((g) => g.y + g.pitch / 2)) - 1;
        return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; };
      const targetOf = (id) => ({ model: TG.model, loop: TG.loop, harness: TG.harness, result: TG.tool, answer: TG.tool,
        reread: rowRect(byId.A2, 0, byId.A2.g), request2: rowRect(byId.B1, 0, byId.B1.g), snowball: rowsRect(["B1", "B2", "B3", "B4", "B5", "B6"].map((i) => byId[i])),
        prices: TG.chips, gap: TG.curves, sys: rowRect(byId.A1, 0, 3), redo: rowRect(byId.E1, 0, byId.E1.len), rebuilt: rowRect(byId.E2, 0, byId.E2.g), ttl: rowRect(byId.E3, 0, byId.E3.len),
        fan: TG.fan, subs: TG.subs, first: TG.realFirst, mass: TG.realBars, rbill: TG.curves })[id];
      const bvCache = {};
      function bvars(code) {   // chiffres cités par les légendes : tous calculés à partir des données
        if (bvCache[code]) return bvCache[code];
        const dec = ["fr", "ro"].includes(code) ? "," : ".", f1 = (v) => v.toFixed(1).replace(".", dec), M = (v) => f1(v / 1e6) + " M", B6 = byId.B6, st = stateAt(B6.T0 + B6.H + 0.01), E1 = byId.E1;
        memo.t = null;
        return (bvCache[code] = { calls: toyMain.length, p: Math.round(100 * st.tcache / (st.tcache + st.tin)), n: Math.round(bill.n), w: Math.round(bill.w), in: PR.in, out: PR.out, read: String(PR.read).replace(".", dec), ratio: Math.round(PR.in / PR.read),
          tok: E1.g * TOK / 1000, x: (E1.g * (PR.write - PR.read)).toFixed(0), sc: nSub, sx: Math.round(calls.slice(nMain).reduce((a, c) => a + c.costW, 0)),
          n0: Math.round(REAL[0][0] / 1000), c: NR, rp: Math.round(R.cr[NR - 1] / R.ctx[NR - 1] * 100), rn: M(R.n[NR - 1]), rw: M(R.w[NR - 1]), rr: f1(R.n[NR - 1] / R.w[NR - 1]) });
      }
      const beatText = (id) => { const { L, code } = ctx.lang(), [t, b] = L.beats[id]; return [t, U.tpl(b, bvars(code))]; };
      const hit = (A, B, m) => A.x < B.x + B.w + m && A.x + A.w > B.x - m && A.y < B.y + B.h + m && A.y + A.h > B.y - m;
      function spotlight(c, tt, L) {
        const b = beatAt(tt); if (!b) { cardGeom = null; return; } const G = targetOf(b.id); if (!G) { cardGeom = null; return; }
        const { W, H } = dim(), { pad, small } = lay, dur = b.t1 - b.t0, p = (tt - b.t0) / dur, k = Math.min(easeOut((tt - b.t0) / 0.35), easeOut((b.t1 - tt) / 0.35));
        const col = BCOL[b.id], chap = chapterAt(b.t0), step = BEATS.filter((f) => chapterAt(f.t0) === chap).indexOf(b) + 1, [title, body] = beatText(b.id);
        const bb = G.r ? { x: G.x - G.r, y: G.y - G.r, w: 2 * G.r, h: 2 * G.r } : G;
        const hole = () => { if (G.r) { c.moveTo(G.x + G.r, G.y); c.arc(G.x, G.y, G.r, 0, Math.PI * 2); } else if (c.roundRect) c.roundRect(G.x, G.y, G.w, G.h, 12); else c.rect(G.x, G.y, G.w, G.h); };
        c.save(); c.globalAlpha = k; c.fillStyle = "rgba(3,9,15,0.76)"; c.beginPath(); c.rect(0, 0, W, H); hole(); c.fill("evenodd");
        c.shadowColor = rgb(col, 1); c.shadowBlur = 10 + 12 * (0.5 + 0.5 * Math.sin(tt * 5)); c.strokeStyle = rgb(col, 0.95); c.lineWidth = 2.5; c.beginPath(); hole(); c.stroke(); c.shadowBlur = 0;
        // carte : première position qui ne recouvre pas la cible (milieu, sous la cible, haut, bas) ; le déplacement fait par l'utilisateur s'ajoute, remis à zéro à chaque pause
        const vid = !!P.video, cw = Math.min(W - 2 * pad, lay.wide ? 620 : W), cx0 = (W - cw) / 2, ch = vid ? (small ? 138 : 150) : small ? 164 : lay.wide ? 176 : 172;
        const cands = [lay.led.y + Math.max(46, lay.led.h * 0.2), bb.y + bb.h + 16, lay.top.y + 4, H - ch - 28];
        const ok = cands.filter((y) => y + ch <= H - 20 && y >= lay.top.y), ov = (y) => Math.max(0, Math.min(y + ch, bb.y + bb.h) - Math.max(y, bb.y)) * Math.max(0, Math.min(cx0 + cw, bb.x + bb.w) - Math.max(cx0, bb.x));
        const cy0 = ok.find((y) => !hit({ x: cx0, y, w: cw, h: ch }, bb, 12)) ?? ok.sort((u, v) => ov(u) - ov(v))[0] ?? cands[0];
        if (cardOff.k !== b.t0) cardOff = { k: b.t0, dx: 0, dy: 0 };
        const x = Math.max(4, Math.min(W - cw - 4, cx0 + cardOff.dx)), y = Math.max(4, Math.min(H - ch - 4, cy0 + cardOff.dy)); cardOff.dx = x - cx0; cardOff.dy = y - cy0;
        c.fillStyle = rgb([36, 44, 37], 0.98); c.strokeStyle = rgb(col, 0.8); c.lineWidth = 1.5; rr(c, x, y, cw, ch, 14); c.fill(); c.stroke();
        c.fillStyle = rgb(col, 1); c.beginPath(); c.arc(x + 26, y + 28, 13, 0, 7); c.fill(); c.fillStyle = "#06121b"; c.font = `800 ${small ? 14 : 15}px ${SANS}`; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(String(step), x + 26, y + 28.5);
        c.textAlign = "left"; c.fillStyle = rgb(TEXT, 1); c.font = `700 ${small ? 16 : 19}px ${SANS}`; c.fillText(fitText(c, title, cw - 100), x + 50, y + 28);
        if (!vid) for (let i = 0; i < 3; i++) { c.fillStyle = rgb([255, 255, 255], 0.28); c.beginPath(); c.arc(x + cw - 20, y + 20 + i * 5.5, 1.6, 0, 7); c.arc(x + cw - 26, y + 20 + i * 5.5, 1.6, 0, 7); c.fill(); }   // poignée : la carte se déplace à la souris
        c.font = `500 ${small ? 12 : 14.5}px ${SANS}`; c.fillStyle = rgb([205, 220, 230], 1); const lh = small ? 17 : 20; U.wrap(c, body, cw - 36).slice(0, 4).forEach((ln, i) => c.fillText(ln, x + 18, y + 60 + i * lh));
        const fl = !vid && E.flow && E.flow.mode === "step" && E.flow.total ? E.flow : null, by0 = y + ch - (vid ? 22 : 44);
        if (fl) { const n = fl.total, sw = (cw - 36 - (n - 1) * 3) / n; for (let i = 0; i < n; i++) { c.fillStyle = i <= fl.index ? rgb(col, 0.95) : rgb([255, 255, 255], 0.14); c.fillRect(x + 18 + i * (sw + 3), by0, sw, 3); } }   // une case par étape
        else { c.fillStyle = rgb(col, 0.9); c.fillRect(x + 18, by0, (cw - 36) * clamp01(p), 3); c.fillStyle = rgb([255, 255, 255], 0.14); c.fillRect(x + 18 + (cw - 36) * clamp01(p), by0, (cw - 36) * (1 - clamp01(p)), 3); }
        if (vid) { c.restore(); cardGeom = null; return; }
        // boutons : Pause / Reprendre (fige tout aussi longtemps qu'on veut) et Continuer (saute la fin de la pause)
        const bh2 = small ? 24 : 26, by = y + ch - 36, f = small ? 11 : 12.5, playing = !fl && E.player && E.player.state === "playing", lab1 = fl ? fl.t("back") : playing ? L.beatBtn.pause : L.beatBtn.resume, lab2 = fl ? fl.t(fl.index >= fl.total - 1 ? "restart" : "next") : L.beatBtn.skip;
        c.font = `600 ${f}px ${SANS}`; const w1 = c.measureText(lab1).width + 40, w2 = c.measureText(lab2).width + 46, x2 = x + cw - 18 - w2, x1 = x2 - 10 - w1;
        c.fillStyle = rgb([255, 255, 255], 0.06); c.strokeStyle = rgb(col, 0.85); c.lineWidth = 1.2; rr(c, x1, by, w1, bh2, bh2 / 2); c.fill(); c.stroke();
        c.fillStyle = rgb(TEXT, 1); if (fl) { c.beginPath(); c.moveTo(x1 + 20, by + bh2 / 2 - 5.5); c.lineTo(x1 + 12, by + bh2 / 2); c.lineTo(x1 + 20, by + bh2 / 2 + 5.5); c.closePath(); c.fill(); } else if (playing) { c.fillRect(x1 + 12, by + bh2 / 2 - 5, 3, 10); c.fillRect(x1 + 18, by + bh2 / 2 - 5, 3, 10); } else { c.beginPath(); c.moveTo(x1 + 12, by + bh2 / 2 - 5.5); c.lineTo(x1 + 21, by + bh2 / 2); c.lineTo(x1 + 12, by + bh2 / 2 + 5.5); c.closePath(); c.fill(); }
        c.textAlign = "left"; c.fillText(lab1, x1 + 28, by + bh2 / 2 + 0.5);
        c.fillStyle = rgb(col, 1); rr(c, x2, by, w2, bh2, bh2 / 2); c.fill(); c.fillStyle = "#06121b"; c.fillText(lab2, x2 + 14, by + bh2 / 2 + 0.5);
        for (let i = 0; i < 2; i++) { const ax = x2 + w2 - 22 + i * 7; c.beginPath(); c.moveTo(ax, by + bh2 / 2 - 5); c.lineTo(ax + 6, by + bh2 / 2); c.lineTo(ax, by + bh2 / 2 + 5); c.closePath(); c.fill(); }
        c.textAlign = "left"; c.font = `400 ${small ? 9 : 10.5}px ${SANS}`; c.fillStyle = rgb(MUTED, 1); c.fillText(fl ? fl.t("stepOf", { n: fl.index + 1, N: fl.total }) + "  ·  " + fl.t("keys") : L.beatKey, x + 18, by + bh2 / 2 + 0.5);
        c.restore();
        cardGeom = { x, y, w: cw, h: ch, bPause: { x: x1, y: by, w: w1, h: bh2 }, bSkip: { x: x2, y: by, w: w2, h: bh2 }, b };
      }

      // ───────────── image ─────────────
      const win = (tt, a, b) => easeOut((tt - a) / 0.45) * easeOut((b - tt) / 0.45);
      function draw() {
        const c = host.ctx, { W, H } = dim(), { L, code } = ctx.lang(), st = stateAt(t), real = inReal(t), rs = real ? realState(t) : null, intro = easeOut(t / 0.6);
        host.begin(); c.setTransform(host.dpr * K, 0, 0, host.dpr * K, 0, 0); c.textBaseline = "middle";
        tiles(c, intro, st, rs || { f: 0 }, real, L, code);
        const aScene = t < marks.ch4 ? easeOut((marks.ch4 - t) / 0.4 + 0.0) : 0, aPrice = Math.max(win(t, marks.ch4, marks.ch6), win(t, marks.ch7, 1e9)), aFan = win(t, marks.ch6, marks.ch7);
        if (aScene > 0.01) scene(c, t, Math.min(1, aScene) * intro, L);
        if (aPrice > 0.01) prices(c, t, aPrice, L, code);
        if (aFan > 0.01) fan(c, t, aFan, L);
        const aToy = t < marks.ch6 ? 1 : easeOut((marks.ch6 + 0.5 - t) / 0.5), aSub = win(t, marks.ch6 + 0.5, marks.ch7), aReal = easeOut((t - marks.ch7 - 0.2) / 0.5);
        geom = [];
        if (aToy > 0.01) { toyLedger(c, t, aToy * intro, L, st); }
        if (aToy > 0.01 || aSub > 0.01) ledgerHead(c, Math.max(aToy, aSub) * intro, L);
        if (aSub > 0.01) subLedger(c, t, aSub, L);
        if (aReal > 0.01) realBars(c, t, aReal, L, code);
        curves(c, t, intro, L, code, st, rs || { pts: [[0, 0, 0]] });
        c.textAlign = "center"; c.textBaseline = "middle"; c.font = `400 ${lay.small ? 9 : 10.5}px ${SANS}`; c.fillStyle = rgb(MUTED, 0.7 * intro); c.fillText(L.footer, W / 2, H - 10);
        spotlight(c, t, L);
        if (t > marks.ch8) conclusion(c, t, L, code);
      }

      setLay(); let lastPs = null;
      return {
        duration, readyTime, chapters, chapterTotal: "07", beats: BEATS,
        stops() { const { L } = ctx.lang(), st = BEATS.map((b) => ({ t: b.t0 + 0.45, id: b.id, title: L.beats[b.id][0], hold: [b.t0, b.t1] })); st.push({ t: marks.ch8 + 2.4, id: "end", title: L.chapters[8][0], hold: null }); return st; },   // arrêts du flux pas à pas (engine/step-flow.js)
        card: () => cardGeom && { ...cardGeom, k: K }, endLabel: mmss(duration),
        setTime(nt) { if (nt !== t) { t = nt; host.dirty = true; } },
        frame() { const ps = (E.player && E.player.state) + (E.flow ? E.flow.mode + E.flow.index : ""); if (ps !== lastPs) { lastPs = ps; host.dirty = true; } if (host.visible && host.dirty) { host.dirty = false; draw(); } },
        readout(tt) {
          const real = inReal(tt), n = real ? Math.round(realCount(tt)) : stateAt(tt).calls, ch = chapterAt(tt), { L, code } = ctx.lang(); let text;
          const bt = beatAt(tt); if (bt) text = beatText(bt.id)[1];
          if (ch === 7 && real && !bt) { const rs = realState(tt); text = U.tpl(L.realText, { p: Math.round(rs.share * 100), r: (rs.cw ? rs.cn / rs.cw : 1).toFixed(1).replace(".", ["fr", "ro"].includes(code) ? "," : ".") }); }
          return { value: n, unit: "callsUnit", chapter: ch, text };
        },
        nowLabel(tt) { return mmss(tt); },
        values(tt) {
          if (inReal(tt)) { const f = Math.floor(realCount(tt)); let cr = 0, nw = 0, out = 0; for (let i = 0; i < f; i++) { cr += REAL[i][1]; nw += REAL[i][0] - REAL[i][1]; out += REAL[i][3]; } return { input: nw, output: out, cached: cr }; }
          const s = stateAt(tt); return { input: s.tin * TOK, output: s.tout * TOK, cached: s.tcache * TOK };
        },
        refresh() { setLay(); host.dirty = true; },
      };
    },
  });
})();
