// V13 - testes unitarios sem rede nem credenciais reais.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';

const code=stripTypeScriptTypes(readFileSync(new URL('../supabase/functions/admin-v13-limited/index.ts',import.meta.url),'utf8'));
const uid='123e4567-e89b-42d3-a456-426614174000';
const origin='https://tiago-c-reis.github.io';
function setup(){
  const state={member:'viewer',authOK:true,auditOK:true,events:[],gateFailure:false,invalidGate:false,count:0};
  const env={
    SUPABASE_URL:'https://fake-project.supabase.co',
    SUPABASE_PUBLISHABLE_KEY:'sb_publishable_TEST_ONLY',
    SUPABASE_SECRET_KEY:'sb_secret_TEST_ONLY',
    ADMIN_PANEL_ENABLED:'true',ADMIN_ALLOWED_ORIGINS:origin
  };
  const respond=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
  const mockFetch=async(target)=>{
    const url=String(target);
    if(url.includes('/auth/v1/user')){
      state.events.push('auth');
      return state.authOK?respond({id:uid}):respond({message:'bad token'},401);
    }
    if(url.includes('vozes_admin_users')){
      state.events.push('member');
      return respond(state.member?[{role:state.member}]:[]);
    }
    if(url.includes('/rest/v1/rpc/vozes_admin_rate_gate_v13')){
      state.events.push('rate_gate');
      if(state.gateFailure)return respond({message:'outage'},503);
      if(state.invalidGate)return respond({not:'a decision'});
      state.count=Math.min(61,state.count+1);
      return respond([{
        allowed:state.count<=60,
        retry_after_seconds:state.count>60?25:0,
        remaining:Math.max(0,60-state.count)
      }]);
    }
    if(url.includes('/rest/v1/vozes_admin_audit')){
      state.events.push('audit');
      return state.auditOK?respond({},201):respond({},500);
    }
    if(url.includes('/rest/v1/rpc/')){
      const fn=url.split('/').pop();state.events.push(fn);
      if(fn==='vozes_admin_summary_v10')return respond({total:12,last30:12,recontact:0,roles:[],regions:[],ages:[]});
      if(fn==='vozes_admin_detail_v10')return respond({id:uid,difficulty:'EXEMPLO FICTICIO'});
      if(fn==='vozes_admin_list_cursor_v12')return respond({items:[],has_more:false,next_cursor:null});
      if(fn==='vozes_admin_list_v10')return respond({items:[],has_more:false});
      throw Error('RPC nao esperada: '+fn);
    }
    throw Error('Destino nao esperado: '+url);
  };
  let handler;
  const ctx={Deno:{env:{get:n=>env[n]},serve:fn=>{handler=fn;}},Response,Request,Headers,AbortController,TextEncoder,URL,Date,atob,setTimeout,clearTimeout,fetch:mockFetch};
  vm.runInNewContext(code,ctx,{filename:'admin-v13/index.ts'});
  assert.equal(typeof handler,'function');
  const token=(aal='aal2')=>'x.'+Buffer.from(JSON.stringify({sub:uid,aal,role:'authenticated',exp:Math.floor(Date.now()/1000)+1800})).toString('base64url')+'.y';
  const send=async(action,{aal='aal2',auth=true,otherOrigin=false,extra={}}={})=>{
    const headers={'content-type':'application/json',origin:otherOrigin?'https://malicioso.invalid':origin};
    if(auth)headers.authorization='Bearer '+token(aal);
    const req=new Request('https://fake-project.supabase.co/functions/v1/admin-v13',{method:'POST',headers,body:JSON.stringify({action,...extra})});
    const res=await handler(req);return {status:res.status,retryAfter:res.headers.get('retry-after'),body:await res.json()};
  };
  return {state,send};
}
test('viewer recebe APENAS resumo',async()=>{
  const {state,send}=setup();const r=await send('summary');
  assert.equal(r.status,200);assert.equal(r.body.role,'viewer');assert.equal(r.body.data.total,12);
  assert.deepEqual(state.events,['auth','member','rate_gate','audit','vozes_admin_summary_v10']);
});
test('viewer NAO pode listar, paginar ou consultar detalhes',async()=>{
  const {state,send}=setup();
  for(const action of ['list','list_cursor','detail']){
    state.events.length=0;
    const r=await send(action,{extra:{id:uid,limit:20}});
    assert.equal(r.status,403,action);assert.equal(r.body.error,'insufficient_permissions');
    assert.deepEqual(state.events,['auth','member'],action);
  }
});
test('coordinator conserva list_cursor e detalhe',async()=>{
  const {state,send}=setup();state.member='coordinator';
  const list=await send('list_cursor',{extra:{limit:20,cursor:null}});
  assert.equal(list.status,200);assert.equal(list.body.role,'coordinator');
  assert.ok(state.events.includes('vozes_admin_list_cursor_v12'));
  state.events.length=0;
  const detail=await send('detail',{extra:{id:uid}});
  assert.equal(detail.status,200);assert.equal(detail.body.data.id,uid);
  assert.ok(state.events.includes('vozes_admin_detail_v10'));
});
test('sem Authorization e bloqueado',async()=>{
  const {state,send}=setup();const r=await send('summary',{auth:false});
  assert.equal(r.status,401);assert.equal(r.body.error,'authentication_required');assert.deepEqual(state.events,[]);
});
test('MFA aal1 e insuficiente',async()=>{
  const {state,send}=setup();const r=await send('summary',{aal:'aal1'});
  assert.equal(r.status,403);assert.equal(r.body.error,'mfa_required');assert.deepEqual(state.events,['auth']);
});
test('conta fora da allowlist administrativa e bloqueada',async()=>{
  const {state,send}=setup();state.member=null;const r=await send('summary');
  assert.equal(r.status,403);assert.equal(r.body.error,'access_denied');assert.deepEqual(state.events,['auth','member']);
});
test('origem nao autorizada e bloqueada',async()=>{
  const {state,send}=setup();const r=await send('summary',{otherOrigin:true});
  assert.equal(r.status,403);assert.equal(r.body.error,'origin_denied');assert.deepEqual(state.events,[]);
});
test('cursor malformado e recusado antes da auditoria e RPC',async()=>{
  const {state,send}=setup();state.member='coordinator';
  const r=await send('list_cursor',{extra:{cursor:{id:'x',received_at:'bad'}}});
  assert.equal(r.status,400);assert.equal(r.body.error,'invalid_cursor');assert.deepEqual(state.events,['auth','member','rate_gate']);
});
test('falha de auditoria impede consulta aos dados',async()=>{
  const {state,send}=setup();state.member='coordinator';state.auditOK=false;
  const r=await send('summary');
  assert.equal(r.status,503);assert.equal(r.body.error,'audit_unavailable');assert.deepEqual(state.events,['auth','member','rate_gate','audit']);
});


