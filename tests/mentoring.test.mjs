import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEntry, publicSnapshot } from '../lib/mentoring.mjs';
import { totals, hours, elapsed, csvCell } from '../src/mentoring/format.js';
const entry={companyId:'acc',sessionDate:'2026-10-13',meetingMinutes:60,followupMinutes:60};
test('a standard session charges both meeting and follow-up time',()=>{
  const valid=validateEntry(entry,'2026-10-13'); assert.equal(valid.meeting+valid.followup,120);
  assert.equal(totals([entry],'acc').used,120); assert.equal(hours(600-totals([entry],'acc').used),'8h');
});
test('five sessions use exactly the ten-hour allowance and a sixth remains visible',()=>{
  const five=Array(5).fill(entry); assert.equal(totals(five,'acc').used,600);
  assert.equal(totals([...five,entry],'acc').used,720);
});
test('rejects negative, fractional, impossible and future entries',()=>{
  for(const change of [{meetingMinutes:-1},{meetingMinutes:1.5},{followupMinutes:1441},{meetingMinutes:0,followupMinutes:0},{sessionDate:'2026-02-30'},{sessionDate:'2026-10-14'},{companyId:'unknown'},{note:'x'.repeat(2001)}]) assert.throws(()=>validateEntry({...entry,...change},'2026-10-13'));
});
test('public response never leaks private notes or audit fields',()=>{
  const result=publicSnapshot([{id:'acc',name:'ACC',budget_minutes:600,private:'secret'}],[{id:'one',company_id:'acc',session_date:'2026-10-13',meeting_minutes:60,followup_minutes:60,private_note:'CONFIDENTIAL',created_at:'secret',actor_id:'mentor'}],{company_id:'acc',started_at:'2026-10-13T10:00:00Z',private_note:'CONFIDENTIAL'},'now');
  assert.doesNotMatch(JSON.stringify(result),/CONFIDENTIAL|secret|mentor|private_note|actor_id/);
  assert.deepEqual(Object.keys(result.entries[0]),['id','companyId','date','meetingMinutes','followupMinutes']);
});
test('timer duration survives reload and formats over an hour',()=>{assert.equal(elapsed(3671),'01:01:11');assert.equal(elapsed(-1),'00:00:00');assert.equal(hours(125),'2h 5m');});
test('company totals cannot include another company',()=>{assert.equal(totals([entry,{...entry,companyId:'elmar-trading'}],'acc').used,120);});
test('CSV export escapes quotes and spreadsheet formulas',()=>{assert.equal(csvCell('A"B'),'"A""B"');assert.equal(csvCell('=1+1'),'"\'=1+1"');});
