import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const source = readFileSync(new URL('../public/smart-trading-core.js', import.meta.url), 'utf8');
const sandbox = { console };
vm.runInNewContext(source, sandbox);
const core = sandbox.PipforgeSmartCore;
const config = { strategy: 'speed', symbol: 'R_100', stake: 1, martingale: 2, maxStake: 4, stopLoss: 10, takeProfit: 10, maxTrades: 10, duration: 1, barrier: 5, contract: 'DIGITEVEN', threshold: 60, patternCount: 3, compareBarrier: 5 };
const sample = core.analyze(Array.from({ length: 100 }, (_, i) => 100 + (i % 10) / 100), 2);
function fixture(overrides = {}) {
  let accountId = 'demo-1', nextId = 0;
  const calls = [], engine = {
    async connect() { return { account_id: accountId, currency: 'USD', account_type: 'demo' }; },
    async request(payload) {
      calls.push(payload);
      if (payload.balance) return { balance: { balance: 100 } };
      if (payload.contracts_for) return { contracts_for: { available: ['DIGITEVEN', 'DIGITMATCH', 'DIGITOVER', 'DIGITUNDER'].map(contract_type => ({ contract_type })) } };
      return {};
    },
    async quote(payload) { calls.push(payload); return { id: String(++nextId), ask_price: payload.amount }; },
    async buy(quote) { calls.push({ buy: quote.id }); return { contract_id: Number(quote.id), buy_price: quote.ask_price }; },
    discardQuote() {}, ...overrides,
  };
  const runner = new core.Runner(engine, () => accountId, () => {});
  return { engine, runner, calls, switchAccount() { accountId = 'real-2'; } };
}
function settle(runner, id, profit) { runner.contract({ proposal_open_contract: { contract_id: id, status: profit > 0 ? 'won' : 'lost', is_sold: 1, profit: String(profit) }, subscription: { id: 'poc-' + id } }); }

test('digit precision retains trailing zeros and O5U4 keeps the original entry conditions', () => {
  assert.equal(core.analyze([123.4], 2).last, 0);
  const prices = [...Array(40).fill(100.08), ...Array(2).fill(100.04)];
  assert.equal(core.plan('o5u4', core.analyze(prices, 2), config).length, 2);
  assert.equal(core.plan('o5u4', core.analyze([...prices, 100.09], 2), config).length, 0);
  assert.equal(core.plan('matches', sample, config).length, 5);
});

test('the runner buys once, waits for settlement, then applies martingale once', async () => {
  const { runner, calls } = fixture(); await runner.start(config);
  await Promise.all([runner.tick('R_100', sample), runner.tick('R_100', sample)]);
  assert.equal(calls.filter(x => x.buy).length, 1);
  assert.equal(runner.positions.size, 1);
  settle(runner, 1, -1); settle(runner, 1, -1);
  assert.equal(runner.profit, -1); assert.equal(runner.nextStake, 2);
  await runner.tick('R_100', sample);
  assert.equal(calls.filter(x => x.buy).length, 2);
  runner.stop(); settle(runner, 2, 1.8);
  await runner.tick('R_100', sample);
  assert.equal(calls.filter(x => x.buy).length, 2);
});

test('account switches and insufficient live funds block purchases', async () => {
  const switched = fixture(); await switched.runner.start(config); switched.switchAccount(); await switched.runner.tick('R_100', sample);
  assert.equal(switched.calls.filter(x => x.buy).length, 0); assert.equal(switched.runner.active, false);
  const low = fixture({ async request(p) { return p.balance ? { balance: { balance: .1 } } : {}; } });
  await low.runner.start(config); await low.runner.tick('R_100', sample);
  assert.equal(low.calls.filter(x => x.buy).length, 0); assert.equal(low.runner.active, false);
});

test('stop loss reserves a complete five-contract round', async () => {
  const { runner, calls } = fixture(); await runner.start({ ...config, strategy: 'matches', stopLoss: 4 }); await runner.tick('R_100', sample);
  assert.equal(calls.filter(x => x.buy).length, 0); assert.equal(runner.active, false);
});

test('partial round failures stop remaining purchases and retain confirmed contracts', async () => {
  let attempt = 0;
  const { runner } = fixture({ async buy(quote) { if (++attempt === 2) throw new Error('Deriv did not respond in time.'); return { contract_id: Number(quote.id), buy_price: 1 }; } });
  await runner.start({ ...config, strategy: 'matches' }); await runner.tick('R_100', sample);
  assert.equal(attempt, 2); assert.equal(runner.trades.length, 1); assert.equal(runner.positions.size, 1); assert.equal(runner.active, false); assert.equal(runner.unresolved, true);
  await assert.rejects(runner.start(config), /settle/);
});

test('stopping while authentication is pending cancels start', async () => {
  let resolve; const { runner } = fixture({ connect: () => new Promise(r => { resolve = r; }) });
  const starting = runner.start(config); runner.stop(); resolve({ account_id: 'demo-1', currency: 'USD' });
  await assert.rejects(starting, /cancelled/); assert.equal(runner.active, false);
});

test('the native workspace exposes all four tabs and actions without an automation-list dependency', async () => {
  const dom = new JSDOM('<div id="site"><div data-pn="smt" class="on"><section class="automation-center"></section></div></div>', { url: 'https://fixture.test', runScripts: 'outside-only' });
  const { window } = dom; let listener;
  window.eval(source);
  window.PipforgeSmartTradingEngine = { subscribe(fn) { listener = fn; return () => {}; }, async request() { throw new Error('fixture feed unavailable'); } };
  window.eval(readFileSync(new URL('../public/smart-trading-suite.js', import.meta.url), 'utf8'));
  const doc = window.document;
  assert.equal(doc.querySelectorAll('[data-tab-tool]').length, 4);
  assert.equal(doc.querySelectorAll('[data-hub]').length, 4);
  assert.equal(doc.querySelectorAll('[data-family]').length, 6);
  doc.querySelector('[data-tab-tool="speed"]').click();
  assert.equal(doc.querySelector('[data-panel="speed"]').hidden, false);
  doc.querySelector('[data-activate="speed"]').click();
  assert.equal(doc.querySelector('[data-start="speed"]').disabled, false);
  assert.equal(doc.querySelectorAll('iframe').length, 0);
  assert.equal(typeof listener, 'function');
  window.dispatchEvent(new window.PageTransitionEvent('pagehide')); window.close();
});
