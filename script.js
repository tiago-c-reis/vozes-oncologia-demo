/* Vozes da Oncologia - V21. Formulário local interativo sem envio.
   Apenas modo production com requisitos validados permite API. */
'use strict';
const app = document.getElementById('app');
const cfg = Object.freeze(window.VOZES_CONFIG || {mode:'demo'});
const isProduction = cfg.mode === 'production';
const isPrelaunch = !isProduction; // Apenas production pode comunicar com a API.
// O preenchimento não é persistido: evita armazenar relatos sensíveis no navegador.
// Avisar antes de fechar ou atualizar quando há respostas ainda não concluídas.
function hasLocalDraft(){return form.stage<5 && (form.roles.length>0 || [form.difficulty,form.solution,form.extra].some(v=>v.trim().length>0) || Object.values(form.roleContext).some(v=>String(v).trim().length>0));}
window.addEventListener('beforeunload',evt=>{if(!hasLocalDraft())return;evt.preventDefault();evt.returnValue='';});
let turnstileWidgetId = null;
let turnstileToken = '';
function isConfiguredForProduction(){
  try {
    const endpoint = new URL(cfg.apiUrl);
    const privacy = new URL(cfg.privacyUrl);
    return isProduction && endpoint.protocol==='https:' && privacy.protocol==='https:' &&
      Boolean(cfg.turnstileSiteKey) && Boolean(cfg.privacyVersion) &&
      !/PENDING|REPLACE|DRAFT|EXAMPLE|TODO/i.test(cfg.privacyVersion) &&
      typeof crypto?.randomUUID === 'function';
  } catch {return false;}
}
function safeId(){return crypto.randomUUID();}
function privacyText(){return isProduction
 ? 'Evite incluir nomes, moradas, datas exatas ou quaisquer dados que possam identificar terceiros. A informação será enviada apenas depois de confirmar o seu consentimento no passo final.'
 : 'Evite indicar nomes, moradas, datas exatas ou outros elementos que permitam identificar terceiros.';
}
function turnstileReset(){
  turnstileToken='';
  try {if(turnstileWidgetId!==null && window.turnstile)window.turnstile.reset(turnstileWidgetId);}catch(_e){}
}
function initializeTurnstile(){
  if(!isProduction || form.stage!==4 || !isConfiguredForProduction())return;
  const el=document.getElementById('v9-turnstile');
  if(!el)return;
  turnstileWidgetId=null;
  turnstileToken='';
  const render=()=>{
    const target=document.getElementById('v9-turnstile');
    if(!target || typeof window.turnstile?.render!=='function')return;
    try {turnstileWidgetId=window.turnstile.render(target,{
      sitekey:cfg.turnstileSiteKey,
      callback:token=>{turnstileToken=token;showError('confirm-error','');},
      'expired-callback':()=>{turnstileToken='';},
      'error-callback':()=>{turnstileToken='';showError('confirm-error','Não foi possível validar o controlo de segurança. Atualize a página.');}
    });}catch(_e){showError('confirm-error','Não foi possível carregar o controlo de segurança.');}
  };
  if(window.turnstile){render();return;}
  if(!document.getElementById('v9-turnstile-script')){
    const js=document.createElement('script');js.id='v9-turnstile-script';
    js.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    js.async=true;js.defer=true;js.onload=render;
    js.onerror=()=>showError('confirm-error','Não foi possível carregar a verificação anti-bot.');
    document.head.appendChild(js);
  }else{
    // Esperar pela carregamento sem forçar cookies ou outro serviço de terceiros.
    const script=document.getElementById('v9-turnstile-script');
    if(script)script.addEventListener('load',render,{once:true});
  }
}
function apiPayload(){
 const role=activeRole();
 return {
  requestId:form.requestId || (form.requestId=safeId()),
  privacyVersion:cfg.privacyVersion,
  profile:{roles:[...form.roles],primaryRole:role,ageGroup:form.ageGroup,region:form.region,context:form.roleContext[role]||''},
  openText:{difficulty:form.difficulty,solution:form.solution,extra:form.extra},
  answers:Object.fromEntries(currentQuestions().filter(q=>form.answers[role]?.[q.id]).map(q=>[q.id,form.answers[role][q.id]])),
  consent:{explicitHealthData:form.ack,adultAttestation:form.adultAttested,recontact:form.contact},
  contact:{email:form.contact?form.email:''},
  turnstileToken
 };
}
async function sendParticipation(){
 if(!isProduction || !isConfiguredForProduction()) throw new Error('A receção de testemunhos não está ativada.');
 const ac=new AbortController();
 const id=setTimeout(()=>ac.abort(),25000);
 try {
   const response=await fetch(cfg.apiUrl,{
     method:'POST',headers:{'content-type':'application/json','accept':'application/json'},
     body:JSON.stringify(apiPayload()),mode:'cors',credentials:'omit',cache:'no-store',signal:ac.signal
   });
   const data=await response.json().catch(()=>({}));
   if(!response.ok || data.status!=='accepted' || !/^[a-f0-9-]{36}$/i.test(data.receipt||'')){
     const messages={unavailable:'A receção ainda não está ativada.',rate_limited:'Foram recebidas demasiadas tentativas. Volte mais tarde.',invalid_turnstile:'A verificação de segurança expirou. Tente de novo.',invalid_payload:'Existem dados inválidos. Reveja o formulário.',privacy_version:'A informação de privacidade foi atualizada. Recarregue a página.',idempotency_conflict:'Foram alteradas respostas após uma tentativa de envio. Para evitar duplicados, não é possível confirmar esta versão. Contacte a equipa caso a tentativa anterior possa ter sido recebida.'};
     const err=new Error(messages[data.error]||'Não foi possível confirmar a receção. Tente novamente.');
     err.code=data.error;throw err;
   }
   return data.receipt;
 } finally{clearTimeout(id);}
}

