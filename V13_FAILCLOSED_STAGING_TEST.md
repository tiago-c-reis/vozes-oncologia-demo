# V13 — Passo 8K: teste isolado de falha do limitador

**Não está publicado. Requer validação antes de implantar.**

## Finalidade

Validar que um utilizador `coordinator` autenticado com TOTP/AAL2 recebe **HTTP 503**, com código `rate_limit_unavailable`, quando a consulta ao contador `vozes_admin_rate_gate_v13` falha, sem executar consultas administrativas nem gravar uma entrada de auditoria V10.

A função separada `admin-v13-failclosed-test` usa a mesma lógica que `admin-v13-limited`, mas intercepta **apenas** a chamada ao RPC de rate limiting e devolve uma resposta sintética de falha. Continua a usar **Auth e allowlist reais** para cada pedido.

**Não substitui a função `admin-v13-limited`. Não altera SQL, permissões, tabelas, limites nem dados clínicos. Não fazer deploy em produção.**

## Procedimento

1. Confirmar projeto: `vozes-oncologia-staging`.
2. Abrir `supabase/functions/admin-v13-failclosed-test/index.ts` nesta branch e rever que a intercepção incide apenas no URL do gate.
3. Supabase → Edge Functions → Deploy a new function → Via Editor. Nome **exato**: `admin-v13-failclosed-test`. Colar o ficheiro integral. Não editar nem fazer deploy sobre `admin-v13-limited`.
4. Em Settings confirmar `Verify JWT with legacy secret` ON. Confirmar que a função utiliza as variáveis de ambiente existentes, sem publicar chaves.
5. Via PowerShell, obter token normal de utilizador `coordinator` com MFA/TOTP e chamar **apenas** a nova função com body `{"action":"summary"}` e header `Origin: https://tiago-c-reis.github.io`.
6. Resultado esperado: HTTP **503**, corpo `{"error":"rate_limit_unavailable"}`. Não deve retornar `data` nem `role`, nem qualquer testemunho.
7. Controlar o número de auditorias antes e depois (se não houver outros administradores a consultar): a função de teste não deveria acrescentar entradas por este pedido. Nota: pedidos anteriores e concorrentes podem afetar a contagem.
8. Realizar uma chamada separada a `admin-v13-limited` com a conta `coordinator` para confirmar que continua a responder 200 (após janela disponível).
9. Após aprovação, **eliminar a função de teste** do Staging, pois é uma instalação de fault injection e não é necessária em operação.

## Testes simulados sem rede

`node --test tests/admin-v13-failclosed.test.mjs`

São testes mockados de isolamento: não provam operacionalidade do serviço, mas cobrem que a falha é tratada com 503, sem invocar auditoria nem RPC de dados. Os testes HTTP reais confirmam essa propriedade na instância instalada.

## Limitações

- Este teste simula **HTTP 503 no gate**, não o shutdown ou a indisponibilidade física da base de dados.
- Não demonstra timeout/transporte abortado, concorrência durante falha nem políticas de divulgação estatística.
- **Não fundir a branch como feature de produção**: os ficheiros são artefactos de teste.
- O estado de produção permanece NO-GO enquanto faltarem os controlos de privacidade/RGPD e revisão institucional.
