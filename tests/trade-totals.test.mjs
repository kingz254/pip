import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('trade totals add string money numerically and use actual settled proceeds',async()=>{
 const source=await readFile(new URL('../client-runtime/fxprotradesite/src/stores/transactions-store.ts',import.meta.url),'utf8');
 const body=source.split('get statistics() {')[1].split('\n    toggleTransactionDetailsModal')[0].replace(/\n    }\s*$/,'').replaceAll(' as TContractInfo','');
 const calculate=new Function('transaction_elements',body);
 const rows=[{buy_price:'0.50',profit:'0.17',sell_price:'0.67',payout:'0.67',is_completed:true},{buy_price:'0.50',profit:'-0.50',sell_price:'0',payout:'0.67',is_completed:true}];
 const result=calculate.call({transactions:rows.map(data=>({type:'contract',data}))},{CONTRACT:'contract'});
 assert.equal(result.total_stake,1);assert.equal(result.total_payout,0.67);assert.ok(Math.abs(result.total_profit+0.33)<1e-9);assert.equal(result.number_of_runs,2);assert.equal(result.won_contracts,1);
});
