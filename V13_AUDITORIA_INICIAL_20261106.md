# V13 — Auditoria inicial de segurança, privacidade e prontidão para produção

**Projeto:** Vozes da Oncologia — Comissão de Oncologia HPP  
**Data:** 2026-11-06  
**Alvo:** `main` (`9c23070a0f799323cf51a93985b9efca59b8245a`), website GitHub Pages V9 e painéis `admin-v10` / `admin-v12`  
**Método:** revisão estática dos ficheiros públicos; correlação com testes funcionais e de performance reportados pelo responsável. **Não** houve análise completa da Edge Function efetivamente publicada, acesso às configurações administrativas do Supabase, pentest ou avaliação jurídica institucional.  
**Decisão:** **NO-GO para recolha de dados reais**; **GO condicionado para Staging com dados exclusivamente fictícios**.

## Constatações positivas verificadas

1. `config.js`: o formulário público tem `mode:'demo'` e `privacyVersion:'PENDING_APPROVAL'`; o código impede submissão real sem configuração explícita de produção.
2. `script.js`: escapa dados antes da sua inserção em templates HTML com `esc()`; o formulário real exige confirmação de maioridade e consentimento explícito, Turnstile e HTTPS; o token do Turnstile é efémero na memória.
3. `admin-v12/admin.js`: a interface usa sessões em memória, comunica com a Edge Function `admin-v10`, disponibiliza o método `list_cursor`; constrói elementos do detalhe administrativo com `textContent`, reduzindo risco de injeção HTML.
4. `admin-v12/index.html`: define uma CSP por `meta` (com a limitação descrita abaixo).
5. `VOZES_V10_01_TABELAS_RLS.sql` e `VOZES_V10_02_CONSULTAS_RPC.sql`: os scripts versionados ativam RLS em tabelas administrativas, revogam permissões públicas e restringem RPCs administrativas ao `service_role`. **Não provam o estado atual da base de dados.**
6. Os ensaios anteriores reportados no Staging confirmaram MFA, autorização coordenador, 45 testemunhos fictícios (20+20+5), filtros, auditoria, limpeza e benchmarks SQL/HTTP. Não foram ensaios externos independentes nem testes com dados clínicos reais.

## Findings e medidas

### V13-01 — CRÍTICO para lançamento: governação RGPD não demonstrada
**Evidência:** `config.js` usa `privacyUrl:''` e `privacyVersion:'PENDING_APPROVAL'`. A documentação `CONFIGURACAO-V9.md` condiciona explicitamente a ativação à aprovação da política. Não foi apresentada política institucional final, documento AIPD, responsável pelo tratamento, base jurídica para as diferentes finalidades, registo de atividades, prazos de conservação ou procedimento de exercício de direitos.

**Risco:** recolha de testemunhos livres pode incluir dados de saúde e identificação de terceiros, mesmo sem pedir nome. Os dados não devem ser descritos como plenamente anónimos. A obtenção de consentimento não substitui as demais obrigações do RGPD.

**Remediação:** designar e documentar responsável pelo tratamento e encarregado relevante; preparar AIPD proporcional; política final (finalidades, legitimidade, destinatários, subcontratantes, transferências, retenção, contacto e direitos); procedimento testado para pedidos de acesso/retificação/apagamento/retirada do consentimento, incluindo backups e auditorias. Aprovação pela estrutura institucional competente antes de ativar submissões.

