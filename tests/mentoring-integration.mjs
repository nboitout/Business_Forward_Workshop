// Run explicitly with .env.local. All writes use connection-local TEMP tables.
// Public production tables and real account/session data are never modified.
import pg from 'pg';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { createHandler } from '../api/mentoring.js';
// TEMP tables require a DIRECT connection: transaction pooling must never be used.
const directUrl=process.env.DATABASE_URL.replace('-pooler.', '.').replace('sslmode=require','sslmode=verify-full');
const client=new pg.Client({connectionString:directUrl,application_name:'mentoring-temp-tests'});
await client.connect();
const baseline=(await client.query('SELECT count(*)::int n FROM public.mentoring_entries')).rows[0].n;
try {
  const schema=(await readFile('database/mentoring.sql','utf8')).replaceAll('CREATE TABLE','CREATE TEMP TABLE');
  await client.query(schema);
  await client.query(await readFile('database/migrations/002_session_segments.sql','utf8'));
  client.release=()=>{};
  const handler=createHandler({database:()=>({query:(...args)=>client.query(...args),connect:async()=>client}),getSession:async req=>req.headers.testAdmin?{user:{id:'test-mentor',email:'nicolas@agentic-sdlc.it'}}:null,checkOrigin:req=>req.headers.origin==='http://localhost:8787'});
  async function call(body=null, admin=true, origin='http://localhost:8787', view=admin?'admin':'') {
    let output;const res={setHeader(){},end(v){output=JSON.parse(v);}};
    await handler({url:'/api/mentoring',query:{view},method:body?'POST':'GET',body,headers:{origin,testAdmin:admin}},res);
    return {status:res.statusCode,...output};
  }
  assert.equal((await call(null,false,'http://localhost:8787','admin')).status,401);
  assert.equal((await call({action:'budget'},false)).status,401);
  assert.equal((await call({action:'budget'},true,'https://evil.example')).status,403);
  const entry={action:'save-entry',id:randomUUID(),companyId:'acc',sessionDate:'2026-10-13',meetingMinutes:60,followupMinutes:60,note:'PRIVATE TEST NOTE'};
  assert.equal((await call(entry)).status,200);
  assert.equal((await call(entry)).status,200);
  let publicData=await call(null,false);
  assert.equal(publicData.entries.length,1);
  assert.equal(publicData.entries[0].sessionNumber,1);
  assert.equal(publicData.entries[0].label,'Mentoring session');
  assert.equal(publicData.entries[0].meetingMinutes+publicData.entries[0].followupMinutes,120);
  assert.ok(!JSON.stringify(publicData).includes('PRIVATE'));
  let privateData=await call();assert.equal(privateData.entries[0].note,'PRIVATE TEST NOTE');
  const update={...entry,updatedAt:privateData.entries[0].updatedAt,meetingMinutes:90};
  assert.equal((await call(update)).status,200);
  assert.equal((await call(update)).status,400);
  assert.equal((await call({...entry,id:randomUUID(),meetingMinutes:-1})).status,400);
  assert.equal((await call({action:'start-timer',companyId:'acc',note:'PRIVATE TIMER'})).status,200);
  assert.equal((await call({action:'start-timer',companyId:'elmar-trading'})).status,400);
  publicData=await call(null,false);assert.ok(!JSON.stringify(publicData).includes('PRIVATE'));
  const stop={...entry,action:'stop-timer',id:randomUUID(),startedAt:publicData.timer.startedAt};
  assert.equal((await call(stop)).status,200);
  assert.equal((await call(stop)).status,200);
  publicData=await call(null,false);assert.equal(publicData.timer,null);assert.equal(publicData.entries.length,2);
  assert.deepEqual(publicData.entries.map(e=>e.sessionNumber),[2,1]);
  const followup={...entry,id:randomUUID(),meetingMinutes:0,followupMinutes:180,label:'Bootcamp',sessionDate:'2026-10-10'};
  assert.equal((await call(followup)).status,200);
  publicData=await call(null,false);
  assert.equal(publicData.entries[0].meetingMinutes,0);
  assert.equal(publicData.entries[0].followupMinutes,180);
  assert.equal(publicData.entries[0].label,'Bootcamp');
  assert.equal(publicData.entries[0].sessionNumber,3);
  assert.equal((await call({action:'budget',companyId:'acc',budgetMinutes:0})).status,200);
  privateData=await call();const first=privateData.entries.find(e=>e.id===entry.id);
  assert.equal((await call({action:'void-entry',id:first.id,updatedAt:first.updatedAt})).status,200);
  assert.equal((await call(null,false)).entries.length,2);
  assert.equal((await client.query('SELECT count(*)::int n FROM public.mentoring_entries')).rows[0].n,baseline);
  console.log('Integration checks passed: authorization, cross-origin rejection, private notes, 2h charging, retries, edit conflicts, timer locking, budget edits, removal. Production rows unchanged.');
}finally{await client.end();}
