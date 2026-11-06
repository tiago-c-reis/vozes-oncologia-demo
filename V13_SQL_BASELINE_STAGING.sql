-- VOZES DA ONCOLOGIA - V13
-- INVENTARIO SEGURANCA STAGING - SOMENTE LEITURA
-- Executar no Supabase STAGING, nunca utilizar para alterar dados.
-- Resultados nao incluem narrativas, emails ou tokens.

-- 1. TABELAS: RLS e grants efetivos
SELECT
  n.nspname AS esquema,
  c.relname AS tabela,
  c.relrowsecurity AS rls_ativo,
  c.relforcerowsecurity AS rls_forcado,
  has_table_privilege('anon',c.oid,'SELECT') AS anon_select,
  has_table_privilege('anon',c.oid,'INSERT') AS anon_insert,
  has_table_privilege('anon',c.oid,'UPDATE') AS anon_update,
  has_table_privilege('anon',c.oid,'DELETE') AS anon_delete,
  has_table_privilege('authenticated',c.oid,'SELECT') AS autenticado_select,
  has_table_privilege('authenticated',c.oid,'INSERT') AS autenticado_insert,
  has_table_privilege('authenticated',c.oid,'UPDATE') AS autenticado_update,
  has_table_privilege('authenticated',c.oid,'DELETE') AS autenticado_delete
FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE c.relkind IN ('r','p')
  AND c.relname LIKE 'vozes_%'
ORDER BY n.nspname,c.relname;

-- 2. FUNCOES: proprietario, DEFINER, search_path e EXECUTE por papel
SELECT
  n.nspname AS esquema,
  p.proname AS funcao,
  pg_get_function_identity_arguments(p.oid) AS argumentos,
  pg_get_userbyid(p.proowner) AS proprietario,
  p.prosecdef AS security_definer,
  p.proconfig AS configuracao,
  has_function_privilege('anon',p.oid,'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') AS authenticated_execute,
  has_function_privilege('service_role',p.oid,'EXECUTE') AS service_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE (p.proname LIKE 'vozes_%'
       OR p.proname = 'accept_participation_v9'
       OR (n.nspname='vozes_private' AND p.proname LIKE '%v12%'))
ORDER BY n.nspname,p.proname;

-- 3. POLITICAS RLS (METADADOS)
SELECT schemaname,tablename,policyname,permissive,roles,cmd
FROM pg_policies
WHERE tablename LIKE 'vozes_%'
ORDER BY schemaname,tablename,policyname;

-- 4. DEPENDENCIAS FK EM TABELAS VOZES
SELECT n.nspname AS esquema,
       c.relname AS tabela,
       k.conname AS restricao,
       pg_get_constraintdef(k.oid) AS definicao
FROM pg_constraint k
JOIN pg_class c ON c.oid=k.conrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE k.contype='f'
  AND (c.relname LIKE 'vozes_%'
       OR k.confrelid='public.vozes_submissions'::regclass)
ORDER BY n.nspname,c.relname,k.conname;

-- 5. RESUMO SEM DADOS PESSOAIS
SELECT
  count(*) AS participacoes,
  (SELECT count(*) FROM public.vozes_admin_users WHERE active=true) AS administradores_ativos,
  (SELECT count(*) FROM public.vozes_admin_audit) AS auditorias,
  current_setting('server_version') AS versao_postgres
FROM public.vozes_submissions;
