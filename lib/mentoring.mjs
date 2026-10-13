export const MENTOR_EMAIL = 'nicolas@agentic-sdlc.it';
export function validateEntry(input, today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Bucharest' })) {
  const date = String(input.sessionDate || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || date > today || date < '2020-01-01') throw new Error('Choose a valid session date, today or earlier.');
  const meeting = Number(input.meetingMinutes), followup = Number(input.followupMinutes);
  if (![meeting, followup].every(v => Number.isInteger(v) && v >= 0 && v <= 1440) || meeting + followup === 0) throw new Error('Enter a positive duration, with at most 24 hours for each part.');
  const note = String(input.note || '').trim();
  if (note.length > 2000) throw new Error('Keep private notes under 2,000 characters.');
  if (!['acc','elmar-trading','laboratorul-de-bucurii','scule-tencuiala','ai-consulting'].includes(input.companyId)) throw new Error('Choose a company.');
  const label = String(input.label || 'Mentoring session').trim();
  if (!label || label.length > 80) throw new Error('Enter a session name of up to 80 characters.');
  return { companyId: input.companyId, date, meeting, followup, note, label };
}
export function requireUuid(value) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value || '')) throw new Error('Invalid session identifier.');
  return value;
}
export function publicSnapshot(companies, entries, timer, serverTime) {
  return {
    companies: companies.map(c => ({ id: c.id, name: c.name, budgetMinutes: c.budget_minutes })),
    entries: entries.map(e => ({ id: e.id, companyId: e.company_id, date: e.session_date, meetingMinutes: e.meeting_minutes, followupMinutes: e.followup_minutes, label: e.session_label, sessionNumber: e.session_number })),
    timer: timer ? { companyId: timer.company_id, startedAt: timer.started_at } : null,
    serverTime
  };
}
