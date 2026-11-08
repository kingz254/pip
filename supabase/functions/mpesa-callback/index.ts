// Safaricom calls this URL after the customer answers the STK prompt. Deploy with --no-verify-jwt.
// Safaricom does not sign callbacks, so we (1) require a secret in the URL and (2) re-ask Safaricom
// whether the payment really succeeded before marking anything paid.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import { darajaToken, stkQuery } from '../_shared/daraja.ts';
import { parseStkCallback, safeEqual } from '../_shared/mpesa.ts';

const ACK = () => new Response(JSON.stringify({ ResultCode: 0, ResultDesc: 'Accepted' }), { headers: { 'Content-Type': 'application/json' } });
const need = (k: string): string => { const v = Deno.env.get(k); if (!v) throw new Error(`missing secret ${k}`); return v; };

Deno.serve(async (req) => {
  try {
    const secret = new URL(req.url).searchParams.get('s') ?? '';
    if (!safeEqual(secret, need('MPESA_CALLBACK_SECRET'))) return new Response('not found', { status: 404 });
    const cb = parseStkCallback(await req.json());
    const admin = createClient(need('SUPABASE_URL'), need('SUPABASE_SERVICE_ROLE_KEY'));

    const { data: pay } = await admin.from('payments').select('*').eq('provider', 'mpesa').eq('provider_ref', cb.checkoutRequestId).maybeSingle();
    if (!pay) { console.warn('callback for unknown payment', cb.checkoutRequestId); return ACK(); }

    if (cb.resultCode !== 0) {
      await admin.from('payments').update({ status: 'failed', raw: { code: cb.resultCode, desc: cb.resultDesc } }).eq('id', pay.id).eq('status', 'initiated');
      return ACK();                                              // order stays pending so the client can retry
    }

    const env = Deno.env.get('MPESA_ENV') ?? 'sandbox';
    const token = await darajaToken(need('MPESA_CONSUMER_KEY'), need('MPESA_CONSUMER_SECRET'), env);
    const confirmed = await stkQuery(token, { shortcode: need('MPESA_SHORTCODE'), passkey: need('MPESA_PASSKEY'), checkoutRequestId: cb.checkoutRequestId }, env);
    const expectedKes = Number(pay.amount_minor) / 100;
    if (confirmed !== 0 || (cb.amount ?? 0) < expectedKes) {
      console.error('payment failed verification', { id: pay.id, confirmed, got: cb.amount, expectedKes });
      return ACK();
    }
    const { error } = await admin.rpc('mark_order_paid', { p_order: pay.order_id, p_provider: 'mpesa', p_ref: cb.checkoutRequestId, p_receipt: cb.receipt ?? null });
    if (error) console.error('mark_order_paid failed', error.message);
    // Keep an extra successful payment on an already-paid order visible (so it can be refunded).
    await admin.from('payments').update({ status: 'succeeded', receipt: cb.receipt ?? null }).eq('id', pay.id);
  } catch (e) {
    console.error('callback error', (e as Error).message);
  }
  return ACK();
});
