"""Generate the two workshop pages from their shared presentation specs."""
import hashlib
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / 'public'

def asset(path):
    digest = hashlib.sha256((ROOT / path).read_bytes()).hexdigest()[:10]
    return '/' + path + '?v=' + digest

for topic in ('trace', 'caching'):
    spec = json.loads((ROOT / 'specs' / f'{topic}.json').read_text(encoding='utf-8'))
    text = spec['i18n']['en']
    scripts = ['engine/engine.js'] + ['engine/' + name + '.js' for name in spec['chart'].get('uses', [])] + ['engine/charts/' + spec['chart']['type'] + '.js', 'workshop.js']
    page = f'''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(text['docTitle'])} · Business Forward</title>
<meta name="description" content="{html.escape(text['docDesc'], quote=True)}">
<meta name="theme-color" content="#fafaf5">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="{asset('engine/player.css')}">
<link rel="stylesheet" href="{asset('theme.css')}">
<link rel="stylesheet" href="{asset('workshop.css')}"></head>
<body><a class="skip-link" href="#ccv-title">Skip to presentation</a>
<div id="app" data-spec="{asset('specs/' + topic + '.json')}" data-site="{asset('specs/site.json')}" data-dv="{asset(topic + '/data.json').split('=')[1]}">
<main class="prerender"><h1>{html.escape(text['title'])}</h1><p>{html.escape(text['lede'])}</p></main>
<noscript>This interactive workshop requires JavaScript.</noscript></div>
{''.join('<script defer src="' + asset(script) + '"></script>' for script in scripts)}
</body></html>'''
    (ROOT / topic / 'index.html').write_text(page, encoding='utf-8')
    print('Built', topic)
