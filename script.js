/* Vozes da Oncologia - protótipo de interface, edição 2026–2027.
   Este ficheiro NÃO envia dados, não grava em Google Sheets e não faz pedidos a APIs.
   Os dados introduzidos existem apenas na memória temporária do browser e podem
   ser descarregados localmente como texto após uma submissão SIMULADA. */
'use strict';
const app = document.getElementById('app');
const roles = [
  ['doente','Sou doente oncológico','Se desejar, há mais algum contexto da sua experiência pessoal que queira acrescentar?'],
  ['sobrevivente','Sou sobrevivente de cancro','Se desejar, há algo mais sobre a sua experiência que nos ajude a compreender esta dificuldade?'],
  ['cuidador','Sou cuidador(a) ou familiar','Há algum contexto da sua experiência enquanto familiar ou cuidador(a) que queira acrescentar?'],
  ['associacao','Represento uma associação de doentes','Quer acrescentar alguma perspetiva das pessoas que a associação representa?'],
  ['profissional','Sou profissional de saúde','Quer acrescentar algum contexto relacionado com a sua prática profissional?'],
  ['apoio','Presto apoio social ou voluntário em oncologia','Quer acrescentar alguma perspetiva da sua atividade de apoio ou voluntariado?']
];
const form = {stage:1,difficulty:'',solution:'',extra:'',roles:[],roleContext:{},email:'',contact:false,emailCopy:false,ack:false,receipt:''};
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
  <div class="hero-copy"><div class="eyebrow">COMISSÃO DE ONCOLOGIA · EDIÇÃO 2026–2027</div>
    <h1>A sua experiência pode ajudar a <span class="mark">melhorar</span> os cuidados oncológicos em Portugal.</h1>
    <p class="hero-lead">Conte-nos as dificuldades que sentiu ou observou e como considera que poderiam ser melhoradas.</p>
    <div class="hero-actions">${btn('Partilhar a minha experiência','#/participe')}</div>
    <div class="hero-note">${icon('lock',16)} Participação escrita · Sem identificação pessoal obrigatória</div>
  </div><div class="hero-art"><img src="assets/retratos-diversidade.webp" alt="Ilustração em aguarela e tinta de pessoas de diferentes idades, origens e experiências, incluindo uma profissional de saúde" fetchpriority="high" /></div>
</div></section>
<section class="section section-light"><div class="wrap">
 <div class="section-head"><div><div class="eyebrow">SIMPLES, LIVRE E SEM RESPOSTAS PREDEFINIDAS</div><h2>Como funciona?</h2></div><span class="handnote">Cada experiência conta.</span></div>
 <div class="steps-grid">${[
 ['Partilhe a dificuldade','Descreva livremente um problema que tenha vivido, acompanhado ou observado.'],
 ['Sugira uma melhoria','Se tiver uma ideia de solução, partilhe-a. Não é obrigatório apresentar propostas.'],
 ['Dê-nos contexto','Selecione um ou mais perfis e responda, se quiser, a perguntas abertas adaptadas.'],
 ['Guarde a sua cópia','Reveja a informação e descarregue uma cópia local do que escreveu.']
 ].map(([title,description],i)=>`<article class="step-card"><div class="step-image"><img src="assets/passo-${i+1}.webp" alt="" loading="lazy" /></div><div class="step-title"><span class="step-index">${i+1}</span><h3>${title}</h3></div><p>${description}</p></article>`).join('')}</div>
 <div class="callout-panel cta-panel"><div><h3>O que podemos melhorar juntos?</h3><p>Não há temas fechados nem respostas certas. Comece pela dificuldade que considera importante.</p></div>${btn('Quero participar','#/participe')}</div>
 </div></section>
