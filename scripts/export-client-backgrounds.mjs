import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const source = await readFile(new URL('public/index.html', root), 'utf8');
function section(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  if (a < 0 || b < 0) throw new Error('Builder background source changed: ' + start);
  return source.slice(a, b);
}
const engine = section('  function scene(', '  var pg=document.createElement("canvas");')
  + section('  function fx(', '  function bgfx(')
  + section('  function digFn(', '  var pb=document.createElement("canvas");')
  + section('  var E={};', '  function dsp(');
await writeFile(new URL('public/client-background.js', root), `(function(){'use strict';var RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
${engine}
var mode='none',colors=['#377cfc','#ff7a5c','#fff'],state={};
var layer=document.createElement('div');layer.className='pf-client-background';
var candle=document.createElement('canvas'),canvas=document.createElement('canvas'),image=document.createElement('div');
layer.append(candle,canvas,image);document.body.prepend(layer);
layer.style.cssText='position:fixed;inset:0;pointer-events:none;z-index:0;background:var(--pf-client-page)';
[candle,canvas,image].forEach(function(el){el.style.cssText='position:absolute;inset:0;width:100%;height:100%;background-size:cover;background-position:center'});
scene(candle,function(){return colors},true,.75);
fx(canvas,function(){return colors},function(c,W,H,T,dt,k){var fn=({digits:digFn,pulse:pulseFn,arrows:arrFn})[mode]||E[mode];if(fn)fn(c,W,H,T,dt,k,state)});
window.PipforgeBackground={update:function(key,a,b){if(key!==mode)state={};mode=key;colors=[a,b,'#fff'];candle.style.display=mode==='candles'?'block':'none';canvas.style.display=(E[mode]||['digits','pulse','arrows'].includes(mode))?'block':'none';image.style.backgroundImage=mode?.startsWith('img-')?imgBG(mode,a,b):'none';layer.style.display=document.documentElement.dataset.pfEmbedded==='true'?'none':'block';canvas.rd?.();}};
var site=window.__PF_SITE_BRANDING__;if(site){var style=getComputedStyle(document.documentElement);window.PipforgeBackground.update(site.background,style.getPropertyValue('--pf-client-accent').trim(),style.getPropertyValue('--pf-client-secondary').trim());}
})();`);
