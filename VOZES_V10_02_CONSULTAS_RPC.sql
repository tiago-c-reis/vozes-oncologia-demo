-- VOZES V10 — FUNCOES RPC (executar depois da Parte 1)
BEGIN;

-- Counts only; the RPC never returns raw narratives or contact details.
CREATE OR REPLACE FUNCTION public.vozes_admin_summary_v10()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $sql$
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM public.vozes_submissions),
    'last30', (SELECT count(*) FROM public.vozes_submissions
                WHERE received_at >= now() - interval '30 days'),
    'recontact', (SELECT count(*) FROM public.vozes_contacts),
    'roles', (SELECT coalesce(jsonb_agg(jsonb_build_object('name', primary_role, 'count', n)
                  ORDER BY n DESC), '[]'::jsonb)
               FROM (SELECT primary_role, count(*) AS n FROM public.vozes_submissions
                     GROUP BY primary_role) q),
    'regions', (SELECT coalesce(jsonb_agg(jsonb_build_object('name', region, 'count', n)
                  ORDER BY n DESC), '[]'::jsonb)
               FROM (SELECT coalesce(nullif(region,''),'Não indicada') AS region, count(*) AS n
                     FROM public.vozes_submissions GROUP BY 1) q),
    'ages', (SELECT coalesce(jsonb_agg(jsonb_build_object('name', age_group, 'count', n)
                  ORDER BY n DESC), '[]'::jsonb)
               FROM (SELECT coalesce(nullif(age_group,''),'Não indicada') AS age_group,
                     count(*) AS n FROM public.vozes_submissions GROUP BY 1) q)
  );
$sql$;

-- Bound pagination and enumerated filters prevent unbounded bulk retrieval.
CREATE OR REPLACE FUNCTION public.vozes_admin_list_v10(
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0,
  p_role text DEFAULT NULL,
  p_region text DEFAULT NULL,
  p_age text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $pl$
DECLARE
  v_items jsonb;
  v_total bigint;
  v_limit integer := least(greatest(coalesce(p_limit, 20), 1), 40);
  v_offset integer := least(greatest(coalesce(p_offset, 0), 0), 500000);
BEGIN
  IF p_role IS NOT NULL AND p_role NOT IN
    ('doente','sobrevivente','cuidador','associacao','profissional','apoio') THEN
    RAISE EXCEPTION 'invalid_role' USING ERRCODE = '22023';
  END IF;
  IF p_region IS NOT NULL AND p_region NOT IN
    ('Norte','Centro','Lisboa e Vale do Tejo','Alentejo','Algarve','Açores','Madeira',
     'Nacional / várias regiões','Fora de Portugal','') THEN
    RAISE EXCEPTION 'invalid_region' USING ERRCODE = '22023';
  END IF;
  IF p_age IS NOT NULL AND p_age NOT IN
    ('18-29 anos','30-44 anos','45-59 anos','60-74 anos','75 anos ou mais',
     'Prefiro não responder','') THEN
    RAISE EXCEPTION 'invalid_age' USING ERRCODE = '22023';
  END IF;

  SELECT count(*) INTO v_total FROM public.vozes_submissions s
    WHERE (p_role IS NULL OR s.primary_role = p_role)
      AND (p_region IS NULL OR s.region = p_region)
      AND (p_age IS NULL OR s.age_group = p_age);

  SELECT coalesce(jsonb_agg(to_jsonb(rowdata) ORDER BY rowdata.received_at DESC, rowdata.id DESC),
                  '[]'::jsonb)
  INTO v_items FROM (
    SELECT s.id, s.received_at, s.primary_role, s.region, s.age_group,
           left(s.difficulty, 160) AS preview
    FROM public.vozes_submissions s
    WHERE (p_role IS NULL OR s.primary_role = p_role)
      AND (p_region IS NULL OR s.region = p_region)
      AND (p_age IS NULL OR s.age_group = p_age)
    ORDER BY s.received_at DESC, s.id DESC
    LIMIT v_limit OFFSET v_offset
  ) rowdata;

  RETURN jsonb_build_object('total', v_total, 'items', v_items,
                            'limit', v_limit, 'offset', v_offset);
END;
$pl$;

-- Raw testimony only for an authorized, AAL2 administrative API. No email plaintext/ciphertext.
CREATE OR REPLACE FUNCTION public.vozes_admin_detail_v10(p_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $sql$
  SELECT jsonb_build_object(
    'id', s.id,
    'received_at', s.received_at,
    'roles', s.roles,
    'primary_role', s.primary_role,
    'age_group', s.age_group,
    'region', s.region,
    'role_context', s.role_context,
    'difficulty', s.difficulty,
    'solution', s.solution,
    'extra', s.extra,
    'answers', s.answers,
    'privacy_version', s.privacy_version,
    'has_contact', EXISTS (SELECT 1 FROM public.vozes_contacts c WHERE c.submission_id = s.id),
    'consent_types', (SELECT coalesce(jsonb_agg(c.consent_type ORDER BY c.consented_at),'[]'::jsonb)
                      FROM public.vozes_consent_events c WHERE c.submission_id = s.id)
  )
  FROM public.vozes_submissions s
  WHERE s.id = p_id;
$sql$;

REVOKE ALL ON FUNCTION public.vozes_admin_summary_v10() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vozes_admin_list_v10(integer,integer,text,text,text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.vozes_admin_detail_v10(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.vozes_admin_summary_v10() TO service_role;
GRANT EXECUTE ON FUNCTION public.vozes_admin_list_v10(integer,integer,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.vozes_admin_detail_v10(uuid) TO service_role;

COMMIT;

-- BOOTSTRAP AFTER CREATING YOUR SUPABASE AUTH USER (run separately, staging only):
-- INSERT INTO public.vozes_admin_users(user_id, role, active)
-- SELECT id, 'coordinator', true FROM auth.users WHERE email = 'EDITAR_EMAIL_AQUI'
-- ON CONFLICT (user_id) DO UPDATE SET role=EXCLUDED.role, active=true;
