-- VOZES DA ONCOLOGIA V10 — ADMIN READ-ONLY / STAGING FIRST
-- Execute exclusively in vozes-oncologia-staging for validation.
-- Requires the V9 four-table schema. No existing V9 access grants are changed.

BEGIN;

CREATE TABLE IF NOT EXISTS public.vozes_admin_users (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('viewer', 'coordinator')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vozes_admin_audit (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_user_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('summary', 'list', 'detail')),
  target_submission_id uuid NULL,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vozes_admin_audit_actor_time_idx
  ON public.vozes_admin_audit (actor_user_id, occurred_at DESC);

ALTER TABLE public.vozes_admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vozes_admin_audit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.vozes_admin_users, public.vozes_admin_audit FROM PUBLIC, anon, authenticated;
REVOKE ALL ON SEQUENCE public.vozes_admin_audit_id_seq FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.vozes_admin_users TO service_role;
GRANT INSERT ON public.vozes_admin_audit TO service_role;
GRANT USAGE ON SEQUENCE public.vozes_admin_audit_id_seq TO service_role;
COMMIT;
