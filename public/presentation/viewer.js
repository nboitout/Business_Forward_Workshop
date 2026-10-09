(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const dialog = $('lightbox');
  const viewport = $('lightbox-viewport');
  const portrait = matchMedia('(max-width: 760px) and (orientation: portrait)');
  let slides = [];
  let current = 0;
  let zoom = 1;
  let rotated = false;
  let touchStart = null;
  const isRomanian = () => document.documentElement.lang === 'ro';
  const label = (en, ro) => isRomanian() ? ro : en;

  function linksFor(canvas, slide) {
    const container = canvas.querySelector('.slide-links');
    container.replaceChildren();
    for (const link of slide.links) {
      const anchor = document.createElement('a');
      anchor.textContent = link.text;
      anchor.href = link.url;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      for (const property of ['left', 'top', 'width', 'height']) anchor.style[property] = `${link[property]}%`;
      container.append(anchor);
    }
  }

  function updateCaptions() {
    if (!slides.length) return;
    const caption = `${current + 1} / ${slides.length} · ${slides[current].title}`;
    $('slide-caption').textContent = caption;
    $('lightbox-caption').textContent = slides[current].title;
    $('lightbox-count').textContent = `${current + 1} / ${slides.length}`;
    $('expand').title = label('Open full screen', 'Deschideți pe tot ecranul');
    document.querySelectorAll('.thumbnail').forEach((button, index) => {
      button.setAttribute('aria-label', `${label('Slide', 'Diapozitivul')} ${index + 1}: ${slides[index].title}`);
    });
  }

  function fitLightbox() {
    if (!dialog.open || !slides.length) return;
    rotated = portrait.matches;
    const padding = 24;
    const availableWidth = Math.max(1, viewport.clientWidth - padding);
    const availableHeight = Math.max(1, viewport.clientHeight - padding);
    const ratio = slides[current].width / slides[current].height;
    const width = (rotated ? Math.min(availableHeight, availableWidth * ratio) : Math.min(availableWidth, availableHeight * ratio)) * zoom;
    const height = width / ratio;
    const canvas = $('lightbox-canvas');
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    canvas.style.transform = `translate(-50%, -50%) rotate(${rotated ? 90 : 0}deg)`;
    $('lightbox-stage').style.width = `${rotated ? height : width}px`;
    $('lightbox-stage').style.height = `${rotated ? width : height}px`;
    dialog.dataset.rotated = String(rotated);
    $('zoom-reset').textContent = `${Math.round(zoom * 100)}%`;
    $('zoom-out').disabled = zoom <= 1;
    $('zoom-in').disabled = zoom >= 3;
  }

  function resetViewport() {
    zoom = 1;
    fitLightbox();
    viewport.scrollTo(0, 0);
  }

  function show(index, updateUrl = true) {
    if (!slides.length) return;
    current = (index + slides.length) % slides.length;
    const slide = slides[current];
    for (const id of ['slide-image', 'lightbox-image']) {
      const image = $(id);
      image.src = slide.src;
      image.alt = `${current + 1}. ${slide.title}`;
    }
    linksFor($('inline-canvas'), slide);
    linksFor($('lightbox-canvas'), slide);
    document.querySelectorAll('.thumbnail').forEach((button, i) => button.setAttribute('aria-current', String(i === current)));
    updateCaptions();
    resetViewport();
    if (updateUrl) history.replaceState(null, '', `${location.pathname}${location.search}#slide-${current + 1}`);
    for (const offset of [-1, 1]) {
      const image = new Image();
      image.src = slides[(current + offset + slides.length) % slides.length].src;
    }
  }

  function indexFromHash() {
    const match = /^#slide-(\d+)$/.exec(location.hash);
    return match ? Math.min(slides.length - 1, Math.max(0, Number(match[1]) - 1)) : 0;
  }

  function openLightbox() {
    if (!slides.length || dialog.open) return;
    dialog.showModal();
    document.body.classList.add('viewer-open');
    resetViewport();
    $('close').focus();
  }
  function closeLightbox() { dialog.close(); }
  $('expand').addEventListener('click', openLightbox);
  $('inline-canvas').addEventListener('click', event => {
    if (!event.target.closest('a') && !touchStart) openLightbox();
  });
  $('close').addEventListener('click', closeLightbox);
  $('collapse').addEventListener('click', closeLightbox);
  dialog.addEventListener('close', () => {
    document.body.classList.remove('viewer-open');
    zoom = 1;
    $('expand').focus();
  });
  document.querySelectorAll('[data-move]').forEach(button => button.addEventListener('click', () => show(current + Number(button.dataset.move))));
  $('zoom-in').addEventListener('click', () => { zoom = Math.min(3, zoom + .25); fitLightbox(); });
  $('zoom-out').addEventListener('click', () => { zoom = Math.max(1, zoom - .25); fitLightbox(); });
  $('zoom-reset').addEventListener('click', resetViewport);
  document.addEventListener('keydown', event => {
    if (!slides.length || event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input,select,textarea,[contenteditable]')) return;
    if (['ArrowRight', 'PageDown'].includes(event.key) || (dialog.open && rotated && event.key === 'ArrowDown')) { event.preventDefault(); show(current + 1); }
    else if (['ArrowLeft', 'PageUp'].includes(event.key) || (dialog.open && rotated && event.key === 'ArrowUp')) { event.preventDefault(); show(current - 1); }
    else if (event.key === 'Home') { event.preventDefault(); show(0); }
    else if (event.key === 'End') { event.preventDefault(); show(slides.length - 1); }
  });

  // Match ROP: horizontal swipes browse; rotated portrait slides also accept vertical swipes.
  // Once zoomed, leave touch gestures to native panning and pinch zoom.
  for (const surface of [$('inline-viewport'), viewport]) {
    surface.addEventListener('touchstart', event => {
      touchStart = event.touches.length === 1 && (!dialog.open || zoom === 1) && !event.target.closest('a,button')
        ? { x: event.touches[0].clientX, y: event.touches[0].clientY } : null;
    }, { passive: true });
    surface.addEventListener('touchmove', event => {
      if (event.touches.length !== 1) { touchStart = null; return; }
      if (!touchStart || (dialog.open && zoom > 1)) return;
      const dx = event.touches[0].clientX - touchStart.x;
      const dy = event.touches[0].clientY - touchStart.y;
      if ((dialog.open && rotated) || Math.abs(dx) > Math.abs(dy) * 1.2) event.preventDefault();
    }, { passive: false });
    surface.addEventListener('touchend', event => {
      const start = touchStart;
      touchStart = null;
      if (!start || !event.changedTouches[0] || (dialog.open && zoom > 1)) return;
      const dx = event.changedTouches[0].clientX - start.x;
      const dy = event.changedTouches[0].clientY - start.y;
      const horizontal = Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy) * 1.2;
      const vertical = Math.abs(dy) >= 40 && Math.abs(dy) > Math.abs(dx) * 1.2;
      if (horizontal) { event.preventDefault(); show(current + (dx < 0 ? 1 : -1)); }
      else if (vertical && dialog.open && rotated) { event.preventDefault(); show(current + (dy < 0 ? 1 : -1)); }
    }, { passive: false });
    surface.addEventListener('touchcancel', () => { touchStart = null; });
  }
  new ResizeObserver(fitLightbox).observe(viewport);
  portrait.addEventListener('change', resetViewport);
  window.addEventListener('hashchange', () => show(indexFromHash(), false));
  new MutationObserver(updateCaptions).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  async function load() {
    $('load-error').hidden = true;
    try {
      const response = await fetch('/presentation/slides.json');
      if (!response.ok) throw new Error(`Slides: ${response.status}`);
      slides = await response.json();
      if (!Array.isArray(slides) || !slides.length) throw new Error('Empty presentation');
      $('thumbnails').replaceChildren();
      slides.forEach((slide, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'thumbnail';
        const image = document.createElement('img');
        image.src = slide.thumbnail;
        image.alt = '';
        image.width = 320;
        image.height = 180;
        image.loading = 'lazy';
        const title = document.createElement('span');
        title.textContent = `${String(index + 1).padStart(2, '0')} · ${slide.title}`;
        button.append(image, title);
        button.addEventListener('click', () => show(index));
        $('thumbnails').append(button);
      });
      show(indexFromHash(), false);
      $('expand').disabled = false;
      document.querySelectorAll('[data-move]').forEach(button => { button.disabled = false; });
    } catch (error) {
      $('load-error').hidden = false;
      $('slide-caption').textContent = label('Presentation unavailable', 'Prezentarea nu este disponibilă');
      console.error(error);
    }
  }
  $('slide-image').addEventListener('error', () => { $('load-error').hidden = false; });
  $('retry').addEventListener('click', load);
  load();
})();
