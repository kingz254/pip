import { randomBytes, createHash } from 'node:crypto';

const AUTH = 'https://auth.deriv.com/oauth2';
const API = 'https://api.derivws.com/trading/v1/options';
const opaque = () => randomBytes(32).toString('base64url');

// Local development uses memory; Vercel supplies encrypted durable credential storage.
export function createDerivAuth({ origin, clientId, redirectUri, upstream = fetch, now = Date.now, store, premiumBots, premiumAdmin }) {
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
      if(url.pathname==='/api/deriv/premium-bots') {
        if(req.method!=='GET'){json(res,405,{error:'Method not allowed'});return true;}
        const accountId=url.searchParams.get('account_id'),botId=url.searchParams.get('bot_id');
        if(!/^[A-Za-z0-9_-]{3,64}$/.test(accountId||'')||(botId&&!/^premium-[0-9]{2}$/.test(botId))){json(res,400,{error:'Choose a valid account and bot'});return true;}
        if(!premiumBots){json(res,503,{error:'Premium library is not configured'});return true;}
        const response=await upstream(API+'/accounts',{headers:{Authorization:'Bearer '+session.token,'Deriv-App-ID':clientId},signal:AbortSignal.timeout(15000)});
        if(!response.ok){json(res,401,{error:'Reconnect your Deriv account'});return true;}
        const accounts=await response.json();
        if(!Array.isArray(accounts.data)||!accounts.data.some(a=>a.account_id===accountId&&a.status==='active')){json(res,403,{error:'Account unavailable'});return true;}
        const data=await premiumBots({domain:new URL(origin).hostname.replace(/^www\./,''),accountId,botId});
        if(!data){json(res,403,{error:'This site and account do not have access to this premium bot'});return true;}
        json(res,200,botId?{xml:data}:{data});return true;
      }
      if (url.pathname.startsWith('/api/deriv/premium-admin')) {
        if (!premiumAdmin) { json(res, 503, { error: 'Premium workspace is not configured.' }); return true; }
        const domain = new URL(origin).hostname.replace(/^www\./, '');
        const verifyOwner = async () => {
          const dateTo = new Date(now()).toISOString().slice(0, 10);
          const dateFrom = new Date(now() - 30 * 86400000).toISOString().slice(0, 10);
          const response = await upstream('https://api.derivws.com/applications/v1/markup-statistics?' + new URLSearchParams({ date_from: dateFrom, date_to: dateTo }), {
            headers: { Authorization: `Bearer ${session.token}`, 'Deriv-App-ID': clientId }, signal: AbortSignal.timeout(15000)
          });
          if (!response.ok) return false;
          const result = await response.json();
          return !!result.data?.breakdown?.some(row => String(row.app_id) === String(clientId));
        };
        if (!(await verifyOwner())) { json(res, 403, { error: 'Connect the Deriv account that owns this site’s application.' }); return true; }
        const accountIsActive = async accountId => {
          const response = await upstream(API + '/accounts', { headers: { Authorization: `Bearer ${session.token}`, 'Deriv-App-ID': clientId }, signal: AbortSignal.timeout(15000) });
          if (!response.ok) return false;
          const accounts = await response.json();
          return Array.isArray(accounts.data) && accounts.data.some(account => account.account_id === accountId && account.status === 'active');
        };
        if (url.pathname.endsWith('/copy-leader')) {
          if (req.method !== 'POST' || req.headers.origin !== origin) { json(res, req.method === 'POST' ? 403 : 405, { error: 'Owner action could not be verified.' }); return true; }
          const body = await readJsonBody(req, 4096);
          if (!body || !/^[A-Za-z0-9_-]{3,64}$/.test(body.account_id || '') || typeof body.enabled !== 'boolean') { json(res, 400, { error: 'Choose an active Deriv account and leader action.' }); return true; }
          if (body.enabled && !(await accountIsActive(body.account_id))) { json(res, 403, { error: 'The leader account is not available on this Deriv session.' }); return true; }
          const saved = await premiumAdmin.setLeader(domain, body.account_id, body.enabled);
          if (!saved) { json(res, 403, { error: 'This site does not have Premium access.' }); return true; }
          json(res, 200, { ok: true }); return true;
        }
        if (url.pathname.endsWith('/copy-signals')) {
          if (req.method !== 'POST' || req.headers.origin !== origin) { json(res, req.method === 'POST' ? 403 : 405, { error: 'Leader event could not be verified.' }); return true; }
          const body = await readJsonBody(req, 4096), parameters = body?.parameters;
          const contractTypes = new Set(['CALL','PUT','HIGHER','LOWER','DIGITMATCH','DIGITDIFF','DIGITOVER','DIGITUNDER','DIGITEVEN','DIGITODD']);
          const safeBarrier = value => value === undefined || (typeof value === 'string' && /^[-+]?[0-9]{1,16}(?:\.[0-9]{1,8})?$/.test(value));
          const durationUnits = new Set(['s', 'm', 'h', 'd']);
          if (!body || !/^[A-Za-z0-9_-]{3,64}$/.test(body.account_id || '') || !Number.isSafeInteger(body.source_contract_id) || !parameters ||
            !contractTypes.has(parameters.contract_type) || !/^[A-Z]{3,8}$/.test(parameters.currency || '') || !/^[A-Za-z0-9_]{2,40}$/.test(parameters.underlying_symbol || '') ||
            !Number.isInteger(parameters.duration) || parameters.duration < 1 || !durationUnits.has(parameters.duration_unit) ||
            parameters.duration * ({ s: 1, m: 60, h: 3600, d: 86400 })[parameters.duration_unit] > 86400 || !safeBarrier(parameters.barrier) || !safeBarrier(parameters.barrier2)) {
            json(res, 400, { error: 'Only supported fixed-time Deriv contracts can be shared.' }); return true;
          }
          if (!(await accountIsActive(body.account_id))) { json(res, 403, { error: 'The leader account is not available on this Deriv session.' }); return true; }
          const saved = await premiumAdmin.publishSignal(domain, body.account_id, body.source_contract_id, parameters);
          if (!saved) { json(res, 403, { error: 'This account is not the active leader for the Premium site.' }); return true; }
          json(res, 200, { ok: true }); return true;
        }
        if (url.pathname.endsWith('/grants')) {
          if (req.method !== 'POST') { json(res, 405, { error: 'Method not allowed.' }); return true; }
          if (req.headers.origin !== origin) { json(res, 403, { error: 'Origin required.' }); return true; }
          const body = await readJsonBody(req, 4096);
          if (!body || !/^premium-[0-9]{2}$/.test(body.bot_id || '') || !/^[A-Za-z0-9_-]{3,64}$/.test(body.account_id || '') || typeof body.enabled !== 'boolean') {
            json(res, 400, { error: 'Choose a valid bot, Deriv account ID, and grant action.' }); return true;
          }
          const updated = await premiumAdmin.setBotAccess(domain, { botId: body.bot_id, accountId: body.account_id, enabled: body.enabled });
          if (!updated) { json(res, 403, { error: 'This site does not have Premium access.' }); return true; }
          json(res, 200, { ok: true }); return true;
        }
        if (req.method !== 'GET') { json(res, 405, { error: 'Method not allowed.' }); return true; }
        const dateFrom = url.searchParams.get('date_from') || new Date(now() - 6 * 86400000).toISOString().slice(0, 10);
        const dateTo = url.searchParams.get('date_to') || new Date(now()).toISOString().slice(0, 10);
        if (![dateFrom, dateTo].every(value => /^\d{4}-\d{2}-\d{2}$/.test(value)) || dateFrom > dateTo) {
          json(res, 400, { error: 'Choose a valid date range.' }); return true;
        }
        const [workspace, markupResponse] = await Promise.all([
          premiumAdmin.snapshot(domain),
          upstream('https://api.derivws.com/applications/v1/markup-statistics?' + new URLSearchParams({ date_from: dateFrom, date_to: dateTo }), {
            headers: { Authorization: `Bearer ${session.token}`, 'Deriv-App-ID': clientId }, signal: AbortSignal.timeout(15000)
          }),
        ]);
        if (!workspace) { json(res, 403, { error: 'This site does not have Premium access.' }); return true; }
        const markupResult = markupResponse.ok ? await markupResponse.json() : null;
        const markup = markupResult?.data?.breakdown?.find(row => String(row.app_id) === String(clientId));
        json(res, 200, { ...workspace, markup: markup || null, markup_available: !!markup }); return true;
      }
      if (url.pathname.startsWith('/api/deriv/premium-copy')) {
        if (!premiumAdmin) { json(res, 503, { error: 'Copy trading is not configured.' }); return true; }
        const body = req.method === 'POST' ? await readJsonBody(req, 4096) : null;
        const accountId = body?.account_id || url.searchParams.get('account_id');
        if (!/^[A-Za-z0-9_-]{3,64}$/.test(accountId || '')) { json(res, 400, { error: 'Choose a valid Deriv account.' }); return true; }
        const accountsResponse = await upstream(API + '/accounts', { headers: { Authorization: `Bearer ${session.token}`, 'Deriv-App-ID': clientId }, signal: AbortSignal.timeout(15000) });
        if (!accountsResponse.ok) { json(res, 401, { error: 'Reconnect your Deriv account.' }); return true; }
        const accountsResult = await accountsResponse.json();
        if (!Array.isArray(accountsResult.data) || !accountsResult.data.some(account => account.account_id === accountId && account.status === 'active')) { json(res, 403, { error: 'That Deriv account is not available in this session.' }); return true; }
        const domain = new URL(origin).hostname.replace(/^www\./, '');
        if (url.pathname.endsWith('/events')) {
          if (req.method !== 'GET') { json(res, 405, { error: 'Method not allowed.' }); return true; }
          const data = await premiumAdmin.signals(domain, accountId);
          json(res, 200, { data }); return true;
        }
        if (url.pathname.endsWith('/claim')) {
          if (req.method !== 'POST' || req.headers.origin !== origin || !Number.isSafeInteger(body?.signal_id)) { json(res, 400, { error: 'Choose a valid copy signal.' }); return true; }
          const claimed = await premiumAdmin.claimSignal(domain, accountId, body.signal_id);
          json(res, 200, { claimed }); return true;
        }
        if (url.pathname !== '/api/deriv/premium-copy') { json(res, 404, { error: 'Not found.' }); return true; }
        if (req.method === 'GET') {
          const data = await premiumAdmin.follower(domain, accountId);
          if (!data) { json(res, 403, { error: 'This site does not have Premium access.' }); return true; }
          json(res, 200, { config: data.config, leader_connected: !!data.leader }); return true;
        }
        if (req.method !== 'POST' || req.headers.origin !== origin) { json(res, 403, { error: 'Origin required.' }); return true; }
        if (!body || typeof body.enabled !== 'boolean' || (body.enabled && (body.consent !== true || !Number.isFinite(body.stake_cap) || body.stake_cap <= 0 || body.stake_cap > 1000 || !Number.isFinite(body.daily_loss_cap) || body.daily_loss_cap <= 0 || body.daily_loss_cap > 10000))) {
          json(res, 400, { error: 'Confirm copy trading and choose valid stake and daily-loss limits.' }); return true;
        }
        const data = await premiumAdmin.setFollower(domain, { accountId, enabled: body.enabled, stakeCap: body.stake_cap, dailyLossCap: body.daily_loss_cap });
        if (!data) { json(res, 403, { error: 'A Premium site leader is not available.' }); return true; }
        json(res, 200, { ok: true }); return true;
      }
      if (url.pathname === '/api/deriv/markup' && req.method === 'GET') {
        const dateFrom = url.searchParams.get('date_from'), dateTo = url.searchParams.get('date_to');
        if (![dateFrom, dateTo].every(value => /^\d{4}-\d{2}-\d{2}$/.test(value || '')) || dateFrom > dateTo) {
          json(res, 400, { error: 'Choose a valid date range.' }); return true;
        }
        const response = await upstream('https://api.derivws.com/applications/v1/markup-statistics?' + new URLSearchParams({ date_from: dateFrom, date_to: dateTo }), {
          headers: { Authorization: `Bearer ${session.token}`, 'Deriv-App-ID': clientId }, signal: AbortSignal.timeout(15000)
        });
        if (!response.ok) { json(res, 403, { error: 'Application owner access is required.' }); return true; }
        const result = await response.json();
        // Deriv returns only the caller's applications. Never expose other apps' totals.
        const app = result.data?.breakdown?.find(row => String(row.app_id) === String(clientId));
        if (!app) { json(res, 403, { error: 'Application ownership could not be verified.' }); return true; }
        json(res, 200, { data: app }); return true;
      }
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

async function readJsonBody(req, maxBytes) {
  let body = '', size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > maxBytes) return null;
    body += chunk.toString('utf8');
  }
  try { return JSON.parse(body); } catch { return null; }
}