**Fontes:** CNPD, Avaliação de Impacto (<https://www.cnpd.pt/organizacoes/outras-obrigacoes/avaliacao-de-impacto/>); CNPD, Consentimento (<https://www.cnpd.pt/organizacoes/areas-tematicas/consentimento/>).

### V13-02 — ALTO: código-fonte do backend efetivamente publicado não versionado
**Evidência:** a árvore do GitHub na revisão contém HTML/JS/CSS e scripts V10 SQL, mas não `supabase/functions/admin-v10/index.ts`, `supabase/functions/submit-participation/index.ts`, nem migrações completas V9/V12 mencionadas na documentação. As funções podem existir e funcionar no Supabase; não foi possível verificar a paridade com a implementação publicada.

**Risco:** configurações e alterações manuais tornam difícil uma auditoria reprodutível, recuperação e rollback. Não equivale à descoberta de uma vulnerabilidade explorável.

**Remediação:** exportar o código efetivo das Edge Functions e migrar o esquema SQL para repositório privado (sem segredos), com versões, testes e pipeline de deploy controlado; documentar hash/versão implantada e configurações não secretas.

### V13-03 — ALTO: permissões `SECURITY DEFINER` e RLS por confirmar no ambiente
**Evidência:** RPCs V10 declaradas `SECURITY DEFINER` sob `public` e com `REVOKE/GRANT` esperados. O estado efetivo no Staging e na futura produção não pode ser inferido exclusivamente dos scripts.

**Risco:** se uma função privilegiada em esquema exposto herdar `EXECUTE` para `PUBLIC`, `anon` ou `authenticated`, poderá contornar RLS. O `service_role` contorna políticas de acesso e exige proteção de ponta a ponta.

**Remediação:** executar `V13_SQL_BASELINE_STAGING.sql` no Staging; rever todos os grants `EXECUTE`, `search_path`, proprietários, RLS, políticas e ACL; aplicar princípio do menor privilégio. Avaliar mover as funções privilegiadas de leitura para esquema não exposto com invocadores controlados. Não alterar permissões sem testes de regressão e plano de rollback.

**Fonte:** Supabase, Row Level Security (<https://supabase.com/docs/guides/database/postgres/row-level-security>).

### V13-04 — MÉDIO: proteção anti-clickjacking incompleta no GitHub Pages
**Evidência:** `admin-v10/index.html` e `admin-v12/index.html` incluem `frame-ancestors 'none'` numa CSP colocada em `<meta http-equiv='Content-Security-Policy'>`. Esta diretiva não é suportada por CSP em `meta`; tem de ser entregue como cabeçalho HTTP.

**Risco:** a diretiva declarada pode dar falsa sensação de proteção contra enquadramento em página de origem atacante. Não prova por si só exploração.

**Remediação:** usar alojamento/proxy sob controlo institucional capaz de enviar cabeçalho HTTP `Content-Security-Policy: frame-ancestors 'none'` e outras proteções adequadas; confirmar a resposta efetiva via header, não a meta tag. Não alterar DNS/produção durante o Staging.

**Fonte:** MDN (<https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors>).

### V13-05 — MÉDIO: segurança de publicação e minimização estatística
**Evidência:** `admin-v12/admin.js` permite exportar categorias individuais com `n >= 10`, mostra excertos dos relatos a utilizadores autorizados e não documenta revisão formal do risco de inferência por combinação de categorias.

**Risco:** `n >= 10` isoladamente não garante anonimização; cruzamento, filtros repetidos e dados raros podem reidentificar pessoas. O painel tem dados potencialmente sensíveis mesmo sem contactos em claro.

**Remediação:** política de divulgação de agregados (supressão complementar, limiares por contexto, revisão humana, critérios de publicação), papéis administrativos mínimos e monitorização de acessos. Evitar exportações de narrativas.

### V13-06 — MÉDIO: exercício de direitos, retenção e cópias de segurança
**Evidência:** documentação V10 reconhece ausência de interface de retificação/apagamento; o Staging preservou 59 entradas de auditoria, incluindo referência a testemunho eliminado. Foram testados backup local e restauro, mas não se demonstrou recuperação integral e eliminação compatível com uma política aprovada.

**Remediação:** especificar como localizar uma participação por recibo sem expor dados de terceiros; retirada de consentimento; eliminação nas tabelas principais e nas cópias segundo política de retenção; tratamento separado de logs/auditoria; cronograma de restauro e responsáveis.

### V13-07 — PENDENTE: configuração e provas operacionais
Verificar no Supabase o Security Advisor, Auth (inscrições públicas, MFA, rate limits, recuperação de contas), segredos, origens, Turnstile no servidor, versionamento de chaves, logs e retenção, backups geridos e localizações de tratamento/subprocessadores. Fazer testes negativos com `anon`/`authenticated` sem acesso a dados reais; testar carga de submissão numa infraestrutura isolada. A análise estática não pode certificar estes controlos.

## Critérios de passagem a produção (GO)

- [ ] Responsável pelo tratamento e documentação RGPD/AIPD aprovados institucionalmente.
- [ ] Política de privacidade e processos efetivos de direitos, retenção e incidentes.
- [ ] Edge Functions e migrações versionadas; correspondência entre código e runtime provada.
- [ ] `V13_SQL_BASELINE_STAGING.sql` executado e revisto, incluindo execução por `anon`/`authenticated`.
- [ ] Configuração Supabase Security Advisor sem alertas relevantes não justificados.
- [ ] MFA/allowlist/revogação, logs e API CORS/rate limits/Turnstile validados em testes negativos.
- [ ] Cabeçalhos HTTP efetivos no alojamento do painel, incluindo política anti-clickjacking.
- [ ] Teste de restauro integral e plano de resposta a incidente.
- [ ] Testes de submissão, concorrência e recuperação em ambiente representativo.
- [ ] Revisão institucional final e aprovação GO explícita.

**Nota:** esta revisão não é uma certificação independente nem um parecer jurídico. Nenhuma falha de confidencialidade foi demonstrada. A configuração pública permanece em `demo`.
