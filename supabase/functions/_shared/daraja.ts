// Network calls to Safaricom Daraja. Secrets come from Edge Function secrets, never from the browser.
import { mpesaPassword, mpesaTimestamp, stkPushBody, type StkPushInput } from './mpesa.ts';

const base = (env: string) => (env === 'production' ? 'https://api.safaricom.co.ke' : 'https://sandbox.safaricom.co.ke');

export async function darajaToken(key: string, secret: string, env: string, f: typeof fetch = fetch): Promise<string> {
  const res = await f(`${base(env)}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: 'Basic ' + btoa(`${key}:${secret}`) }, signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`daraja auth failed (${res.status})`);
  const j = await res.json();
  if (!j.access_token) throw new Error('daraja auth: no token');
  return j.access_token;
}

export async function stkPush(token: string, input: StkPushInput, env: string, f: typeof fetch = fetch) {
  const res = await f(`${base(env)}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(stkPushBody(input)), signal: AbortSignal.timeout(20000),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || String(j.ResponseCode) !== '0' || !j.CheckoutRequestID) {
    throw new Error(j.errorMessage || j.ResponseDescription || `stk push failed (${res.status})`);
  }
  return { checkoutRequestId: String(j.CheckoutRequestID), merchantRequestId: String(j.MerchantRequestID ?? '') };
}

/** Ask Safaricom directly whether the payment succeeded, instead of trusting the callback body. */
export async function stkQuery(token: string, p: { shortcode: string; passkey: string; checkoutRequestId: string }, env: string, f: typeof fetch = fetch): Promise<number> {
  const ts = mpesaTimestamp();
  const res = await f(`${base(env)}/mpesa/stkpushquery/v1/query`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ BusinessShortCode: p.shortcode, Password: mpesaPassword(p.shortcode, p.passkey, ts), Timestamp: ts, CheckoutRequestID: p.checkoutRequestId }),
    signal: AbortSignal.timeout(20000),
  });
  const j = await res.json().catch(() => ({}));
  const code = Number(j.ResultCode);
  if (Number.isNaN(code)) throw new Error(j.errorMessage || 'stk query: no result code');
  return code;
}
