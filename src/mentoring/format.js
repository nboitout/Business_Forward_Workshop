export const hours = minutes => { const m = Math.round(Math.abs(minutes)); return `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}`; };
export const elapsed = seconds => { const s = Math.max(0, Math.floor(seconds)); return [Math.floor(s / 3600), Math.floor(s % 3600 / 60), s % 60].map(v => String(v).padStart(2, '0')).join(':'); };
export function totals(entries, companyId) {
  const own = entries.filter(e => e.companyId === companyId);
  const meeting = own.reduce((n,e) => n + e.meetingMinutes, 0);
  const followup = own.reduce((n,e) => n + e.followupMinutes, 0);
  return { entries: own, meeting, followup, used: meeting + followup };
}
export function sessionSegments(entries, budgetMinutes) {
  const ordered = [...entries].sort((a,b)=>(a.sessionNumber ?? 0)-(b.sessionNumber ?? 0));
  const used = ordered.reduce((sum,e)=>sum+e.meetingMinutes+e.followupMinutes,0);
  // An overrun keeps every segment visible; the card separately reports the excess.
  const scale = Math.max(budgetMinutes,used,1);
  return ordered.map((entry,index)=>({ ...entry, number:entry.sessionNumber ?? index+1, width:100*(entry.meetingMinutes+entry.followupMinutes)/scale }));
}
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const csvCell = value => '"' + String(value ?? '').replace(/^[=+@\-\t\r]/, m => "'" + m).replace(/"/g, '""') + '"';