<section class="section"><div class="wrap two-col"><div class="body-copy"><div class="eyebrow">PORQUE ESCUTAR IMPORTA</div><h2>Por trás de cada dificuldade, há uma experiência que importa compreender.</h2><p>Doentes, sobreviventes, familiares, associações, profissionais de saúde e pessoas que prestam apoio conhecem realidades diferentes da oncologia. Queremos criar espaço para as ouvir sem antecipar os problemas que poderão identificar.</p><p>Esta iniciativa integra o trabalho da Comissão de Oncologia do Health Parliament Portugal na edição 2026–2027.</p></div><div class="logo-showcase video-explainer-card"><div class="video-explainer-inner"><div class="video-badge">VÍDEO EXPLAINER</div><div class="video-play" aria-hidden="true">▶</div><h3>Como funciona esta iniciativa?</h3><p>Breve vídeo introdutório sobre o objetivo do projeto, quem pode participar e como serão utilizados os contributos.</p><ul class="video-points"><li>Porque estamos a ouvir</li><li>Como participar</li><li>O que acontece depois</li></ul><div class="video-coming">Em breve</div></div></div></div></section>
<section class="section commission-section" id="comissao" aria-labelledby="comissao-titulo"><div class="wrap">
 <details class="commission-accordion">
  <summary class="commission-summary">
   <div class="commission-summary-copy"><div class="eyebrow">EQUIPA DO ESTUDO</div><h2 id="comissao-titulo">A Comissão de Oncologia</h2><p>Abra para conhecer a equipa, a estrutura de liderança e a proposta de coordenação científica da iniciativa.</p></div>
   <div class="commission-summary-side"><div class="commission-edition">HPP <span>2026-2027</span></div><span class="commission-toggle-label">Ver equipa</span></div>
  </summary>
  <div class="commission-body">
   <p class="commission-body-intro">Dez membros com percursos e perspetivas complementares, unidos pelo propósito de contribuir para melhores cuidados oncológicos em Portugal.</p>
   <div class="commission-grid">
   ${[
    ['Ana Bilé',''],
    ['Diana Silva Gonçalves',''],
    ['Gonçalo Pinto Mendes',''],
    ['Helena Cruz',''],
    ['Henrique Cabral',''],
    ['Mariana Coutinho',''],
    ['Pedro Pedrosa',''],
    ['Pedro Ventura',''],
    ['Sofia Morão',''],
    ['Tiago Cunha Reis','']
   ].map(([name,role])=>`<div class="commission-person"><div class="commission-avatar" aria-hidden="true">${icon('profile',26)}</div><span class="commission-person-name">${name}</span>${role?`<span class="commission-role">${role}</span>`:''}</div>`).join('')}
   </div>
   <div class="commission-credit"><div class="commission-credit-mark" aria-hidden="true"></div><div class="commission-credit-copy"><span>CONCEÇÃO E COORDENAÇÃO CIENTÍFICA DA INICIATIVA · PROPOSTA</span><strong>Prof. Doutor Tiago Cunha Reis</strong></div><p>Atribuição sujeita a validação institucional antes da publicação.</p></div>
  </div>
 </details>
 </div></section>`;}
function faq(){return `
<div class="wrap page-intro"><span class="pill">INFORMAÇÃO PARA PARTICIPAR</span><h1>Perguntas frequentes.</h1><p>Respostas sobre a iniciativa, a participação, a privacidade e o acompanhamento do trabalho da Comissão.</p></div>
<section class="section section-light"><div class="wrap faq-list">${[
 ['Quem pode participar?','Doentes oncológicos, sobreviventes, cuidadores e familiares, representantes de associações de doentes, profissionais de saúde e pessoas envolvidas em apoio social ou voluntariado em oncologia. Pode selecionar mais do que um perfil.'],
 ['O que devo escrever?','Descreva uma dificuldade ou problema que tenha vivido, acompanhado ou observado nos cuidados oncológicos. Se desejar, explique como acredita que poderia ser melhorado. Pode acrescentar livremente outras informações que considere relevantes.'],
 ['Tenho de sugerir uma solução?','Não. A descrição de uma dificuldade é, por si só, um contributo útil. A sugestão de melhoria e as perguntas de contexto são opcionais.'],
 ['Tenho de me identificar?','O formulário foi desenhado sem exigir nome ou conta. No entanto, relatos livres podem conter elementos identificativos e um email opcional constitui um dado pessoal. Uma participação sem nome não é automaticamente anónima.'],
 ['Como será utilizada a informação?','Na versão futura, a finalidade prevista é apoiar a identificação de dificuldades e oportunidades de melhoria e o desenvolvimento de propostas pela Comissão de Oncologia. Antes da recolha real, serão divulgados o responsável pelo tratamento, as bases legais, a política de conservação, os destinatários e os direitos dos titulares.'],
 ['Posso deixar um email para recontacto?','Sim, prevê-se essa possibilidade, opcional e com autorização específica. No presente protótipo, o email não é transmitido nem permite recontacto real.'],
 ['Recebo uma cópia da minha participação?','O protótipo gera automaticamente uma cópia de texto descarregável no dispositivo. Numa versão de produção deverá ficar garantida uma cópia da submissão, com envio por email apenas quando a pessoa o solicitar e o serviço estiver configurado.'],
 ['O website garante anonimato absoluto?','Não seria correto fazer essa promessa. A proteção dos contributos exige medidas técnicas e organizativas, minimização de dados, separação de contactos e avaliação jurídica específica para eventuais dados de saúde.'],
 ['Há proteção contra bots?','A versão de produção deverá incluir mecanismos como Cloudflare Turnstile validado no servidor, limites de submissões, verificação de pedidos e deteção de abuso. O protótipo não inclui esses serviços. Nenhum mecanismo garante que todos os contributos sejam de origem humana.'],
 ['A participação substitui atendimento ou reclamação clínica?','Não. O website destina-se à auscultação e à melhoria dos cuidados; não é um serviço de urgência, aconselhamento médico ou canal oficial de reclamação. Em caso de necessidade clínica, utilize os serviços de saúde apropriados.'],
 ['O que acontece aos contributos?','A intenção é que apoiem o trabalho da Comissão e, quando existirem resultados validados, sejam comunicados de forma agregada. A participação não garante que uma proposta individual seja adotada ou implementada.']
 ].map(([q,a],i)=>`<div class="faq-item" ${i===4?'id="privacidade"':''}><details ${i===0?'open':''}><summary>${q}</summary><div class="faq-answer"><p>${a}</p></div></details></div>`).join('')}
