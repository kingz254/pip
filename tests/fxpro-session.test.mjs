import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { restoreTradingSession, getTradingSocketUrl, selectTradingAccount, getSelectedAccount, removeLegacyCredentials } from '../client-runtime/fxprotradesite/src/pipforge/session.ts';

test('FXPro session selects owned accounts, refreshes OTPs and rejects a stale account connection', async () => {
  const dom = new JSDOM('', { url: 'https://client.example/?token1=old&keep=yes#bot' });
  const previous = Object.fromEntries(['window','localStorage','sessionStorage','fetch','Event'].map(k => [k, globalThis[k]]));
  Object.assign(globalThis, { window: dom.window, localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage, Event: dom.window.Event });
  try {
    localStorage.setItem('authToken', 'old');
    removeLegacyCredentials();
    assert.equal(localStorage.getItem('authToken'), null);
    assert.equal(window.location.search, '?keep=yes');
    let otpCalls = 0, release;
    const accounts = ['demo','real'].map(type => ({ account_id: type, account_type: type, currency: 'USD', balance: '100', status: 'active' }));
    globalThis.fetch = async (url, options) => {
      assert.equal(options.credentials, 'same-origin');
      if (url.endsWith('/session')) return Response.json({ authenticated: true });
      if (url.endsWith('/accounts')) return Response.json({ data: accounts });
      assert.equal(options.method, 'POST');
      otpCalls++;
      if (otpCalls === 3) await new Promise(resolve => { release = resolve; });
      return Response.json({ data: { url: `wss://api.derivws.com/trading/v1/options/ws/demo?otp=${otpCalls}` } });
    };
    await restoreTradingSession();
    assert.equal(getSelectedAccount().account_type, 'demo');
    assert.notEqual(await getTradingSocketUrl(), await getTradingSocketUrl());
    assert.throws(() => selectTradingAccount('unowned'), /unavailable/);
    const pending = getTradingSocketUrl();
    selectTradingAccount('real');
    release();
    await assert.rejects(pending, /Account changed/);
    assert.equal(getSelectedAccount().account_type, 'real');
  } finally {
    Object.assign(globalThis, previous);
    dom.window.close();
  }
});
