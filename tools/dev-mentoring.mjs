import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import api from '../api/mentoring.js';
import auth from '../api/mentoring-auth.js';
process.env.APP_ORIGIN = 'http://localhost:8787';
const root = resolve('public');
const types = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.png':'image/png', '.svg':'image/svg+xml', '.woff2':'font/woff2', '.webp':'image/webp', '.json':'application/json' };
createServer(async (req, res) => {
  const url = new URL(req.url, process.env.APP_ORIGIN);
  if (url.pathname === '/api/mentoring' || url.pathname.startsWith('/api/auth/')) {
    let body = ''; for await (const chunk of req) { body += chunk; if (body.length > 10000) { res.writeHead(413).end(); return; } }
    req.body = body; req.query = Object.fromEntries(url.searchParams);
    if (url.pathname.startsWith('/api/auth/')) req.query.route = url.pathname.slice('/api/auth/'.length);
    return (url.pathname === '/api/mentoring' ? api : auth)(req, res);
  }
  try {
    let path = resolve(root, '.' + decodeURIComponent(url.pathname));
    if (path !== root && !path.startsWith(root + sep)) throw new Error();
    if ((await stat(path)).isDirectory()) path = resolve(path, 'index.html');
    res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' });
    res.end(await readFile(path));
  } catch { res.writeHead(404).end('Not found'); }
}).listen(8787, '127.0.0.1', () => console.log('Mentoring preview: http://localhost:8787/mentoring/'));
