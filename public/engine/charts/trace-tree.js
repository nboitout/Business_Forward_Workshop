/*
 * trace-tree : trace d'une demande à un assistant IA (Claude Code) : chaque appel au modèle, puis les outils qu'il a lancés,
 * et la courbe du contexte (cache lu / écrit, sortie). Module de graphique du moteur commun. Port de animation/trace_render.py.
 * Données : trace/data.json (animation/trace_extract.py) : { wall_seconds, events: [{k: model|tool|final, ...}] }.
 */
(function () {
  "use strict";
  const E = window.Engine, U = E.util, { clamp01, easeOut, rgb } = U;
  const TEXT = [250, 250, 245], MUTED = [183, 193, 169], ACCENT = [243, 237, 87], AMBER = [255, 190, 80], VIOLET = [130, 120, 255], CORAL = [255, 122, 110], BGTOP = [32, 43, 36];
  const SANS = '"Source Sans 3","Segoe UI",system-ui,sans-serif', MONO = '"IBM Plex Mono",ui-monospace,monospace';

  E.registerChart("trace-tree", {
    create(ctx) {
      const P = ctx.spec.chart, EV = ctx.data.events, MODELS = EV.filter((e) => e.k === "model"), NC = MODELS.length, NT = EV.filter((e) => e.k === "tool").length;
      const CTX_MAX = P.ctxMax || 260000, TOTAL_CTX = MODELS.reduce((s, m) => s + m.ctx, 0), TOTAL_CR = MODELS.reduce((s, m) => s + m.cr, 0), TOTAL_OUT = MODELS.reduce((s, m) => s + m.out, 0);
      const TOOL_MIN = EV.filter((e) => e.k === "tool").reduce((s, e) => s + e.dur, 0) / 60, WALL_MIN = ctx.data.wall_seconds / 60;
      const category = (e) => (e.name.startsWith("mcp__Claude_Browser__") ? "browser" : P.categories[e.name] || "other");

      // ── chronologie : un pas par événement, pauses sur les appels commentés ──
      const START = []; let acc = P.tIntro;
      EV.forEach((e) => { START.push(acc); acc += e.k === "model" ? P.dModel : e.k === "tool" ? P.dTool : P.dFinal; if (e.k === "model" && P.callouts[e.n]) acc += P.calloutHold; });
      const tEnd = acc, tIns = tEnd + P.tHold, tInsEnd = tIns + P.tInsight, duration = tInsEnd + P.tTail;
      const callStart = {}; EV.forEach((e, i) => { if (e.k === "model") callStart[e.n] = START[i]; });
      const chapters = [{ t: 0, chip: false, num: null }];
      P.phases.forEach((n, i) => chapters.push({ t: callStart[n], chip: true, num: String(i + 1).padStart(2, "0") }));
      chapters.push({ t: tIns, chip: true, num: String(P.phases.length + 1).padStart(2, "0") });
      chapters.push({ t: tInsEnd, chip: true, num: null });
      const chapterAt = (t) => { let i = 0; chapters.forEach((c, k) => { if (t >= c.t) i = k; }); return i; };
      const cur = (t) => { let j = -1; for (let i = 0; i < START.length; i++) if (START[i] <= t) j = i; return j; };

      // ── cumuls (pour compteurs, légende) ──
      const cum = []; { let calls = 0, tools = 0, cx = 0, cr = 0; const cat = {};
        EV.forEach((e) => { if (e.k === "model") { calls++; cx += e.ctx; cr += e.cr; } else if (e.k === "tool") { tools++; const c = category(e); cat[c] = (cat[c] || 0) + e.tok; }
          cum.push({ calls, tools, cx, cr, cat: { ...cat } }); }); }

      const host = E.host(ctx.canvas);
      let t = tEnd, lay = null, hoverCall = null, hoverRow = null, rowsGeom = [];
      const setLay = () => {
        const { W, H } = host, small = W < 420;
        lay = { small, fs: small ? 10.5 : 12.5, row: small ? 21 : 24, tileH: small ? 48 : 56, tileY: 40, treeTop: 40 + (small ? 48 : 56) + 16, treeBot: H * 0.585,
                cTop: H * 0.685, cBase: H * 0.885, cx0: small ? 30 : 40, cx1: W - 14 };
      };
      const cxp = (n) => lay.cx0 + (lay.cx1 - lay.cx0) * (n - 1) / (NC - 1), cyp = (v) => lay.cBase - (lay.cBase - lay.cTop) * v / CTX_MAX;
      host.onResize = setLay;
      host.onLeave = () => { hoverCall = null; hoverRow = null; host.dirty = true; };
      host.onMove = (x, y) => {
        const { L, fmt } = ctx.lang(); let call = null, row = null;
        if (y >= lay.cTop - 14 && y <= lay.cBase + 34) call = Math.max(1, Math.min(NC, Math.round(1 + (x - lay.cx0) / (lay.cx1 - lay.cx0) * (NC - 1))));
        else row = rowsGeom.find((g) => Math.abs(y - g.y) < lay.row / 2) || null;
        if (call !== hoverCall || (row && row.i) !== (hoverRow && hoverRow.i)) { hoverCall = call; hoverRow = row; host.dirty = true; }
        if (call) { const m = MODELS[call - 1]; host.showTip(`<b>${L.callName} #${call}</b><span class="big">${fmt(m.ctx)}</span> <span class="dim">${L.tip.ctx}</span>` +
          `<div class="dim">${U.tpl(L.tip.split, { out: fmt(m.out), cr: fmt(m.cr), cc: fmt(m.cc) })}</div><div class="dim">${L.tip.click}</div>`, x, y); }
        else if (row) { const e = EV[row.i]; host.showTip(e.k === "tool" ? `<b>${esc(e.label)}</b><div class="dim">${fmt(e.tok)} ${L.tok} · ${e.dur}s${e.err ? " · " + L.tip.err : ""}</div>` : `<b>${L.callName} #${e.n}</b><div class="dim">${U.tpl(L.tip.split, { out: fmt(e.out), cr: fmt(e.cr), cc: fmt(e.cc) })}</div>`, x, y); }
        else host.hideTip();
      };
      const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
      host.onClick = () => { if (hoverCall) ctx.seek(callStart[hoverCall] + 0.02); };

      function fitText(c, s, maxW) { if (c.measureText(s).width <= maxW) return s; while (s.length > 1 && c.measureText(s + "…").width > maxW) s = s.slice(0, -1); return s + "…"; }
      const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect ? c.roundRect(x, y, w, h, r) : c.rect(x, y, w, h); };

      function draw() {
        const c = host.ctx, { W, H } = host, { L, fmt, code } = ctx.lang(), j = cur(t), a = easeOut(t / P.tIntro), { fs, row, tileH, tileY, treeTop, treeBot } = lay;
        host.begin(); c.textBaseline = "middle";
        // compteurs
        const cm = j >= 0 ? cum[j] : { calls: 0, tools: 0, cx: 0, cr: 0 }, hit = cm.cx ? cm.cr / cm.cx : 0, dec = code === "fr" ? "," : ".";
        const tiles = [[String(cm.calls), ACCENT, L.tiles[0]], [String(cm.tools), TEXT, L.tiles[1]], [(cm.cx / 1e6).toFixed(2).replace(".", dec) + " M", TEXT, L.tiles[2]], [Math.round(hit * 100) + (code === "fr" ? " %" : "%"), ACCENT, L.tiles[3]]];
        const gap = 6, tw = (W - 20 - 3 * gap) / 4;
        tiles.forEach(([v, col, lab], i) => { const x = 10 + i * (tw + gap); c.fillStyle = rgb([255, 255, 255], 0.05 * a); c.strokeStyle = rgb([255, 255, 255], 0.09 * a); c.lineWidth = 1; rr(c, x, tileY, tw, tileH - 6, 10); c.fill(); c.stroke();
          c.textAlign = "center"; c.font = `700 ${lay.small ? 17 : 21}px ${MONO}`; c.fillStyle = rgb(col, a); c.fillText(v, x + tw / 2, tileY + (tileH - 6) * 0.42);
          c.font = `400 ${lay.small ? 9 : 10.5}px ${SANS}`; c.fillStyle = rgb(MUTED, a); c.fillText(lab, x + tw / 2, tileY + (tileH - 6) * 0.78); });
        // arbre
        c.textAlign = "left"; c.font = `600 ${fs - 2}px ${SANS}`; c.fillStyle = rgb(MUTED, a); c.fillText(L.treeTitle, 12, treeTop - 10);
        rowsGeom = [];
        if (j >= 0) {
          const cf = j + easeOut((t - START[j]) / 0.18);
          for (let i = Math.max(0, j - 24); i <= j; i++) {
            const e = EV[i], y = treeBot - (cf - i) * row - row / 2, ap = easeOut((t - START[i]) / 0.18), fade = clamp01((y - (treeTop + 4)) / 60), al = a * ap * fade;
            if (al <= 0.01) continue;
            rowsGeom.push({ i, y }); const hov = hoverRow && hoverRow.i === i;
            if (hov) { c.fillStyle = rgb([255, 255, 255], 0.07); rr(c, 6, y - row / 2 + 1, W - 12, row - 2, 6); c.fill(); }
            c.font = `${e.k === "model" ? 600 : 400} ${fs}px ${MONO}`;
            if (e.k === "model") { c.textAlign = "left"; c.fillStyle = rgb(ACCENT, al); c.fillText(`├─ ${L.callName} #${e.n}`, 12, y); c.textAlign = "right"; c.font = `400 ${fs - 1.5}px ${MONO}`; c.fillStyle = rgb(MUTED, al);
              c.fillText(`ctx ${fmt(e.ctx)} · out ${fmt(e.out)}`, W - 12, y); }
            else if (e.k === "tool") { c.textAlign = "right"; c.font = `400 ${fs - 1.5}px ${MONO}`; const tk = `${fmt(e.tok)} ${L.tok}`, tkw = c.measureText(tk).width; c.fillStyle = rgb(AMBER, al); c.fillText(tk, W - 12, y);
              c.textAlign = "left"; c.font = `400 ${fs - 1}px ${MONO}`; c.fillStyle = rgb(e.err ? CORAL : TEXT, al * 0.92); c.fillText(fitText(c, "├─ " + e.label, W - 40 - tkw - 18), 26, y); }
            else { c.textAlign = "left"; c.fillStyle = rgb(AMBER, al); c.fillText(`└─ ${L.finalName}`, 12, y); }
          }
        } else { c.textAlign = "left"; c.font = `600 ${fs}px ${MONO}`; c.fillStyle = rgb(ACCENT, a); c.fillText(L.promptName, 12, treeBot - row / 2); }
        callouts(c, j);
        chart(c, j, a, L, fmt);
        c.textAlign = "center"; c.font = `400 ${lay.small ? 9 : 10.5}px ${SANS}`; c.fillStyle = rgb(MUTED, 0.7 * a); c.fillText(L.footer, W / 2, H - 10);
        if (t > tIns) insights(c, L, fmt, code, dec);
      }

      function callouts(c, j) {
        const { L } = ctx.lang(); Object.keys(P.callouts).forEach((n) => {
          const s0 = callStart[n]; if (!(s0 <= t && t < s0 + P.dModel + P.calloutHold)) return;
          const k = Math.min(easeOut((t - s0) / 0.3), easeOut((s0 + P.dModel + P.calloutHold - t) / 0.3)), msg = L.callouts[n], { W } = host;
          c.font = `600 ${lay.small ? 12 : 14}px ${SANS}`; const lines = U.wrap(c, msg, W - 56), bh = 16 + lines.length * (lay.small ? 17 : 20), y0 = lay.treeTop + 10 + (1 - k) * 10;
          c.fillStyle = rgb([36, 44, 37], 0.96 * k); c.strokeStyle = rgb(AMBER, 0.7 * k); c.lineWidth = 1.5; rr(c, 14, y0, W - 28, bh, 12); c.fill(); c.stroke();
          c.fillStyle = rgb(AMBER, k); c.textAlign = "left"; lines.forEach((ln, li) => c.fillText(ln, 26, y0 + 12 + li * (lay.small ? 17 : 20) + 5));
        });
      }

      function chart(c, j, a, L, fmt) {
        const { W, H } = host, { cx0, cx1, cTop, cBase, fs } = lay;
        c.textAlign = "left"; c.font = `600 ${fs - 2}px ${SANS}`; c.fillStyle = rgb(MUTED, a); c.fillText(L.chartTitle, 12, cTop - 22);
        let lx = W - 12; c.textAlign = "right"; c.font = `400 ${fs - 2}px ${SANS}`;
        [[L.legendOut, VIOLET], [L.legendWrite, AMBER], [L.legendRead, ACCENT]].forEach(([lab, col]) => { c.fillStyle = rgb(MUTED, a); c.fillText(lab, lx, cTop - 22); const w = c.measureText(lab).width; c.fillStyle = rgb(col, a); c.beginPath(); c.arc(lx - w - 8, cTop - 22, 3.5, 0, 7); c.fill(); lx -= w + 22; });
        [0, 100000, 200000].forEach((v) => { const y = cyp(v); c.strokeStyle = rgb([255, 255, 255], (v ? 0.07 : 0.25) * a); c.lineWidth = 1; c.beginPath(); c.moveTo(cx0, y + .5); c.lineTo(cx1, y + .5); c.stroke();
          if (v) { c.textAlign = "right"; c.font = `500 ${fs - 2}px ${MONO}`; c.fillStyle = rgb(MUTED, 0.8 * a); c.fillText(v / 1000 + "k", cx0 - 4, y); } });
        const kdone = j >= 0 ? cum[j].calls : 0; if (kdone < 1) return;
        const frac = kdone > 1 ? easeOut((t - callStart[kdone]) / 0.2) : 1, pts = MODELS.slice(0, kdone).map((m) => ({ x: cxp(m.n), m }));
        if (pts.length > 1 && frac < 1) pts[pts.length - 1].x = pts[pts.length - 2].x + (pts[pts.length - 1].x - pts[pts.length - 2].x) * frac;
        if (pts.length >= 2) {
          c.fillStyle = rgb(ACCENT, 0.38 * a); c.beginPath(); c.moveTo(pts[0].x, cBase); pts.forEach((p) => c.lineTo(p.x, cyp(p.m.cr))); c.lineTo(pts[pts.length - 1].x, cBase); c.closePath(); c.fill();
          c.fillStyle = rgb(AMBER, 0.55 * a); c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p.x, cyp(p.m.cr + p.m.cc)) : c.moveTo(p.x, cyp(p.m.cr + p.m.cc)))); for (let i = pts.length - 1; i >= 0; i--) c.lineTo(pts[i].x, cyp(pts[i].m.cr)); c.closePath(); c.fill();
          c.strokeStyle = rgb(TEXT, 0.9 * a); c.lineWidth = 2; c.lineJoin = "round"; c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p.x, cyp(p.m.ctx)) : c.moveTo(p.x, cyp(p.m.ctx)))); c.stroke();
        }
        pts.forEach((p) => { const h = Math.max(2, 26 * p.m.out / 17000); c.fillStyle = rgb(VIOLET, 0.9 * a); c.fillRect(p.x - 2, cBase + 6, 4, h); });
        const last = pts[pts.length - 1]; c.fillStyle = rgb(TEXT, a); c.beginPath(); c.arc(last.x, cyp(last.m.ctx), 4.5, 0, 7); c.fill();
        c.textAlign = "center"; c.font = `700 ${fs + 1}px ${MONO}`; c.fillText(Math.round(last.m.ctx / 1000) + " k", Math.min(last.x, cx1 - 14), cyp(last.m.ctx) - 13);
        c.font = `500 ${fs - 2}px ${MONO}`; c.fillStyle = rgb(MUTED, 0.8 * a); c.textAlign = "left"; c.fillText("#1", cx0, cBase + 42); c.textAlign = "right"; c.fillText("#" + NC, cx1, cBase + 42);
        if (hoverCall && hoverCall <= kdone) { const x = cxp(hoverCall), m = MODELS[hoverCall - 1]; c.strokeStyle = rgb(TEXT, 0.4); c.setLineDash([3, 4]); c.beginPath(); c.moveTo(x, cyp(m.ctx)); c.lineTo(x, cBase); c.stroke(); c.setLineDash([]);
          c.fillStyle = "#fff"; c.beginPath(); c.arc(x, cyp(m.ctx), 4.5, 0, 7); c.fill(); }
      }

      function insights(c, L, fmt, code, dec) {
        const { W, H } = host, ti = t - tIns, k = easeOut(ti / 0.6), v = { a: fmt(MODELS[0].ctx), b: Math.round(TOTAL_CR / TOTAL_CTX * 100), c: (TOTAL_CR / 1e6).toFixed(2).replace(".", dec), d: (TOTAL_CTX / 1e6).toFixed(2).replace(".", dec),
          e: fmt(TOTAL_OUT), f: TOOL_MIN.toFixed(1).replace(".", dec), g: WALL_MIN.toFixed(1).replace(".", dec) };
        c.fillStyle = rgb(BGTOP, k); c.fillRect(0, 0, W, H); c.textAlign = "left"; c.textBaseline = "middle";
        c.font = `600 ${lay.small ? 11 : 13}px ${SANS}`; c.fillStyle = rgb(ACCENT, k); c.fillText(L.insKicker, 16, 30 + (1 - k) * 10);
        const ch = (H - 64) / 4 - 10; L.insights.forEach(([big, lab, sub], i) => { const ka = easeOut((ti - 0.4 - i * 0.5) / 0.5), y0 = 52 + i * (ch + 10) + (1 - ka) * 16, col = [ACCENT, ACCENT, VIOLET, AMBER][i];
          c.fillStyle = rgb([255, 255, 255], 0.05 * ka); c.strokeStyle = rgb([255, 255, 255], 0.09 * ka); c.lineWidth = 1; rr(c, 10, y0, W - 20, ch, 14); c.fill(); c.stroke();
          c.font = `700 ${lay.small ? 32 : 42}px ${MONO}`; c.fillStyle = rgb(col, ka); c.fillText(U.tpl(big, v).replace(" ", " "), 24, y0 + ch * 0.32);
          c.font = `600 ${lay.small ? 14 : 17}px ${SANS}`; c.fillStyle = rgb(TEXT, ka); c.fillText(U.tpl(lab, v), 24, y0 + ch * 0.62);
          c.font = `400 ${lay.small ? 11 : 13}px ${SANS}`; c.fillStyle = rgb(MUTED, ka); c.fillText(fitText(c, U.tpl(sub, v), W - 48), 24, y0 + ch * 0.83); });
      }

      setLay();
      return {
        duration, readyTime: tEnd, chapters, chapterTotal: String(P.phases.length + 1).padStart(2, "0"), endLabel: String(NC),
        setTime(nt) { if (nt !== t) { t = nt; host.dirty = true; } },
        frame() { if (host.visible && host.dirty) { host.dirty = false; draw(); } },
        readout(tt) { const j = cur(tt); return { value: j >= 0 ? cum[j].calls : 0, unit: "callsUnit", chapter: chapterAt(tt) }; },
        nowLabel(tt) { const j = cur(tt); return String(j >= 0 ? cum[j].calls : 0); },
        values(tt) { const j = cur(tt), base = Object.fromEntries(ctx.spec.legend.map((k) => [k, 0])); return { ...base, ...(j >= 0 ? cum[j].cat : {}) }; },
        refresh() { setLay(); host.dirty = true; },
      };
    },
  });
})();
