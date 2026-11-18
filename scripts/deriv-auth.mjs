import { randomBytes, createHash } from 'node:crypto';

const AUTH = 'https://auth.deriv.com/oauth2';
const API = 'https://api.derivws.com/trading/v1/options';
const opaque = () => randomBytes(32).toString('base64url');

// Local development uses memory; Vercel supplies encrypted durable credential storage.
export function createDerivAuth({ origin, clientId, redirectUri, upstream = fetch, now = Date.now, store }) {
  const transactions = new Map(), sessions = new Map();
  const read = async (kind,id) => {
    const map=kind==='transaction'?transactions:sessions;
    const value=store?await store.get(origin,kind,id):map.get(id);
    if(value && value.expires<=now()){await remove(kind,id);return undefined;}
    return value;
  };
  const put = async(kind,id,value)=>store?store.set(origin,kind,id,value):(kind==='transaction'?transactions:sessions).set(id,value);
  const remove = async(kind,id)=>store?store.delete(origin,kind,id):(kind==='transaction'?transactions:sessions).delete(id);
  const take = async(id)=>{
    if(store)return store.take(origin,'transaction',id);
    const value=transactions.get(id);transactions.delete(id);return value;
  };
  const secure = new URL(origin).protocol === 'https:';
  const cookie = (name, value, age) => `${name}=${value}; Path=/api/deriv; HttpOnly; SameSite=Lax; Max-Age=${age}${secure ? '; Secure' : ''}`;
  const cookies = req => Object.fromEntries((req.headers.cookie || '').split(';').map(v => v.trim().split('=')));
  const json = (res, code, data) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); };
  const redirect = (res, target, setCookie) => { res.writeHead(302, { Location: target, 'Cache-Control': 'no-store', ...(setCookie ? { 'Set-Cookie': setCookie } : {}) }); res.end(); };
  const safeReturn = value => {
    try { const url = new URL(value || '/', origin); return url.origin === origin && !url.pathname.startsWith('/api/') ? url.pathname + url.search + url.hash : '/'; } catch { return '/'; }
  };
  const loginResult = (target, result) => { const url=new URL(safeReturn(target),origin);url.searchParams.set('deriv_login',result);return url.pathname+url.search+url.hash; };
  return async function handle(req, res, url) {
    if (!url.pathname.startsWith('/api/deriv/')) return false;
    for (const [id, item] of transactions) if (item.expires <= now()) transactions.delete(id);
    for (const [id, item] of sessions) if (item.expires <= now()) sessions.delete(id);
    if (req.headers.host !== new URL(origin).host || (req.headers.origin && req.headers.origin !== origin)) { json(res, 403, { error: 'Origin not allowed' }); return true; }
    const sessionId = cookies(req).pf_deriv;
    try {
      const session = await read('session',sessionId);
      if (url.pathname === '/api/deriv/login' && req.method === 'GET') {
        if (!clientId || !redirectUri || new URL(redirectUri).origin !== origin || new URL(redirectUri).pathname !== '/api/deriv/callback') {
          res.writeHead(503, {'Content-Type':'text/html','Cache-Control':'no-store'});res.end('<h1>Account connection is not set up yet</h1><p>Please contact the site owner, or return to the trading app to view live prices.</p>'); return true;
        }
        if (transactions.size >= 1000) { json(res, 429, { error: 'Please try signing in later.' }); return true; }
        const id = opaque(), verifier = opaque(), state = opaque();
        await put('transaction',id, { verifier, state, returnTo: safeReturn(url.searchParams.get('return')), expires: now() + 600000 });
        const auth = new URL(`${AUTH}/auth`);
        auth.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'trade', state,
          code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256' }).toString();
        if (url.searchParams.get('signup') === '1') auth.searchParams.set('prompt', 'registration');
        redirect(res, auth.href, cookie('pf_deriv_pending', id, 600)); return true;
      }
      if (url.pathname === '/api/deriv/callback' && req.method === 'GET') {
        const id = cookies(req).pf_deriv_pending, tx = await take(id);
        if (!tx || tx.expires<=now() || url.searchParams.get('state') !== tx.state) { redirect(res, '/?deriv_login=failed', cookie('pf_deriv_pending','',0)); return true; }
        const clear = cookie('pf_deriv_pending', '', 0);
        if (url.searchParams.has('error') || !url.searchParams.get('code')) { redirect(res, loginResult(tx.returnTo,url.searchParams.get('error')==='access_denied'?'cancelled':'failed'), clear); return true; }
        const tokenResponse = await upstream(`${AUTH}/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ grant_type: 'authorization_code', client_id: clientId, redirect_uri: redirectUri, code: url.searchParams.get('code'), code_verifier: tx.verifier }), signal: AbortSignal.timeout(15000) });
        if (!tokenResponse.ok) { redirect(res, loginResult(tx.returnTo,'failed'), clear); return true; }
        const token = await tokenResponse.json();
        if (typeof token.access_token !== 'string' || !Number.isFinite(token.expires_in) || token.expires_in <= 0) throw new Error('Invalid token response');
        if (sessions.size >= 1000) throw new Error('Session capacity reached');
        await remove('session',sessionId);
        const idNew = opaque(); await put('session',idNew, { token: token.access_token, expires: now() + token.expires_in * 1000 });
        redirect(res, tx.returnTo, [clear, cookie('pf_deriv', idNew, token.expires_in)]); return true;
      }
      if (url.pathname === '/api/deriv/session' && req.method === 'GET') { json(res, 200, { authenticated: !!session, expires_at: session ? Math.floor(session.expires / 1000) : null }); return true; }
      if (url.pathname === '/api/deriv/logout' && req.method === 'POST') {
        if (req.headers.origin !== origin) { json(res, 403, { error: 'Origin required' }); return true; }
        await remove('session',sessionId); jsonWithCookie(res, cookie('pf_deriv', '', 0)); return true;
      }
      if (!session) { json(res, 401, { error: 'Connect your Deriv account first.' }); return true; }
      const otp = url.pathname.match(/^\/api\/deriv\/accounts\/([\w-]{1,64})\/otp$/);
      if (url.pathname !== '/api/deriv/accounts' && !otp) { json(res, 404, { error: 'Not found' }); return true; }
      if ((otp && req.method !== 'POST') || (!otp && req.method !== 'GET')) { json(res, 405, { error: 'Method not allowed' }); return true; }
      if (otp && req.headers.origin !== origin) { json(res, 403, { error: 'Origin required' }); return true; }
      const request = path => upstream(API + path, { headers: { Authorization: `Bearer ${session.token}`, 'Deriv-App-ID': clientId }, signal: AbortSignal.timeout(15000) });
      if (otp) {
        const accounts = await request('/accounts');
        if (!accounts.ok) { if (accounts.status === 401) await remove('session',sessionId); json(res, accounts.status, { error: 'Could not verify account access.' }); return true; }
        const list = await accounts.json();
        if (!Array.isArray(list.data) || !list.data.some(a => a.account_id === otp[1])) { json(res, 403, { error: 'Account unavailable.' }); return true; }
      }
      const response = otp ? await upstream(`${API}/accounts/${encodeURIComponent(otp[1])}/otp`, { method: 'POST', headers: { Authorization: `Bearer ${session.token}`, 'Deriv-App-ID': clientId }, signal: AbortSignal.timeout(15000) }) : await request('/accounts');
      if (!response.ok) { if (response.status === 401) await remove('session',sessionId); json(res, response.status, { error: 'Deriv is unavailable. Please try again.' }); return true; }
      const data = await response.json();
      if (otp) {
        const socket = new URL(data.data?.url);
        if (socket.protocol !== 'wss:' || socket.hostname !== 'api.derivws.com' || !['/trading/v1/options/ws/real','/trading/v1/options/ws/demo'].includes(socket.pathname)) throw new Error('Invalid socket response');
        json(res, 200, { data: { url: socket.href } });
      } else {
        json(res, 200, { data: (data.data || []).map(({account_id,account_type,balance,currency,group,status}) => ({account_id,account_type,balance:String(balance),currency,group,status})) });
      }
    } catch { if(url.pathname==='/api/deriv/callback')redirect(res,'/?deriv_login=failed',cookie('pf_deriv_pending','',0));else json(res, 502, { error: 'Could not connect to Deriv. Please try again.' }); }
    return true;
  };
}

function jsonWithCookie(res, value) { res.writeHead(200, { 'Set-Cookie': value, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end('{"ok":true}'); }
