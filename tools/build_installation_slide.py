"""Build the editable comparison slide and its EN/RO copy."""
from pathlib import Path
from html import escape
import json,re

root=Path(__file__).resolve().parents[1]/'public'
pairs=[]
def t(en,ro):
    pairs.append([en,ro]); return escape(en)
def icon(name,cls=''):
    return f'<svg class="diagram-icon {cls}" viewBox="0 0 80 80" aria-hidden="true"><use href="#diagram-{name}"></use></svg>'
def file(kind): return icon(kind,'file-icon')
def outputs(): return '<div class="output-files"><div>'+file('sheet')+'<small>Comparison.xlsx</small></div><div>'+file('doc')+'<small>Recommendation.docx</small></div></div>'
defs='''<svg class="diagram-definitions" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><defs>
<symbol id="diagram-pdf" viewBox="0 0 80 80"><path d="M20 5h29l14 15v54H20z" fill="white" stroke="#8194ac" stroke-width="2"/><path d="M49 5v16h14" fill="#e1eafa" stroke="#8194ac" stroke-width="2"/><path d="M27 57h28M27 65h24" stroke="#b6c8e0" stroke-width="3"/><rect x="13" y="32" width="48" height="21" rx="3" fill="#ed3340"/><text x="37" y="47" text-anchor="middle" fill="white" font-size="15" font-weight="700" font-family="Arial">PDF</text></symbol>
<symbol id="diagram-sheet" viewBox="0 0 80 80"><path d="M16 5h32l16 17v53H16z" fill="#00966e"/><path d="M48 5v18h16" fill="#75d1b5"/><path d="M25 34h29v29H25zM25 44h29M25 53h29M35 34v29" fill="none" stroke="white" stroke-width="2.5"/></symbol>
<symbol id="diagram-doc" viewBox="0 0 80 80"><path d="M16 5h32l16 17v53H16z" fill="#2985ef"/><path d="M48 5v18h16" fill="#93c4ff"/><path d="M26 37h28M26 47h28M26 57h20M26 65h15" stroke="white" stroke-width="3"/></symbol>
<symbol id="diagram-folder" viewBox="0 0 80 80"><path d="M5 22q0-7 7-7h20l9 10h30q5 0 5 6v36H5z" fill="#ffb522"/><path d="M7 31h67v34q0 7-7 7H13q-6 0-6-7z" fill="#ffd569"/><path d="M15 38h50v23H15z" fill="#fff0b4"/></symbol>
<symbol id="diagram-browser" viewBox="0 0 80 80"><rect x="5" y="10" width="70" height="60" rx="6" fill="white" stroke="#657f9f" stroke-width="3"/><path d="M7 24h66" stroke="#657f9f" stroke-width="3"/><circle cx="14" cy="17" r="2" fill="#657f9f"/><circle cx="22" cy="17" r="2" fill="#657f9f"/><circle cx="30" cy="17" r="2" fill="#657f9f"/><path d="M40 59V34m-11 11 11-11 11 11" fill="none" stroke="#348eff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/></symbol>
<symbol id="diagram-robot" viewBox="0 0 80 80"><path d="M40 20V9" stroke="#4387cc" stroke-width="4"/><circle cx="40" cy="8" r="5" fill="#4387cc"/><rect x="10" y="20" width="60" height="49" rx="21" fill="#b9dcff" stroke="#5c9bdd" stroke-width="2"/><rect x="19" y="30" width="42" height="29" rx="12" fill="#123d70" stroke="white" stroke-width="2"/><circle cx="30" cy="42" r="3" fill="white"/><circle cx="50" cy="42" r="3" fill="white"/><path d="M31 50q9 8 18 0" fill="none" stroke="white" stroke-width="2"/></symbol>
<symbol id="diagram-globe" viewBox="0 0 80 80"><circle cx="40" cy="40" r="29" fill="none" stroke="white" stroke-width="3"/><ellipse cx="40" cy="40" rx="13" ry="29" fill="none" stroke="white" stroke-width="3"/><path d="M11 40h58M17 23q23 12 46 0M17 57q23-12 46 0M40 11v58" fill="none" stroke="white" stroke-width="3"/></symbol>
<symbol id="diagram-monitor" viewBox="0 0 80 80"><rect x="12" y="14" width="56" height="40" rx="3" fill="none" stroke="white" stroke-width="4"/><path d="M7 64h66l-9-10H16z" fill="none" stroke="white" stroke-width="4"/></symbol>
</defs></svg>'''
panels=[]
data=[
 ('browser','globe','BROWSER','BROWSER','Using manual file uploads','Încărcare manuală a fișierelor',[
 ('YOU','DUMNEAVOASTRĂ','Upload the source files','Încărcați fișierele-sursă','Select documents from your laptop.','Selectați documentele de pe laptop.','<div class="pdf-stack">'+file('pdf')*3+'</div><b class="flow-arrow">→</b>'+icon('browser')),
 ('AI','AI','Analyse and create','Analizează și creează','Produce the spreadsheet and recommendation.','Creează tabelul comparativ și recomandarea.',icon('robot')+'<b class="flow-arrow">→</b>'+outputs()),
 ('YOU','DUMNEAVOASTRĂ','Download and save','Descărcați și salvați','Put the results in your working folder.','Puneți rezultatele în folderul de lucru.',outputs()+'<b class="flow-arrow">→</b>'+icon('folder'))
 ],'upload the updated versions.','încărcați versiunile actualizate.'),
 ('desktop','monitor','DESKTOP APP','APLICAȚIA DESKTOP','Using authorised local folder access','Acces autorizat la un folder local',[
 ('YOU','DUMNEAVOASTRĂ','Authorise the working folder','Autorizați folderul de lucru','Choose the files AI can access.','Alegeți fișierele la care AI poate avea acces.',icon('folder')+'<div class="permission">'+t('Allow access to this folder?','Permiteți accesul la acest folder?')+'<b>✓</b></div>'),
 ('AI','AI','Read, analyse, create and save','Citește, analizează, creează și salvează','Work directly with the permitted local files.','Lucrează direct cu fișierele locale permise.',icon('robot')+'<b class="flow-arrow">→</b>'+outputs()),
 ('YOU','DUMNEAVOASTRĂ','Review the saved results','Verificați rezultatele salvate','Open the outputs in your working folder.','Deschideți rezultatele din folderul de lucru.','<div class="result-folder">'+icon('folder')+outputs()+'</div>')
 ],'ask AI to use the latest files.','cereți AI să folosească ultimele versiuni.')]
