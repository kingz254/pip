import test from 'node:test';
import assert from 'node:assert/strict';
import {createPremiumBots} from '../scripts/premium-bots.mjs';
test('premium delivery checks live tenant, paid package and grant before accessing source',async()=>{
 let paid=true,granted=false,live=true;const calls=[];
 const upstream=async address=>{const url=new URL(address),table=url.pathname.split('/').pop();calls.push([table,url.search]);return Response.json(table==='sites'?(live?[{id:'site-a'}]:[]):table==='orders'?(paid?[{id:'order-a'}]:[]):table==='premium_bot_catalog'?[{id:'premium-01',execution_ready:true}]:table==='premium_bot_grants'?(granted?[{bot_id:'premium-01'}]:[]):[{xml_content:'<xml>private fixture</xml>'}]);};
 const deliver=createPremiumBots({url:'https://db.test',serviceKey:'private-key',upstream});const request={domain:'client.test',accountId:'ROT123',botId:'premium-01'};
 assert.equal(await deliver(request),null);assert.equal(calls.some(c=>c[0]==='premium_bot_sources'),false);
 granted=true;assert.equal(await deliver(request),'<xml>private fixture</xml>');assert.ok(calls.some(c=>c[0]==='sites'&&c[1].includes('eq.client.test')));
 paid=false;assert.equal(await deliver(request),null);paid=true;live=false;assert.equal(await deliver(request),null);
});

 test('builder inline scripts remain valid after package updates', async()=>{const {readFileSync}=await import('node:fs');const html=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;for(const script of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))assert.doesNotThrow(()=>new AsyncFunction(script[1]));assert.equal(html.split('</html>').length,2);});
