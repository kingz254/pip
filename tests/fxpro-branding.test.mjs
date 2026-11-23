import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

test('nested analysis tools inherit palette, font and matching canvas scheme on edits', async t=>{
 const dom=new JSDOM('<iframe></iframe>',{url:'https://client.example'}),w=dom.window;
 const keys=['window','document','location','localStorage','Event','HTMLIFrameElement'];
 const old=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));
 for(const k of keys)globalThis[k]=k==='window'?w:w[k];
 t.after(()=>{Object.assign(globalThis,old);w.close()});
 const {applySiteBranding}=await import('../client-runtime/fxprotradesite/src/pipforge/site-branding.ts');
 const frame=w.document.querySelector('iframe');frame.contentDocument.title='Binaryfx';frame.contentDocument.body.innerHTML='<h1>Binaryfx</h1>';
 const site={name:'Acme',template:'midnight',background:'none',blur:75,header:'compact',font_theme:'inter',icon_shape:'round',icon_place:'both',social:{},menu:{},loader_style:'ring'};
 applySiteBranding(site);
 assert.equal(frame.style.colorScheme,'dark');assert.equal(frame.contentDocument.documentElement.style.colorScheme,'dark');
 assert.equal(frame.contentDocument.querySelector('h1').textContent,'Acme');
 assert.ok(frame.contentDocument.getElementById('pf-tool-theme').textContent.includes('backdrop-filter'));
 applySiteBranding({...site,name:'Atlas',template:'snow'});
 assert.equal(frame.style.colorScheme,'light');assert.equal(frame.contentDocument.querySelector('h1').textContent,'Atlas');
 assert.equal(frame.contentDocument.querySelectorAll('#pf-tool-theme').length,1);
 applySiteBranding({...site,menu:{font_scale:85},loader_style:'ripple',header:'balanced'});
 assert.equal(w.document.documentElement.style.fontSize,'8.5px');
 assert.equal(w.document.documentElement.dataset.pfLoader,'ripple');
 assert.equal(w.document.documentElement.dataset.pfHeader,'balanced');
 applySiteBranding({...site,menu:{font_scale:200}});
 assert.equal(w.document.documentElement.style.fontSize,'11.5px');
});
