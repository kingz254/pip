// Unit tests for the pure/shared Edge Function code. Node runs the .ts files directly (strip-types).
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDomain, tldOf, parseBootstrap, interpretRdap } from '../supabase/functions/_shared/domain.ts';
import { checkDomain, _resetCache } from '../supabase/functions/_shared/rdap.ts';
import { mpesaTimestamp, mpesaPassword, normalizeKePhone, kesAmount, stkPushBody, parseStkCallback, safeEqual } from '../supabase/functions/_shared/mpesa.ts';
import { darajaToken, stkPush, stkQuery } from '../supabase/functions/_shared/daraja.ts';
import { corsHeaders } from '../supabase/functions/_shared/cors.ts';

test('normalizeDomain', () => {
  assert.equal(normalizeDomain('https://www.MyBrand.com/path?x=1'), 'mybrand.com');
  assert.equal(normalizeDomain('  shop.co.ke '), 'shop.co.ke');
  for (const bad of ['', 'nodot', 'a b.com', '-bad.com', 'bad-.com', 'x.c', 'javascript:alert(1)', '<script>.com', 123, null, 'a'.repeat(64) + '.com'])
    assert.equal(normalizeDomain(bad), null, String(bad));
  assert.equal(tldOf('shop.co.ke'), 'ke');
});

test('interpretRdap only trusts RDAP for TLDs that run it', () => {
  const tlds = parseBootstrap({ services: [[['com', 'NET'], ['https://rdap.verisign.com/']], [['dev'], ['https://x/']]] });
  assert.ok(tlds.has('net') && tlds.has('com') && tlds.has('dev'));
  assert.equal(interpretRdap('a.com', 200, tlds), 'taken');
  assert.equal(interpretRdap('a.com', 404, tlds), 'free');
  assert.equal(interpretRdap('a.com', 500, tlds), 'unknown');
  assert.equal(interpretRdap('a.co.ke', 404, tlds), 'manual', 'a 404 for a TLD without RDAP must not look "free"');
});

function fakeFetch(map) {
  return async (url) => {
    const u = String(url);
    for (const [k, v] of Object.entries(map)) if (u.includes(k)) { if (v instanceof Error) throw v; return v; }
    throw new Error('unexpected ' + u);
  };
}
const resp = (status, body = {}) => ({ status, ok: status >= 200 && status < 300, json: async () => body, body: { cancel: async () => {} } });
const bootstrap = resp(200, { services: [[['com', 'net'], ['x']]] });

test('checkDomain', async () => {
  _resetCache();
  assert.equal(await checkDomain('taken.com', fakeFetch({ 'dns.json': bootstrap, 'rdap.org/domain/taken.com': resp(200) })), 'taken');
  assert.equal(await checkDomain('free.net', fakeFetch({ 'dns.json': bootstrap, 'rdap.org/domain/free.net': resp(404) })), 'free');
  assert.equal(await checkDomain('x.co.ke', fakeFetch({ 'dns.json': bootstrap, 'rdap.org/domain/x.co.ke': resp(404) })), 'manual');
  assert.equal(await checkDomain('boom.com', fakeFetch({ 'dns.json': bootstrap, 'rdap.org': new Error('network') })), 'unknown');
  _resetCache();
  assert.equal(await checkDomain('a.com', fakeFetch({ 'dns.json': resp(503) })), 'unknown');
});

test('M-Pesa helpers', () => {
  assert.equal(mpesaTimestamp(new Date(Date.UTC(2026, 10, 7, 9, 5, 3))), '20261107090503');
  assert.equal(mpesaPassword('174379', 'pass', '20261107090503'), btoa('174379pass20261107090503'));
  const good = { '0712345678': '254712345678', '0112345678': '254112345678', '712345678': '254712345678', '254712345678': '254712345678', '+254 712-345-678': '254712345678', '(0712) 345 678': '254712345678' };
  for (const [input, want] of Object.entries(good)) assert.equal(normalizeKePhone(input), want, input);
  for (const bad of ['', '071234567', '0812345678', '254212345678', 'abc', '+1 415 555 0100', null, 712345678]) assert.equal(normalizeKePhone(bad), null, String(bad));
  assert.equal(kesAmount(215, 129.4), 27821);
  assert.equal(kesAmount(1.1, 100), 110, 'float noise must not add a shilling');
  assert.equal(kesAmount(215.01, 129.4), 27823, 'real fractions round up');
  assert.equal(kesAmount(0.001, 1), 1);
  assert.throws(() => kesAmount(0, 130)); assert.throws(() => kesAmount(10, 0)); assert.throws(() => kesAmount(NaN, 130));
  const b = stkPushBody({ shortcode: '174379', passkey: 'k', phone: '254712345678', amountKes: 100, callbackUrl: 'https://x/cb', reference: 'PFabcdef123456789', description: 'Pipforge order', now: new Date(Date.UTC(2026, 0, 1)) });
  assert.equal(b.Amount, 100); assert.equal(b.PartyA, '254712345678'); assert.equal(b.AccountReference.length, 12); assert.equal(b.TransactionDesc.length, 13);
  assert.equal(b.Password, mpesaPassword('174379', 'k', b.Timestamp));
  assert.ok(safeEqual('abc', 'abc')); assert.ok(!safeEqual('abc', 'abd')); assert.ok(!safeEqual('abc', 'abcd'));
});

