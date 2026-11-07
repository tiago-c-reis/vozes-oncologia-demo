// VOZES DA ONCOLOGIA — V13 FAIL-CLOSED TEST / STAGING ONLY
// ISOLATED FAULT-INJECTION FUNCTION: admin-v13-failclosed-test
// This function intentionally returns a simulated 503 for the rate-gate RPC.
// It must NEVER serve real traffic or replace admin-v13-limited.
// It still requires valid Auth + aal2 + an active authorized coordinator.
// NEVER change this fault injection to a bypass or deploy this file as admin-v13-limited.
const env = (name: string) =>
  (Deno.env.get(name) || '').trim();

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const baseHeaders = (origin: string) => ({
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store, private, max-age=0',
  'pragma': 'no-cache',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'content-security-policy': "default-src 'none'; frame-ancestors 'none'",
  'vary': 'Origin',
  ...(origin ? { 'access-control-allow-origin': origin } : {}),
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-expose-headers': 'retry-after',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-max-age': '300'
});

const json = (
  body: unknown,
  status: number,
  origin: string,
  additionalHeaders: Record<string, string> = {}
) => new Response(JSON.stringify(body), {
  status,
  headers: { ...baseHeaders(origin), ...additionalHeaders }
});

function pickKey(names: string[]): string {
  for (const name of names) {
    const value = env(name);
    if (!value) continue;

    if (name.endsWith('_KEYS')) {
      try {
        const keys = JSON.parse(value);
        if (typeof keys.default === 'string')
          return keys.default;
      } catch {
        continue;
      }
    } else {
      return value;
    }
  }
  return '';
}

const publicKey = () => pickKey([
  'SUPABASE_PUBLISHABLE_KEYS',
  'SUPABASE_PUBLISHABLE_KEY',
  'SUPABASE_ANON_KEY'
]);

const secretKey = () => pickKey([
  'SUPABASE_SECRET_KEYS',
  'SUPABASE_SECRET_KEY',
  'SUPABASE_SERVICE_ROLE_KEY'
]);

function adminRestHeaders(key: string): HeadersInit {
  const h: Record<string, string> = {
    apikey: key,
    accept: 'application/json'
  };

  if (key.split('.').length === 3)
    h.authorization = `Bearer ${key}`;

  return h;
}

function claimsFromValidatedJwt(token: string) {
  try {
    const s = token.split('.')[1];
    const base = s.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(
      atob(base.padEnd(Math.ceil(base.length / 4) * 4, '='))
    );
  } catch {
    return null;
  }
}

async function fetchChecked(
  url: string,
  init: RequestInit,
  ms = 8500
): Promise<Response> {
  // Test-only fault injection. No DB writes or calls to the rate-gate RPC.
  // Simulates an unavailable upstream after real Auth and administrative allowlist checks.
  if (url.endsWith('/rest/v1/rpc/vozes_admin_rate_gate_v13')) {
    return new Response(JSON.stringify({ error: 'simulated_rate_gate_down' }), {
      status: 503,
      headers: { 'content-type': 'application/json' }
    });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal
    });
  } finally {
    clearTimeout(timer);
  }
}

