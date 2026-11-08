// POST { domain } -> { domain, status: 'free' | 'taken' | 'unknown' }
// Requires a signed-in user. Best-effort availability only: the registrar is authoritative at purchase time.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { corsHeaders, json } from '../_shared/cors.ts';
import { normalizeDomain } from '../_shared/domain.ts';
import { checkDomain } from '../_shared/rdap.ts';

const hits = new Map<string, number[]>();           // per-instance, best-effort rate limit
function limited(uid: string): boolean {
  const now = Date.now();
  const a = (hits.get(uid) ?? []).filter((t) => now - t < 60_000);
  a.push(now); hits.set(uid, a);
  return a.length > 30;
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req, Deno.env.get('ALLOWED_ORIGIN'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405, cors);

  const url = Deno.env.get('SUPABASE_URL')!;
  const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
  const { data: { user: me } } = await user.auth.getUser();
  if (!me) return json({ error: 'sign in required' }, 401, cors);
  if (limited(me.id)) return json({ error: 'too many checks, slow down' }, 429, cors);

  let body: { domain?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'invalid json' }, 400, cors); }
  const domain = normalizeDomain(body?.domain);
  if (!domain) return json({ error: 'invalid domain' }, 400, cors);

  // Already claimed by another Pipforge client (even if unpaid)?
  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: claim } = await admin.from('sites').select('owner')
    .ilike('domain', domain).in('status', ['pending_payment', 'paid', 'provisioning', 'live']).neq('owner', me.id).limit(1);
  if (claim?.length) return json({ domain, status: 'taken' }, 200, cors);

  return json({ domain, status: await checkDomain(domain) }, 200, cors);
});
