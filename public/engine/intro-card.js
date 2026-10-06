/*
 * Intro-card : au démarrage (et après « Arrêter »), le panneau de texte (titre, résumé, compteur, légende) s'ouvre au centre de l'animation, déplaçable
 * à la souris ; au lancement de la lecture, il retourne à sa place dans la page. Module optionnel : une page l'active avec "uses": ["intro-card"]
 * dans sa spec (chart). Il ne touche pas au moteur : il lit Engine.player.state ("stopped" = pas encore lancé) et déplace .copy avec une transformation
 * CSS, donc la mise en page ne bouge pas. Ordinateur seulement (>= 1024 px) ; téléphone et tablette gardent le texte à sa place.
 * Styles : classes .copy--card (carte au centre), .copy--fly (retour en cours), .ccv--intro (voile sur l'animation) dans engine/player.css.
 */
(function () {
  "use strict";
  const MQ = window.matchMedia("(min-width: 1024px)"), INTERACTIVE = "button, a, select, input, label, textarea, summary";
  let copy = null, screen = null, section = null, on = false, tx = 0, ty = 0, sc = 1, scroll0 = 0, drag = { x: 0, y: 0 }, grab = null, flyTimer = 0;

  const state = () => (window.Engine && window.Engine.player ? window.Engine.player.state : null);

  function measure() {   // position de la carte au centre de l'écran d'animation, mesurée à partir de sa place d'origine
    copy.style.transition = "none"; copy.style.transform = "none";
    const r = copy.getBoundingClientRect(), s = screen.getBoundingClientRect();
    sc = Math.min(1, (Math.min(s.height, innerHeight) - 36) / r.height);
    tx = s.left + s.width / 2 - (r.left + r.width / 2); ty = s.top + s.height / 2 - (r.top + r.height / 2); scroll0 = scrollY;
  }
  const place = () => { copy.style.transform = `translate(${tx + drag.x}px, ${ty + drag.y + (scrollY - scroll0)}px) scale(${sc})`; };   // la page défile, l'animation reste épinglée : on compense

  function enter(initial) {
    if (!MQ.matches) return;
    on = true; drag = { x: 0, y: 0 }; clearTimeout(flyTimer);
    copy.classList.remove("copy--fly"); copy.classList.add("copy--card"); section.classList.add("ccv--intro");
    measure(); copy.getBoundingClientRect();           // enregistre la position d'origine avant de lancer la transition
    copy.style.transition = initial ? "none" : ""; place();
  }
  function leave(instant) {
    if (!on) return;
    on = false; grab = null; copy.classList.remove("copy--card"); section.classList.remove("ccv--intro");
    if (instant) { copy.style.transition = "none"; copy.style.transform = ""; copy.classList.remove("copy--fly"); return; }
    copy.classList.add("copy--fly"); copy.style.transition = ""; copy.style.transform = "";   // la transition CSS ramène la carte à sa place
    flyTimer = setTimeout(() => copy.classList.remove("copy--fly"), 900);
  }
  function refresh() { if (!on) return; measure(); place(); }   // taille de fenêtre, langue (la hauteur du texte change)

  function clampDrag() {   // garde au moins une partie de la carte dans la fenêtre
    const r = copy.getBoundingClientRect(), m = 90, top = 70;
    let dx = 0, dy = 0;
    if (r.right < m) dx = m - r.right; else if (r.left > innerWidth - m) dx = innerWidth - m - r.left;
    if (r.bottom < top + m) dy = top + m - r.bottom; else if (r.top > innerHeight - m) dy = innerHeight - m - r.top;
    if (dx || dy) { drag.x += dx; drag.y += dy; place(); }
  }

  function setup() {
    copy = document.querySelector(".copy"); screen = document.querySelector(".screen"); section = document.querySelector(".ccv");
    copy.addEventListener("pointerdown", (e) => {
      if (!on || e.pointerType !== "mouse" || e.button !== 0 || e.target.closest(INTERACTIVE)) return;
      e.preventDefault(); try { copy.setPointerCapture(e.pointerId); } catch (err) {}
      copy.style.transition = "none"; grab = { x: e.clientX, y: e.clientY, dx: drag.x, dy: drag.y }; copy.classList.add("copy--drag");
    });
    copy.addEventListener("pointermove", (e) => { if (!grab) return; drag.x = grab.dx + e.clientX - grab.x; drag.y = grab.dy + e.clientY - grab.y; place(); });
    const end = () => { if (!grab) return; grab = null; copy.classList.remove("copy--drag"); clampDrag(); };
    copy.addEventListener("pointerup", end); copy.addEventListener("pointercancel", end);
    window.addEventListener("resize", () => { if (on && !MQ.matches) leave(true); else if (!on && MQ.matches && state() === "stopped") enter(true); else refresh(); });
    window.addEventListener("scroll", () => { if (on && !grab) { copy.style.transition = "none"; place(); } }, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(() => refresh()).observe(copy);
    if (document.fonts) document.fonts.ready.then(refresh);
    // la carte suit l'état de lecture : au centre tant que rien n'a été lancé (ou après « Arrêter »), à sa place ensuite
    let last = null;
    setInterval(() => { const s = state(); if (s === last) return; const first = last === null; last = s; if (s === "stopped") enter(first); else leave(); }, 80);
  }

  const wait = setInterval(() => { if (window.Engine && window.Engine.player && document.querySelector(".copy") && document.querySelector(".screen")) { clearInterval(wait); setup(); } }, 50);
  setTimeout(() => clearInterval(wait), 15000);
})();
