import test from 'node:test';
import assert from 'node:assert/strict';
import {boot,tick} from './helpers/boot.mjs';

test('client tabs mount the local templates and leave only one active app frame',async(t)=>{
  const {w,d,$,click,errors}=boot();t.after(()=>w.close());await tick(200);
  const routes={bld:'/apps/bot/#bot_builder',ana:'/apps/digits/',smt:'/apps/digits/?mode=smart',cht:'/apps/rise-fall/',acc:'/apps/accumulators/'};
  for(const [tab,path] of Object.entries(routes)){
    click(d.querySelector('#stabs [data-tab="'+tab+'"]'));
    const frames=d.querySelectorAll('.pf-template-frame');assert.equal(frames.length,1);
    assert.equal(frames[0].getAttribute('src'),path);assert.equal(frames[0].parentNode.dataset.pn,tab);
    assert.equal(w.__pfEmbeddedActive,true);
  }
  click(d.querySelector('#stabs [data-tab="home"]'));
  assert.equal(d.querySelectorAll('.pf-template-frame').length,0);assert.equal(w.__pfEmbeddedActive,false);
  assert.deepEqual(errors,[]);
});
