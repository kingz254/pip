import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, tick } from './helpers/boot.mjs';
import { isBuilderHost } from '../api/site-entry.mjs';

test('preview keeps one complete FXPro app mounted when design choices change', async t => {
  const { w, d, $, click, input, errors } = boot();
  t.after(() => w.close()); await tick(200);
  const frame = d.querySelector('.pf-full-app');
  assert.ok(frame);
  assert.equal(frame.getAttribute('src'), '/fxpro.html?preview=1');
  assert.equal(d.querySelectorAll('.pf-template-frame').length, 0);
  const updates = [];
  frame.contentWindow.postMessage = (message, origin) => updates.push({ message, origin });
  input($('name'), 'Acme Markets');
  click(d.querySelector('#tpls [data-t="violet"]'));
  click(d.querySelector('[data-loader="pulse"]'));
  const menu = d.querySelector('#mnu input[data-m="id-forex"]');
  menu.checked = false; menu.dispatchEvent(new w.Event('change', { bubbles: true }));
  assert.equal(d.querySelector('.pf-full-app'), frame, 'design edits preserve the app session and active workspace');
  assert.equal(d.querySelectorAll('.pf-full-app').length, 1);
  const profile = updates.at(-1).message.profile;
  assert.equal(profile.name, 'Acme Markets');
  assert.equal(profile.template, 'violet');
  assert.equal(profile.loader_style, 'pulse');
  assert.equal(profile.menu['id-forex'], false);
  assert.equal(updates.at(-1).origin, w.location.origin);
  assert.deepEqual(errors, []);
});

test('builder offers every native FXPro tab in source order', async t => {
  const { w, d } = boot(); t.after(() => w.close()); await tick(100);
  assert.deepEqual([...d.querySelectorAll('#mnu input')].map(x => x.dataset.m), [
    'id-dbot-dashboard','id-bot-builder','id-dtrader','id-charts','id-analysis-tool','id-free-bots','id-portfolio','id-forex',
  ]);
});

test('domain entry sends customer domains directly to the app while preserving Pipforge hosts', () => {
  assert.equal(isBuilderHost('pip-coral-seven.vercel.app'), true);
  assert.equal(isBuilderHost('localhost:5173'), true);
  assert.equal(isBuilderHost('fxprotrades.site'), false);
  assert.equal(isBuilderHost('www.fxprotrades.site'), false);
  assert.equal(isBuilderHost('pip-coral-seven.vercel.app.attacker.example'), false);
});


test('runtime theme messages accept only the mounted same-origin app', async t => {
  const { w, d, $ } = boot(); t.after(() => w.close()); await tick(100);
  const frame=d.querySelector('.pf-full-app');
  const message=(origin,source,theme)=>w.dispatchEvent(new w.MessageEvent('message',{origin,source,data:{type:'PF_RUNTIME_THEME',theme}}));
  message('https://untrusted.example',frame.contentWindow,'dark');
  assert.equal($('site').dataset.clientTheme,'light');
  message(w.location.origin,w,'dark');
  assert.equal($('site').dataset.clientTheme,'light');
  message(w.location.origin,frame.contentWindow,'dark');
  assert.equal($('site').dataset.clientTheme,'dark');
  assert.equal(frame.style.colorScheme,'dark');
  message(w.location.origin,frame.contentWindow,'invalid');
  assert.equal($('site').dataset.clientTheme,'dark');
});
