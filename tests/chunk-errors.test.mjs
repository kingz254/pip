import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { initChunkErrorHandler } from '../client-runtime/fxprotradesite/src/utils/chunk-error-handler.ts';
test('ordinary network failures do not ask users to clear their site data', () => {
 const dom = new JSDOM('<html><head></head><body></body></html>', { url:'https://example.test' });
 globalThis.window=dom.window;globalThis.document=dom.window.document;
 initChunkErrorHandler();
 window.dispatchEvent(new window.ErrorEvent('error',{message:'Failed to fetch'}));
 assert.equal(document.querySelector('[data-chunk-error-notification]'),null);
 window.dispatchEvent(new window.ErrorEvent('error',{message:'Loading CSS chunk 42 failed'}));
 assert.ok(document.querySelector('[data-chunk-error-notification]'));
 dom.window.close();delete globalThis.window;delete globalThis.document;
});
