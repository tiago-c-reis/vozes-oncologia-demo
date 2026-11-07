-- V13 - RATE LIMIT ADMINISTRATIVO: 60 pedidos/minuto/administrador
-- INSTALAR APENAS EM VOZES-ONCOLOGIA-STAGING APOS REVISAO.
-- APLICAR ANTES DO DEPLOY DE admin-v13-limited.
-- Nao altera, elimina ou substitui objetos V10 / V12 / V13 existentes.
BEGIN;
SET LOCAL statement_timeout = '20s';
SET LOCAL lock_timeout = '5s';

CREATE SCHEMA IF NOT EXISTS vozes_private;

-- Um estado por conta, sem crescimento por minuto.
CREATE TABLE vozes_private.vozes_admin_rate_state_v13 (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  window_bucket bigint NOT NULL,
  requests integer NOT NULL CHECK (requests BETWEEN 1 AND 61),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

ALTER TABLE vozes_private.vozes_admin_rate_state_v13 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE vozes_private.vozes_admin_rate_state_v13
  FROM PUBLIC, anon, authenticated, service_role;

-- O invocador e o service_role. Evita SECURITY DEFINER em schema exposto.
-- A tabela permanece em schema privado, nunca diretamente acessivel aos clientes.
GRANT USAGE ON SCHEMA vozes_private TO service_role;
GRANT SELECT, INSERT, UPDATE
  ON vozes_private.vozes_admin_rate_state_v13 TO service_role;

CREATE FUNCTION public.vozes_admin_rate_gate_v13(p_user_id uuid)
RETURNS TABLE (
  allowed boolean,
  retry_after_seconds integer,
  remaining integer
)
LANGUAGE plpgsql
VOLATILE
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_bucket bigint := floor(extract(epoch FROM clock_timestamp()) / 60)::bigint;
  v_hits integer;
BEGIN
  -- Defense in depth: apenas utilizadores administrativos ativos.
  IF p_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.vozes_admin_users a
    WHERE a.user_id = p_user_id
      AND a.active = true
      AND a.role IN ('viewer', 'coordinator')
  ) THEN
    RAISE EXCEPTION 'inactive_admin'
      USING ERRCODE = '42501';
  END IF;

  -- UPSERT atomico: serializa alteracoes concorrentes ao mesmo user_id.
  INSERT INTO vozes_private.vozes_admin_rate_state_v13 AS st
    (user_id, window_bucket, requests, updated_at)
  VALUES
    (p_user_id, v_bucket, 1, clock_timestamp())
  ON CONFLICT (user_id) DO UPDATE
    SET window_bucket = EXCLUDED.window_bucket,
        requests = CASE
          WHEN st.window_bucket = EXCLUDED.window_bucket
            THEN LEAST(st.requests + 1, 61)
          ELSE 1
        END,
        updated_at = EXCLUDED.updated_at
  RETURNING st.requests INTO v_hits;

  -- Janela fixa UTC (epoca Unix / minuto). O 61. pedido e negado.
  RETURN QUERY SELECT
    (v_hits <= 60),
    CASE WHEN v_hits > 60
      THEN GREATEST(
        1,
        LEAST(
          60,
          ceil(((v_bucket + 1) * 60)::numeric -
               extract(epoch FROM clock_timestamp()))::integer
        )
      )
      ELSE 0
    END,
    GREATEST(0, 60 - v_hits);
END;
$$;

-- Revogar execute herdado de PUBLIC (global default PostgreSQL).
REVOKE ALL ON FUNCTION public.vozes_admin_rate_gate_v13(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vozes_admin_rate_gate_v13(uuid)
  TO service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;

-- Pos-implantacao, confirmar apenas metadados:
-- SELECT has_function_privilege('anon',
--   'public.vozes_admin_rate_gate_v13(uuid)', 'EXECUTE') AS anon_execute,
--   has_function_privilege('authenticated',
--   'public.vozes_admin_rate_gate_v13(uuid)', 'EXECUTE') AS authenticated_execute,
--   has_function_privilege('service_role',
--   'public.vozes_admin_rate_gate_v13(uuid)', 'EXECUTE') AS service_execute;
