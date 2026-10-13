import test from 'node:test';
import assert from 'node:assert/strict';
import { mentorSession, sameOrigin } from '../lib/mentoring-server.mjs';
test('server checks the provider session, fixed mentor ID and email; cookies alone grant no access',async()=>{
  const originalFetch=globalThis.fetch;
  process.env.NEON_AUTH_BASE_URL='https://auth.example.test/mentoring/auth';
  process.env.MENTOR_USER_ID='fixed-mentor';
  process.env.APP_ORIGIN='https://workshop.example.test';
  try {
    assert.equal(await mentorSession({headers:{}}),null);
    for(const user of [{id:'attacker',email:'nicolas@agentic-sdlc.it'},{id:'fixed-mentor',email:'other@example.test'}]) {
      globalThis.fetch=async()=>Response.json({session:{id:'s'},user});
      assert.equal(await mentorSession({headers:{cookie:'forged-cookie'}}),null);
    }
    globalThis.fetch=async()=>Response.json(null);
    assert.equal(await mentorSession({headers:{cookie:'expired-cookie'}}),null);
    globalThis.fetch=async(url,options)=>{
      assert.equal(url,'https://auth.example.test/mentoring/auth/get-session');
      assert.equal(options.headers.cookie,'managed-session-cookie');
      return Response.json({session:{id:'s'},user:{id:'fixed-mentor',email:'nicolas@agentic-sdlc.it'}});
    };
    assert.equal((await mentorSession({headers:{cookie:'managed-session-cookie'}})).user.id,'fixed-mentor');
    assert.equal(sameOrigin({headers:{origin:'https://workshop.example.test'}}),true);
    assert.equal(sameOrigin({headers:{origin:'https://attacker.example.test'}}),false);
    assert.equal(sameOrigin({headers:{}}),false);
  }finally{globalThis.fetch=originalFetch;}
});
