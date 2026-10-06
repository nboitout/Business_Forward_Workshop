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
    const updateLabels = () => {
      const ro = document.documentElement.lang === 'ro';
      const number = document.querySelector('[data-tab="trace"][aria-current]') ? '01' : '02';
      tools.querySelector('span').textContent = (ro ? 'WORKSHOP AI · ' : 'AI WORKSHOP · ') + number + ' / 02';
      brand.setAttribute('aria-label', ro ? 'Workshop Business Forward, pagina de întâmpinare' : 'Business Forward workshop, welcome page');
      button.textContent = document.fullscreenElement ? (ro ? 'Ieșire din ecran complet ↙' : 'Exit fullscreen ↙') : (ro ? 'Ecran complet ↗' : 'Fullscreen ↗');
    };
    new MutationObserver(updateLabels).observe(document.documentElement, {attributes:true, attributeFilter:['lang']});
    updateLabels();
    button.hidden = !document.fullscreenEnabled;
    button.addEventListener('click', async () => {
      try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
      catch { button.textContent = document.documentElement.lang === 'ro' ? 'Ecran complet indisponibil' : 'Fullscreen unavailable'; }
    });
    document.addEventListener('fullscreenchange', updateLabels);
    return true;
  }
  if (!enhance()) { const observer = new MutationObserver(() => { if (enhance()) observer.disconnect(); }); observer.observe(document.getElementById('app'), {childList:true}); }
})();
