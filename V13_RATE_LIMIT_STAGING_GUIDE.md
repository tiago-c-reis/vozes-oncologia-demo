# V13 — Rate limiting administrativo atómico (60 pedidos/minuto)
**Estado: CÓDIGO EM PR; NÃO INSTALADO NO SUPABASE.**
Este PR é dependente do PR #3 (RBAC V13). Não publicar nem fundir antes de verificar os controlos.

## Âmbito e arquitetura
- Endpoint NOVO: `admin-v13-limited`. Mantém `admin-v10` e `admin-v13` intocados.
- Depois de verificar JWT pelo Supabase Auth, `aal2`, allowlist de administradores, formato da ação e RBAC, pede autorização ao RPC `vozes_admin_rate_gate_v13`.
- Contador no PostgreSQL: `vozes_private.vozes_admin_rate_state_v13`, **um registo por user_id**.
- Janela fixa por minuto UTC, 60 pedidos por conta. 61.º pedido recebe **HTTP 429** com `Retry-After`; o excedente não executa RPCs com narrativas nem cria novas entradas de auditoria `vozes_admin_audit`.
- Um `INSERT ... ON CONFLICT DO UPDATE` no mesmo registo torna a contagem atómica entre instâncias Edge Function. Limita a 61 o campo `requests`, evitando overflow.
- Erro da RPC/JSON inválido: HTTP **503**, sem consultar dados (fail closed). Não é um fail-open silencioso.
- Função PostgreSQL usa **SECURITY INVOKER**, não SECURITY DEFINER, em esquema `public`; só `service_role` tem `EXECUTE`. Tabela e privilégios privados no esquema `vozes_private`, com RLS ativado.
- É um limite de **janela fixa**: duas janelas adjacentes podem permitir uma rajada superior a 60 num intervalo móvel de 60 segundos. Não alegar proteção de rolling-window.
- Não substitui Auth rate limits, proteções contra tráfego não autenticado, monitorização do gateway ou controlos de custos.

## Ordem de implementação (apenas quando autorizada)
1. Confirmar projeto selecionado: `vozes-oncologia-staging`.
2. Rever o ficheiro `supabase/migrations/20261107_1300_admin_rate_limit_v13.sql` e executar uma única vez no SQL Editor Staging. É uma **migração de escrita**, não deve ser aplicada à produção.
3. Executar `supabase/tests/v13_rate_gate_transactional.sql`, que valida 60+1 operações sob transação terminada por `ROLLBACK`; registar o resultado e confirmar grants. Repetir se atravessar o minuto UTC.
4. Só depois implantar a **nova** Edge Function `admin-v13-limited` com código `supabase/functions/admin-v13-limited/index.ts`; manter `Verify JWT with legacy secret = ON` como na V13, após confirmar compatibilidade real.
5. Confirmar variáveis de ambiente existentes (sem revelar os valores): `ADMIN_PANEL_ENABLED`, `ADMIN_ALLOWED_ORIGINS`, URL Supabase, chave pública e chave server secret.
6. Executar 2–3 pedidos autenticados `summary` com coordenador + MFA, confirmar HTTP 200, sem falhas no gate; confirmar que o acesso `viewer` se mantém negado no backend (sem recriar viewer se não há necessidade operacional).
7. Para testar HTTP 429 sem 61 pedidos ao servidor: preparar contador de um utilizador de TESTE numa transação separada em Staging, com instrução própria; confirmar retorno 429 e `Retry-After`; esperar mudança de minuto e confirmar retorno 200.
8. Verificar contadores, RLS, auditoria e monitorização; testar falha de função de quota com resposta 503, sem acesso a dados. Validar erros negativos sem revelar tokens ou dados pessoais.
9. Manter `admin-v13-limited` sem tráfego público até todos os critérios passarem. A interface administrativa atual não deve apontar para este endpoint antes da aceitação final.

## Testes automáticos (simulados)
`node --test tests/admin-v13-limited.test.mjs`
Testam 60/61, 429, `Retry-After`, falha do rate gate => 503, permissões RBAC, MFA e casos negativos. **Os mocks não comprovam concorrência real de PostgreSQL**, motivo pelo qual também existe o script SQL transacional e é necessária a inspeção da migração.

## Pendências e salvaguardas
- A função atual `admin-v13` e o painel `admin-v12` permanecem sem este limitador. A proteção só existe em `admin-v13-limited` após deploy.
- Quota apenas para ações administrativas válidas/autorizadas; recusas de origem, JWT, MFA ou RBAC não consomem quota.
- Pedidos rate-limited retornam 429 antes do INSERT na tabela de auditoria administrativa V10. Os HTTP 429 são visíveis nos logs/metadados da Edge Function. Auditoria de recusas e alertas precisam de política própria.
- Dados pessoais no estado do limiter: apenas UUID administrativo e hora de atualização; a linha é eliminada com `auth.users` por FK `ON DELETE CASCADE`.
- Limitar pedidos não substitui a política RGPD, classificação de risco, retenção, nem revisão institucional.
