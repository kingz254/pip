import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const tradingScript = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
  .map((match) => match[1])
  .find((script) => script.includes('PipforgeSmartTradingEngine'));

test('Smart Trading uses one quote-bound New API engine', () => {
  assert.ok(tradingScript, 'the Smart Trading engine is embedded in the client app');
  assert.doesNotThrow(() => new vm.Script(tradingScript));
  assert.match(tradingScript, /window\.PipforgeSmartTradingEngine=smartTradingEngine/);
  assert.match(tradingScript, /async function quoteContract\(payload\)/);
  assert.match(tradingScript, /subscribe:1/);
  assert.match(tradingScript, /requestAutomation\(buyRequest,String\(proposal\.id\)\)/);
  assert.match(tradingScript, /buyRequest=\{buy:String\(proposal\.id\),price:price\}/);
  assert.match(tradingScript, /buyRequest=\{buy:"1",price:price,parameters:parameters\}/);
  assert.match(tradingScript, /function changeMarketFeed\(source\)/);
  assert.doesNotMatch(tradingScript, /if\(b\.dataset\.tab==="cht"\)startFeed\(\)/);
});
