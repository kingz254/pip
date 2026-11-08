// POST { order_id, method: 'mpesa', phone } -> starts an M-Pesa STK push for a pending order.
// The amount is read from the order row (set by the create_order SQL function), never from the browser.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { corsHeaders, json } from '../_shared/cors.ts';
import { darajaToken, stkPush } from '../_shared/daraja.ts';
import { checkDomain } from '../_shared/rdap.ts';
import { kesAmount, normalizeKePhone } from '../_shared/mpesa.ts';

const need = (k: string): string => { const v = Deno.env.get(k); if (!v) throw new Error(`missing secret ${k}`); return v; };

Deno.serve(async (req) => {
  const cors = corsHeaders(req, Deno.env.get('ALLOWED_ORIGIN'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405, cors);
  try {
    const url = need('SUPABASE_URL');
    const user = createClient(url, need('SUPABASE_ANON_KEY'), { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } });
    const { data: { user: me } } = await user.auth.getUser();
    if (!me) return json({ error: 'sign in required' }, 401, cors);

    const body = await req.json().catch(() => ({}));
    if (body.method !== 'mpesa') return json({ error: 'Only M-Pesa is enabled right now. Card payments are coming.' }, 400, cors);
    const phone = normalizeKePhone(body.phone);
    if (!phone) return json({ error: 'Enter a valid Safaricom number, for example 0712345678' }, 400, cors);

    // RLS means this only returns the caller's own order.
    const { data: order } = await user.from('orders').select('*').eq('id', body.order_id).maybeSingle();
    if (!order) return json({ error: 'order not found' }, 404, cors);
    if (order.status !== 'pending') return json({ error: `order is ${order.status}` }, 409, cors);

    // Last look before taking money: a brand-new domain must still be unregistered.
    if (order.domain_mode === 'new' && (await checkDomain(order.domain)) === 'taken') {
      return json({ error: 'That domain was just registered by someone else. Please pick another.' }, 409, cors);
    }

    const amountKes = kesAmount(Number(order.total_usd), Number(need('USD_KES_RATE')));
    const env = Deno.env.get('MPESA_ENV') ?? 'sandbox';
    const shortcode = need('MPESA_SHORTCODE');
    const token = await darajaToken(need('MPESA_CONSUMER_KEY'), need('MPESA_CONSUMER_SECRET'), env);
    const callbackUrl = `${url}/functions/v1/mpesa-callback?s=${encodeURIComponent(need('MPESA_CALLBACK_SECRET'))}`;
    const { checkoutRequestId } = await stkPush(token, {
      shortcode, passkey: need('MPESA_PASSKEY'), phone, amountKes, callbackUrl,
      reference: 'PF' + String(order.id).replace(/-/g, '').slice(0, 8), description: 'Pipforge',
    }, env);

    const admin = createClient(url, need('SUPABASE_SERVICE_ROLE_KEY'));
    const { error } = await admin.from('payments').insert({
      order_id: order.id, provider: 'mpesa', provider_ref: checkoutRequestId,
      amount_minor: amountKes * 100, currency: 'KES', raw: { phone_last4: phone.slice(-4) },
    });
    if (error) throw new Error('could not record payment: ' + error.message);
    return json({ ok: true, checkout_request_id: checkoutRequestId, amount_kes: amountKes }, 200, cors);
  } catch (e) {
    console.error('checkout failed', (e as Error).message);
    return json({ error: 'We could not start the payment. Please try again.' }, 502, cors);
  }
});