for kind,symbol,en,ro,sub,subro,steps,end,endro in data:
 rows=[]
 for i,(actor,actorro,title,titlero,desc,descro,art) in enumerate(steps,1):
  rows.append(f'<li><span class="diagram-number">{i}</span><div class="step-copy"><span class="actor">{t(actor,actorro)}</span><h4>{t(title,titlero)}</h4><p>{t(desc,descro)}</p></div><div class="step-art" aria-hidden="true">{art}</div></li>')
 panels.append(f'<article class="diagram-panel {kind}"><div class="panel-heading"><span class="round-icon">{icon(symbol)}</span><div><h3>{t(en,ro)}</h3><p>{t(sub,subro)}</p></div></div><ol>{"".join(rows)}</ol><p class="change-note"><strong>{t("When local files change:","Când fișierele locale se modifică:")}</strong> {t(end,endro)}</p></article>')
slide=f'''<div class="coded-label"><span>{t('CODE VERSION · EDITABLE TEXT & VECTOR GRAPHICS','VERSIUNE PRIN COD · TEXT EDITABIL ȘI GRAFICĂ VECTORIALĂ')}</span></div>
<section class="coded-slide" id="coded-slide" aria-labelledby="coded-title">{defs}
<h2 id="coded-title">{t('Why install the desktop app?','De ce să instalați aplicația desktop?')}</h2>
<p class="diagram-subtitle">{t('Both can do the work. The difference is how they access your files.','Ambele pot realiza sarcina. Diferența este modul de acces la fișiere.')}</p>
<div class="same-task"><span class="task-files" aria-hidden="true">{file('pdf')*3}</span><p><strong>{t('Same task:','Aceeași sarcină:')}</strong> {t('compare supplier quotes and create a spreadsheet + recommendation.','comparați ofertele furnizorilor și creați un tabel comparativ + o recomandare.')}</p></div>
<div class="diagram-panels">{''.join(panels)}</div>
<p class="diagram-benefit"><span aria-hidden="true">↗</span> {t('The benefit: less manual file handling, especially for recurring work.','Beneficiul: mai puține operațiuni manuale cu fișierele, mai ales pentru activitățile recurente.')}</p>
<div class="diagram-notes"><span>{t('Start with copies of non-sensitive files and limited permissions.','Începeți cu copii ale unor fișiere nesensibile și cu permisiuni limitate.')}</span><span>{t('Comparison assumes browser uploads. Connected services or a desktop bridge can also extend browser access; features vary.','Comparația presupune încărcări în browser. Serviciile conectate sau o punte desktop pot extinde accesul din browser; funcțiile diferă.')}</span></div></section>'''
p=root/'preparation/index.html';s=p.read_text(encoding='utf-8')
s=re.sub(r'<div class="coded-label">.*?</section>', '', s, flags=re.S)
s=re.sub(r'<div class="romanian-slide".*?</div><figcaption', '<figcaption', s, flags=re.S)
s=s.replace('</figure>','</figure>\n'+slide,1)
if '/preparation/slide-translations.js' not in s:
 s=s.replace('<script defer src="/language-switch.js">','<script defer src="/preparation/slide-translations.js"></script><script defer src="/language-switch.js">')
if '/preparation/coded-slide.css' not in s:
 s=s.replace('</head>','<link rel="stylesheet" href="/preparation/coded-slide.css"></head>')
p.write_text(s,encoding='utf-8')
(root/'preparation/slide-translations.js').write_text('window.workshopTranslations.push(...'+json.dumps(pairs,ensure_ascii=False)+');\n',encoding='utf-8')
