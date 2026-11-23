import assert from 'node:assert/strict';
import { test } from 'node:test';
import { executeTradesSequentially } from '../client-runtime/fxprotradesite/src/pages/chart/execute-trades.ts';

test('Speed Bot waits for each purchase before sending the next', async () => {
  let inFlight = 0;
  let maxInFlight = 0;
  const results = await executeTradesSequentially(3, async () => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    await new Promise(resolve => setTimeout(resolve, 1));
    inFlight--;
    return 'bought';
  });

  assert.equal(maxInFlight, 1);
  assert.deepEqual(results, ['bought', 'bought', 'bought']);
});
