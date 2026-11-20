import test from 'node:test';
import assert from 'node:assert/strict';
import {initializeBotAccount} from '../client-runtime/fxprotradesite/src/pipforge/bot-account.mjs';
import {replaceGold} from '../client-runtime/fxprotradesite/src/pipforge/gold-accent.mjs';
import {borrowSocket} from '../packages/deriv-core/src/react/borrow-socket.ts';
import {responseForWorkspace} from '../client-runtime/fxprotradesite/src/pipforge/new-options.mjs';

test('chart hours map New API symbols and optional events without inventing market hours',()=>{
 const markets=responseForWorkspace({active_symbols:[{underlying_symbol:'R_100',underlying_symbol_name:'Volatility 100',underlying_symbol_type:'stockindex',pip_size:0.01,market:'synthetic_index',submarket:'random_index',subgroup:'synthetics'}]}).active_symbols;
 assert.equal(markets[0].subgroup_display_name,'synthetics');
 const hours={open:['00:00:00'],close:['23:59:59']};
 const data={trading_times:{markets:[{name:'Derived',submarkets:[{name:'Continuous',symbols:[{underlying_symbol:'R_100',times:hours},{underlying_symbol:'UNAVAILABLE'}]}]}]}};
 const symbols=responseForWorkspace(data).trading_times.markets[0].submarkets[0].symbols;
 assert.equal(symbols.length,1);assert.equal(symbols[0].symbol,'R_100');assert.deepEqual(symbols[0].events,[]);assert.deepEqual(symbols[0].times,hours);
 assert.equal(data.trading_times.markets[0].submarkets[0].symbols.length,2);
});

test('bot initializes from the selected demo or real account without a provider token or another stream event',async()=>{
 for(const [account_id,balance] of [['DOT39098596',9998.88],['CR123456',17.25]]){
  const account={account_id,currency:'USD'};const requests=[];
  const api={is_authorized:true,account_info:{},api:{send:async request=>{requests.push(request);return {balance:{loginid:account_id,currency:'USD',balance}}}}};
  const info=await initializeBotAccount(api,account_id,()=>account,()=>1);
  assert.equal(info.balance,balance);assert.equal(info.loginid,account_id);assert.deepEqual(requests,[{balance:1}]);
 }
});
test('bot refuses stale, unauthenticated and wrong-account balances',async()=>{
 let account={account_id:'DOT39098596',currency:'USD'},generation=1,finish;
 const api={is_authorized:false,api:{send:()=>new Promise(resolve=>{finish=resolve})}};
 await assert.rejects(initializeBotAccount(api,account.account_id,()=>account,()=>generation),/connecting/);
 api.is_authorized=true;
 const pending=initializeBotAccount(api,account.account_id,()=>account,()=>generation);generation++;
 finish({balance:{loginid:account.account_id,currency:'USD',balance:9998.88}});
 await assert.rejects(pending,/Account changed/);
 api.api.send=async()=>({balance:{loginid:'CR123456',currency:'USD',balance:0}});
 await assert.rejects(initializeBotAccount(api,account.account_id,()=>account,()=>generation),/does not match/);
});
test('gold accents become client colors while status colors remain intact',()=>{
 assert.equal(replaceGold('#b99425'),'var(--pf-client-accent)');
 assert.equal(replaceGold('linear-gradient(#b1913e,#dba80db7)'), 'linear-gradient(var(--pf-client-accent),color-mix(in srgb,var(--pf-client-accent) 72%,transparent))');
 assert.equal(replaceGold('#ec3f3f'),'#ec3f3f');
});
test('a template releases its own streams without disconnecting or forgetting another tool',async()=>{
 let closed=0,own=0,other=0;const owner={subscribe:async()=>({subscriptionId:'own',unsubscribe:async()=>{own++}}),disconnect:()=>closed++,send:async r=>r,onMessage:()=>()=>{other++}};
 const lease=borrowSocket(owner),sub=await lease.socket.subscribe({ticks:'R_100'},()=>{});
 lease.socket.onMessage(()=>{});lease.release();await Promise.resolve();
 assert.equal(own,1);assert.equal(other,1);assert.equal(closed,0);
 lease.socket.disconnect();assert.equal(closed,0);
});
