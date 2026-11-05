# Vozes da Oncologia — V10 · Painel administrativo privado

**Estado desta entrega:** frontend de Staging pré-configurado com URL e chave pública fornecidos. A API `admin-v10`, SQL e conta coordenadora foram configurados no Staging de acordo com as verificações partilhadas; o acesso com MFA ainda requer validação no browser. **Não usar para dados reais de saúde.** Não inserir dados reais de saúde nesta etapa. A V9 pública permanece em `mode: 'demo'` e `SUBMISSIONS_ENABLED=false`.

## O que inclui

- `admin-v10/`: website estático privado (interface, CSS, autenticação por email + palavra-passe + TOTP); sem persistência local dos tokens. Nesta entrega, `publishableKey` pública e `enabled:true` já estão definidos para Staging.
- `supabase/functions/admin-v10/index.ts`: API privada que **verifica no servidor** o JWT com Supabase Auth, exige `aal2`, confirma a existência e estado do utilizador na lista de administradores, e audita cada consulta antes de aceder aos dados.
- `supabase/migrations/20261105_000002_v10_admin.sql`: tabela de administradores, auditoria e três funções SQL para agregados, lista limitada e detalhe. As funções só podem ser executadas com `service_role`.
- Os dados de contactos **não podem ser descifrados pelo painel**. A exportação contém apenas contagens por grupos com **n >= 10**; não inclui narrativas, identificadores de participações ou emails. Uma revisão de risco de reidentificação continua a ser necessária para qualquer partilha de estatísticas.

## Sequência recomendada — configurar apenas Staging

### 1. Executar SQL da V10

No projeto `vozes-oncologia-staging`, ir a **SQL Editor → New query** e executar, por esta ordem, os ficheiros completos:

1. `VOZES_V10_01_TABELAS_RLS.sql` — cria duas tabelas e ativa RLS. Se o editor perguntar por RLS, escolher **Run without RLS**, pois o ficheiro já contém `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` explícitos.
2. `VOZES_V10_02_CONSULTAS_RPC.sql` — cria e restringe as três funções de consulta.

Confirmar `Success` após cada uma. O ficheiro `supabase/migrations/20261105_000002_v10_admin.sql` contém a versão completa para gestão de migrações por CLI; **não executar ambos os caminhos**.

O script NÃO altera os dados existentes nem as quatro tabelas V9. Evitar executar o script de novo quando houver alterações não reconciliadas.

### 2. Criar a primeira conta de administrador, sem partilhar credenciais

No **Supabase Staging → Authentication → Users → Add user**, cria uma conta controlada por ti, com email e palavra-passe fortes e email confirmado. Desativar inscrições públicas (*Signups*) se estiverem habilitadas no projeto (ninguém deve conseguir criar contas administrativas por iniciativa própria). Em seguida, no SQL Editor executa (substituir **localmente** o email; nunca o enviar aqui):

```sql
INSERT INTO public.vozes_admin_users (user_id, role, active)
SELECT id, 'coordinator', true
FROM auth.users
WHERE lower(email) = lower('EMAIL_ADMIN_AQUI')
ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role, active = true;

SELECT user_id, role, active FROM public.vozes_admin_users;
```

Se a consulta não devolver um registo, verifica o email. Para mais utilizadores, atribuir `viewer` ou `coordinator` por decisão expressa. Evitar contas partilhadas.

### 3. Instalar a Edge Function no Staging

Em **Edge Functions → Deploy a new function → Via Editor**, nome **`admin-v10`**. Substituir todo o código por `supabase/functions/admin-v10/index.ts`. Publicar. Em **Settings** definir **Verify JWT with legacy secret = OFF**, porque a função faz verificação do JWT diretamente pelo serviço Supabase Auth, com requisitos `aal2` e allowlist. A opção OFF NÃO elimina a autenticação interna obrigatória.

### 4. Secrets do Staging

Em **Edge Functions → Secrets**, definir:

| Name | Value |
|---|---|
| `ADMIN_PANEL_ENABLED` | `true` (só Staging, após configurar acesso) |
| `ADMIN_ALLOWED_ORIGINS` | `https://tiago-c-reis.github.io` |

`SUPABASE_URL`, `SUPABASE_SECRET_KEYS` e `SUPABASE_PUBLISHABLE_KEYS` devem ser disponibilizados pelo Supabase. Verificar presença na área de *Default secrets*. **Nunca** copiar `sb_secret_*` ou `service_role` para ficheiros públicos, nem partilhar esses valores no chat. Se as variáveis de chave automática não estiverem presentes, confirmar nas definições do projeto (não criar uma chave extra pública).

