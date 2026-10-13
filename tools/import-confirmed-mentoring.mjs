// Deliberate one-time import; IDs make retries safe and existing records are never overwritten.
import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { validateEntry } from '../lib/mentoring.mjs';
const source=JSON.parse(await readFile('database/imports/2026-10-13-confirmed-sessions.json','utf8'));
const client=new pg.Client({connectionString:process.env.DATABASE_URL.replace('-pooler.', '.').replace('sslmode=require','sslmode=verify-full'),application_name:'mentoring-confirmed-import'});
await client.connect();
try {
  await client.query('BEGIN');
  await client.query('LOCK TABLE mentoring_entries IN SHARE ROW EXCLUSIVE MODE');
  let count=0;
  for (const company of source.companies) {
    const {rows:existing}=await client.query('SELECT id FROM mentoring_entries WHERE company_id=$1',[company.id]);
    if(existing.some(e=>!company.sessions.some(s=>s.id===e.id))) throw new Error(`Existing sessions for ${company.id}; reconcile them before importing.`);
    for (const s of company.sessions) {
      validateEntry({companyId:company.id,sessionDate:s.date,meetingMinutes:s.meetingMinutes,followupMinutes:s.followupMinutes,label:s.label});
      const result=await client.query('INSERT INTO mentoring_entries (id,company_id,session_number,session_label,session_date,meeting_minutes,followup_minutes) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING RETURNING id',[s.id,company.id,s.number,s.label,s.date,s.meetingMinutes,s.followupMinutes]);
      if(result.rowCount) {
        count++;
        await client.query('INSERT INTO mentoring_audit (actor_id,action,record_id,details) VALUES ($1,$2,$3,$4)',[process.env.MENTOR_USER_ID,'import-confirmed-session',s.id,JSON.stringify({source:source.source,companyId:company.id,...s})]);
      }
    }
  }
  await client.query('COMMIT');
  console.log(`Imported ${count} confirmed sessions. Existing records were preserved.`);
}catch(error){await client.query('ROLLBACK');throw error;}finally{await client.end();}
