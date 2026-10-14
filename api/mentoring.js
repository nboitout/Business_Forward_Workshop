import { db, mentorSession, sameOrigin, send } from '../lib/mentoring-server.mjs';
import { publicSnapshot, validateEntry, requireUuid } from '../lib/mentoring.mjs';

export function createHandler({ database = db, getSession = mentorSession, checkOrigin = sameOrigin } = {}) {
return async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) return send(res, 405, { error: 'Method not allowed.' });
  const url = new URL(req.url, 'http://localhost');
  const admin = (req.query?.view || url.searchParams.get('view')) === 'admin';
  try {
    const session = admin || req.method === 'POST' ? await getSession(req) : null;
    if ((admin || req.method === 'POST') && !session) return send(res, 401, { error: 'Please sign in as the mentor.' });
    if (req.method === 'GET') {
      // One snapshot prevents totals and history disagreeing during a concurrent save.
      const { rows: [data] } = await database().query(`SELECT
        (SELECT coalesce(json_agg(c ORDER BY display_order), '[]') FROM mentoring_companies c) companies,
        (SELECT coalesce(json_agg(e ORDER BY session_number DESC NULLS LAST, created_at DESC), '[]') FROM mentoring_entries e WHERE voided_at IS NULL) entries,
        (SELECT row_to_json(t) FROM mentoring_timer t WHERE id = 1) timer, now() AS server_time`);
      const result = publicSnapshot(data.companies, data.entries, data.timer, data.server_time);
      if (admin) {
        result.entries.forEach((entry, i) => { entry.note = data.entries[i].private_note; entry.updatedAt = data.entries[i].updated_at; });
        if (result.timer) result.timer.note = data.timer.private_note;
        result.mentor = session.user.email;
      }
      return send(res, 200, result);
    }
    if (!checkOrigin(req)) return send(res, 403, { error: 'Request origin is not allowed.' });
    let body;
    try { body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}; } catch { return send(res, 400, { error: 'Invalid request.' }); }
    const client = await database().connect();
    try {
      await client.query('BEGIN');
      const { action } = body;
      let recordId = body.id || body.companyId;
      let details = {};
      if (action === 'save-entry' || action === 'stop-timer') {
        const entry = validateEntry(body);
        if (action === 'stop-timer' && entry.status !== 'completed') throw new Error('A finished timer must be recorded as completed.');
        recordId = requireUuid(body.id);
        if (action === 'stop-timer') {
          const { rows: [timer] } = await client.query('SELECT * FROM mentoring_timer WHERE id = 1 FOR UPDATE');
          // Network retries use the same UUID; do not charge the meeting twice.
          if (!timer) {
            const existing = await client.query('SELECT id FROM mentoring_entries WHERE id = $1', [recordId]);
            if (!existing.rowCount) throw new Error('This timer has already been stopped. Refresh the page.');
            await client.query('ROLLBACK');
            return send(res, 200, { ok: true });
          }
          if (timer.company_id !== entry.companyId || new Date(timer.started_at).getTime() !== new Date(body.startedAt).getTime()) throw new Error('The active timer changed. Refresh before saving.');
        }
        if (body.updatedAt && action === 'save-entry') {
          const result = await client.query(`UPDATE mentoring_entries SET session_date=$2, meeting_minutes=$3, followup_minutes=$4, private_note=$5, session_label=$7, status=$8, updated_at=now() WHERE id=$1 AND updated_at=$6 AND voided_at IS NULL RETURNING id`, [recordId, entry.date, entry.meeting, entry.followup, entry.note, body.updatedAt, entry.label, entry.status]);
          if (!result.rowCount) throw new Error('This entry changed in another tab. Refresh before editing.');
        } else {
          await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`mentoring-session:${entry.companyId}`]);
          await client.query(`INSERT INTO mentoring_entries (id,company_id,session_date,meeting_minutes,followup_minutes,private_note,session_label,status,session_number) SELECT $1,$2,$3,$4,$5,$6,$7,$8,coalesce(max(session_number),0)+1 FROM mentoring_entries WHERE company_id=$2 ON CONFLICT (id) DO NOTHING`, [recordId, entry.companyId, entry.date, entry.meeting, entry.followup, entry.note, entry.label, entry.status]);
        }
        if (action === 'stop-timer') await client.query('DELETE FROM mentoring_timer WHERE id = 1');
        details = { companyId: entry.companyId, meetingMinutes: entry.meeting, followupMinutes: entry.followup, status: entry.status, sessionDate: entry.date };
      } else if (action === 'start-timer') {
        validateEntry({ ...body, sessionDate: new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Bucharest' }), meetingMinutes: 60, followupMinutes: 60 });
        const result = await client.query('INSERT INTO mentoring_timer (id,company_id,private_note) VALUES (1,$1,$2) ON CONFLICT (id) DO NOTHING RETURNING id', [body.companyId, String(body.note || '')]);
        if (!result.rowCount) throw new Error('A timer is already running. Stop it before starting another.');
      } else if (action === 'void-entry') {
        recordId = requireUuid(body.id);
        const result = await client.query('UPDATE mentoring_entries SET voided_at=now(),updated_at=now() WHERE id=$1 AND updated_at=$2 AND voided_at IS NULL RETURNING id', [recordId, body.updatedAt]);
        if (!result.rowCount) throw new Error('This entry changed. Refresh before removing it.');
      } else if (action === 'budget') {
        const minutes = Number(body.budgetMinutes);
        if (!Number.isInteger(minutes) || minutes < 0 || minutes > 60000) throw new Error('Enter a budget between 0 and 1,000 hours.');
        const result = await client.query('UPDATE mentoring_companies SET budget_minutes=$2 WHERE id=$1 RETURNING id', [body.companyId, minutes]);
        if (!result.rowCount) throw new Error('Company not found.');
        details = { budgetMinutes: minutes };
      } else { throw new Error('Unknown action.'); }
      await client.query('INSERT INTO mentoring_audit (actor_id,action,record_id,details) VALUES ($1,$2,$3,$4)', [session.user.id, action, recordId, JSON.stringify(details)]);
      await client.query('COMMIT');
      return send(res, 200, { ok: true });
    } catch (error) {
      await client.query('ROLLBACK');
      if (!error.code) return send(res, 400, { error: error.message });
      throw error;
    } finally { client.release(); }
  } catch (error) {
    console.error('Mentoring request failed', error.code || error.name);
    return send(res, 503, { error: 'The tracker is temporarily unavailable. Please try again.' });
  }
};
}
export default createHandler();