### 5. Configurar o frontend V10

Em `admin-v10/config.js`, esta entrega já define os seguintes valores públicos (não alterar para a produção):

- `enabled: true` somente para testar o login e MFA em Staging;
- `supabaseUrl`: já aponta para o projeto de Staging;
- `publishableKey`: a **Publishable key** pública do projeto Staging, obtida em **Project Settings → API Keys** (não usar a secret key);
- `adminFunction: 'admin-v10'`.

Publicar o ZIP atualizado no GitHub Pages. O endereço da área administrativa será:

`https://tiago-c-reis.github.io/vozes-oncologia-demo/admin-v10/`

Não existe ligação pública a esta área no menu do website. Ainda assim, **o URL não é uma medida de segurança**: todos os dados dependem da autenticação e autorização aplicadas no servidor.

### 6. Validar antes de usar dados sensíveis

1. Sem iniciar sessão: não deve aparecer dashboard nem ser possível consultar a API (HTTP 401).
2. Iniciar sessão com conta de administrador autorizada: deve exigir configurar e validar o TOTP antes de revelar dados.
3. Após MFA, sem entrada na allowlist: API deve devolver HTTP 403.
4. Após MFA e entrada na allowlist: resumo e lista devem funcionar.
5. Conta com role `viewer`: verificar que não há funções de escrita; funções SQL para listagem/detalhe não gravam participações.
6. Verificar que as consultas geram registos em `public.vozes_admin_audit`.
7. Validar recuperação/descifragem de um email fictício efetivamente persistido **num teste separado**, não pelo dashboard.
8. Rever permissões, RLS, acesso indevido, backups, retenção, AIPD e contratos de tratamento antes de qualquer promoção a produção.

Consulta SQL para verificar **sem mostrar narrativas**:

```sql
SELECT action, count(*) AS acessos
FROM public.vozes_admin_audit GROUP BY action ORDER BY action;
```

## Segurança e limitações

- MFA é obrigatório (`aal2` verificado no backend). A interface usa APIs REST oficiais Supabase Auth. Tokens de sessão ficam apenas em memória; atualizar a página requer nova autenticação.
- As respostas de saúde são apresentadas sem HTML dinâmico (inseridas via `textContent`). O browser não tem credenciais administrativas do servidor.
- Operações suportadas: `summary`, `list` (40 linhas por pedido no máximo), `detail`. Não há pesquisa de texto integral nem exportação bruta.
- O painel mostra contactos apenas como **sim/não**; não recupera emails. Não há ainda interface de eliminação/retificação, registo de atividade por participante, ou API de gestão de direitos.
- Os resultados agregados por grupos pequenos podem permitir inferências. A exportação CSV filtra contagens abaixo de 10, mas **não substitui** revisão humana contra reidentificação e dedução por diferenças.
- A proteção contra acesso não autorizado foi implementada em código, mas depende de testes reais no Supabase e auditoria de segurança antes de receber informação clínica.
- Recomendado alojar a futura versão de produção do painel num domínio separado e aplicar controlos adicionais de acesso e monitorização.
- Não reativar `SUBMISSIONS_ENABLED` nos projetos V9 para testar a V10; a V10 é **apenas leitura**.

## Guia rápido — ZIP pré-configurado (5 novembro 2026)

1. Substituir os ficheiros do repositório GitHub Pages pelo conteúdo da pasta `vozes-oncologia-demo-main`. Não enviar apenas a pasta `admin-v10`, para preservar a versão integral.
2. Confirmar que o website público continua no modo `demo` (`config.js` da raiz).
3. Abrir `https://tiago-c-reis.github.io/vozes-oncologia-demo/admin-v10/` após o deploy.
4. Iniciar sessão com a conta criada em **Staging > Authentication > Users**; configurar TOTP na primeira autenticação e concluir o código de seis dígitos. Nunca divulgar a senha, QR nem segredo TOTP.
5. Confirmar indicadores vazios (ambiente de testes sem participações) e auditar o acesso com a consulta `SELECT action, count(*) FROM public.vozes_admin_audit GROUP BY action ORDER BY action;`.
6. Se ocorrer erro, não ativar `SUBMISSIONS_ENABLED`: verificar `ADMIN_PANEL_ENABLED`, `ADMIN_ALLOWED_ORIGINS` e os Logs da função `admin-v10` em Staging.

**Nota de segurança:** disponibilizar o código estático em GitHub Pages não torna o painel privado por si só. O acesso aos dados é restringido pelo servidor com MFA e allowlist. Não usar esta página para dados clínicos reais antes de validações adicionais e revisão independente.