<div class="callout-panel cta-panel"><div><h3>Ainda quer partilhar uma experiência?</h3><p>Descreva a dificuldade nas suas próprias palavras.</p></div>${btn('Participar','#/participe')}</div>
</div></section>`;}
function progress(n){return `<div class="form-progress" aria-label="Progresso da participação">${[['A sua experiência',1],['O seu contexto',2],['Revisão e privacidade',3]].map(([name,k])=>`<div class="progress-item ${k===n?'current':(k<n?'past':'')}" ${k===n?'aria-current="step"':''}><span class="bubble">${k<n?'✓':k}</span><span>${name}</span></div>`).join('')}</div>`;}
function formStage1(){return `<div class="eyebrow">PASSO 01 · ESCUTA ABERTA</div><h2>O que precisa de melhorar nos cuidados oncológicos?</h2><p class="form-subtitle">Partilhe livremente uma dificuldade que tenha sentido, acompanhado ou observado. Não há uma lista de temas nem respostas certas.</p>
<div class="form-group"><label class="field-label" for="difficulty">1. Que dificuldade ou problema gostaria de dar a conhecer? <span aria-hidden="true">*</span></label><textarea id="difficulty" name="difficulty" maxlength="12000" required placeholder="Conte-nos, pelas suas palavras, o que aconteceu ou o que considera que precisa de melhorar..."></textarea><p class="field-helper">Obrigatório para avançar. Não inclua nomes ou informações que identifiquem outras pessoas.</p><div id="difficulty-error" aria-live="polite"></div></div>
<div class="form-group"><label class="field-label" for="solution">2. Como considera que esta situação poderia ser melhorada? <span class="optional">Opcional</span></label><textarea id="solution" name="solution" maxlength="12000" placeholder="Se tiver uma sugestão ou ideia, partilhe-a aqui..."></textarea><p class="field-helper">Não precisa de apresentar uma solução para participar.</p></div>
<div class="form-group"><label class="field-label" for="extra">3. Há mais alguma coisa que queira acrescentar? <span class="optional">Opcional</span></label><textarea id="extra" name="extra" maxlength="12000" placeholder="Outro contexto ou informação que considere importante..."></textarea></div>
${privacyNote()}<div class="form-actions"><span class="footnote">* Campo obrigatório</span><button class="button button-yellow" type="button" data-action="next1">Continuar ${icon('arrow',17)}</button></div>`;}
function privacyNote(){return `<div class="privacy-reminder">${icon('shield',20)}<p>Este formulário é uma <strong>demonstração</strong>: nada é enviado, armazenado ou partilhado. Por segurança, utilize apenas exemplos fictícios ao testar.</p></div>`;}
function formStage2(){return `<div class="eyebrow">PASSO 02 · CONTEXTO</div><h2>Qual é a sua ligação à oncologia?</h2><p class="form-subtitle">Selecione um ou mais perfis. Esta informação ajuda a compreender a perspetiva de quem participa, sem exigir a sua identificação.</p>
<div class="profile-grid">${roles.map(([id,label])=>`<label class="profile-option ${form.roles.includes(id)?'selected':''}"><input type="checkbox" data-role="${id}" ${form.roles.includes(id)?'checked':''}/><span>${label}</span></label>`).join('')}</div><div id="role-error" aria-live="polite"></div>
<div id="adaptive-fields">${adaptiveFields()}</div>${privacyNote()}<div class="form-actions"><button type="button" class="button button-quiet" data-action="back1">${icon('chevron',17)} Voltar</button><button class="button button-yellow" type="button" data-action="next2">Continuar ${icon('arrow',17)}</button></div>`;}
function adaptiveFields(){if(!form.roles.length)return '';return `<div class="adaptive-box"><div class="adaptive-eyebrow">Para compreender melhor · opcional</div>${roles.filter(([id])=>form.roles.includes(id)).map(([id,label,prompt])=>`<div class="form-group"><label class="field-label" for="context-${id}">${prompt} <span class="optional">Opcional</span></label><textarea id="context-${id}" data-context="${id}" maxlength="6000" placeholder="Pode deixar este campo em branco.">${esc(form.roleContext[id]||'')}</textarea></div>`).join('')}</div>`;}
function formStage3(){const chosen=roles.filter(([id])=>form.roles.includes(id)).map(x=>x[1]).join(' · ');return `<div class="eyebrow">PASSO 03 · REVISÃO E PRIVACIDADE</div><h2>Reveja a sua participação.</h2><p class="form-subtitle">Confirme o que escreveu. Neste protótipo, o botão final apenas simula a submissão e gera uma cópia descarregável.</p>
<dl class="summary-card"><dt>Dificuldade identificada</dt><dd>${esc(form.difficulty)}</dd><dt>Sugestão de melhoria</dt><dd>${esc(form.solution||'Não indicada')}</dd><dt>Informação adicional</dt><dd>${esc(form.extra||'Não indicada')}</dd><dt>Perfil</dt><dd>${esc(chosen)}</dd>${Object.entries(form.roleContext).filter(([id,v])=>form.roles.includes(id)&&v.trim()).map(([id,v])=>`<dt>Contexto - ${esc(roles.find(x=>x[0]===id)?.[1])}</dt><dd>${esc(v)}</dd>`).join('')}</dl>
<div class="privacy-card"><strong>${icon('shield',18)} Privacidade e utilização da informação</strong><p><strong>Este é um protótipo sem envio:</strong> não existe recolha real nem integração com serviços externos. Num website publicado, os contributos destinam-se a apoiar a identificação de necessidades e propostas da Comissão. Os termos legais, medidas de segurança e dados de contacto da entidade responsável terão de ser confirmados antes da ativação do envio.</p></div>
<div class="form-group"><label class="field-label" for="email">Email <span class="optional">Opcional</span></label><input class="text-input" type="email" id="email" inputmode="email" autocomplete="email" placeholder="email@exemplo.pt" value="${esc(form.email)}" /><p class="field-helper">Neste protótipo, não será enviado qualquer email. Na versão final, poderá optar por receber uma cópia ou autorizar recontacto.</p></div>
<label class="checkbox-row"><input type="checkbox" id="contact" ${form.contact?'checked':''}/><span>Na versão publicada, gostaria de autorizar um eventual recontacto sobre o meu contributo. <span class="optional">Opcional</span></span></label>
<label class="checkbox-row"><input type="checkbox" id="emailCopy" ${form.emailCopy?'checked':''}/><span>Na versão publicada, gostaria de receber também uma cópia por email. <span class="optional">Opcional</span></span></label>
<label class="checkbox-row"><input type="checkbox" id="ack" ${form.ack?'checked':''}/><span><strong>Compreendo que estou a testar um protótipo, que os dados não serão enviados à Comissão e que a cópia será descarregada apenas no meu dispositivo.</strong></span></label>
<div id="confirm-error" aria-live="polite"></div><div class="form-actions"><button class="button button-quiet" type="button" data-action="back2">${icon('chevron',17)} Voltar</button><button class="button button-yellow" type="button" data-action="submitDemo">Simular submissão e obter cópia ${icon('download',17)}</button></div>`;}
function completed(){return `<div class="success-state"><div class="success-mark">✓</div><div class="eyebrow">DEMONSTRAÇÃO CONCLUÍDA</div><h2>O percurso de participação está completo.</h2><p>O formulário foi validado e foi preparada uma cópia local do conteúdo. <strong>Não foi enviada qualquer participação ao HPP, nem os seus dados foram guardados num servidor.</strong></p>
<div class="demo-disclaimer"><strong>Importante:</strong> este comprovativo é apenas de demonstração e não comprova receção pela Comissão de Oncologia. Na versão publicada, a confirmação incluirá uma referência real de submissão e uma cópia garantida.</div>
<div class="success-buttons"><button type="button" class="button button-yellow" data-action="download">${icon('download',18)} Descarregar novamente a cópia</button><button type="button" class="button button-outline" data-action="restart">Nova participação</button></div>
<p class="footnote" style="margin-top:22px">A cópia está em formato .txt e pode ser guardada ou impressa em PDF a partir do seu dispositivo.</p></div>`;}
function participate(){return `<section class="form-page"><div class="wrap"><div class="form-head"><div class="eyebrow">A SUA VOZ IMPORTA · EDIÇÃO 2026–2027</div><h1>Conte-nos o que pode melhorar.</h1><p>Partilhe as dificuldades que considera importantes, com as suas palavras. A proposta de solução e as perguntas adicionais são opcionais.</p></div><div class="form-shell">${form.stage<4?progress(form.stage):''}<div class="form-content">${form.stage===1?formStage1():form.stage===2?formStage2():form.stage===3?formStage3():completed()}</div></div><div style="max-width:940px;margin:18px auto 0;text-align:center" class="footnote">Esta plataforma não se destina ao envio de pedidos de assistência médica ou reclamações clínicas urgentes.</div></div></section>`;}
function saveVisibleStage(){if(form.stage===1){['difficulty','solution','extra'].forEach(k=>{let el=document.getElementById(k);if(el)form[k]=el.value});}if(form.stage===2){document.querySelectorAll('[data-context]').forEach(el=>form.roleContext[el.dataset.context]=el.value);}if(form.stage===3){form.email=document.getElementById('email')?.value.trim()||'';form.contact=Boolean(document.getElementById('contact')?.checked);form.emailCopy=Boolean(document.getElementById('emailCopy')?.checked);form.ack=Boolean(document.getElementById('ack')?.checked);}}
function showError(nodeId,msg){const el=document.getElementById(nodeId);if(el){el.innerHTML=msg?`<p class="field-error" role="alert">${esc(msg)}</p>`:'';if(msg)el.scrollIntoView({behavior:'smooth',block:'center'});}}
function switchStage(n){saveVisibleStage();form.stage=n;renderPage(false);document.querySelector('.form-shell')?.scrollIntoView({behavior:'smooth',block:'start'});}
function makeCopy(){const picked=roles.filter(r=>form.roles.includes(r[0])).map(r=>r[1]);return [`VOZES DA ONCOLOGIA - CÓPIA LOCAL DE DEMONSTRAÇÃO`,`HPP · COMISSÃO DE ONCOLOGIA · EDIÇÃO 2026–2027`,``, `ATENÇÃO: Esta cópia refere-se a um TESTE LOCAL, não a uma submissão recebida pela Comissão.`,``,`1. DIFICULDADE IDENTIFICADA`,form.difficulty,``,`2. PROPOSTA DE MELHORIA (OPCIONAL)`,form.solution||'Não indicada',``,`3. INFORMAÇÃO ADICIONAL`,form.extra||'Não indicada',``,`4. PERFIS`,...picked,``,`5. CONTEXTO ADICIONAL`,...roles.filter(r=>form.roles.includes(r[0])&&form.roleContext[r[0]]?.trim()).map(r=>`${r[1]}: ${form.roleContext[r[0]]}`),``,`6. RECONTACTO`, `Email (opcional): ${form.email||'Não indicado'}`,`Autoriza recontacto em eventual versão publicada: ${form.contact?'Sim':'Não'}`,`Deseja cópia por email em eventual versão publicada: ${form.emailCopy?'Sim':'Não'}`,``,`FIM DO COMPROVATIVO LOCAL.`].join('\r\n');}
function downloadCopy(){const txt='\uFEFF'+makeCopy();const blob=new Blob([txt],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='vozes-oncologia-copia-demonstracao.txt';document.body.appendChild(a);a.click();a.remove();window.setTimeout(()=>URL.revokeObjectURL(url),7000);}
function isValidEmail(s){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)}
function onFormClick(evt){const target=evt.target.closest('[data-action]');if(!target)return;saveVisibleStage();const action=target.dataset.action;
 if(action==='next1'){if(form.difficulty.trim().length<15){showError('difficulty-error','Descreva a dificuldade com pelo menos 15 caracteres, para que seja possível compreendê-la.');document.getElementById('difficulty')?.focus();return;}showError('difficulty-error','');switchStage(2);}
 else if(action==='next2'){if(!form.roles.length){showError('role-error','Selecione pelo menos um perfil para contextualizar a sua participação.');return;}switchStage(3);}
 else if(action==='back1')switchStage(1);
 else if(action==='back2')switchStage(2);
 else if(action==='submitDemo'){
   if((form.contact||form.emailCopy)&&!isValidEmail(form.email)){showError('confirm-error','Para assinalar recontacto ou cópia por email, introduza um endereço de email válido.');return;}
   if(form.email&&!isValidEmail(form.email)){showError('confirm-error','Confirme o formato do email ou deixe o campo em branco.');return;}
   if(!form.ack){showError('confirm-error','Confirme que compreende o caráter demonstrativo deste formulário.');return;}
   showError('confirm-error','');form.stage=4;renderPage(false);downloadCopy();document.querySelector('.form-shell')?.scrollIntoView({behavior:'smooth',block:'start'});
 }
 else if(action==='download')downloadCopy();
 else if(action==='restart'){Object.assign(form,{stage:1,difficulty:'',solution:'',extra:'',roles:[],roleContext:{},email:'',contact:false,emailCopy:false,ack:false,receipt:''});renderPage(false);document.querySelector('.form-shell')?.scrollIntoView({behavior:'smooth',block:'start'});}
}
function bindForm(){const shell=app.querySelector('.form-shell');if(!shell)return;shell.addEventListener('click',onFormClick);if(form.stage===1){['difficulty','solution','extra'].forEach(k=>{let el=document.getElementById(k);if(el){el.value=form[k];el.addEventListener('input',()=>{form[k]=el.value;if(k==='difficulty')showError('difficulty-error','');});}});}
 if(form.stage===2){document.querySelectorAll('[data-role]').forEach(input=>input.addEventListener('change',()=>{saveVisibleStage();form.roles=input.checked?[...form.roles,input.dataset.role]:form.roles.filter(x=>x!==input.dataset.role);document.querySelectorAll('[data-role]').forEach(el=>el.closest('.profile-option').classList.toggle('selected',el.checked));document.getElementById('adaptive-fields').innerHTML=adaptiveFields();showError('role-error','');}));}
 if(form.stage===3){['email','contact','emailCopy','ack'].forEach(k=>{const e=document.getElementById(k);if(e)e.addEventListener('change',saveVisibleStage);});}
}
function currentRoute(){const route=location.hash.match(/^#\/(inicio|participe|faq)/);return route?.[1]||'inicio';}
function renderPage(resetScroll=true){let route=currentRoute();const pages={inicio:home,participe:participate,faq};app.innerHTML=(pages[route]||home)();document.querySelectorAll('.main-nav a').forEach(a=>{const active=a.dataset.nav===route;a.classList.toggle('active',active);if(active)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});document.title=({'inicio':'Vozes da Oncologia','participe':'Participe','faq':'Perguntas frequentes'})[route]+' | Comissão de Oncologia - HPP';document.getElementById('main-nav')?.classList.remove('open');document.getElementById('menu-toggle')?.setAttribute('aria-expanded','false');if(route==='participe')bindForm();if(resetScroll){const anchor=location.hash.split('#')[2];if(anchor){requestAnimationFrame(()=>document.getElementById(anchor)?.scrollIntoView())}else window.scrollTo({top:0,behavior:'auto'});} }
document.getElementById('menu-toggle').addEventListener('click',function(){const nav=document.getElementById('main-nav');const open=nav.classList.toggle('open');this.setAttribute('aria-expanded',String(open));this.setAttribute('aria-label',open?'Fechar menu':'Abrir menu');});
window.addEventListener('hashchange',()=>{if(form.stage<4&&currentRoute()==='participe')saveVisibleStage();renderPage();});
if(!location.hash)location.replace('#/inicio');else renderPage();
