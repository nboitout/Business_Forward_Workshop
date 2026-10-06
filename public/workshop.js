(() => {
  function enhance() {
    const nav = document.querySelector('.topnav');
    if (!nav) return false;
    const brand = nav.querySelector('.topnav__brand');
    brand.innerHTML = '<img src="/assets/business-forward-logo.png" alt="Business Forward" width="720" height="303">';
    brand.setAttribute('aria-label', 'Business Forward workshop, welcome page');
    const tools = document.createElement('div');
    tools.className = 'workshop-tools';
    tools.innerHTML = '<span>AI WORKSHOP · '+(document.querySelector('[data-tab="trace"][aria-current]') ? '01' : '02')+' / 02</span><button type="button" class="fullscreen">Fullscreen ↗</button>';
    nav.append(tools);
    const button = tools.querySelector('button');
    button.hidden = !document.fullscreenEnabled;
    button.addEventListener('click', async () => {
      try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
      catch { button.textContent = 'Fullscreen unavailable'; }
    });
    document.addEventListener('fullscreenchange', () => { button.textContent = document.fullscreenElement ? 'Exit fullscreen ↙' : 'Fullscreen ↗'; });
    return true;
  }
  if (!enhance()) { const observer = new MutationObserver(() => { if (enhance()) observer.disconnect(); }); observer.observe(document.getElementById('app'), {childList:true}); }
})();
