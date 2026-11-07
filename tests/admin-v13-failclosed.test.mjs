// V13 — fail-closed test for a separately deployed fault-injection endpoint.
// Does not use Supabase credentials, network, or any patient data.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

const code=stripTypeScriptTypes(readFileSync(new URL('../supabase/functions/admin-v13-failclosed-test/index.ts',import.meta.url),'utf8'));
const uid='123e4567-e89b-42d3-a456-426614174000';
const origin='https://tiago-c-reis.github.io';
const response=(x,status=200)=>new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json'}});

function session(){
  const state={role:'coordinator',events:[]};
  const config={
    SUPABASE_URL:'https://fake-project.supabase.co',
    SUPABASE_PUBLISHABLE_KEY:'sb_publishable_TEST_ONLY',
    SUPABASE_SECRET_KEY:'sb_secret_TEST_ONLY',
    ADMIN_PANEL_ENABLED:'true',
    ADMIN_ALLOWED_ORIGINS:origin
  };
  let handler;
  const fakeFetch=async (target)=>{
    const u=String(target);
    if(u.includes('/auth/v1/user')){state.events.push('auth');return response({id:uid});}
    if(u.includes('vozes_admin_users')){state.events.push('membership');return response(state.role?[{role:state.role}]:[]);}
    if(u.includes('vozes_admin_audit')){state.events.push('audit');return response({},201);}
    if(u.includes('/rest/v1/rpc/')){state.events.push('rpc');return response({total:123});}
    throw Error('Unexpected upstream call: '+u);
  };
  vm.runInNewContext(code,{
    Deno:{env:{get:key=>config[key]},serve:fn=>{handler=fn;}},
    Response, Request, Headers, AbortController, TextEncoder,
    URL, Date, atob, setTimeout, clearTimeout, fetch:fakeFetch
  });
  assert.equal(typeof handler,'function');
  const token=(aal)=>{
    return 'x.'+Buffer.from(JSON.stringify({
      sub:uid,aal,role:'authenticated',exp:Math.floor(Date.now()/1000)+3600
    })).toString('base64url')+'.x';
  };
  const call=async(action,{auth=true,aal='aal2',useOrigin=origin,more={}}={})=>{
    const headers={origin:useOrigin,'content-type':'application/json'};
    if(auth)headers.authorization='Bearer '+token(aal);
    const req=new Request('https://fake-project.supabase.co/functions/v1/admin-v13-failclosed-test',{
      method:'POST',headers,body:JSON.stringify({action,...more})
    });
    const r=await handler(req);return {status:r.status,body:await r.json()};
  };
  return {state,call};
}

test('coordinator summary: 503 fail-closed before audit and data RPC',async()=>{
  const {state,call}=session();const r=await call('summary');
  assert.equal(r.status,503);assert.equal(r.body.error,'rate_limit_unavailable');
  assert.deepEqual(state.events,['auth','membership']);
});
test('coordinator list_cursor: 503 and no preview/data',async()=>{
  const {state,call}=session();const r=await call('list_cursor',{more:{cursor:null,limit:20}});
  assert.equal(r.status,503);assert.equal(r.body.error,'rate_limit_unavailable');
  assert.deepEqual(state.events,['auth','membership']);
});
test('coordinator detail: 503 and no personal data',async()=>{
  const {state,call}=session();const r=await call('detail',{more:{id:uid}});
  assert.equal(r.status,503);assert.equal(r.body.error,'rate_limit_unavailable');
  assert.deepEqual(state.events,['auth','membership']);
});
test('JWT aal1 is rejected before rate gate',async()=>{
  const {state,call}=session();const r=await call('summary',{aal:'aal1'});
  assert.equal(r.status,403);assert.equal(r.body.error,'mfa_required');
  assert.deepEqual(state.events,['auth']);
});
test('non-admin user cannot invoke',async()=>{
  const {state,call}=session();state.role=null;const r=await call('summary');
  assert.equal(r.status,403);assert.equal(r.body.error,'access_denied');
  assert.deepEqual(state.events,['auth','membership']);
});
test('no JWT is rejected',async()=>{
  const {state,call}=session();const r=await call('summary',{auth:false});
  assert.equal(r.status,401);assert.equal(r.body.error,'authentication_required');
  assert.deepEqual(state.events,[]);
});
test('unapproved origin is rejected',async()=>{
  const {state,call}=session();const r=await call('summary',{useOrigin:'https://unapproved.invalid'});
  assert.equal(r.status,403);assert.equal(r.body.error,'origin_denied');
  assert.deepEqual(state.events,[]);
});