test('parseStkCallback', () => {
  const good = { Body: { stkCallback: { MerchantRequestID: 'm1', CheckoutRequestID: 'ws_1', ResultCode: 0, ResultDesc: 'ok',
    CallbackMetadata: { Item: [{ Name: 'Amount', Value: 27822 }, { Name: 'MpesaReceiptNumber', Value: 'QWE1' }, { Name: 'PhoneNumber', Value: 254712345678 }] } } } };
  assert.deepEqual(parseStkCallback(good), { merchantRequestId: 'm1', checkoutRequestId: 'ws_1', resultCode: 0, resultDesc: 'ok', amount: 27822, receipt: 'QWE1', phone: '254712345678' });
  const cancelled = parseStkCallback({ Body: { stkCallback: { MerchantRequestID: 'm', CheckoutRequestID: 'ws_2', ResultCode: 1032, ResultDesc: 'Request cancelled by user' } } });
  assert.equal(cancelled.resultCode, 1032); assert.equal(cancelled.amount, undefined);
  for (const bad of [null, {}, { Body: {} }, { Body: { stkCallback: { CheckoutRequestID: 5 } } }, { Body: { stkCallback: { CheckoutRequestID: 'x', ResultCode: 'zz' } } }])
    assert.throws(() => parseStkCallback(bad));
});

test('Daraja client', async () => {
  const calls = [];
  const f = async (url, init) => {
    calls.push([String(url), init]);
    const u = String(url);
    if (u.includes('/oauth/')) return resp(200, { access_token: 'tok' });
    if (u.includes('stkpushquery')) return resp(200, { ResultCode: '0' });
    return resp(200, { ResponseCode: '0', CheckoutRequestID: 'ws_9', MerchantRequestID: 'm9' });
  };
  assert.equal(await darajaToken('k', 's', 'sandbox', f), 'tok');
  assert.ok(calls[0][0].startsWith('https://sandbox.safaricom.co.ke/'));
  assert.equal(calls[0][1].headers.Authorization, 'Basic ' + btoa('k:s'));
  const r = await stkPush('tok', { shortcode: '1', passkey: 'p', phone: '254712345678', amountKes: 5, callbackUrl: 'https://x', reference: 'r', description: 'd' }, 'production', f);
  assert.equal(r.checkoutRequestId, 'ws_9'); assert.ok(calls[1][0].startsWith('https://api.safaricom.co.ke/'));
  assert.equal(await stkQuery('tok', { shortcode: '1', passkey: 'p', checkoutRequestId: 'ws_9' }, 'sandbox', f), 0);
  await assert.rejects(() => darajaToken('k', 's', 'sandbox', async () => resp(401)), /auth failed/);
  await assert.rejects(() => stkPush('t', { shortcode: '1', passkey: 'p', phone: '1', amountKes: 1, callbackUrl: 'x', reference: 'r', description: 'd' }, 'sandbox', async () => resp(200, { ResponseCode: '1', ResponseDescription: 'Insufficient' })), /Insufficient/);
  await assert.rejects(() => stkQuery('t', { shortcode: '1', passkey: 'p', checkoutRequestId: 'x' }, 'sandbox', async () => resp(500, { errorMessage: 'bad' })), /bad/);
});

test('cors', () => {
  const req = (o) => new Request('https://x', { headers: o ? { origin: o } : {} });
  assert.equal(corsHeaders(req('https://a.com'), undefined)['Access-Control-Allow-Origin'], '*');
  assert.equal(corsHeaders(req('https://b.com'), 'https://a.com,https://b.com')['Access-Control-Allow-Origin'], 'https://b.com');
  assert.equal(corsHeaders(req('https://evil.com'), 'https://a.com')['Access-Control-Allow-Origin'], 'https://a.com');
});
