// Safaricom Daraja helpers (pure functions; network calls live in daraja.ts).

/** YYYYMMDDHHmmss in UTC. Daraja only needs the same value in the timestamp field and the password. */
export function mpesaTimestamp(d: Date = new Date()): string {
  const p = (n: number, l = 2) => String(n).padStart(l, '0');
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`;
}

export const mpesaPassword = (shortcode: string, passkey: string, timestamp: string): string =>
  btoa(`${shortcode}${passkey}${timestamp}`);

/** Accepts 07XXXXXXXX, 01XXXXXXXX, 7XXXXXXXX, 2547XXXXXXXX, +2547XXXXXXXX; returns 2547XXXXXXXX or null. */
export function normalizeKePhone(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  let d = input.replace(/[\s\-()]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  if (/^0[17]\d{8}$/.test(d)) d = '254' + d.slice(1);
  else if (/^[17]\d{8}$/.test(d)) d = '254' + d;
  return /^254[17]\d{8}$/.test(d) ? d : null;
}

/** Daraja only takes whole shillings. Round UP so we never under-collect. */
export function kesAmount(usd: number, usdKesRate: number): number {
  if (!(usd > 0) || !(usdKesRate > 0)) throw new Error('invalid amount or rate');
  // Round to 6 places first so float noise (1.1 * 100 = 110.00000000000001) cannot add a whole shilling.
  return Math.max(1, Math.ceil(Math.round(usd * usdKesRate * 1e6) / 1e6));
}

export interface StkPushInput {
  shortcode: string; passkey: string; phone: string; amountKes: number;
  callbackUrl: string; reference: string; description: string; now?: Date;
}
export function stkPushBody(i: StkPushInput) {
  const ts = mpesaTimestamp(i.now);
  return {
    BusinessShortCode: i.shortcode,
    Password: mpesaPassword(i.shortcode, i.passkey, ts),
    Timestamp: ts,
    TransactionType: 'CustomerPayBillOnline',
    Amount: i.amountKes,
    PartyA: i.phone,
    PartyB: i.shortcode,
    PhoneNumber: i.phone,
    CallBackURL: i.callbackUrl,
    AccountReference: i.reference.slice(0, 12),
    TransactionDesc: i.description.slice(0, 13),
  };
}

export interface StkCallback {
  merchantRequestId: string; checkoutRequestId: string; resultCode: number; resultDesc: string;
  amount?: number; receipt?: string; phone?: string;
}
export function parseStkCallback(json: any): StkCallback {
  const cb = json?.Body?.stkCallback;
  if (!cb || typeof cb.CheckoutRequestID !== 'string') throw new Error('not an STK callback');
  const out: StkCallback = {
    merchantRequestId: String(cb.MerchantRequestID ?? ''), checkoutRequestId: cb.CheckoutRequestID,
    resultCode: Number(cb.ResultCode), resultDesc: String(cb.ResultDesc ?? ''),
  };
  if (Number.isNaN(out.resultCode)) throw new Error('bad result code');
  const items: { Name: string; Value?: unknown }[] = cb.CallbackMetadata?.Item ?? [];
  const get = (n: string) => items.find((x) => x.Name === n)?.Value;
  if (get('Amount') !== undefined) out.amount = Number(get('Amount'));
  if (get('MpesaReceiptNumber') !== undefined) out.receipt = String(get('MpesaReceiptNumber'));
  if (get('PhoneNumber') !== undefined) out.phone = String(get('PhoneNumber'));
  return out;
}

/** Constant-time string compare for the callback secret. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
