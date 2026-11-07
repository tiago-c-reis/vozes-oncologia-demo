# V13 — RBAC administrativo (STAGING): deploy controlado e testes

## Estado
- NAO implantado no Supabase: a branch cria NOVA Edge Function chamada admin-v13; nao substitui admin-v10.
- NAO publicado no GitHub Pages: admin-v13/ so fica disponivel quando a branch for integrada na main.
- Nao usar dados pessoais ou clinicos reais; apenas Staging e dados sinteticos.
- Formulario publico mantem modo demo.

## Matriz RBAC imposta no servidor

| Perfil | summary | list | list_cursor | detail |
|---|---|---|---|---|
| viewer | 200 | 403 | 403 | 403 |
| coordinator | 200 | 200 | 200 | 200 |
| fora da allowlist | 403 | 403 | 403 | 403 |
| sem JWT | 401 (*) | 401 (*) | 401 (*) | 401 (*) |
| JWT sem MFA aal2 | 403 | 403 | 403 | 403 |

(*) O gateway Supabase com verify_jwt ON pode rejeitar o pedido antes de executar o handler, com corpo diferente.

A interface admin-v13/ oculta a listagem quando a resposta da API identifica viewer. Nao e o unico controlo: o backend devolve 403 em todas as operacoes narrativas para viewer.

## Testes locais
Node >=22: executar "node --test tests/admin-v13-rbac.test.mjs" na raiz.
Os testes usam respostas FICTICIAS: nao acedem a Supabase e nao certificam o comportamento publicado.

## Ordem segura de implementacao
1. Rever os ficheiros neste PR e executar os testes locais. Nao alterar a main ou o Supabase.
2. Depois de aprovados, instalar NOVA Edge Function admin-v13 no projeto vozes-oncologia-staging, usando o codigo em supabase/functions/admin-v13/index.ts. Nunca substituir admin-v10.
3. Manter Verify JWT ON para chamadas com JWT de utilizador, e confirmar o formato de assinatura do projeto. O handler valida ainda o token na API de Auth, a claim aal2 e a allowlist administrativa.
4. Verificar (sem expor valores) os segredos e configuracoes: ADMIN_PANEL_ENABLED=true, ADMIN_ALLOWED_ORIGINS=https://tiago-c-reis.github.io, e chaves de servidor fornecidas pelo Supabase. Nao guardar segredos no GitHub.
5. Com conta coordinator existente e MFA: summary, list_cursor e detail devem dar 200 e gerar auditoria.
6. Criar uma conta de TESTE independente viewer no Staging, apenas via Authentication/Users (registos publicos permanecem desativados); inscrever TOTP; atribuir a role viewer em vozes_admin_users. Nao mudar a conta coordinator existente.
7. Com conta viewer autenticada e MFA, confirmar: summary=200; list=403; list_cursor=403; detail=403, com erro insufficient_permissions. Confirmar tambem que o frontend mostra somente estatisticas.
8. Testar sem token (401), com token aal1 (403), utilizador fora da allowlist (403) e origem nao autorizada (403). Nao divulgar tokens.
9. Confirmar auditoria, ausencia de narrativas no CSV, sem alteracoes na V10/V12; registar os resultados num relatorio GO/NO-GO.
10. So apos essa validacao publicar a interface admin-v13 em GitHub Pages, mediante autorizacao.

## Limitacoes em aberto
- Agregados por categoria, incluindo contagens pequenas, NAO garantem anonimato: precisam de regras de minimizacao e supressao antes da recolha real.
- A opcao viewer=summary only evita tambem excertos e identificadores. Isto e mais restritivo do que impedir apenas a vista integral.
- Pedidos recusados antes da auditoria ainda nao geram entradas na tabela V10. Melhorar observabilidade posteriormente.
- Rate limiting por utilizador, revisao RGPD, gestao de direitos e pentest sao etapas distintas.
- Codigo backend foi derivado do ficheiro fornecido pelo responsavel em 2026-11-07, nao de exportacao direta da funcao implantada; confirmar paridade antes de deploy.