const roles = [
  ['doente','Sou doente oncológico','Se desejar, há mais algum contexto da sua experiência pessoal que queira acrescentar?'],
  ['sobrevivente','Sou sobrevivente de cancro','Se desejar, há algo mais sobre a sua experiência que nos ajude a compreender esta dificuldade?'],
  ['cuidador','Sou cuidador(a) ou familiar','Há algum contexto da sua experiência enquanto familiar ou cuidador(a) que queira acrescentar?'],
  ['associacao','Represento uma associação de doentes','Quer acrescentar alguma perspetiva das pessoas que a associação representa?'],
  ['profissional','Sou profissional de saúde','Quer acrescentar algum contexto relacionado com a sua prática profissional?'],
  ['apoio','Presto apoio social ou voluntário em oncologia','Quer acrescentar alguma perspetiva da sua atividade de apoio ou voluntariado?']
];
const ageGroups = [
 ['','Não indicar faixa etária'],
 ['18-29 anos','18-29 anos'],
 ['30-44 anos','30-44 anos'],
 ['45-59 anos','45-59 anos'],
 ['60-74 anos','60-74 anos'],
 ['75 anos ou mais','75 anos ou mais'],
 ['Prefiro não responder','Prefiro não responder']
];
const regions = [
 ['','Não indicar região'],
 ['Norte','Norte'], ['Centro','Centro'], ['Lisboa e Vale do Tejo','Lisboa e Vale do Tejo'],
 ['Alentejo','Alentejo'], ['Algarve','Algarve'], ['Açores','Região Autónoma dos Açores'],
 ['Madeira','Região Autónoma da Madeira'], ['Nacional / várias regiões','Âmbito nacional / várias regiões'],
 ['Fora de Portugal','Fora de Portugal']
];
const optionsExtent = ['Nada','Pouco','Moderadamente','Bastante','Muito','Não sei avaliar','Não se aplica','Prefiro não responder'];
const optionsCoordination = ['Muito má','Má','Nem boa nem má','Boa','Muito boa','Não sei avaliar','Não se aplica','Prefiro não responder'];
const optionsFrequency = ['Nunca','Raramente','Algumas vezes','Frequentemente','Sempre','Não sei avaliar','Não se aplica','Prefiro não responder'];
const optionsTravel = ['Não','Sim, dentro da mesma região','Sim, noutra região','Não sei','Prefiro não responder'];
const optionsObserver = ['Nunca','Raramente','Algumas vezes','Frequentemente','Muito frequentemente','Não tenho informação','Não se aplica','Prefiro não responder'];
const surveyModules = {
 vivencia: [
  {id:'acesso',text:'Em que medida a região onde reside dificultou o acesso aos cuidados de que precisava?',options:optionsExtent},
  {id:'articulacao',text:'Como avalia a articulação entre os diferentes serviços e profissionais ao longo do seu percurso?',options:optionsCoordination},
  {id:'orientacao',text:'Quando tinha dúvidas sobre a doença ou os cuidados, sabia a quem recorrer?',options:optionsFrequency},
  {id:'decisoes',text:'Recebeu informação suficiente para participar nas decisões sobre os seus cuidados?',options:optionsExtent},
  {id:'deslocacoes',text:'Precisou de se deslocar para outro hospital para receber cuidados?',options:optionsTravel}
 ],
 cuidador: [
  {id:'acesso',text:'Na sua perspetiva, em que medida a região de residência dificultou o acesso da pessoa acompanhada aos cuidados de que precisava?',options:optionsExtent},
  {id:'articulacao',text:'Como avalia a articulação entre serviços e profissionais no percurso que acompanhou?',options:optionsCoordination},
  {id:'orientacao',text:'Quando tinha dúvidas sobre os cuidados da pessoa acompanhada, sabia a quem recorrer?',options:optionsFrequency},
  {id:'decisoes',text:'Na sua perspetiva, a pessoa acompanhada recebeu informação suficiente para participar nas decisões sobre os seus cuidados?',options:optionsExtent},
  {id:'deslocacoes',text:'A pessoa acompanhada precisou de se deslocar para outro hospital para receber cuidados?',options:optionsTravel}
 ],
 observacao: [
  {id:'acesso',text:'Com que frequência observa dificuldades de acesso associadas à região de residência?',options:optionsObserver},
  {id:'articulacao',text:'Com que frequência observa dificuldades de articulação entre serviços e profissionais?',options:optionsObserver},
  {id:'orientacao',text:'Com que frequência observa pessoas com dúvidas sem saber a quem recorrer?',options:optionsObserver},
  {id:'decisoes',text:'Com que frequência observa pessoas sem informação suficiente para participar nas decisões sobre os seus cuidados?',options:optionsObserver},
  {id:'deslocacoes',text:'Com que frequência observa pessoas que necessitam de se deslocar para outro hospital para receber cuidados?',options:optionsObserver}
 ]
};
const moduleForRole = role => role==='cuidador'?'cuidador':['doente','sobrevivente'].includes(role)?'vivencia':'observacao';
const regionLabelForRole = role => role==='cuidador'?'Em que região reside ou residia a pessoa que acompanhou?':['doente','sobrevivente'].includes(role)?'Em que região reside?':'Em que região observa principalmente estas situações?';
const form = {stage:1,difficulty:'',solution:'',extra:'',roles:[],primaryRole:'',ageGroup:'',region:'',roleContext:{},answers:{},email:'',contact:false,ack:false,adultAttested:false,requestId:'',receipt:''};
const esc = (v) => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = (name,size=22) => {
 const shapes={
  users:'<circle cx="9" cy="7" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2"/><path d="M16 4a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5v1"/>',
  profile:'<path d="M8 18c.5-2.1 2.2-3.8 4.5-4.4 1.4-.4 2.2-1 2.7-1.8.5-.9.7-1.9.7-3.1 0-3.1-2-5.7-4.6-5.7-2.2 0-4 1.8-4 4.2 0 1.3.5 2.4 1.3 3.2-.2 1.1-.8 2.3-1.8 3.4-.9 1-2 1.8-3.3 2.2H8Z"/><path d="M11.2 7.5c.9-.2 1.5.3 1.5 1.1 0 .7-.5 1.2-1.1 1.4"/><path d="M15.2 16.7c2 .4 3.7 1.7 4.8 3.3"/>',
  bulb:'<path d="M9 18h6m-5 4h4M9 15c-1.5-1.2-3-3.4-3-6a6 6 0 1 1 12 0c0 2.6-1.5 4.8-3 6l-.6 2H9.6z"/>',
  chat:'<path d="M20 11a8 8 0 0 1-8 8 9 9 0 0 1-4-.9L3 20l1.9-5A9 9 0 1 1 20 11Z"/><path d="M8 11h.1M12 11h.1M16 11h.1"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  check:'<path d="m5 12 4 4L19 6"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4"/>',
  arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
  chevron:'<path d="m15 18-6-6 6-6"/>',
  shield:'<path d="M12 2 4 5v6c0 5 3 8 8 11 5-3 8-6 8-11V5z"/><path d="m8 12 3 3 5-6"/>',
  heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
 };
 return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round">${shapes[name]||shapes.check}</svg>`;
};
const btn = (text,link,variant='yellow',extra='')=>`<a class="button button-${variant}" href="${link}" ${extra}>${text} ${icon('arrow',17)}</a>`;
function home(){return `
<section class="hero"><div class="wrap hero-grid">
  <div class="hero-copy"><div class="eyebrow">VOZES DA ONCOLOGIA · ESCUTA NACIONAL</div>
    <h1>A sua experiência pode ajudar a <span class="mark">melhorar</span> os cuidados oncológicos em Portugal.</h1>
    <p class="hero-lead">Conte-nos as dificuldades que sentiu ou observou e como considera que poderiam ser melhoradas.</p>
    <div class="hero-actions">${btn(isPrelaunch?'Explorar o formulário':'Partilhar a minha experiência','#/participe')}</div>
    <div class="hero-note">${icon('lock',16)} ${isPrelaunch?'Preenchimento local · Sem envio':'Participação escrita · Sem identificação pessoal obrigatória'}</div>
  </div><div class="hero-art"><img src="assets/retratos-diversidade.webp" alt="Ilustração em aguarela e tinta de pessoas de diferentes idades, origens e experiências, incluindo uma profissional de saúde" fetchpriority="high" /></div>
</div></section>
<section class="section section-light"><div class="wrap">
 <div class="section-head"><div><div class="eyebrow">ESCUTA LIVRE, COM CONTEXTO FACULTATIVO</div><h2>Como funciona?</h2></div><span class="handnote">Cada experiência conta.</span></div>
 <div class="steps-grid">${[
 ['Escolha o seu perfil','Indique a sua ligação à oncologia. Pode selecionar um ou mais perfis.'],
 ['Partilhe a sua experiência','Descreva livremente uma dificuldade e, se quiser, sugira como poderia ser melhorada.'],
 ['Responda, se quiser','Até cinco perguntas complementares, adaptadas ao seu perfil e totalmente opcionais.'],
 ['Reveja e guarde','Reveja as respostas, consulte a privacidade e guarde uma cópia pessoal no dispositivo.']
 ].map(([title,description],i)=>`<article class="step-card"><div class="step-image"><img src="assets/passo-${[3,1,2,4][i]}.webp" alt="" loading="lazy" /></div><div class="step-title"><span class="step-index">${i+1}</span><h3>${title}</h3></div><p>${description}</p></article>`).join('')}</div>
 <div class="callout-panel cta-panel"><div><h3>O que podemos melhorar juntos?</h3><p>Indique a sua ligação à oncologia e descreva a sua experiência com as suas palavras. As perguntas fechadas surgem apenas depois e são opcionais.</p></div>${btn(isPrelaunch?'Explorar o formulário':'Quero participar','#/participe')}</div>
 </div></section>
<section class="section"><div class="wrap two-col"><div class="body-copy"><div class="eyebrow">PORQUE ESCUTAR IMPORTA</div><h2>Por trás de cada dificuldade, há uma experiência que importa compreender.</h2><p>Doentes, sobreviventes, familiares, associações, profissionais de saúde e pessoas que prestam apoio conhecem realidades diferentes da oncologia. Queremos criar espaço para as ouvir sem antecipar os problemas que poderão identificar.</p><p>Os contributos ajudam a identificar necessidades, reconhecer dificuldades recorrentes e definir prioridades que apoiem a melhoria dos cuidados oncológicos em Portugal.</p></div><div class="logo-showcase video-explainer-card"><div class="video-explainer-inner"><div class="video-badge">DA ESCUTA À MELHORIA</div><h3>Ouvir para compreender. Compreender para melhorar.</h3><p>O projeto procura transformar experiências em conhecimento útil para identificar necessidades e apoiar recomendações fundamentadas.</p><ul class="video-points"><li>Escutar diferentes perspetivas</li><li>Identificar dificuldades recorrentes</li><li>Comunicar prioridades e propostas</li></ul></div></div></div></section>
<section class="section commission-section" id="comissao" aria-labelledby="comissao-titulo"><div class="wrap">
 <details class="commission-accordion">
  <summary class="commission-summary">
   <div class="commission-summary-copy"><div class="eyebrow">EQUIPA DO ESTUDO</div><h2 id="comissao-titulo">Comissão de Oncologia</h2><p>Abra para conhecer a equipa e a coordenação científica da iniciativa.</p></div>
   <div class="commission-summary-side"><div class="commission-edition">Health Parliament Portugal</div><span class="commission-toggle-label">Ver equipa</span></div>
  </summary>
  <div class="commission-body">
   <p class="commission-body-intro">Dez membros com percursos e perspetivas complementares, unidos pelo propósito de contribuir para melhores cuidados oncológicos em Portugal.</p>
   <div class="commission-grid" aria-label="Membros da equipa">
   ${[
    ['Ana Bilé','assets/equipa/ana-bile.webp'],
    ['Diana Silva Gonçalves','assets/equipa/diana-goncalves.webp'],
    ['Gonçalo Pinto Mendes','assets/equipa/goncalo-pinto-mendes.webp'],
    ['Helena Vaz Cruz','assets/equipa/helena-vaz-cruz.webp'],
    ['Henrique Cabral','assets/equipa/henrique-cabral.webp'],
    ['Mariana Coutinho','assets/equipa/mariana-coutinho.webp'],
    ['Pedro Pedrosa','assets/equipa/pedro-pedrosa.webp'],
    ['Pedro Ventura','assets/equipa/pedro-ventura.webp'],
    ['Sofia Mourão','assets/equipa/sofia-mourao.webp'],
    ['Tiago Cunha Reis','assets/equipa/tiago-cunha-reis.webp']
   ].map(([name,photo])=>`<figure class="commission-person"><div class="commission-portrait"><img class="commission-photo" src="${photo}" alt="Retrato de ${name}" width="672" height="1008" loading="lazy" decoding="async"></div><figcaption class="commission-person-name">${name}</figcaption></figure>`).join('')}
   </div>
   <div class="commission-credit"><div class="commission-credit-mark" aria-hidden="true"></div><div class="commission-credit-copy"><span>COORDENAÇÃO DA INICIATIVA VOZES DA ONCOLOGIA</span><strong>Prof. Doutor Tiago Cunha Reis</strong></div></div>
  </div>
 </details>
 </div></section>`;}
