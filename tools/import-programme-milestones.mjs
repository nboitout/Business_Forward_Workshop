import pg from 'pg';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateEntry } from '../lib/mentoring.mjs';

export async function importProgrammeMilestones(client, actorId) {
  const source=JSON.parse(await readFile(new URL('../database/imports/2026-10-14-programme-milestones.json',import.meta.url),'utf8'));
  let count=0;
  await client.query('BEGIN');
  try {
    for (const [index, companyId] of source.companies.entries()) {
      await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',[`mentoring-session:${companyId}`]);
      for (const [offset, session] of source.sessions.entries()) {
        const id=`f8ae6d04-5023-4d9b-afc4-${String(index*2+offset+1).padStart(12,'0')}`;
        validateEntry({...session,companyId,sessionDate:session.date});
        const result=await client.query(`INSERT INTO mentoring_entries (id,company_id,session_date,meeting_minutes,followup_minutes,session_label,status,session_number)
          SELECT $1,$2,$3,$4,$5,$6,$7,coalesce(max(session_number),0)+1 FROM mentoring_entries WHERE company_id=$2
          ON CONFLICT (id) DO NOTHING RETURNING id`,[id,companyId,session.date,session.meetingMinutes,session.followupMinutes,session.label,session.status]);
        if (result.rowCount) {
          count++;
          await client.query('INSERT INTO mentoring_audit(actor_id,action,record_id,details) VALUES($1,$2,$3,$4)',[actorId,'import-programme-milestone',id,JSON.stringify({source:source.source,companyId,...session})]);
        }
      }
    }
    await client.query('COMMIT');
    return count;
  } catch(error) { await client.query('ROLLBACK');throw error; }
}

if(process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const client=new pg.Client({connectionString:process.env.DATABASE_URL.replace('-pooler.','.').replace('sslmode=require','sslmode=verify-full'),application_name:'mentoring-milestones-import'});
  await client.connect();
  try { console.log(`Imported ${await importProgrammeMilestones(client,process.env.MENTOR_USER_ID)} programme milestones.`); }
  finally { await client.end(); }
}
