import test from 'node:test';
import assert from 'node:assert/strict';
import {boot,tick} from './helpers/boot.mjs';
test('announcement and bold font choices reach the complete client preview',async t=>{
 const {w,d,$,input}=boot();t.after(()=>w.close());await tick(200);
 const frame=d.querySelector('.pf-full-app');assert.ok(frame);
 let profile;frame.contentWindow.postMessage=data=>{if(data.type==='PF_RUNTIME_PROFILE')profile=data.profile};
 $('announcement-visible').checked=false;$('announcement-visible').dispatchEvent(new w.Event('change',{bubbles:true}));
 $('font-bold-control').checked=true;$('font-bold-control').dispatchEvent(new w.Event('change',{bubbles:true}));
 assert.equal(profile.menu.announcement_visible,false);assert.equal(profile.menu.bold_text,true);assert.equal($('font-size-control'),null);
});
