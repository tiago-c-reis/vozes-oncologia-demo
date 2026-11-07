-- V13 LIMITED - TESTE TRANSACIONAL DO CONTADOR
-- APENAS STAGING / executar DEPOIS da migracao.
-- Este script faz INSERT/UPDATE apenas numa transacao ROLLBACK.
-- Nao altera testemunhos, contactos, configuracoes ou permissões.
BEGIN;
SET LOCAL statement_timeout='20s';
SET LOCAL lock_timeout='5s';

DO $$
DECLARE
  v_actor uuid;
  v_allowed boolean;
  v_retry integer;
  v_remaining integer;
  v_bucket bigint;
  v_i integer;
BEGIN
  IF (SELECT count(*) FROM public.vozes_admin_users
      WHERE role='coordinator' AND active=true) <> 1 THEN
    RAISE EXCEPTION 'Esperado exatamente 1 coordinator ativo no Staging';
  END IF;

  SELECT user_id INTO v_actor
  FROM public.vozes_admin_users
  WHERE role='coordinator' AND active=true;

  -- Evitar executar perto da mudanca de minuto.
  IF mod(floor(extract(epoch FROM clock_timestamp()))::bigint,60)>45 THEN
    RAISE EXCEPTION 'Muito perto do fim do minuto. Repetir daqui a pouco.';
  END IF;

  v_bucket := floor(extract(epoch FROM clock_timestamp())/60)::bigint;
  DELETE FROM vozes_private.vozes_admin_rate_state_v13
  WHERE user_id=v_actor;

  FOR v_i IN 1..61 LOOP
    SELECT g.allowed,g.retry_after_seconds,g.remaining
      INTO v_allowed,v_retry,v_remaining
    FROM public.vozes_admin_rate_gate_v13(v_actor) AS g;

    IF v_i <= 60 AND (
      v_allowed IS DISTINCT FROM true
      OR v_remaining <> 60-v_i
      OR v_retry <> 0
    ) THEN
      RAISE EXCEPTION 'Falha na consulta %: % / % / %',
        v_i,v_allowed,v_retry,v_remaining;
    END IF;

    IF v_i=61 AND (
      v_allowed IS DISTINCT FROM false
      OR v_remaining <> 0
      OR v_retry NOT BETWEEN 1 AND 60
    ) THEN
      RAISE EXCEPTION '61a consulta deveria ser bloqueada';
    END IF;
  END LOOP;

  IF floor(extract(epoch FROM clock_timestamp())/60)::bigint <> v_bucket THEN
    RAISE EXCEPTION 'Teste atravessou limite de minuto: repetir';
  END IF;

  RAISE NOTICE 'PASS: 60 pedidos permitidos, 61o bloqueado';
END;
$$;

SELECT
  has_function_privilege(
    'anon','public.vozes_admin_rate_gate_v13(uuid)','EXECUTE'
  ) AS anon_execute,
  has_function_privilege(
    'authenticated','public.vozes_admin_rate_gate_v13(uuid)','EXECUTE'
  ) AS authenticated_execute,
  has_function_privilege(
    'service_role','public.vozes_admin_rate_gate_v13(uuid)','EXECUTE'
  ) AS service_execute,
  'PASS APENAS SE 2 FALSE E 1 TRUE E DO SEM ERROS' AS verificacao;

ROLLBACK; -- elimina todos os efeitos do teste do contador
