import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
test('concurrent connection callers reject when a socket closes before opening',async()=>{
 let socket;
 class FakeSocket{static OPEN=1;readyState=0;constructor(){socket=this}close(){this.readyState=3;this.onclose?.()}}
 const old=globalThis.WebSocket;globalThis.WebSocket=FakeSocket;
 const source=(await readFile(new URL('../packages/deriv-core/src/ws/deriv-ws.ts',import.meta.url),'utf8')).replace("import { getPublicWsUrl } from '../config/urls';","const getPublicWsUrl=()=> 'wss://example.test';");
 const {DerivWS}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source,{mode:'transform'})).toString('base64'));
 const client=new DerivWS();
 try{const first=client.connect();const second=client.connect();const rejected=Promise.all([assert.rejects(first,/closed before opening/),assert.rejects(second,/could not be established/)]);socket.close();await rejected;}finally{client.disconnect();globalThis.WebSocket=old}
});


test('identical chart history reads share a request while fresh reads use a short cache', async () => {
 const source=(await readFile(new URL('../packages/deriv-core/src/ws/deriv-ws.ts',import.meta.url),'utf8')).replace("import { getPublicWsUrl } from '../config/urls';","const getPublicWsUrl=()=> 'wss://example.test';");
 const {DerivWS}=await import('data:text/javascript;base64,'+Buffer.from(stripTypeScriptTypes(source,{mode:'transform'})).toString('base64'));
 const client=new DerivWS(); let calls=0;
 client.sendRequest=async()=>{calls++;return {history:{prices:[1]}}};
 const request={ticks_history:'R_25',count:100,end:'latest'};
 const [first,second]=await Promise.all([client.send(request),client.send({...request})]);
 assert.equal(calls,1);assert.deepEqual(first,second);
 await client.send(request);assert.equal(calls,1);
 await client.send({...request,count:200});assert.equal(calls,2);
});