async function handleRequest(request: Request): Promise<Response> {
  const origin = request.headers.get('origin') || '';

  const origins = env('ADMIN_ALLOWED_ORIGINS')
    .split(',')
    .map(x => x.trim())
    .filter(Boolean);

  if (!origin || !origins.includes(origin))
    return json({ error: 'origin_denied' }, 403, '');

  if (request.method === 'OPTIONS')
    return new Response(null, {
      status: 204,
      headers: baseHeaders(origin)
    });

  if (request.method !== 'POST')
    return json({ error: 'method_not_allowed' }, 405, origin);

  const url = env('SUPABASE_URL').replace(/\/$/, '');
  const anon = publicKey();
  const secret = secretKey();

  if (
    env('ADMIN_PANEL_ENABLED') !== 'true' ||
    !url || !anon || !secret
  ) {
    return json({ error: 'unavailable' }, 503, origin);
  }

  const bearer = request.headers.get('authorization') || '';

  if (!/^Bearer\s+[^\s]+$/i.test(bearer))
    return json({ error: 'authentication_required' }, 401, origin);

  const jwt = bearer.replace(/^Bearer\s+/i, '');

  try {
    // Verificar token no Supabase Auth.
    const check = await fetchChecked(`${url}/auth/v1/user`, {
      headers: {
        apikey: anon,
        authorization: `Bearer ${jwt}`,
        accept: 'application/json'
      }
    });

    if (!check.ok)
      return json({ error: 'authentication_required' }, 401, origin);

    const user = await check.json();

    if (!UUID.test(user?.id || ''))
      return json({ error: 'authentication_required' }, 401, origin);

    const claims = claimsFromValidatedJwt(jwt);

    if (
      !claims ||
      claims.sub !== user.id ||
      claims.aal !== 'aal2' ||
      claims.role !== 'authenticated' ||
      typeof claims.exp !== 'number' ||
      claims.exp <= Date.now() / 1000
    ) {
      return json({ error: 'mfa_required' }, 403, origin);
    }

    // Lista privada de utilizadores autorizados.
    const membershipUrl =
      `${url}/rest/v1/vozes_admin_users?select=role` +
      `&user_id=eq.${encodeURIComponent(user.id)}` +
      `&active=eq.true&limit=1`;

    const memberRes = await fetchChecked(membershipUrl, {
      headers: adminRestHeaders(secret)
    });

    if (!memberRes.ok)
      return json({ error: 'unavailable' }, 503, origin);

    const membership = await memberRes.json();

    if (
      !Array.isArray(membership) ||
      !['viewer', 'coordinator'].includes(membership[0]?.role)
    ) {
      return json({ error: 'access_denied' }, 403, origin);
    }

    if (!/application\/json/i.test(
      request.headers.get('content-type') || ''
    )) {
      return json({ error: 'unsupported_media_type' }, 415, origin);
    }

    const raw = await request.text();

    if (new TextEncoder().encode(raw).length > 4096)
      return json({ error: 'invalid_request' }, 413, origin);

    let body: any;

    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: 'invalid_request' }, 400, origin);
    }

    if (!body || typeof body !== 'object' || Array.isArray(body))
      return json({ error: 'invalid_request' }, 400, origin);

    const action = body.action;

    if (!['summary', 'list', 'list_cursor', 'detail'].includes(action))
      return json({ error: 'invalid_action' }, 400, origin);

    // V13: RBAC enforced before privileged RPCs and before reading narratives.
    // A viewer can only request aggregate summary, never lists, previews or detail.
    if (membership[0].role === 'viewer' && action !== 'summary') {
      return json({ error: 'insufficient_permissions' }, 403, origin);
    }

    // V13 limited: quota global entre instancias por user_id.
    // Falha da RPC = fail closed, sem consulta administrativa.
    // OPTIONS e pedidos sem autorizacao sao bloqueados antes da contagem.
    const limiter = await fetchChecked(
      `${url}/rest/v1/rpc/vozes_admin_rate_gate_v13`,
      {
        method: 'POST',
        headers: {
          ...adminRestHeaders(secret),
          'content-type': 'application/json'
        },
        body: JSON.stringify({ p_user_id: user.id })
      },
      5000
    );

    if (!limiter.ok)
      return json({ error: 'rate_limit_unavailable' }, 503, origin);

    const decisions = await limiter.json().catch(() => null);
    const gate = Array.isArray(decisions) && decisions.length === 1
      ? decisions[0]
      : null;

    if (
      !gate || typeof gate.allowed !== 'boolean' ||
      !Number.isInteger(gate.retry_after_seconds) ||
      !Number.isInteger(gate.remaining)
    ) {
      return json({ error: 'rate_limit_unavailable' }, 503, origin);
    }

    if (!gate.allowed) {
      const retrySeconds = Math.max(1, Math.min(60, gate.retry_after_seconds));
      return json(
        { error: 'rate_limited', retry_after_seconds: retrySeconds },
        429,
        origin,
        { 'retry-after': String(retrySeconds) }
      );
    }

    let args: Record<string, unknown> = {};
    let target: string | null = null;
    let fn: string;

    if (action === 'summary') {
      fn = 'vozes_admin_summary_v10';
    }

    else if (action === 'list') {
      // Compatibilidade integral com paginação V10.
      fn = 'vozes_admin_list_v10';

      const lim = body.limit === undefined ? 20 : body.limit;
      const offset = body.offset === undefined ? 0 : body.offset;

      if (
        !Number.isInteger(lim) || lim < 1 || lim > 40 ||
        !Number.isInteger(offset) || offset < 0 || offset > 500000
      ) {
        return json({ error: 'invalid_filters' }, 400, origin);
      }

      for (const k of ['role', 'region', 'age']) {
        if (
          body[k] !== undefined &&
          body[k] !== null &&
          (typeof body[k] !== 'string' || body[k].length > 80)
        ) {
          return json({ error: 'invalid_filters' }, 400, origin);
        }
      }

      args = {
        p_limit: lim,
        p_offset: offset,
        p_role: body.role || null,
        p_region: body.region || null,
        p_age: body.age || null
      };
    }

    else if (action === 'list_cursor') {
      // Nova paginação V12, sem OFFSET.
      fn = 'vozes_admin_list_cursor_v12';

      const lim = body.limit === undefined ? 20 : body.limit;

      if (
        !Number.isInteger(lim) ||
        lim < 1 || lim > 40 ||
        body.offset !== undefined
      ) {
        return json({ error: 'invalid_filters' }, 400, origin);
      }

      for (const k of ['role', 'region', 'age']) {
        if (
          body[k] !== undefined &&
          body[k] !== null &&
          (typeof body[k] !== 'string' || body[k].length > 80)
        ) {
          return json({ error: 'invalid_filters' }, 400, origin);
        }
      }

      const cursor = body.cursor ?? null;

      if (cursor !== null) {
        if (
          typeof cursor !== 'object' ||
          Array.isArray(cursor) ||
          Object.keys(cursor).sort().join(',') !== 'id,received_at' ||
          !UUID.test(cursor.id || '') ||
          typeof cursor.received_at !== 'string' ||
          cursor.received_at.length > 50 ||
          !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(cursor.received_at) ||
          !Number.isFinite(Date.parse(cursor.received_at))
        ) {
          return json({ error: 'invalid_cursor' }, 400, origin);
        }
      }

      args = {
        p_limit: lim,
        p_cursor_received_at: cursor?.received_at ?? null,
        p_cursor_id: cursor?.id ?? null,
        p_role: body.role || null,
        p_region: body.region || null,
        p_age: body.age || null
      };
    }

    else {
      fn = 'vozes_admin_detail_v10';

      if (!UUID.test(body.id || ''))
        return json({ error: 'invalid_id' }, 400, origin);

      target = body.id;
      args = { p_id: target };
    }

    // Conservar auditoria compatível com tabela V10.
    // list_cursor é registada como list.
    const auditAction =
      action === 'list_cursor' ? 'list' : action;

    const h = adminRestHeaders(secret);

    const audit = await fetchChecked(
      `${url}/rest/v1/vozes_admin_audit`,
      {
        method: 'POST',
        headers: {
          ...h,
          'content-type': 'application/json',
          prefer: 'return=minimal'
        },
        body: JSON.stringify({
          actor_user_id: user.id,
          action: auditAction,
          target_submission_id: target
        })
      }
    );

    if (!audit.ok)
      return json({ error: 'audit_unavailable' }, 503, origin);

    const result = await fetchChecked(
      `${url}/rest/v1/rpc/${fn}`,
      {
        method: 'POST',
        headers: {
          ...h,
          'content-type': 'application/json'
        },
        body: JSON.stringify(args)
      },
      12000
    );

    if (!result.ok)
      return json({ error: 'query_unavailable' }, 503, origin);

    const data = await result.json();

    if (action === 'detail' && !data)
      return json({ error: 'not_found' }, 404, origin);

    return json({
      data,
      role: membership[0].role
    }, 200, origin);

  } catch {
    // Nao registar JWTs, emails ou testemunhos.
    return json({ error: 'unavailable' }, 503, origin);
  }
}

Deno.serve(handleRequest);