function faq(){return `
<div class="wrap page-intro"><span class="pill">INFORMAÇÃO PARA PARTICIPAR</span><h1>Perguntas frequentes.</h1><p>Saiba como participar, qual a finalidade da escuta, como é tratada a informação e como as experiências ajudam a identificar prioridades para melhorar a oncologia em Portugal.</p></div>
<section class="section section-light"><div class="wrap faq-list">${[
 ['Como surgiu o Vozes da Oncologia?','O Vozes da Oncologia nasceu no âmbito dos trabalhos da Comissão de Oncologia do Health Parliament Portugal, na edição 2026-2027. A iniciativa procura dar voz às pessoas que vivem, acompanham ou trabalham na área da oncologia, reunindo experiências e contributos que permitam identificar dificuldades, reconhecer necessidades e apoiar a definição de prioridades para melhorar os cuidados oncológicos em Portugal.'],
 ['Quem pode participar?','Doentes oncológicos, sobreviventes, cuidadores e familiares, representantes de associações de doentes, profissionais de saúde e pessoas envolvidas em apoio social ou voluntariado em oncologia. Pode selecionar mais do que um perfil e escolher aquele que melhor corresponde à perspetiva do seu testemunho.'],
 ['Como funciona a participação?',isPrelaunch?'Pode explorar as quatro etapas, escolher o perfil, preencher as respostas e descarregar uma cópia local em PDF. Nesta modalidade, as respostas não são enviadas nem recebidas pela iniciativa.':'Comece por selecionar o seu perfil e, se desejar, indique a sua faixa etária e a região mais relevante. Depois, descreva uma dificuldade ou problema e, se quiser, apresente uma sugestão de melhoria. Por fim, pode responder às perguntas facultativas, confirmar o consentimento e enviar.'],
 ['Tenho de sugerir uma solução?','Não. Dar a conhecer uma dificuldade é, por si só, um contributo útil. As sugestões de melhoria, a faixa etária, a região e as perguntas complementares são facultativas.'],
 ['Porque pedem a faixa etária e a região?','Estes dados facultativos ajudam a contextualizar os relatos, identificar possíveis diferenças entre grupos etários e regiões e interpretar melhor as prioridades assinaladas. A faixa etária refere-se à pessoa que está a responder, não à pessoa acompanhada. Não pedimos data de nascimento nem morada. Mesmo quando opcionais, estas informações são importantes para a qualidade da análise.'],
 ['Existem perguntas fechadas?','Sim. Depois do relato livre, são apresentadas até cinco perguntas facultativas, adaptadas ao perfil principal. Permitem contextualizar as experiências e construir indicadores descritivos, sem substituir o testemunho nas suas próprias palavras.'],
 ['Como são utilizados os contributos?','O Vozes da Oncologia centra-se na identificação de dificuldades recorrentes, necessidades e oportunidades de melhoria nos cuidados oncológicos. A análise procura apoiar prioridades e recomendações, com comunicação de resultados agregados e reconhecimento das limitações dos dados recolhidos. Um contributo individual não garante a adoção de uma medida específica.'],
 ['As respostas representam toda a população portuguesa?','Não necessariamente. A participação voluntária não constitui, por si só, uma amostra nacional representativa. A divulgação de resultados deve indicar a dimensão das respostas, o contexto dos participantes e as limitações metodológicas relevantes.'],
 ['Tenho de me identificar?','Não é obrigatório indicar nome ou criar uma conta. Recomendamos que não escreva nomes de terceiros, datas exatas ou outros dados que possam identificar pessoas no relato livre. A ausência de nome não garante, por si só, anonimato absoluto.'],
 ['Como é protegida a minha privacidade?','O website permite consultar a informação da iniciativa e as etapas do formulário, sem enviar testemunhos nesta configuração. Os serviços de alojamento podem tratar dados técnicos de navegação. Consulte a <a href="/privacidade.html">página de privacidade e dados</a> para conhecer as responsabilidades, os serviços tecnológicos e os seus direitos.'],
 ['Posso deixar um email para recontacto?',isPrelaunch?'O formulário interativo não solicita endereço de email nem permite recontacto. O contacto geral da iniciativa está disponível no rodapé do website.':'Pode indicar um email facultativo e autorizar expressamente um eventual recontacto sobre o contributo.'],
 ['Posso receber uma cópia do que escrevi?','Sim. Pode descarregar um PDF com as suas respostas, incluindo os campos de escuta aberta. A cópia é preparada no dispositivo, sem transmitir o conteúdo do documento a serviços externos. Só um identificador de receção do servidor confirma uma participação recebida.'],
 ['A participação substitui um pedido de apoio médico ou uma reclamação?','Não. O Vozes da Oncologia é um espaço de escuta orientado para a melhoria dos cuidados. Não substitui avaliação ou aconselhamento médico, assistência urgente nem os canais oficiais de reclamação. Para necessidades clínicas, recorra aos serviços de saúde adequados.']
 ].map(([q,a],i)=>`<div class="faq-item" ${q==='Como é protegida a minha privacidade?'?'id="privacidade"':''}><details ${i===0?'open':''}><summary>${q}</summary><div class="faq-answer"><p>${a}</p></div></details></div>`).join('')}
<div class="callout-panel cta-panel"><div><h3>Quer partilhar uma experiência?</h3><p>Descreva a dificuldade nas suas próprias palavras e ajude a identificar o que pode melhorar.</p></div>${btn(isPrelaunch?'Explorar o formulário':'Participar','#/participe')}</div>
</div></section>`;}
function progress(n){return `<div class="form-progress" aria-label="Progresso da participação">${[['O seu perfil',1],['A sua experiência',2],['Perguntas opcionais',3],['Revisão e privacidade',4]].map(([name,k])=>`<div class="progress-item ${k===n?'current':(k<n?'past':'')}" ${k===n?'aria-current="step"':''}><span class="bubble">${k<n?'✓':k}</span><span>${name}</span></div>`).join('')}</div>`;}
function formStageExperience(){return `<div class="eyebrow">PASSO 02 · ESCUTA ABERTA</div><h2>O que precisa de melhorar nos cuidados oncológicos?</h2><p class="form-subtitle">Partilhe livremente uma dificuldade que tenha sentido, acompanhado ou observado. Não há uma lista de temas nem respostas certas. As perguntas complementares surgem apenas depois.</p>
<div class="form-group"><label class="field-label" for="difficulty">1. Que dificuldade ou problema gostaria de dar a conhecer? <span aria-hidden="true">*</span></label><textarea id="difficulty" name="difficulty" maxlength="12000" required placeholder="Conte-nos, pelas suas palavras, o que aconteceu ou o que considera que precisa de melhorar..."></textarea><p class="field-helper">Obrigatório para avançar. Evite incluir nomes, datas exatas ou outros elementos que identifiquem pessoas.</p><div id="difficulty-error" aria-live="polite"></div></div>
<div class="form-group"><label class="field-label" for="solution">2. Como considera que esta situação poderia ser melhorada? <span class="optional">Opcional</span></label><textarea id="solution" name="solution" maxlength="12000" placeholder="Se tiver uma sugestão ou ideia, partilhe-a aqui..."></textarea><p class="field-helper">Não precisa de apresentar uma solução para participar.</p></div>
<div class="form-group"><label class="field-label" for="extra">3. Há mais alguma coisa que queira acrescentar? <span class="optional">Opcional</span></label><textarea id="extra" name="extra" maxlength="12000" placeholder="Outro contexto ou informação que considere importante..."></textarea></div>
${privacyNote()}<div class="form-actions"><button class="button button-quiet" type="button" data-action="back1">${icon('chevron',17)} Voltar</button><button class="button button-yellow" type="button" data-action="next2">Continuar ${icon('arrow',17)}</button></div>`;}
function privacyNote(){return `<div class="privacy-reminder">${icon('shield',20)}<p>${privacyText()}</p></div>`;}
function formStageProfile(){return `<div class="eyebrow">PASSO 01 · PERFIL E CONTEXTO</div><h2>Qual é a sua ligação à oncologia?</h2><p class="form-subtitle">Pode selecionar vários perfis. Se escolher mais do que um, indique qual representa a perspetiva principal deste contributo. Assim, evitamos perguntas repetidas.</p>
<div class="profile-grid">${roles.map(([id,label])=>`<label class="profile-option ${form.roles.includes(id)?'selected':''}"><input type="checkbox" data-role="${id}" ${form.roles.includes(id)?'checked':''}/><span>${label}</span></label>`).join('')}</div><div id="role-error" aria-live="polite"></div>
<div id="adaptive-fields">${adaptiveFields()}</div>${privacyNote()}<div class="form-actions"><span class="footnote">Selecione pelo menos um perfil</span><button class="button button-yellow" type="button" data-action="next1">Continuar ${icon('arrow',17)}</button></div>`;}
function adaptiveFields(){if(!form.roles.length)return '';
 const chosen=form.roles.includes(form.primaryRole)?form.primaryRole:form.roles[0];
 const r=roles.find(x=>x[0]===chosen);
 return `<div class="adaptive-box"><div class="adaptive-eyebrow">Contexto adicional · opcional</div>
 ${form.roles.length>1?`<div class="form-group"><label class="field-label" for="primaryRole">A partir de que perspetiva está a partilhar esta experiência?</label><select id="primaryRole" class="text-input" aria-label="Perspetiva principal">${roles.filter(x=>form.roles.includes(x[0])).map(([id,label])=>`<option value="${id}" ${id===chosen?'selected':''}>${label}</option>`).join('')}</select><p class="field-helper">Este campo serve apenas para adaptar as perguntas. Os outros perfis mantêm-se registados.</p></div>`:''}
 <p class="adaptive-info-note"><strong>A informação seguinte é facultativa.</strong> Ainda assim, indicar a faixa etária e a região ajuda-nos a contextualizar os testemunhos e a identificar necessidades e prioridades entre diferentes grupos, tornando a análise mais útil para o estudo.</p>
 <div class="form-group"><label class="field-label" for="ageGroup">Qual é a sua faixa etária? <span class="optional">Opcional</span></label><select id="ageGroup" class="text-input">${ageGroups.map(([v,label])=>`<option value="${esc(v)}" ${form.ageGroup===v?'selected':''}>${esc(label)}</option>`).join('')}</select><p class="field-helper">Considere a sua própria idade, não a de outra pessoa que acompanha. Não pedimos a data de nascimento.</p></div>
 <div class="form-group"><label class="field-label" for="region">${esc(regionLabelForRole(chosen))} <span class="optional">Opcional</span></label><select id="region" class="text-input">${regions.map(([v,label])=>`<option value="${esc(v)}" ${form.region===v?'selected':''}>${esc(label)}</option>`).join('')}</select><p class="field-helper">Indique apenas uma região ampla, se for útil. A opção "Âmbito nacional / várias regiões" é adequada a contributos transversais. Não pedimos morada nem instituição.</p></div>
 <div class="form-group"><label class="field-label" for="context-primary">${esc(r[2])} <span class="optional">Opcional</span></label><textarea id="context-primary" data-context="${chosen}" maxlength="6000" placeholder="Pode deixar este campo em branco.">${esc(form.roleContext[chosen]||'')}</textarea></div></div>`;
}
function activeRole(){return form.roles.includes(form.primaryRole)?form.primaryRole:form.roles[0];}
function currentQuestions(){return surveyModules[moduleForRole(activeRole())]||[];}
function formStage3(){const questions=currentQuestions();return `<div class="eyebrow">PASSO 03 · INDICADORES OPCIONAIS</div><h2>Algumas perguntas complementares.</h2><p class="form-subtitle">Estas cinco perguntas opcionais ajudam a produzir indicadores comparáveis, sem substituir as suas palavras. Pode deixar qualquer pergunta sem resposta.</p>
 <div class="measurement-note"><strong>Perspetiva:</strong> ${esc(roles.find(r=>r[0]===activeRole())?.[1]||'')}.<br>As respostas referem-se apenas à experiência ou à atividade que indicou. Não há respostas certas.</div>
 ${questions.map((q,i)=>`<fieldset class="likert-question"><legend><span class="likert-number">${i+1}</span> ${esc(q.text)}</legend><div class="likert-options" role="group" aria-label="${esc(q.text)}">${q.options.map((o,j)=>`<label class="likert-choice"><input type="radio" name="q-${q.id}" value="${esc(o)}" ${form.answers[activeRole()]?.[q.id]===o?'checked':''}/><span>${esc(o)}</span></label>`).join('')}</div><button class="clear-answer" type="button" data-action="clearAnswer" data-q="${q.id}">Limpar resposta</button></fieldset>`).join('')}
 ${privacyNote()}<div class="form-actions"><button type="button" class="button button-quiet" data-action="back2">${icon('chevron',17)} Voltar</button><div class="stage3-actions" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><button type="button" class="button button-quiet" data-action="skip3">Saltar esta etapa</button><button class="button button-yellow" type="button" data-action="next3">Continuar ${icon('arrow',17)}</button></div></div>`;}
