import { createAuthClient } from '@neondatabase/auth';
import { hours, totals, sessionSegments, escapeHtml as esc, csvCell } from './format.js';
import { setupContact } from './contact.js';
const $ = selector => document.querySelector(selector);
const auth = createAuthClient(`${location.origin}/api/auth`);
const email = 'nicolas@agentic-sdlc.it';
let data, admin = false, selected = location.hash.slice(1), lastSync = 0, loadId = 0, saving = false, resetMode = false, editing = null, requestId = null;
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Bucharest' });
const company = () => data?.companies.find(c => c.id === selected);
const dateLabel = date => date ? new Intl.DateTimeFormat('en-GB', { day:'numeric', month:'short', year:'numeric', timeZone:'Europe/Bucharest' }).format(new Date(`${date}T12:00:00Z`)) : 'Date to confirm';
let pinnedSession = null, tipHideTimeout;
function hideSessionTip() { clearTimeout(tipHideTimeout); $('#session-tooltip').hidden = true; pinnedSession = null; }
function showSessionTip(button) {
  clearTimeout(tipHideTimeout);
  const entry = data?.entries.find(e=>e.id===button.dataset.session);
  if (!entry) return;
  const tip=$('#session-tooltip'), rect=button.getBoundingClientRect();
  tip.innerHTML=`<strong>Session ${button.dataset.sessionNumber} · ${esc(entry.label || 'Mentoring session')}</strong>${entry.status === 'planned' ? '<span>Planned · time reserved</span>' : ''}<span>${esc(dateLabel(entry.date))}</span><p>${hours(entry.meetingMinutes)} meeting + ${hours(entry.followupMinutes)} follow-up / preparation</p><b>${hours(entry.meetingMinutes+entry.followupMinutes)} total</b>`;
  tip.hidden=false;
  tip.style.left=`${Math.max(10,Math.min(rect.left,innerWidth-tip.offsetWidth-10))}px`;
  tip.style.top=`${rect.bottom+tip.offsetHeight+12 < innerHeight ? rect.bottom+8 : Math.max(10,rect.top-tip.offsetHeight-8)}px`;
}
function notice(message) { $('#notice').textContent = message; $('#notice').hidden = !message; }
async function api(body, useAdmin = admin) {
  const response = await fetch(`/api/mentoring${useAdmin ? '?view=admin' : ''}`, { method: body ? 'POST' : 'GET', credentials:'same-origin', cache:'no-store', headers: body ? {'Content-Type':'application/json'} : {}, body: body ? JSON.stringify(body) : undefined, signal:AbortSignal.timeout(20000) });
  const result = await response.json();
  if (!response.ok) { const error = new Error(result.error || 'Unable to load the tracker.'); error.status = response.status; throw error; }
  return result;
}
async function refresh(silent = false) {
  const id = ++loadId;
  try {
    const next = await api();
    if (id !== loadId) return;
    const changed = !data || JSON.stringify([data.companies,data.entries,data.mentor]) !== JSON.stringify([next.companies,next.entries,next.mentor]);
    data = next;
    lastSync = Date.now();
    if (!data.companies.some(c => c.id === selected)) selected = data.companies[0]?.id;
    if (!silent) notice('');
    $('#sync-status').classList.remove('offline');
    $('#sync-status').textContent = 'Live · updates every 20s';
    if (changed) render();
  } catch (error) {
    if (id !== loadId) return;
    if (error.status === 401 && admin) {
      admin = false; data = null; renderAccess(); $('#company-detail').hidden = true;
      $('#company-grid').innerHTML = '<div class="loading-card">Your session expired. Reloading public data…</div>';
      notice('Your sign-in expired. Sign in again to continue editing.');
      return refresh(true);
    }
    $('#sync-status').textContent = data ? 'Connection lost · showing last saved data' : 'Unable to connect';
    $('#sync-status').classList.add('offline');
    if (!data) $('#company-grid').innerHTML = '<div class="loading-card">The tracker could not be loaded.<br><button id="retry" class="text-button">Try again</button></div>';
    if (!silent) notice(error.message);
  } finally { $('#company-grid').setAttribute('aria-busy','false'); }
}
function renderAccess() {
  $('#admin-tools').hidden = !admin; $('#detail-actions').hidden = !admin;
  $('#mentor-access').hidden = admin; $('#sign-out').hidden = !admin;
}
function render() {
  hideSessionTip();
  renderAccess();
  const initials = {'acc':'ACC','elmar-trading':'ET','laboratorul-de-bucurii':'LB','scule-tencuiala':'ST','ai-consulting':'A&I'};
  $('#company-grid').innerHTML = data.companies.map(c => {
    const t = totals(data.entries,c.id), remaining = c.budgetMinutes - t.committed;
    const segments = sessionSegments(t.entries,c.budgetMinutes);
    const bar = segments.map(e=>`<button class="session-segment session-color-${(e.number-1)%5} ${e.status === 'planned' ? 'is-planned' : ''}" style="width:${e.width}%" data-session="${esc(e.id)}" data-session-number="${e.number}" aria-describedby="session-tooltip" aria-label="${esc(c.name)} · ${e.status === 'planned' ? 'Planned' : 'Completed'} session ${e.number} · ${esc(e.label || 'Mentoring session')} · ${esc(dateLabel(e.date))} · ${hours(e.meetingMinutes)} meeting + ${hours(e.followupMinutes)} follow-up"><span aria-hidden="true">${e.status === 'planned' ? 'P' : e.number}</span></button>`).join('');
    return `<article class="company-card" data-selected="${c.id === selected}"><button class="company-select" data-company="${esc(c.id)}" aria-pressed="${c.id === selected}" aria-label="View ${esc(c.name)}"><span class="card-top"><span class="monogram">${esc(initials[c.id])}</span><span class="card-arrow" aria-hidden="true">↗</span></span><span class="company-name">${esc(c.name)}</span><span class="remaining ${remaining < 0 ? 'over' : ''}">${hours(remaining)}</span><span class="remaining-label">${remaining < 0 ? 'over budget' : 'available'}</span></button><div class="session-bar" role="group" aria-label="${esc(c.name)} session breakdown">${bar}</div><span class="card-meta"><span>${hours(t.used)} used</span><span>${hours(c.budgetMinutes)} allocated</span></span>${t.reserved ? `<small class="reserved-note">${hours(t.reserved)} reserved for planned work</small>` : ''}</article>`;
  }).join('');
  if (!company()) return;
  $('#company-detail').hidden = false;
  $('#detail-heading').textContent = company().name;
  const t = totals(data.entries,selected), remaining = company().budgetMinutes - t.committed;
  $('#detail-stats').innerHTML = `<div class="stat"><span>Time allocated</span><strong>${hours(company().budgetMinutes)}</strong><small>Total budget through 15 November 2026</small></div><div class="stat"><span>Time completed</span><strong>${hours(t.used)}</strong><small>${hours(t.meeting)} meetings + ${hours(t.followup)} follow-up / preparation</small></div><div class="stat"><span>Time reserved</span><strong>${hours(t.reserved)}</strong><small>Planned work · already deducted from available time</small></div><div class="stat"><span>${remaining < 0 ? 'Over budget' : 'Time available'}</span><strong class="${remaining < 0 ? 'over' : ''}">${hours(remaining)}</strong><small>${remaining < 0 ? 'Discuss the additional time with Nicolas' : 'Allocation minus completed and reserved time'}</small></div>`;
  $('#export-csv').disabled = !t.entries.length;
  $('#history').innerHTML = t.entries.length ? `<div class="table-scroll"><table class="history-table"><thead><tr><th>SESSION / DATE</th><th>MEETING</th><th>FOLLOW-UP / PREPARATION</th><th>TOTAL</th>${admin ? '<th>PRIVATE NOTES</th><th>ACTIONS</th>' : ''}</tr></thead><tbody>${sessionSegments(t.entries,company().budgetMinutes).reverse().map(e => `<tr><td><strong>${e.number}. ${esc(e.label || 'Mentoring session')}</strong>${e.status === 'planned' ? '<span class="planned-badge">Planned · reserved</span>' : ''}<small class="session-date">${esc(dateLabel(e.date))}</small></td><td>${hours(e.meetingMinutes)}</td><td>${hours(e.followupMinutes)}</td><td><strong>${hours(e.meetingMinutes + e.followupMinutes)}</strong></td>${admin ? `<td class="note-cell">${esc(e.note || '—')}</td><td><button class="row-action" data-edit="${esc(e.id)}">Edit</button><button class="row-action danger" data-void="${esc(e.id)}">Remove</button></td>` : ''}</tr>`).join('')}</tbody></table></div>` : `<div class="empty"><span class="empty-mark" aria-hidden="true">↗</span><div><strong>Your mentoring journey starts here.</strong><p>No sessions recorded yet. ${admin ? 'Log the first meeting when it has taken place.' : 'Your time balance will update here after each session.'}</p></div></div>`;
  updateSyncStatus();
}
function updateSyncStatus() {
  if (lastSync && Date.now() - lastSync > 45000 && !$('#sync-status').classList.contains('offline')) { $('#sync-status').textContent = 'Waiting for connection · last saved data'; $('#sync-status').classList.add('offline'); }
}
function openEntry(entry = null) {
  editing = entry; requestId = entry?.id || crypto.randomUUID();
  const form = $('#entry-form'); form.reset(); $('#entry-error').textContent = '';
  form.elements.companyId.innerHTML = data.companies.map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
  form.elements.companyId.value = entry?.companyId || selected;
  form.elements.companyId.disabled = Boolean(entry);
  form.elements.sessionDate.value = entry ? (entry.date || '') : today();
  form.elements.label.value = entry?.label || 'Mentoring session';
  form.elements.status.value = entry?.status || 'completed';
  form.elements.meetingMinutes.value = entry?.meetingMinutes ?? 60;
  form.elements.followupMinutes.value = entry?.followupMinutes ?? 60;
  form.elements.note.value = entry?.note || '';
  $('#entry-title').textContent = entry ? 'Edit session' : 'Log a meeting';
  entryTotal(); $('#entry-dialog').showModal();
}
function entryTotal() {
  const f=$('#entry-form').elements, planned=f.status.value === 'planned';
  f.sessionDate.required=!planned;
  if(planned) f.sessionDate.removeAttribute('max'); else f.sessionDate.max=today();
  $('#session-date-hint').textContent=planned ? 'Leave blank until the date is confirmed.' : 'Use the date the work was completed.';
  $('#entry-total').textContent=`${hours(Number(f.meetingMinutes.value) + Number(f.followupMinutes.value))} will be ${planned ? 'reserved, not marked as completed' : 'recorded as completed'}`;
}
async function mutate(body) {
  if (saving) throw new Error('A save is already in progress.');
  saving = true;
  try { await api(body,true); await refresh(true); }
  finally { saving = false; }
}
async function busy(form, action, errorTarget) {
  const buttons = [...form.querySelectorAll('button')]; buttons.forEach(b => b.disabled=true);
  $(errorTarget).textContent='';
  try { await action(); } catch (error) { $(errorTarget).textContent=error.message || 'Something went wrong. Try again.'; }
  finally { buttons.forEach(b => b.disabled=false); }
}
document.addEventListener('click', async event => {
  const segment = event.target.closest('[data-session]');
  if (segment) { const wasPinned=pinnedSession===segment.dataset.session; hideSessionTip(); if(!wasPinned){pinnedSession=segment.dataset.session;showSessionTip(segment);} return; }
  if (!event.target.closest('#session-tooltip')) hideSessionTip();
  const close = event.target.closest('[data-close]'); if (close) { if (!saving) close.closest('dialog').close(); return; }
  const choice = event.target.closest('[data-company]');
  if (choice) { selected=choice.dataset.company; history.replaceState(null,'',`#${selected}`); render(); return; }
  const edit = event.target.closest('[data-edit]'); if (edit) openEntry(data.entries.find(e => e.id === edit.dataset.edit));
  const remove = event.target.closest('[data-void]');
  if (remove) {
    const entry=data.entries.find(e=>e.id===remove.dataset.void);
    if (!confirm(`Remove the ${dateLabel(entry.date)} session (${hours(entry.meetingMinutes + entry.followupMinutes)})? The time will return to the company’s balance.`)) return;
    remove.disabled=true;
    try { await mutate({action:'void-entry',id:entry.id,updatedAt:entry.updatedAt}); notice('Session removed. The time balance has been updated.'); } catch(error) { notice(error.message); remove.disabled=false; }
  }
  if (event.target.closest('#retry')) refresh();
});
$('#mentor-access').onclick=()=>{$('#login-dialog').showModal();};
$('#log-session').onclick=$('#add-session').onclick=()=>openEntry();
$('#entry-form').addEventListener('input',entryTotal);
$('#entry-form').onsubmit=event=>{
  event.preventDefault(); const form=event.currentTarget;
  busy(form,async()=>{
    const f=form.elements;
    const body={action:'save-entry',id:requestId,companyId:f.companyId.value,sessionDate:f.sessionDate.value,status:f.status.value,label:f.label.value,meetingMinutes:Number(f.meetingMinutes.value),followupMinutes:Number(f.followupMinutes.value),note:f.note.value};
    if (editing) body.updatedAt=editing.updatedAt;
    if (!(body.meetingMinutes+body.followupMinutes)) throw new Error('Record at least one minute.');
    await mutate(body); $('#entry-dialog').close(); notice('Session saved. The public time balance has been updated.');
  },'#entry-error');
};
$('#edit-budget').onclick=()=>{ $('#budget-form').elements.hours.value=company().budgetMinutes/60; $('#budget-title').textContent=`Budget · ${company().name}`; $('#budget-error').textContent=''; $('#budget-dialog').showModal(); };
$('#budget-form').onsubmit=event=>{event.preventDefault();const f=event.currentTarget;busy(f,async()=>{await mutate({action:'budget',companyId:selected,budgetMinutes:Number(f.elements.hours.value)*60});$('#budget-dialog').close();notice('Time budget updated.');},'#budget-error');};
$('#login-form').onsubmit=event=>{
  event.preventDefault();const form=event.currentTarget;
  busy(form,async()=>{
    if (resetMode) {
      if (form.elements.newPassword.value !== form.elements.confirmPassword.value) throw new Error('The two passwords do not match.');
      const result=await auth.emailOtp.resetPassword({email,otp:form.elements.otp.value,password:form.elements.newPassword.value});
      if(result.error) throw new Error(result.error.message);
      setResetMode(false); form.elements.password.value=''; $('#login-copy').textContent='Your password is set. Sign in to start tracking.'; return;
    }
    const result=await auth.signIn.email({email,password:form.elements.password.value});
    if(result.error) throw new Error(result.error.message || 'Check your password and try again.');
    await api(null,true); admin=true; form.elements.password.value=''; $('#login-dialog').close(); await refresh();
  },'#login-error');
};
function setResetMode(value) {
  resetMode=value;$('#password-fields').hidden=value;$('#reset-fields').hidden=!value;$('#reset-password').hidden=value;$('#back-to-login').hidden=!value;
  const f=$('#login-form').elements;f.password.required=!value;f.otp.required=value;f.newPassword.required=value;f.confirmPassword.required=value;
  $('#login-title').textContent=value?'Set your mentor password.':'Welcome back, Nicolas.';
  $('#login-copy').textContent=value?'Enter the code sent to nicolas@agentic-sdlc.it, then choose a password.':'Sign in to record sessions and manage time budgets.';
  $('#login-submit').textContent=value?'Save password →':'Sign in →';$('#login-error').textContent='';
}
$('#reset-password').onclick=()=>busy($('#login-form'),async()=>{
  const result=await auth.forgetPassword.emailOtp({email});
  if(result.error) throw new Error(result.error.message);
  setResetMode(true);
},'#login-error');
$('#back-to-login').onclick=()=>setResetMode(false);
$('#sign-out').onclick=async()=>{
  $('#sign-out').disabled=true;
  try { const result=await auth.signOut(); if(result.error)throw new Error(result.error.message); admin=false; data=null; $('#history').replaceChildren(); await refresh(); notice('Signed out. You are viewing the public dashboard.'); }
  catch(error){notice(error.message);}finally{$('#sign-out').disabled=false;}
};
$('#export-csv').onclick=()=>{
  const rows=[['Company','Session number','Session','Status','Date (Europe/Bucharest)','Meeting minutes','Follow-up minutes','Total minutes'],...sessionSegments(totals(data.entries,selected).entries,company().budgetMinutes).map(e=>[company().name,e.number,e.label,e.status || 'completed',e.date || 'Date to confirm',e.meetingMinutes,e.followupMinutes,e.meetingMinutes+e.followupMinutes])];
  const blob=new Blob(['\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`mentoring-${selected}-${today()}.csv`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
window.addEventListener('hashchange',()=>{if(data?.companies.some(c=>c.id===location.hash.slice(1))){selected=location.hash.slice(1);render();}});
document.addEventListener('pointerover',event=>{if(event.target.closest('[data-session],#session-tooltip'))clearTimeout(tipHideTimeout);const segment=event.target.closest('[data-session]');if(segment&&!pinnedSession)showSessionTip(segment);});
document.addEventListener('pointerout',event=>{if(pinnedSession)return;const target=event.relatedTarget;if(!target?.closest?.('[data-session],#session-tooltip')){clearTimeout(tipHideTimeout);tipHideTimeout=setTimeout(hideSessionTip,180);}});
document.addEventListener('focusin',event=>{const segment=event.target.closest('[data-session]');if(segment)showSessionTip(segment);else if(!pinnedSession)hideSessionTip();});
document.addEventListener('keydown',event=>{if(event.key==='Escape')hideSessionTip();});
window.addEventListener('scroll',hideSessionTip,{passive:true});
window.addEventListener('resize',hideSessionTip);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh(true);});
window.addEventListener('online',()=>refresh(true));
setupContact();
setInterval(()=>{if(!document.hidden)refresh(true);},20000);setInterval(updateSyncStatus,1000);
await refresh();
try { const result=await auth.getSession();if(result.data?.user){await api(null,true);admin=true;await refresh();} } catch { /* Public access remains available when signed out. */ }
