/* Vozes da Oncologia - V10 Admin. Zero service-role credentials in browser.
   Sessions only in memory: closing/reloading the page requires authentication again.
   Server always enforces Auth signature, AAL2 and allowlist; UI is not an access control.
*/
'use strict';
const cfg=window.VOZES_ADMIN_CONFIG||{};
const $=id=>document.getElementById(id);
const areas=['setup','access','dashboard','error-panel'];
const origin=String(cfg.supabaseUrl||'').replace(/\/$/,'');
const publicKey=cfg.publishableKey||'';
const ROUTE=`${origin}/functions/v1/${cfg.adminFunction||'admin-v10'}`;
const state={access:'',refresh:'',exp:0,user:null,factorId:'',enrolling:false,summary:null,list:null,offset:0,pageSize:20,role:null};
const labels={doente:'Doente oncológico',sobrevivente:'Sobrevivente',cuidador:'Cuidador/familiar',associacao:'Associação',profissional:'Profissional de saúde',apoio:'Apoio social / voluntariado'};
function show(id){for(const area of areas)$(area).hidden=area!==id;}
function feedback(msg,good=false){$('auth-message').textContent=msg;$('auth-message').classList.toggle('good',good);}
function showError(msg){$('error-text').textContent=msg;show('error-panel');}
function fmtNum(n){return Number(n||0).toLocaleString('pt-PT');}
function fmtDate(t){const d=new Date(t);return Number.isNaN(d.getTime())?'-':d.toLocaleString('pt-PT',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});}
function safeText(v){return v===null||v===undefined||v===''?'Não indicado':String(v);}
function appendText(el,tag,text,className){const n=document.createElement(tag);n.textContent=text;if(className)n.className=className;el.appendChild(n);return n;}
function clearSession(){state.access='';state.refresh='';state.exp=0;state.user=null;state.role=null;state.factorId='';state.enrolling=false;state.summary=null;state.list=null;state.offset=0;$('password').value='';$('mfa-code').value='';$('mfa-secret').textContent='';$('mfa-qr').src='';$('logout').hidden=true;}
function updateTokens(tokens){if(tokens?.access_token){state.access=tokens.access_token;state.refresh=tokens.refresh_token||state.refresh;state.exp=Date.now()+Math.max(Number(tokens.expires_in||3600)-45,60)*1000;}}
async function authCall(path,{method='GET',body,token=state.access}={}){
  const r=await fetch(`${origin}/auth/v1/${path}`,{method,headers:{'apikey':publicKey,'content-type':'application/json',...(token?{'authorization':`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'});
  const out=await r.json().catch(()=>({}));
  if(!r.ok)throw Error(out?.msg||out?.message||out?.error_description||out?.error||`Auth HTTP ${r.status}`);
  return out;
}
async function refreshToken(){if(!state.refresh)throw Error('Sessão terminada. Inicie sessão novamente.');const out=await authCall('token?grant_type=refresh_token',{method:'POST',body:{refresh_token:state.refresh},token:''});updateTokens(out);}
async function adminCall(body){
  if(Date.now()>=state.exp)await refreshToken();
  const r=await fetch(ROUTE,{method:'POST',headers:{'authorization':`Bearer ${state.access}`,'content-type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
  const out=await r.json().catch(()=>({}));
  if(!r.ok){if(r.status===401||r.status===403&&out.error==='mfa_required'){clearSession();show('access');$('login-view').hidden=false;$('mfa-view').hidden=true;}throw Error(({'authentication_required':'Sessão expirada. Inicie novamente.','mfa_required':'É obrigatório concluir a autenticação multifator.','access_denied':'A sua conta não consta da lista de administradores autorizados.','unavailable':'Serviço administrativo indisponível. Verifique a configuração Staging.','audit_unavailable':'Registo de auditoria indisponível; acesso bloqueado.','query_unavailable':'Consulta indisponível.'})[out.error]||`Não foi possível consultar os dados (HTTP ${r.status}).`);}
  state.role=out.role;return out.data;
}
async function signIn(evt){evt.preventDefault();feedback('A validar as credenciais...');$('login-button').disabled=true;
  try{const out=await authCall('token?grant_type=password',{method:'POST',body:{email:$('email').value.trim(),password:$('password').value},token:''});updateTokens(out);state.user=out.user;await beginMfa();}
  catch{feedback('Falha de autenticação. Confirme as credenciais e o segundo fator.');}
  finally{$('login-button').disabled=false;$('password').value='';}
}
async function beginMfa(){
  if(!state.access)throw Error('Sessão ausente');
  $('login-view').hidden=true;$('mfa-view').hidden=false;feedback('');
  // The authenticated user resource exposes verified factors; GET /factors is not a portable endpoint.
  const factors=await authCall('user');
  const list=Array.isArray(factors?.factors)?factors.factors:[];
  const verified=list.find(f=>f.factor_type==='totp' && f.status==='verified');
  if(verified){state.factorId=verified.id;state.enrolling=false;$('mfa-enrollment').hidden=true;$('mfa-explanation').textContent='Introduza o código de seis dígitos da sua aplicação autenticadora.';return;}
  const enrolled=await authCall('factors',{method:'POST',body:{factor_type:'totp',friendly_name:'Vozes da Oncologia - Admin'}});
  state.factorId=enrolled.id;state.enrolling=true;$('mfa-enrollment').hidden=false;
  $('mfa-explanation').textContent='É obrigatório registar um segundo fator antes de consultar os testemunhos.';
  const qr=enrolled?.totp?.qr_code||'';
  const img=$('mfa-qr');
  if(qr.startsWith('data:image/svg+xml,')) {img.src=qr;img.hidden=false;}
  else if(qr.trim().startsWith('<svg')) {img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(qr);img.hidden=false;}
  else img.hidden=true;
  $('mfa-secret').textContent=enrolled?.totp?.secret||'';
}
async function verifyMfa(evt){evt.preventDefault();feedback('A verificar o código...');$('mfa-button').disabled=true;
  try{
    const code=$('mfa-code').value.trim();if(!/^\d{6}$/.test(code))throw Error('Código inválido');
    const challenge=await authCall(`factors/${encodeURIComponent(state.factorId)}/challenge`,{method:'POST',body:{}});
    const data=await authCall(`factors/${encodeURIComponent(state.factorId)}/verify`,{method:'POST',body:{challenge_id:challenge.id,code}});
    updateTokens(data);$('mfa-code').value='';$('mfa-secret').textContent='';$('mfa-qr').src='';
    if(!state.access)throw Error('MFA não atualizou o token de acesso');
    await loadDashboard();
  }catch{feedback('Não foi possível validar o segundo fator ou autorizar o acesso.');}
  finally{$('mfa-button').disabled=false;}
}
function bars(container,items,maxItems=6){container.replaceChildren();const values=Array.isArray(items)?items.slice(0,maxItems):[];if(!values.length){appendText(container,'p','Sem participações neste período.','empty');return;}
  const max=Math.max(...values.map(x=>Number(x.count||0)),1);
  for(const item of values){const row=document.createElement('div');row.className='bar-row';
    appendText(row,'span',labels[item.name]||item.name||'Não indicado','name');
    const track=document.createElement('span');track.className='track';const fill=document.createElement('i');fill.style.width=`${Math.max(0,Math.min(100,Number(item.count||0)/max*100))}%`;track.appendChild(fill);row.appendChild(track);appendText(row,'strong',fmtNum(item.count));container.appendChild(row);}
}
function populateSummary(s){state.summary=s;$('metric-total').textContent=fmtNum(s.total);$('metric-recent').textContent=fmtNum(s.last30);$('metric-contact').textContent=fmtNum(s.recontact);bars($('chart-roles'),s.roles);bars($('chart-regions'),s.regions);}
function renderList(data){state.list=data;const tbody=$('records');tbody.replaceChildren();const items=Array.isArray(data.items)?data.items:[];
  if(!items.length){const tr=document.createElement('tr');const td=document.createElement('td');td.colSpan=6;td.className='empty';td.textContent='Sem participações para os filtros selecionados.';tr.appendChild(td);tbody.appendChild(tr);}
  for(const item of items){const tr=document.createElement('tr');appendText(tr,'td',fmtDate(item.received_at));appendText(tr,'td',labels[item.primary_role]||item.primary_role);appendText(tr,'td',safeText(item.region));appendText(tr,'td',safeText(item.age_group));appendText(tr,'td',safeText(item.preview));const td=document.createElement('td');const button=appendText(td,'button','Consultar','record-link');button.type='button';button.addEventListener('click',()=>openDetail(item.id));tr.appendChild(td);tbody.appendChild(tr);}
  const total=Number(data.total||0);$('count-label').textContent=`${fmtNum(total)} resultado(s) · ${total?fmtNum(state.offset+1):'0'}-${fmtNum(Math.min(total,state.offset+items.length))}`;
  $('previous').disabled=state.offset===0;$('next').disabled=state.offset+state.pageSize>=total;
}
function currentFilters(){return{role:$('filter-role').value||null,region:$('filter-region').value||null,age:$('filter-age').value||null};}
async function loadList(){const data=await adminCall({action:'list',limit:state.pageSize,offset:state.offset,...currentFilters()});renderList(data);}
async function loadDashboard(){show('dashboard');$('logout').hidden=false;$('environment').textContent=cfg.environment||'STAGING';try{const summary=await adminCall({action:'summary'});populateSummary(summary);await loadList();}catch(e){showError(e.message||'Serviço indisponível');}}
function section(target,title,value){const box=document.createElement('section');box.className='detail-section';appendText(box,'h3',title);appendText(box,'p',safeText(value));target.appendChild(box);}
function meta(target,title,value){const box=document.createElement('div');box.className='meta-item';appendText(box,'label',title);appendText(box,'strong',safeText(value));target.appendChild(box);}
async function openDetail(id){try{const d=await adminCall({action:'detail',id});const root=$('drawer-body');root.replaceChildren();$('drawer-title').textContent='Participação '+String(d.id||'').slice(0,8).toUpperCase();
  const grid=document.createElement('div');grid.className='detail-meta';meta(grid,'Receção',fmtDate(d.received_at));meta(grid,'Perfil',labels[d.primary_role]||d.primary_role);meta(grid,'Região',d.region);meta(grid,'Faixa etária',d.age_group);meta(grid,'Recontacto',d.has_contact?'Autorizado':'Não autorizado');meta(grid,'Consentimentos',(d.consent_types||[]).join(', '));root.appendChild(grid);
  section(root,'Dificuldade / experiência partilhada',d.difficulty);section(root,'Sugestão de melhoria',d.solution);section(root,'Contexto adicional',d.extra);section(root,'Enquadramento profissional',d.role_context);
  const response=document.createElement('section');response.className='detail-section';appendText(response,'h3','Perguntas complementares');const pre=appendText(response,'pre',JSON.stringify(d.answers||{},null,2),'detail-json');root.appendChild(response);
  $('drawer-backdrop').hidden=false;$('drawer-close').focus();document.body.style.overflow='hidden';}
  catch(e){alert(e.message||'Não foi possível consultar a participação.');}
}
function closeDetail(){$('drawer-backdrop').hidden=true;document.body.style.overflow='';}
function aggregateCsv(){if(!state.summary)return;const out=[['dimensao','categoria','contagem']];for(const [kind,arr] of [['perfil',state.summary.roles],['regiao',state.summary.regions],['faixa_etaria',state.summary.ages]])for(const item of arr||[]) {const n=Number(item.count||0);if(n>=10)out.push([kind,String(item.name||'').replaceAll('"','""'),String(n)]);}
  const csv='\ufeff'+out.map(r=>r.map(v=>'"'+String(v).replaceAll('"','""')+'"').join(';')).join('\r\n');const blob=new Blob([csv],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='Vozes_Oncologia_Estatisticas_Agregadas.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function logout(){try{if(state.access)await authCall('logout',{method:'POST',body:{}});}catch{}finally{clearSession();closeDetail();$('login-view').hidden=false;$('mfa-view').hidden=true;feedback('Sessão terminada.',true);show('access');}}
function setup(){
  $('login-form').addEventListener('submit',signIn);$('mfa-form').addEventListener('submit',verifyMfa);
  $('logout').addEventListener('click',logout);$('refresh').addEventListener('click',()=>loadDashboard());
  $('filters').addEventListener('submit',async e=>{e.preventDefault();state.offset=0;try{await loadList();}catch(err){alert(err.message);}});
  $('previous').addEventListener('click',async()=>{state.offset=Math.max(0,state.offset-state.pageSize);try{await loadList();}catch(err){alert(err.message);}});
  $('next').addEventListener('click',async()=>{state.offset+=state.pageSize;try{await loadList();}catch(err){alert(err.message);}});
  $('download-agg').addEventListener('click',aggregateCsv);
  $('drawer-close').addEventListener('click',closeDetail);$('drawer-backdrop').addEventListener('click',e=>{if(e.target===$('drawer-backdrop'))closeDetail();});
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('drawer-backdrop').hidden)closeDetail();});
  $('error-back').addEventListener('click',()=>{clearSession();$('login-view').hidden=false;$('mfa-view').hidden=true;show('access');});
  const ready=cfg.enabled===true&&/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(origin)&&
      /^(sb_publishable_[a-zA-Z0-9_-]+|eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)$/.test(publicKey);
  show(ready?'access':'setup');
}
setup();
