import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
test('an active Volatility 25 signal sends its contract and prediction to the bot loader', async () => {
 const dom=new JSDOM('<div id="riseFallTable"></div><table><tbody id="overUnderTable"></tbody></table><table><tbody id="combinedTable"></tbody></table>',{url:'https://example.test/signals/',runScripts:'outside-only'});
 const {window}=dom;window.WebSocket=class {};window.setInterval=()=>0;
 let message;window.postMessage=(data)=>{message=data};
 const code=await readFile(new URL('../client-runtime/fxprotradesite/public/signals/signals.js',import.meta.url),'utf8');
 window.eval(code+'\nticksStorage.R_25=Array(255).fill(100.01);updateTables();');
 const button=window.document.querySelector('button[data-symbol="R_25"][data-type="DIGITOVER"]');
 assert.ok(button);assert.equal(button.disabled,false);button.click();
 assert.equal(message.fileName,'signals over bot.xml');assert.equal(message.signal.symbol,'R_25');assert.equal(message.signal.type,'DIGITOVER');assert.equal(message.signal.barrier,2);
 dom.window.close();
});
