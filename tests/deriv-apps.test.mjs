import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {boot,tick} from './helpers/boot.mjs';

test('embedded templates use the client glass surface instead of fixed theme panels',()=>{
  const source=readFileSync(new URL('../public/deriv-apps.js',import.meta.url),'utf8');
  assert.match(source,/--pf-client-glass/);
  assert.match(source,/backdrop-filter:blur\(18px\)/);
  assert.match(source,/html\[data-pf-theme\] \.bg-background/);
  assert.match(source,/--primary:'\+accentRgb/);
});

test('client tabs mount the local templates and leave only one active app frame',async(t)=>{
  const {w,d,$,click,errors}=boot();t.after(()=>w.close());await tick(200);
  click(d.querySelector('[data-loader="pulse"]'));
  const routes={home:'/apps/bot/#dashboard',bld:'/apps/bot/#bot_builder',cht:'/apps/rise-fall/',tut:'/apps/bot/#tutorial',ana:'/apps/digits/',smt:'/apps/digits/?mode=smart',acc:'/apps/accumulators/'};
  for(const [tab,path] of Object.entries(routes)){
    click(d.querySelector('#stabs [data-tab="'+tab+'"]'));
    if(tab==='bld'){assert.equal($('site-loader').dataset.style,'pulse');assert.ok($('site-loader').classList.contains('on'));}
    const frames=d.querySelectorAll('.pf-template-frame');assert.equal(frames.length,1);
    assert.equal(frames[0].getAttribute('src'),path);assert.equal(frames[0].parentNode.dataset.pn,tab);
    assert.equal(w.__pfEmbeddedActive,true);
  }
  click(d.querySelector('#stabs [data-tab="aih"]'));
  assert.equal(d.querySelectorAll('.pf-template-frame').length,0);assert.equal(w.__pfEmbeddedActive,false);
  assert.deepEqual(errors,[]);
});