function formStage4(){const chosen=roles.filter(([id])=>form.roles.includes(id)).map(x=>x[1]).join(' · ');const questions=currentQuestions();const answers=form.answers[activeRole()]||{};
const prodFields = `<div class="privacy-card"><strong>${icon('shield',18)} Informação sobre o tratamento</strong><p>Este formulário pode conter dados pessoais relativos à saúde. Leia a <a href="${esc(cfg.privacyUrl||'#')}" target="_blank" rel="noopener noreferrer">Política de Privacidade</a> antes de continuar. Os contactos opcionais são armazenados separadamente e não se destinam ao envio automático de emails.</p></div>
<div class="form-group"><label class="field-label" for="email">Email para eventual recontacto <span class="optional">Opcional</span></label><input class="text-input" type="email" id="email" inputmode="email" autocomplete="off" maxlength="254" placeholder="exemplo@email.pt" value="${esc(form.email)}" /><p class="field-helper">O email só será enviado ao servidor se assinalar a opção de recontacto.</p></div>
<label class="checkbox-row"><input type="checkbox" id="contact" ${form.contact?'checked':''}/><span>Autorizo que me contactem posteriormente sobre este contributo. <span class="optional">Opcional</span></span></label>
<label class="checkbox-row"><input type="checkbox" id="adultAttested" ${form.adultAttested?'checked':''}/><span><strong>Confirmo que tenho 18 anos ou mais.</strong></span></label>
<label class="checkbox-row"><input type="checkbox" id="ack" ${form.ack?'checked':''}/><span><strong>Li a informação de privacidade e dou consentimento explícito para o tratamento do meu testemunho, que poderá incluir dados pessoais relativos à saúde, para as finalidades aí descritas.</strong></span></label>
<div class="form-group"><label class="field-label">Verificação de segurança</label><div id="v9-turnstile"></div></div>
${!isConfiguredForProduction()?'<div class="demo-disclaimer" role="alert"><strong>Recolha desativada.</strong> A configuração de produção ainda não foi validada. Não é possível enviar respostas.</div>':''}`;
const demoFields = `<div class="privacy-card"><strong>${icon('shield',18)} Cópia local, sem envio</strong><p>Pode preencher o formulário e guardar uma cópia pessoal em PDF. O projeto não recebe nem armazena estas respostas. Evite informações pessoais ou de saúde identificáveis neste preenchimento. Consulte a <a href="/privacidade.html">informação de privacidade</a>.</p></div>
<label class="checkbox-row"><input type="checkbox" id="ack" ${form.ack?'checked':''}/><span><strong>Compreendo que este preenchimento não envia respostas à iniciativa e cria apenas uma cópia no meu dispositivo.</strong></span></label>`
return `<div class="eyebrow">PASSO 04 · REVISÃO E PRIVACIDADE</div><h2>Reveja a sua participação.</h2><p class="form-subtitle">${isProduction?'Confirme o que escreveu e leia a informação de privacidade antes de enviar.':'Confirme os campos apresentados. O envio de respostas encontra-se indisponível.'}</p>
<dl class="summary-card"><dt>Dificuldade identificada</dt><dd>${esc(form.difficulty)}</dd><dt>Sugestão de melhoria</dt><dd>${esc(form.solution||'Não indicada')}</dd><dt>Informação adicional</dt><dd>${esc(form.extra||'Não indicada')}</dd><dt>Perfis selecionados</dt><dd>${esc(chosen)}</dd><dt>Perspetiva principal</dt><dd>${esc(roles.find(r=>r[0]===activeRole())?.[1]||'Não indicada')}</dd><dt>Faixa etária (facultativa)</dt><dd>${esc(form.ageGroup||'Não indicada')}</dd><dt>Região mais relevante (facultativa)</dt><dd>${esc(form.region||'Não indicada')}</dd>${form.roleContext[activeRole()]?.trim()?`<dt>Contexto adicional</dt><dd>${esc(form.roleContext[activeRole()])}</dd>`:''}<dt>Respostas complementares</dt><dd>${questions.map(q=>esc(q.text)+'\n'+esc(answers[q.id]||'Sem resposta')).join('\n\n')}</dd></dl>
${isProduction?prodFields:demoFields}
<div id="confirm-error" aria-live="polite"></div><div id="pdf-export-status" role="status" aria-live="polite" class="field-helper"></div><div class="form-actions"><button class="button button-quiet" type="button" data-action="back3">${icon('chevron',17)} Voltar</button><button class="button button-yellow" type="button" ${isProduction&&!isConfiguredForProduction()?'disabled':''} data-action="${isProduction?'submitReal':'submitDemo'}">${isProduction?'Enviar participação':'Guardar PDF no dispositivo'} ${icon(isProduction?'arrow':'download',17)}</button></div>`;
}
function completed(){const accepted=isProduction&&Boolean(form.receipt);return `<div class="success-state"><div class="success-mark">✓</div><div class="eyebrow">${accepted?'RECEÇÃO CONFIRMADA':'CÓPIA LOCAL PREPARADA'}</div><h2>${accepted?'A sua participação foi recebida.':'A cópia local foi preparada.'}</h2><p>${accepted?'A participação foi guardada no sistema. Pode agora guardar uma cópia pessoal das suas respostas no seu dispositivo.':'Foi preparada uma cópia local do conteúdo. <strong>Não foi enviada qualquer participação.</strong>'}</p>
${accepted?`<div class="receipt-panel"><strong>Identificador de receção</strong><code>${esc(form.receipt)}</code><p>Guarde este identificador para referência. O PDF pode conter informação sensível; não o partilhe involuntariamente.</p></div>`:'<div class="demo-disclaimer">Esta cópia pessoal não comprova o envio ou a receção de uma participação.</div>'}
<div id="pdf-repeat-error" class="field-helper" role="status" aria-live="polite"></div><div class="success-buttons"><button type="button" class="button button-yellow" data-action="download">${icon('download',18)} Descarregar ${accepted?'a minha cópia':'novamente o PDF'}</button><button type="button" class="button button-outline" data-action="restart">Nova participação</button></div>
<p class="footnote" style="margin-top:22px">O PDF contém a transcrição integral dos campos abertos e é preparado localmente neste dispositivo.</p></div>`;}
function participate(){return `<section class="form-page"><div class="wrap"><div class="form-head"><div class="eyebrow">A SUA VOZ IMPORTA · EDIÇÃO 2026-2027</div><h1>Conte-nos o que pode melhorar.</h1><p>Comece por indicar a sua ligação à oncologia. Depois, partilhe livremente as dificuldades que considera importantes. As propostas de melhoria e as perguntas complementares são opcionais.</p></div>${isPrelaunch?'<div class="local-mode-notice" role="status"><strong>Formulário interativo</strong><span>Pode selecionar os perfis, preencher as perguntas e guardar uma cópia em PDF. O envio à iniciativa está desativado. Não introduza dados pessoais ou de saúde identificáveis.</span></div>':''}<div class="form-shell">${form.stage<5?progress(form.stage):''}<div class="form-content">${form.stage===1?formStageProfile():form.stage===2?formStageExperience():form.stage===3?formStage3():form.stage===4?formStage4():completed()}</div></div><div style="max-width:940px;margin:18px auto 0;text-align:center" class="footnote">Esta plataforma não se destina ao envio de pedidos de assistência médica ou reclamações clínicas urgentes.</div></div></section>`;}
function saveVisibleStage(){
 if(form.stage===1){
  const c=document.querySelector('[data-context]');if(c)form.roleContext[c.dataset.context]=c.value;
  const select=document.getElementById('primaryRole');if(select)form.primaryRole=select.value;
  if(!form.roles.includes(form.primaryRole))form.primaryRole=form.roles[0]||'';
  const age=document.getElementById('ageGroup');if(age)form.ageGroup=age.value;
  const region=document.getElementById('region');if(region)form.region=region.value;
 }
 if(form.stage===2){['difficulty','solution','extra'].forEach(k=>{const el=document.getElementById(k);if(el)form[k]=el.value});}
 if(form.stage===3){const role=activeRole();if(role){form.answers[role]??={};currentQuestions().forEach(q=>{const checked=document.querySelector(`input[name="q-${q.id}"]:checked`);if(checked)form.answers[role][q.id]=checked.value;});}}
 if(form.stage===4){form.email=document.getElementById('email')?.value.trim()||'';form.contact=Boolean(document.getElementById('contact')?.checked);form.ack=Boolean(document.getElementById('ack')?.checked);form.adultAttested=Boolean(document.getElementById('adultAttested')?.checked);}
}
function showError(nodeId,msg){const el=document.getElementById(nodeId);if(el){el.innerHTML=msg?`<p class="field-error" role="alert">${esc(msg)}</p>`:'';if(msg)el.scrollIntoView({behavior:'smooth',block:'center'});}}
function switchStage(n){saveVisibleStage();form.stage=n;renderPage(false);document.querySelector('.form-shell')?.scrollIntoView({behavior:'smooth',block:'start'});}
function collectPdfData(){
 const role=activeRole();
 const answers=form.answers[role]||{};
 return {
   difficulty:form.difficulty, solution:form.solution, extra:form.extra,
   roles:roles.filter(r=>form.roles.includes(r[0])).map(r=>r[1]),
   primaryRole:roles.find(r=>r[0]===role)?.[1]||'',
   ageGroup:ageGroups.find(r=>r[0]===form.ageGroup)?.[1]||form.ageGroup,
   region:regions.find(r=>r[0]===form.region)?.[1]||form.region,
   context:form.roleContext[role]||'',
   questions:currentQuestions().map(q=>({text:q.text,answer:answers[q.id]||''})),
   email:form.email,contact:form.contact,receipt:form.receipt
 };
}
async function downloadCopy(){
 if(typeof window.VozesPDF?.download!=='function')throw new Error('O componente de geração do PDF não está disponível. Atualize a página e tente novamente.');
 return window.VozesPDF.download(collectPdfData());
}
function isValidEmail(s){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)}
async function onFormClick(evt){const target=evt.target.closest('[data-action]');if(!target)return;saveVisibleStage();const action=target.dataset.action;
 if(action==='next1'){
  if(!form.roles.length){showError('role-error','Selecione pelo menos um perfil para contextualizar a sua participação.');return;}
  if(!form.roles.includes(form.primaryRole))form.primaryRole=form.roles[0];
  showError('role-error','');switchStage(2);
 }
 else if(action==='next2'){
  if(form.difficulty.trim().length<15){showError('difficulty-error','Descreva a dificuldade com pelo menos 15 caracteres, para que seja possível compreendê-la.');document.getElementById('difficulty')?.focus();return;}
  showError('difficulty-error','');switchStage(3);
 }
 else if(action==='next3'||action==='skip3')switchStage(4);
 else if(action==='back1')switchStage(1);
 else if(action==='back2')switchStage(2);
 else if(action==='back3')switchStage(3);
 else if(action==='clearAnswer'){
  const question=target.dataset.q;const role=activeRole();
  if(question&&role){form.answers[role]??={};delete form.answers[role][question];document.querySelectorAll(`input[name="q-${question}"]`).forEach(el=>el.checked=false);}
 }
 else if(action==='submitReal'){
   if(!isConfiguredForProduction()){showError('confirm-error','A recolha ainda não está ativa.');return;}
   if(form.ageGroup==='Menos de 18 anos' || !form.adultAttested){showError('confirm-error','Só é possível participar depois de confirmar que tem 18 anos ou mais.');return;}
   if(!form.ack){showError('confirm-error','Para participar é necessário ler a informação de privacidade e dar consentimento explícito.');return;}
   if(form.contact && !isValidEmail(form.email)){showError('confirm-error','Para permitir recontacto, introduza um email válido.');return;}
   if(form.email && !isValidEmail(form.email)){showError('confirm-error','Verifique o email introduzido ou deixe-o em branco.');return;}
   if(!turnstileToken){showError('confirm-error','Conclua a verificação de segurança antes de enviar.');return;}
   showError('confirm-error','');target.disabled=true;
   const status=document.getElementById('pdf-export-status');
   if(status)status.textContent='A enviar a sua participação de forma segura...';
   try {
     // O mesmo requestId é reutilizado após falhas de rede para evitar duplicados.
     const receipt=await sendParticipation();
     form.receipt=receipt;form.stage=5;renderPage(false);
     document.querySelector('.form-shell')?.scrollIntoView({behavior:'smooth',block:'start'});
     try {await downloadCopy();}
     catch(pdfError){console.warn('Receção confirmada; exportação PDF não concluída.');
       const el=document.getElementById('pdf-repeat-error');if(el)el.textContent='Participação recebida, mas o PDF não foi descarregado. Pode tentar novamente abaixo.';
     }
   }catch(err){turnstileReset();showError('confirm-error',err.message||'Falha ao comunicar com o servidor. Tente novamente.');}
   finally{target.disabled=false;}
 }
 else if(action==='submitDemo'){
  // Não recolher nem solicitar endereços de contacto em modo local.
  form.email='';form.contact=false;form.receipt='';
  if(!form.ack){showError('confirm-error','Confirme que compreende que o PDF é local e não envia respostas.');return;}
  showError('confirm-error','');
  const status=document.getElementById('pdf-export-status');
  target.disabled=true;
  if(status)status.textContent='A preparar o PDF completo no seu dispositivo...';
  try {
    await downloadCopy();
    form.stage=5;renderPage(false);
    document.querySelector('.form-shell')?.scrollIntoView({behavior:'smooth',block:'start'});
  } catch(err) {
    console.error('Erro ao gerar PDF:',err);
    showError('confirm-error','Não foi possível gerar o PDF. Os seus dados continuam no formulário. Tente novamente.');
  } finally {target.disabled=false;}
 }
 else if(action==='download'){
  target.disabled=true;
  try{await downloadCopy();}
  catch(err){console.error('Erro ao gerar PDF:',err); const feedback=document.getElementById('pdf-repeat-error');if(feedback)feedback.textContent='Não foi possível descarregar o PDF. Tente novamente.';}
  finally{target.disabled=false;}
 }
 else if(action==='restart'){
  Object.assign(form,{stage:1,difficulty:'',solution:'',extra:'',roles:[],primaryRole:'',ageGroup:'',region:'',roleContext:{},answers:{},email:'',contact:false,ack:false,adultAttested:false,requestId:'',receipt:''});
  renderPage(false);document.querySelector('.form-shell')?.scrollIntoView({behavior:'smooth',block:'start'});
 }
}
function bindForm(){const shell=app.querySelector('.form-shell');if(!shell)return;shell.addEventListener('click',onFormClick);
 if(form.stage===2){['difficulty','solution','extra'].forEach(k=>{const el=document.getElementById(k);if(el){el.value=form[k];el.addEventListener('input',()=>{form[k]=el.value;if(k==='difficulty')showError('difficulty-error','');});}});}
 if(form.stage===1){
  document.querySelectorAll('[data-role]').forEach(input=>input.addEventListener('change',()=>{
   saveVisibleStage();form.roles=input.checked?[...form.roles,input.dataset.role]:form.roles.filter(x=>x!==input.dataset.role);
   if(!form.roles.includes(form.primaryRole))form.primaryRole=form.roles[0]||'';
   document.querySelectorAll('[data-role]').forEach(el=>el.closest('.profile-option').classList.toggle('selected',el.checked));
   document.getElementById('adaptive-fields').innerHTML=adaptiveFields();
   bindAdaptiveFields();showError('role-error','');
  }));
  bindAdaptiveFields();
 }
 if(form.stage===3){document.querySelectorAll('.likert-question input[type=radio]').forEach(el=>el.addEventListener('change',()=>{const role=activeRole();form.answers[role]??={};form.answers[role][el.name.replace('q-','')]=el.value;}));}
 if(form.stage===4){['email','contact','ack','adultAttested'].forEach(k=>{const e=document.getElementById(k);if(e)e.addEventListener('change',saveVisibleStage);});}
}
function bindAdaptiveFields(){
 const age=document.getElementById('ageGroup');if(age)age.addEventListener('change',()=>form.ageGroup=age.value);
 const region=document.getElementById('region');if(region)region.addEventListener('change',()=>form.region=region.value);
 const role=document.getElementById('primaryRole');if(role)role.addEventListener('change',()=>{
  const oldContext=document.querySelector('[data-context]');if(oldContext)form.roleContext[oldContext.dataset.context]=oldContext.value;
  form.primaryRole=role.value;document.getElementById('adaptive-fields').innerHTML=adaptiveFields();bindAdaptiveFields();
 });
 const ctx=document.querySelector('[data-context]');if(ctx)ctx.addEventListener('input',()=>form.roleContext[ctx.dataset.context]=ctx.value);
}

