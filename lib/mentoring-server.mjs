import pg from 'pg';
import { attachDatabasePool } from '@vercel/functions';
import { MENTOR_EMAIL } from './mentoring.mjs';
let pool;
export function db() {
  if (!process.env.DATABASE_URL) throw new Error('Database is not configured.');
  if (!pool) {
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 3, idleTimeoutMillis: 5000, connectionTimeoutMillis: 15000 });
    attachDatabasePool(pool);
  }
  return pool;
}
export function sameOrigin(req) {
  const origin = req.headers.origin;
  // State-changing browser calls must be same-origin. GET never changes data.
  if (!origin) return false;
  const expected = process.env.APP_ORIGIN || 'https://businessforwardworkshop.vercel.app';
  return origin === expected;
}
export async function mentorSession(req) {
  if (!process.env.NEON_AUTH_BASE_URL || !process.env.MENTOR_USER_ID || !req.headers.cookie) return null;
  const response = await fetch(`${process.env.NEON_AUTH_BASE_URL}/get-session`, {
    headers: { cookie: req.headers.cookie, origin: process.env.APP_ORIGIN || 'https://businessforwardworkshop.vercel.app' },
    signal: AbortSignal.timeout(10000), cache: 'no-store'
  });
  if (!response.ok) return null;
  const session = await response.json();
  return session?.user?.id === process.env.MENTOR_USER_ID && session.user.email?.toLowerCase() === MENTOR_EMAIL && session.session ? session : null;
}
export function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.statusCode = status;
  res.end(JSON.stringify(body));
}
