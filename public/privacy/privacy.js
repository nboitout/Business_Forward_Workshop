(() => {
  const copy = {
    prepare:['Prepare for the workshop →','Pregătiți-vă pentru workshop →'],
    eyebrow:['BEFORE YOU SHARE YOUR DATA','ÎNAINTE DE A PARTAJA DATELE'],
    title:['Your chats. Whose training data?','Conversațiile dvs. antrenează AI-ul?'],
    intro:['Choose an AI service. Switch off training. See what changes — and what stays.','Alegeți un serviciu AI. Dezactivați utilizarea datelor pentru antrenare. Vedeți ce se schimbă și ce se păstrează.'],
    scope:['Personal accounts · Free & paid','Conturi personale · Gratuite și plătite'],
    personal:['PERSONAL ACCOUNT SETTINGS','SETĂRI PENTRU CONTURI PERSONALE'],
    simulation:['Interactive illustration only. Your account settings are not changed.','Simulare interactivă. Setările contului dvs. nu sunt modificate.'],
    control:['The control in your account','Setarea din contul dvs.'],
    newchat:['Your next conversation','Următoarea conversație'], answer:['AI still responds to your request.','AI-ul continuă să răspundă cerințelor dvs.'],
    training:['MODEL TRAINING','ANTRENAREA MODELELOR'],history:['NEW CHAT HISTORY','ISTORICUL CONVERSAȚIILOR NOI'],
    past:['01 / PAST CONVERSATIONS','01 / CONVERSAȚII ANTERIOARE'],retention:['02 / STORAGE & EXCEPTIONS','02 / STOCARE ȘI EXCEPȚII'],feedback:['03 / FEEDBACK','03 / FEEDBACK'],
    open:['Open privacy settings ↗','Deschideți setările de confidențialitate ↗'],source:['Official sources:','Surse oficiale:'],
    compareLabel:['THE DIFFERENCE THAT MATTERS','DIFERENȚA CARE CONTEAZĂ'],compareTitle:['After opting out, can you keep new chats in history?','După dezactivarea antrenării, puteți păstra conversațiile noi în istoric?'],
    service:['Service','Serviciu'],excluded:['New chats excluded from training*','Conversații noi excluse de la antrenare*'],saved:['New chat history retained','Istoricul conversațiilor noi se păstrează'],yes:['Yes','Da'],no:['No — Keep Activity is off','Nu — Keep Activity este dezactivat'],
    exceptions:['*For ordinary personal-account chats; feedback and safety exceptions are described above. Turning off training does not undo completed training or automatically delete stored data.','*Pentru conversații obișnuite din conturi personale; excepțiile privind feedbackul și siguranța sunt descrise mai sus. Dezactivarea nu anulează antrenarea deja finalizată și nu șterge automat datele stocate.'],
    opinionLabel:['WORKSHOP PERSPECTIVE · SME ADOPTION','PERSPECTIVA WORKSHOPULUI · ADOPȚIA ÎN IMM-URI'],opinionTitle:['Privacy should not cost you continuity.','Confidențialitatea nu ar trebui să coste continuitatea.'],
    opinion:['For an SME using a personal account, losing new chat history makes it harder to revisit work. In my view, coupling these controls is a poor product choice and may discourage Gemini adoption. This is a workshop interpretation, not a measured adoption finding.','Pentru un IMM care folosește un cont personal, pierderea istoricului nou îngreunează reluarea activității. În opinia mea, cuplarea acestor setări este o alegere de produs neinspirată și poate descuraja adoptarea Gemini. Aceasta este perspectiva workshopului, nu concluzia unui studiu de adopție.'],
    businessTitle:['Check the account, not just the subscription price.','Verificați tipul contului, nu doar prețul abonamentului.'],
    business:['A paid personal subscription is still a personal account. Business, enterprise and eligible education workspaces have different terms. Do not apply this diagram to your organisation’s managed workspace or to an API.','Un abonament personal plătit rămâne un cont personal. Spațiile de lucru business, enterprise și educaționale eligibile au condiții diferite. Această diagramă nu descrie spațiul de lucru administrat de organizația dvs. sau utilizarea prin API.'],
    checked:['Official documentation checked on 6 October 2026. Settings and policies can change; use the source links to verify your account.','Documentație oficială verificată la 6 octombrie 2026. Setările și politicile se pot schimba; consultați sursele pentru a verifica situația contului dvs.'],home:['← Workshop home','← Pagina principală'],
    allowed:['ELIGIBLE','ELIGIBILE'],blocked:['EXCLUDED*','EXCLUSE*'],kept:['SAVED','SALVATE'],lost:['NOT SAVED','NESALVATE'],
    trainOn:['Chats may help train models','Conversațiile pot antrena modele'],trainOff:['New chats excluded from training*','Conversațiile noi sunt excluse de la antrenare*'],
    onDetail:['Content may be reused to improve the provider’s models.','Conținutul poate fi reutilizat pentru îmbunătățirea modelelor furnizorului.'],offDetail:['The feedback and safety exceptions below still matter.','Excepțiile de mai jos privind feedbackul și siguranța rămân relevante.'],
    historyOn:['You can return to your chats','Puteți reveni la conversații'],historyDetail:['Regular chats remain available in your history.','Conversațiile obișnuite rămân disponibile în istoric.'],
    historyOff:['New chats leave no Activity history','Conversațiile noi nu apar în Activitate'],historyOffDetail:['Gemini still retains them for 72 hours. Some Connected Apps are unavailable.','Gemini le păstrează totuși timp de 72 de ore. Unele aplicații conectate nu mai sunt disponibile.'],
    independent:['Training and history are separate controls. You can turn training off and keep your chat history.','Antrenarea și istoricul au setări separate. Puteți dezactiva antrenarea și păstra istoricul.'],
    coupledOn:['One control, two consequences: Keep Activity enables saved history and model improvement.','O setare, două consecințe: Keep Activity activează salvarea istoricului și îmbunătățirea modelelor.'],
    coupledOff:['One control, two consequences: opting out also switches off new Activity history.','O setare, două consecințe: dezactivarea antrenării oprește și salvarea noului istoric în Activitate.']
  };
  const models = {
    chatgpt:{name:'ChatGPT',setting:'Improve the model for everyone',
      default:['ON by default for personal Free / Plus / Pro. Check your saved setting.','ACTIVAT implicit pentru conturile personale Free / Plus / Pro. Verificați setarea salvată.'],
      past:['Opt-out covers new conversations. It does not promise to remove earlier chats from training already performed. Start a fresh chat after switching off.','Dezactivarea acoperă conversațiile noi. Nu promite eliminarea conversațiilor anterioare din antrenarea deja efectuată. Începeți o conversație nouă după dezactivare.'],
      retention:['Opt-out does not delete history. Memory is a separate control. Temporary chats are not used for training and may be kept for up to 30 days for safety.','Dezactivarea nu șterge istoricul. Memoria are o setare separată. Conversațiile temporare nu sunt folosite la antrenare și pot fi păstrate până la 30 de zile pentru siguranță.'],
      feedback:['Submitting thumbs-up/down feedback may allow the associated conversation to be used for training.','Feedbackul pozitiv sau negativ poate permite utilizarea conversației asociate pentru antrenare.'],
      path:['Settings → Data controls → Improve the model for everyone → OFF','Setări → Controale privind datele → Improve the model for everyone → Dezactivat'],url:'https://chatgpt.com/settings/data-controls',
      sources:[['Data controls','https://help.openai.com/en/articles/7730893-data-controls-in-chatgpt'],['History & defaults','https://help.openai.com/en/articles/8983130-what-if-i-want-to-keep-my-history-on-but-disable-model-training']]},
    claude:{name:'Claude',setting:'Help Improve our AI models',
      default:['Your saved choice applies to personal Free / Pro / Max. ON here illustrates consent, not a universal default.','Se aplică alegerea salvată pentru Free / Pro / Max. Starea ACTIVAT ilustrează consimțământul, nu o setare implicită universală.'],
      past:['Switching off excludes stored and new chats from future training runs. Training already started or completed is not reversed.','Dezactivarea exclude conversațiile stocate și cele noi din viitoarele antrenări. Antrenarea deja începută sau finalizată nu este anulată.'],
      retention:['History remains until deleted separately. With training permission, data may remain in training pipelines for up to 5 years. Safety-flagged content has separate rules.','Istoricul se păstrează până la ștergerea separată. Cu acord pentru antrenare, datele pot rămâne în procesele de antrenare până la 5 ani. Conținutul semnalat pentru siguranță are reguli separate.'],
      feedback:['Submitted feedback may be used for training. Safety-flagged chats may support internal safety models and research.','Feedbackul trimis poate fi folosit pentru antrenare. Conversațiile semnalate pot contribui la modele interne de siguranță și cercetare.'],
      path:['Settings → Privacy → Help Improve our AI models → OFF','Setări → Confidențialitate → Help Improve our AI models → Dezactivat'],url:'https://claude.ai/new#settings/data-privacy-controls',
      sources:[['Model improvement','https://privacy.claude.com/en/articles/12109829-how-do-i-change-my-model-improvement-privacy-settings'],['Training & feedback','https://privacy.claude.com/en/articles/10023580-is-my-data-used-for-model-training'],['Retention','https://privacy.claude.com/en/articles/10023548-how-long-do-you-store-my-data']]},
    gemini:{name:'Gemini',setting:'Keep Activity',
      default:['ON by default for adults using personal accounts, including paid personal plans.','ACTIVAT implicit pentru adulții cu un cont personal, inclusiv cu abonament personal plătit.'],
      past:['Turning off does not delete old Activity. Deletion is separate; previously human-reviewed chats may remain for up to 3 years.','Dezactivarea nu șterge Activitatea anterioară. Ștergerea este separată; conversațiile deja revizuite de persoane pot fi păstrate până la 3 ani.'],
      retention:['With Keep Activity off, chats are retained for 72 hours for service and safety. This is not zero storage.','Cu Keep Activity dezactivat, conversațiile sunt păstrate 72 de ore pentru funcționare și siguranță. Stocarea nu este eliminată.'],
      feedback:['Sending feedback can permit training reuse, including context from your last 24 hours of chats.','Trimiterea feedbackului poate permite reutilizarea pentru antrenare, inclusiv a contextului din ultimele 24 de ore de conversații.'],
      path:['Settings & help → Activity → Keep Activity → Turn off','Setări și ajutor → Activitate → Keep Activity → Dezactivați'],url:'https://myactivity.google.com/product/gemini',
      sources:[['Privacy Hub','https://support.google.com/gemini/answer/13594961?hl=en'],['Activity & defaults','https://support.google.com/gemini/answer/13278892?hl=en']]}
  };
  const params = new URLSearchParams(location.search);
  let provider = Object.hasOwn(models,params.get('provider')) ? params.get('provider') : 'chatgpt';
  let enabled = params.get('training') !== 'off';
  const $ = id => document.getElementById(id);
  const t = pair => pair[document.documentElement.lang === 'ro' ? 1 : 0];
  function render() {
    const m=models[provider], gemini=provider==='gemini', noHistory=gemini&&!enabled;
    document.querySelectorAll('[data-copy]').forEach(el=>el.textContent=t(copy[el.dataset.copy]));
    document.title=t(['Your data & AI · Business Forward','Datele dvs. și AI · Business Forward']);
    document.querySelector('.tabs').setAttribute('aria-label',t(['AI service','Serviciu AI']));
    document.querySelectorAll('[data-provider]').forEach(b=>{const active=b.dataset.provider===provider;b.setAttribute('aria-selected',active);b.tabIndex=active?0:-1;});
    $('diagram').dataset.provider=provider;
    $('diagram').setAttribute('aria-labelledby','tab-'+provider);
    $('provider-title').textContent=m.name;
    $('default-note').textContent=t(m.default);
    $('setting-name').textContent=m.setting;
    $('training-toggle').setAttribute('aria-checked',enabled);
    $('training-toggle').setAttribute('aria-label',m.setting);
    $('toggle-label').textContent=enabled?'ON':'OFF';
    $('training-badge').textContent=t(copy[enabled?'allowed':'blocked']);
    $('training-title').textContent=t(copy[enabled?'trainOn':'trainOff']);
    $('training-text').textContent=t(copy[enabled?'onDetail':'offDetail']);
    $('training-card').className=enabled?'':'protected';
    $('history-badge').textContent=t(copy[noHistory?'lost':'kept']);
    $('history-title').textContent=t(copy[noHistory?'historyOff':'historyOn']);
    $('history-text').textContent=t(copy[noHistory?'historyOffDetail':'historyDetail']);
    $('history-card').className=noHistory?'limited':'';
    $('takeaway').textContent=t(copy[gemini?(enabled?'coupledOn':'coupledOff'):'independent']);
    ['past','retention','feedback'].forEach(key=>$(key+'-text').textContent=t(m[key]));
    $('settings-path').textContent=t(m.path);
    $('settings-link').href=m.url;
    const labels={'Data controls':'Controale privind datele','History & defaults':'Istoric și setări implicite','Model improvement':'Îmbunătățirea modelelor','Training & feedback':'Antrenare și feedback','Retention':'Păstrarea datelor','Privacy Hub':'Centrul de confidențialitate','Activity & defaults':'Activitate și setări implicite'};
    $('provider-sources').replaceChildren(...m.sources.map(([label,url])=>{const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=t([label,labels[label]])+' ↗';return a;}));
    const url=new URL(location.href);url.searchParams.set('provider',provider);url.searchParams.set('training',enabled?'on':'off');history.replaceState(null,'',url.pathname+url.search+url.hash);
  }
  document.querySelector('.tabs').addEventListener('click',e=>{const b=e.target.closest('[data-provider]');if(b){provider=b.dataset.provider;render();}});
  document.querySelector('.tabs').addEventListener('keydown',e=>{
    const keys=['ArrowLeft','ArrowRight','Home','End'];if(!keys.includes(e.key))return;e.preventDefault();
    const ids=Object.keys(models),i=ids.indexOf(provider);provider=ids[e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3];render();$('tab-'+provider).focus();
  });
  $('training-toggle').addEventListener('click',()=>{enabled=!enabled;render();});
  new MutationObserver(render).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  render();
})();