test('60 consultas autorizadas, 61o pedido recebe HTTP 429',async()=>{
  const {state,send}=setup();state.member='coordinator';
  for(let i=0;i<60;i++){
    const result=await send('summary');
    assert.equal(result.status,200,'request '+(i+1));
  }
  const denied=await send('summary');
  assert.equal(denied.status,429);
  assert.equal(denied.body.error,'rate_limited');
  assert.equal(denied.retryAfter,'25');
  assert.equal(state.events.filter(x=>x==='vozes_admin_summary_v10').length,60);
  assert.equal(state.events.filter(x=>x==='audit').length,60);
});
test('contador reiniciado numa nova janela permite novamente',async()=>{
  const {state,send}=setup();state.member='coordinator';
  state.count=60;
  assert.equal((await send('summary')).status,429);
  state.count=0; // mock representa nova janela UTC
  assert.equal((await send('summary')).status,200);
});
test('falha de RPC do limitador bloqueia consulta sem auditoria',async()=>{
  const {state,send}=setup();state.member='coordinator';state.gateFailure=true;
  const r=await send('summary');
  assert.equal(r.status,503);
  assert.equal(r.body.error,'rate_limit_unavailable');
  assert.deepEqual(state.events,['auth','member','rate_gate']);
});
test('formato de resposta da RPC incorreto bloqueia consulta',async()=>{
  const {state,send}=setup();state.member='coordinator';state.invalidGate=true;
  const r=await send('summary');
  assert.equal(r.status,503);
  assert.equal(r.body.error,'rate_limit_unavailable');
  assert.deepEqual(state.events,['auth','member','rate_gate']);
});
test('um viewer sem permissao nao consegue consultar listagens nem gastar quota',async()=>{
  const {state,send}=setup();state.member='viewer';
  const r=await send('list_cursor',{extra:{limit:20,cursor:null}});
  assert.equal(r.status,403);
  assert.equal(state.count,0);
  assert.deepEqual(state.events,['auth','member']);
});
