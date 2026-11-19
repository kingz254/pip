import test from 'node:test';
import assert from 'node:assert/strict';
import { requestForOptions, buyOnSelectedAccount, responseForWorkspace } from '../client-runtime/fxprotradesite/src/pipforge/new-options.mjs';

const account = { account_id: 'demo', currency: 'EUR' };
test('Blockly inputs become New API requests using the selected account currency', () => {
  const request = requestForOptions({ proposal: 1, symbol: 'R_100', currency: 'USD', amount: '2', contract_type: 'DIGITEVEN', barrier: 5, selected_tick: 5 }, account);
  assert.deepEqual(request, { proposal: 1, underlying_symbol: 'R_100', currency: 'EUR', amount: 2, contract_type: 'DIGITEVEN' });
  assert.throws(() => requestForOptions({ authorize: 'fixture' }), /unavailable/);
  assert.deepEqual(requestForOptions({ contracts_for: 'R_100', currency: 'USD', product_type: 'basic', start_type: 'spot' }), { contracts_for: 'R_100' });
});

test('purchase prices and buys on the same socket, preserves account generation and releases quote', async () => {
  const calls = [];
  let released = 0, current = true;
  const socket = {
    subscribe: async (request, handler) => { calls.push(request); handler({ proposal: { id: 'q'.repeat(32), ask_price: '2' } }); return { unsubscribe: async () => { released++; } }; },
    send: async request => { calls.push(request); return { buy: { contract_id: 123 } }; },
  };
  const input = { buy: 1, price: 2, parameters: { symbol: 'R_100', currency: 'USD', amount: 2, basis: 'stake', contract_type: 'DIGITEVEN', duration: 1, duration_unit: 't' } };
  assert.equal((await buyOnSelectedAccount(socket, input, account, () => current)).buy.contract_id, 123);
  assert.equal(calls[0].currency, 'EUR');
  assert.deepEqual(calls[1], { buy: 'q'.repeat(32), price: 2 });
  assert.equal(released, 1);
  socket.subscribe = async (_, handler) => { handler({ proposal: { id: 'q'.repeat(32), ask_price: 2 } }); current = false; return { unsubscribe: async () => { released++; } }; };
  await assert.rejects(buyOnSelectedAccount(socket, input, account, () => current), /Account changed/);
  assert.equal(calls.length, 2);
  assert.equal(released, 2);
});

test('an ambiguous buy failure is sent once and does not leak its quote subscription', async () => {
  let buys = 0, released = 0;
  const socket = {
    subscribe: async (_, handler) => { handler({ proposal: { id: 'q'.repeat(32), ask_price: 1 } }); return { unsubscribe: async () => { released++; } }; },
    send: async () => { buys++; throw new Error('Connection closed; verify your positions.'); },
  };
  await assert.rejects(buyOnSelectedAccount(socket, { buy: '1', price: 1, parameters: { contract_type: 'CALL', symbol: 'R_100' } }, account, () => true), /verify your positions/);
  assert.equal(buys, 1); assert.equal(released, 1);
});

test('New API settlement spots reach the existing Blockly view model', () => {
  const result = responseForWorkspace({ proposal_open_contract: { underlying_symbol: 'R_100', entry_spot: '42', exit_spot: '43', is_sold: 1 } });
  assert.equal(result.proposal_open_contract.entry_tick, '42');
  assert.equal(result.proposal_open_contract.exit_tick, '43');
});
