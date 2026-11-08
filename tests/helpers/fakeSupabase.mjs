// A small in-memory stand-in for the parts of supabase-js the front-end uses.
export function fakeSupabase({ domainStatus = () => 'free', payAfterMs = 150 } = {}) {
  const db = { profiles: [], sites: [], orders: [], payments: [], fulfilment_tasks: [], commission_daily: [] };
  const calls = { rpc: [], invoke: [], signOut: 0, oauth: 0 };
  let authCb = null, session = null, id = 0; const state = { admin: false };
  const uid = () => 'id-' + (++id);

  function builder(table) {
    let op = 'select', payload = null, filters = [], wantSingle = false, maybe = false, lim = null;
    const run = () => {
      let rows = db[table];
      if (op === 'insert') { const row = { id: uid(), status: 'draft', ...payload }; rows.push(row); return { data: row, error: null }; }
      const match = rows.filter((r) => filters.every(([k, v, kind]) => kind === 'gte' ? String(r[k]) >= String(v) : kind === 'in' ? v.includes(r[k]) : r[k] === v));
      if (op === 'update') { match.forEach((r) => Object.assign(r, payload)); return wantSingle ? { data: match[0] || null, error: match[0] ? null : { message: 'no row' } } : { data: match, error: null }; }
      let out = lim ? match.slice(0, lim) : match;
      if (wantSingle) return { data: out[0] || null, error: out[0] || maybe ? null : { message: 'no row' } };
      return { data: out, error: null };
    };
    const b = {
      select() { if (op !== 'select') { op = op; wantSingle = wantSingle; } return b; },
      insert(p) { op = 'insert'; payload = p; return b; },
      update(p) { op = 'update'; payload = p; return b; },
      eq(k, v) { filters.push([k, v, 'eq']); return b; },
      in(k, arr) { filters.push([k, arr, 'in']); return b; },
      gte(k, v) { filters.push([k, v, 'gte']); return b; },
      order() { return b; }, limit(n) { lim = n; return b; },
      single() { wantSingle = true; return Promise.resolve().then(run); },
      maybeSingle() { wantSingle = true; maybe = true; return Promise.resolve().then(run); },
      then(res, rej) { return Promise.resolve().then(run).then(res, rej); },
    };
    return b;
  }

  const rpcs = {
    complete_profile({ p_name, p_phone, p_consent }) {
      if (!p_consent) return { error: { message: 'consent required' } };
      const p = db.profiles.find((x) => x.id === session.user.id);
      Object.assign(p, { full_name: p_name.trim(), phone: p_phone }); return { data: p, error: null };
    },
    create_order({ p_site }) {
      const s = db.sites.find((x) => x.id === p_site); if (!s) return { error: { message: 'site not found' } };
      const dom = s.domain_mode === 'new' ? (s.domain.endsWith('.com') ? 15 : 8) : 0, conn = s.domain_mode === 'own' ? 10 : 0;
      db.orders.filter((o) => o.site_id === s.id && o.status === 'pending').forEach((o) => (o.status = 'cancelled'));
      const o = { id: uid(), owner: s.owner, site_id: s.id, domain: s.domain, domain_mode: s.domain_mode, setup_usd: 200, domain_usd: dom, connection_usd: conn, total_usd: 200 + dom + conn, status: 'pending' };
      db.orders.push(o); s.status = 'pending_payment'; return { data: o, error: null };
    },
    is_admin() { return { data: !!state.admin, error: null }; },
    admin_complete_task({ p_task, p_notes }) {
      const tk = db.fulfilment_tasks.find((x) => x.id === p_task); Object.assign(tk, { status: 'done', notes: p_notes });
      const left = db.fulfilment_tasks.filter((x) => x.site_id === tk.site_id && x.status === 'todo').length;
      db.sites.find((s) => s.id === tk.site_id).status = left === 0 ? 'live' : 'provisioning'; return { data: tk, error: null };
    },
    public_site({ p_domain }) {
      const s = db.sites.find((x) => x.domain === p_domain && x.status === 'live');
      const pick = ['name', 'template', 'background', 'header', 'announcement', 'icon_shape', 'icon_place', 'social', 'menu', 'bot_mode', 'embed_url', 'markup', 'deriv_app_id', 'referral_url', 'domain'];
      return { data: s ? Object.fromEntries(pick.map((k) => [k, s[k]])) : null, error: null };
    },
  };

  const client = {
    calls, db,
    auth: {
      getSession: async () => ({ data: { session } }),
      onAuthStateChange: (cb) => { authCb = cb; return { data: { subscription: { unsubscribe() {} } } }; },
      signInWithOAuth: async () => { calls.oauth++; return { error: null }; },
      signOut: async () => { calls.signOut++; session = null; return { error: null }; },
    },
    from: (t) => builder(t),
    rpc: async (name, args) => { calls.rpc.push([name, args]); return rpcs[name](args); },
    functions: {
      invoke: async (name, { body }) => {
        calls.invoke.push([name, body]);
        if (name === 'domain-check') return { data: { domain: body.domain, status: domainStatus(body.domain) }, error: null };
        if (name === 'checkout') {
          const o = db.orders.find((x) => x.id === body.order_id);
          if (!/^0?7\d{8}$/.test(body.phone.replace(/\s/g, ''))) return { data: null, error: { message: 'bad phone', context: { json: async () => ({ error: 'Enter a valid Safaricom number, for example 0712345678' }) } } };
          const pay = { id: uid(), order_id: o.id, status: 'initiated' }; db.payments.push(pay);
          setTimeout(() => { pay.status = 'succeeded'; o.status = 'paid'; db.sites.find((s) => s.id === o.site_id).status = 'paid';
            ['register_domain', 'connect_dns', 'issue_ssl', 'go_live'].forEach((t) => db.fulfilment_tasks.push({ site_id: o.site_id, task: t, status: 'todo' })); }, payAfterMs);
          return { data: { ok: true }, error: null };
        }
      },
    },
    // test controls
    setAdmin(v) { state.admin = v; },
    signInAs(user) {
      session = { user };
      if (!db.profiles.find((p) => p.id === user.id)) db.profiles.push({ id: user.id, email: user.email, full_name: null, phone: null });
      authCb && authCb('SIGNED_IN', session);
    },
  };
  return client;
}
