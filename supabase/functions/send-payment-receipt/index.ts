import { createClient } from 'npm:@supabase/supabase-js@2.45.4';
import nodemailer from 'npm:nodemailer@9.1.1';
import { corsHeaders, json } from '../_shared/cors.ts';

const SENDER = 'Pipforge <pipforgeapp@gmail.com>';
const EMAIL = 'pipforgeapp@gmail.com';
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

Deno.serve(async (req) => {
  const cors = corsHeaders(req, Deno.env.get('ALLOWED_ORIGIN'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405, cors);

  const password = Deno.env.get('GMAIL_APP_PASSWORD');
  if (!password) return json({ error: 'Receipt email is not configured yet. Ask the Pipforge admin to configure Gmail.' }, 503, cors);

  let body: { order_id?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'invalid json' }, 400, cors); }
  if (typeof body.order_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.order_id)) return json({ error: 'invalid order' }, 400, cors);

  const url = Deno.env.get('SUPABASE_URL')!;
  const authorization = req.headers.get('Authorization') ?? '';
  const user = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
  const { data: { user: caller }, error: authError } = await user.auth.getUser();
  if (authError || !caller) return json({ error: 'sign in required' }, 401, cors);
  const { data: isAdmin, error: adminError } = await user.rpc('is_admin');
  if (adminError || isAdmin !== true) return json({ error: 'admins only' }, 403, cors);

  const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: order, error: orderError } = await admin.from('orders')
    .select('id,owner,site_id,domain,total_usd,paid_at,status').eq('id', body.order_id).maybeSingle();
  if (orderError || !order) return json({ error: 'order not found' }, 404, cors);
  if (order.status !== 'paid') return json({ error: 'payment is not confirmed' }, 409, cors);

  const { data: payment, error: paymentError } = await admin.from('payments')
    .select('id,provider_ref,amount_minor,currency,receipt_email_status,receipt_email_attempted_at')
    .eq('order_id', order.id).eq('provider', 'crypto_manual').eq('status', 'succeeded')
    .order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (paymentError || !payment || !/^[a-f0-9]{64}$/i.test(payment.provider_ref)) return json({ error: 'confirmed transaction receipt not found' }, 409, cors);
  if (payment.receipt_email_status === 'sent') return json({ sent: true, already_sent: true }, 200, cors);
  if (payment.receipt_email_status === 'sending' && payment.receipt_email_attempted_at && Date.now() - Date.parse(payment.receipt_email_attempted_at) < 10 * 60_000) {
    return json({ sent: false, in_progress: true }, 202, cors);
  }

  const [{ data: profile }, { data: site }] = await Promise.all([
    admin.from('profiles').select('email,full_name,phone').eq('id', order.owner).maybeSingle(),
    admin.from('sites').select('name,domain').eq('id', order.site_id).maybeSingle(),
  ]);
  if (!profile?.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) return json({ error: 'client email is missing or invalid' }, 409, cors);

  const attemptedAt = new Date().toISOString();
  let claim = await admin.from('payments').update({ receipt_email_status: 'sending', receipt_email_attempted_at: attemptedAt, receipt_email_error: null })
    .eq('id', payment.id).in('receipt_email_status', ['not_sent', 'failed']).select('id').maybeSingle();
  if (!claim.data && payment.receipt_email_status === 'sending') {
    claim = await admin.from('payments').update({ receipt_email_status: 'sending', receipt_email_attempted_at: attemptedAt, receipt_email_error: null })
      .eq('id', payment.id).eq('receipt_email_status', 'sending').eq('receipt_email_attempted_at', payment.receipt_email_attempted_at).select('id').maybeSingle();
  }
  if (claim.error || !claim.data) return json({ sent: false, in_progress: true }, 202, cors);

  const amount = (Number(payment.amount_minor) / 100).toFixed(2);
  const clientName = profile.full_name || 'Client';
  const siteName = site?.name || 'Pipforge site';
  const domain = order.domain || site?.domain || 'Not selected';
  const txid = payment.provider_ref;
  const paidAt = order.paid_at ? new Date(order.paid_at).toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC') : 'Confirmed';
  const values = [
    ['Client', clientName], ['Email', profile.email], ['Phone', profile.phone || 'Not provided'],
    ['Website', siteName], ['Domain', domain], ['Amount received', `${amount} ${payment.currency || 'USDT'}`],
    ['Network', 'TRON (TRC20)'], ['Transaction hash', txid], ['Order reference', order.id], ['Paid at', paidAt],
  ];
  const text = `Pipforge payment receipt\n\n${values.map(([label, value]) => `${label}: ${value}`).join('\n')}\n\nThank you for choosing Pipforge. Keep this email as proof of payment.\nQuestions? Contact ${EMAIL}.`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#20242b"><h1 style="color:#ef4c58">Pipforge payment receipt</h1><p>Hi ${escapeHtml(clientName)}, your payment has been confirmed. Keep this email as your receipt.</p><table style="border-collapse:collapse;width:100%">${values.map(([label, value]) => `<tr><th align="left" style="padding:10px;border-bottom:1px solid #ddd">${escapeHtml(label)}</th><td style="padding:10px;border-bottom:1px solid #ddd;word-break:break-word">${escapeHtml(value)}</td></tr>`).join('')}</table><p>Questions? Contact <a href="mailto:${EMAIL}">${EMAIL}</a>.</p></div>`;
  const transport = nodemailer.createTransport({ host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: EMAIL, pass: password } });
  try {
    await transport.sendMail({ from: SENDER, to: profile.email, subject: `Pipforge payment receipt · ${siteName}`, text, html });
    const { error } = await admin.from('payments').update({ receipt_email_status: 'sent', receipt_email_sent_at: new Date().toISOString(), receipt_email_error: null }).eq('id', payment.id);
    if (error) throw error;
    return json({ sent: true, to: profile.email }, 200, cors);
  } catch (error) {
    const detail = error instanceof Error ? error.message.slice(0, 300) : 'mail delivery failed';
    await admin.from('payments').update({ receipt_email_status: 'failed', receipt_email_error: detail }).eq('id', payment.id);
    console.error('Pipforge receipt delivery failed:', detail);
    return json({ error: 'Payment is confirmed, but the receipt email could not be sent. Retry it from the admin portal.' }, 502, cors);
  } finally {
    transport.close();
  }
});
