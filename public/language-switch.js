(() => {
  const pairs = window.workshopTranslations;
  const lookup = new Map();
  pairs.forEach(pair => pair.forEach(text => lookup.set(text, pair)));
  const nodes = [];
  const walker = document.createTreeWalker(document.documentElement, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.parentElement.closest('script,style')) continue;
    const pair = lookup.get(node.textContent.trim());
    if (pair) nodes.push({node, pair, before: node.textContent.match(/^\s*/)[0], after: node.textContent.match(/\s*$/)[0]});
  }
  const attributes = [];
  document.querySelectorAll('[alt],[aria-label],meta[name="description"]').forEach(el => {
    ['alt','aria-label','content'].forEach(name => {
      const pair = lookup.get(el.getAttribute(name));
      if (pair) attributes.push({el,name,pair});
    });
  });
  const toggle = document.createElement('div');
  toggle.className = 'page-language'; toggle.setAttribute('role','group');
  toggle.setAttribute('aria-label','Language / Limbă');
  toggle.innerHTML = '<button type="button" lang="en" data-language="en">EN</button><button type="button" lang="ro" data-language="ro">RO</button>';
  document.querySelector('header').append(toggle);
  const valid = value => value === 'en' || value === 'ro';
  function apply(lang) {
    const index = lang === 'ro' ? 1 : 0;
    nodes.forEach(({node,pair,before,after}) => { node.textContent = before + pair[index] + after; });
    attributes.forEach(({el,name,pair}) => el.setAttribute(name,pair[index]));
    document.documentElement.lang = lang;
    document.querySelectorAll('main [lang]').forEach(el => { el.lang = lang; });
    toggle.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed',String(b.dataset.language === lang)));
    document.querySelectorAll('a[href]').forEach(a => {
      const url = new URL(a.getAttribute('href'),location.href);
      if(url.origin !== location.origin || !['/','/preparation/','/privacy/','/workshop/','/presentation/','/trace/','/caching/'].includes(url.pathname)) return;
      if(a.getAttribute('href').startsWith('#')) return;
      if(['/trace/','/caching/'].includes(url.pathname)) { url.hash = lang; url.searchParams.delete('lang'); }
      else url.searchParams.set('lang',lang);
      a.href = url.pathname + url.search + url.hash;
    });
    const current = new URL(location.href); current.searchParams.set('lang',lang);
    history.replaceState(null,'',current.pathname+current.search+current.hash);
    try { localStorage.setItem('ccv-lang',lang); } catch {}
  }
  let stored; try { stored = localStorage.getItem('ccv-lang'); } catch {}
  const requested = new URLSearchParams(location.search).get('lang');
  apply(valid(requested) ? requested : valid(stored) ? stored : navigator.language.startsWith('ro') ? 'ro' : 'en');
  toggle.addEventListener('click',event => { const lang=event.target.dataset.language; if(valid(lang)) apply(lang); });
})();