function currentRoute(){const route=location.hash.match(/^#\/(inicio|participe|faq)/);return route?.[1]||'inicio';}
function renderPage(resetScroll=true){let route=currentRoute();const pages={inicio:home,participe:participate,faq};app.innerHTML=(pages[route]||home)();document.querySelectorAll('.main-nav a').forEach(a=>{const active=a.dataset.nav===route;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});document.title='Vozes da Oncologia';document.getElementById('main-nav')?.classList.remove('open');document.getElementById('menu-toggle')?.setAttribute('aria-expanded','false');if(route==='participe'){bindForm();if(isProduction&&form.stage===4)initializeTurnstile();}if(resetScroll){const anchor=location.hash.split('#')[2];if(anchor){requestAnimationFrame(()=>document.getElementById(anchor)?.scrollIntoView())}else window.scrollTo({top:0,behavior:'auto'});} }
document.getElementById('menu-toggle').addEventListener('click',function(){const nav=document.getElementById('main-nav');const open=nav.classList.toggle('open');this.setAttribute('aria-expanded',String(open));this.setAttribute('aria-label',open?'Fechar menu':'Abrir menu');});
window.addEventListener('hashchange',()=>{if(form.stage<5&&currentRoute()==='participe')saveVisibleStage();renderPage();});
if(!location.hash)location.replace('#/inicio');else renderPage();

// Contactos: o endereço só é mostrado após ação explícita do visitante.
(function setupFooterContact(){
 const host=document.getElementById('footer-contact');
 const trigger=document.getElementById('footer-contact-trigger');
 const reveal=document.getElementById('footer-contact-reveal');
 const copy=document.getElementById('footer-contact-copy');
 const display=document.getElementById('footer-contact-email');
 const feedback=document.getElementById('footer-contact-feedback');
 if(!host||!trigger||!reveal||!copy||!display||!feedback)return;
 const address=['ouvir','vozesoncologia.pt'].join('@');
 function close(){host.classList.remove('is-open');trigger.setAttribute('aria-expanded','false');}
 trigger.addEventListener('click',()=>{const open=!host.classList.contains('is-open');host.classList.toggle('is-open',open);trigger.setAttribute('aria-expanded',String(open));});
 reveal.addEventListener('click',()=>{display.textContent=address;reveal.hidden=true;copy.hidden=false;feedback.textContent='Endereço de email revelado.';});
 copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(address);feedback.textContent='Email copiado.';}catch(e){feedback.textContent='Selecione e copie o endereço apresentado.';}});
 document.addEventListener('click',(evt)=>{if(!host.contains(evt.target))close();});
 document.addEventListener('keydown',(evt)=>{if(evt.key==='Escape'){close();if(host.contains(document.activeElement))trigger.focus();}});
})();
