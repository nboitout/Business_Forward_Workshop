import { sameOrigin, send } from '../lib/mentoring-server.mjs';
import { MENTOR_EMAIL } from '../lib/mentoring.mjs';
// Same-origin proxy retains Neon's managed sessions on browsers that block third-party cookies.
const routes = new Map([
  ['get-session', 'GET'], ['sign-in/email', 'POST'], ['sign-out', 'POST'],
  ['forget-password/email-otp', 'POST'], ['email-otp/reset-password', 'POST'],
  ['email-otp/request-password-reset', 'POST']
]);
export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const route = req.query?.route || url.searchParams.get('route') || '';
  if (routes.get(route) !== req.method) return send(res, 404, { message: 'Not found.' });
  if (!process.env.NEON_AUTH_BASE_URL) return send(res, 503, { message: 'Sign-in is being connected. Please try again later.' });
  if (req.method === 'POST' && !sameOrigin(req)) return send(res, 403, { message: 'Request origin is not allowed.' });
  try {
    const body = req.method === 'POST' ? (typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}) : null;
    if (body?.email && body.email.toLowerCase() !== MENTOR_EMAIL) return send(res, 403, { message: 'This sign-in is reserved for the programme mentor.' });
    const upstream = await fetch(`${process.env.NEON_AUTH_BASE_URL}/${route}`, {
      method: req.method, headers: { 'content-type': 'application/json', cookie: req.headers.cookie || '', origin: process.env.APP_ORIGIN || 'https://businessforwardworkshop.vercel.app' },
      body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000), redirect: 'manual'
    });
    const cookies = upstream.headers.getSetCookie();
    if (cookies.length) res.setHeader('Set-Cookie', cookies.map(c => c.replace(/;\s*Domain=[^;]+/ig, '')));
    const content = await upstream.text();
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = upstream.status;
    res.end(content);
  } catch { return send(res, 502, { message: 'Sign-in could not be reached. Please try again.' }); }
}
