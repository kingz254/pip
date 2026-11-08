import test from 'node:test';
import assert from 'node:assert/strict';
import { boot, tick } from './helpers/boot.mjs';
import { fakeSupabase } from './helpers/fakeSupabase.mjs';

const USER = { id: 'user-1', email: 'jane@gmail.com' };

test('demo mode (no Supabase keys): full flow runs with no script errors', async (t) => {
  const { w, d, $, click, input, errors } = boot(); t.after(() => w.close());
  await tick(300);
  assert.equal(w.location.hash, '#landing');
  click($('gsi')); input($('ge'), 'jane@gmail.com'); click($('gct'));
  input($('gn'), 'Jane Doe'); input($('gp'), '+254700000000'); $('gc').checked = true; click($('gdo')); await tick(100);
  assert.equal(w.location.hash, '#home');
  assert.match($('acct').textContent, /Hi, Jane/);
  for (const p of ['why', 'templates', 'bots', 'pricing', 'how', 'tutorials', 'earnings', 'testimonials', 'faq', 'dashboard', 'checkout', 'legal', 'verify', 'home']) {
    w.location.hash = '#' + p; await tick(30);
    assert.ok(!d.getElementById('p-' + p).hidden, 'page ' + p);
  }
  assert.equal(d.querySelectorAll('#tpls .tpl').length, 20);
  assert.equal(d.querySelectorAll('#bgs .chip').length, 25);
  for (const b of d.querySelectorAll('#bgs .chip')) click(b);
  for (const t of d.querySelectorAll('#tpls .tpl')) click(t);
  input($('name'), 'Alpha Trades'); assert.equal($('url').textContent, 'alphatrades.site');
  click(d.querySelector('#dmm [data-v="own"]')); input($('dow'), 'https://www.MyBrand.com/x');
  assert.equal($('url').textContent, 'mybrand.com'); assert.match($('ren').textContent, /\$10/);
  assert.deepEqual(errors, []);
});

test('demo mode: social links reject unsafe values', async (t) => {
  const { w, d, $, click, input, errors } = boot(); t.after(() => w.close());
  await tick(200);
  click($('gsi')); input($('ge'), 'x@gmail.com'); click($('gct')); input($('gn'), 'Xx Test'); input($('gp'), '0700000001'); $('gc').checked = true; click($('gdo')); await tick(50);
  for (const k of ['ig', 'x', 'ml', 'wa', 'tg']) input(d.querySelector(`#socs input[data-k="${k}"]`), 'javascript:alert(1)');
  const hrefs = [...d.querySelectorAll('#sh a')].map((a) => a.getAttribute('href'));
  assert.ok(hrefs.every((h) => /^(https:\/\/|mailto:)/.test(h)), hrefs.join(','));
  assert.deepEqual(errors, []);
});

test('backend mode: sign in, profile, autosave, domain check, order, M-Pesa, status', async (t) => {
  const sb = fakeSupabase({ domainStatus: (dm) => dm === 'taken.site' ? 'taken' : dm.endsWith('.co.ke') ? 'manual' : 'free' });
  const { w, d, $, click, input, errors } = boot({ sb }); t.after(() => w.close());
  await tick(300);
  assert.equal(w.location.hash, '#landing');
  assert.equal(w.document.documentElement.classList.contains('locked'), true);
  click($('gsi')); await tick(10); assert.equal(sb.calls.oauth, 1, 'Google OAuth started');

  // Returning from Google: profile has no name/phone yet -> details step
  sb.signInAs(USER); await tick(100);
  assert.equal($('a2').style.display, 'grid'); assert.equal($('gem').textContent, 'jane@gmail.com');
  click($('gdo')); assert.match($('ae2').textContent, /name/i);
  input($('gn'), 'Jane Doe'); input($('gp'), '12'); click($('gdo')); assert.match($('ae2').textContent, /phone/i);
  input($('gp'), '+254 700 000 000'); click($('gdo')); assert.match($('ae2').textContent, /consent/i);
  $('gc').checked = true; click($('gdo')); await tick(150);
  // objects made inside jsdom live in another realm, so compare as JSON
  assert.equal(JSON.stringify(sb.calls.rpc[0]), JSON.stringify(['complete_profile', { p_name: 'Jane Doe', p_phone: '+254700000000', p_consent: true }]));
  assert.equal(w.location.hash, '#home'); assert.match($('acct').textContent, /Hi, Jane/);

  // Autosave creates the site row, then updates it
  input($('name'), 'Alpha Trades'); click(d.querySelector('#tpls [data-t="gold"]')); click(d.querySelector('#bgs [data-b="radar"]'));
  await tick(1700);
  assert.equal(sb.db.sites.length, 1);
  let s = sb.db.sites[0];
  assert.equal(s.owner, USER.id); assert.equal(s.name, 'Alpha Trades'); assert.equal(s.template, 'gold'); assert.equal(s.background, 'radar');
  assert.equal(s.domain, 'alphatrades.site'); assert.equal(s.domain_mode, 'new'); assert.equal(s.markup, 1);
  assert.equal(s.status, 'draft', 'client never sets status');
  input(d.querySelector('#socs input[data-k="ig"]'), 'alpha_trades'); input($('dm'), '2.5');
  await tick(1700);
  assert.equal(JSON.stringify(s.social), JSON.stringify({ ig: 'alpha_trades' })); assert.equal(s.markup, 2.5);
  assert.equal(sb.db.sites.length, 1, 'updates, not a second insert');

  // Dashboard save validates and stores the Deriv details
  w.location.hash = '#dashboard'; await tick(50);
  input($('da'), '12ab'); click($('dsave')); await tick(50); assert.equal(s.deriv_app_id, undefined);
  input($('da'), '123456'); input($('dr'), 'https://track.example/ref'); click($('dsave')); await tick(100);
  assert.equal(s.deriv_app_id, '123456'); assert.equal(s.referral_url, 'https://track.example/ref');

  // Domain availability: taken blocks, free proceeds
  w.location.hash = '#home'; await tick(30);
  input($('dn'), 'taken'); await tick(1100);
  assert.ok($('dst').classList.contains('bad')); click($('reserve')); await tick(300);
  assert.equal(sb.calls.rpc.filter((c) => c[0] === 'create_order').length, 0, 'no order for a taken domain');
  input($('dn'), 'alphatrades'); await tick(1100); assert.ok($('dst').classList.contains('ok'));

  // Reserve -> server-priced order -> checkout page shows server totals
  click($('reserve')); await tick(1800);
  assert.equal(w.location.hash, '#checkout');
  assert.equal(sb.db.orders.length, 1); assert.equal($('sTot').textContent, '$208');
  // Pay: bad phone shows the server message; good phone starts M-Pesa and polling confirms it
  input($('pp'), '123'); click($('pay')); await tick(2200);
  assert.match($('pst').textContent, /valid Safaricom number/);
  input($('pp'), '0712345678'); click($('pay')); await tick(2200);
  const co = sb.calls.invoke.filter((c) => c[0] === 'checkout').pop();
  assert.equal(co[1].method, 'mpesa'); assert.equal(co[1].order_id, sb.db.orders.find((o) => o.status !== 'cancelled').id);
  assert.ok(!('amount' in co[1]) && !('total' in co[1]), 'browser never sends the price');
  await tick(3600);
  assert.match($('pst').textContent, /Payment received/);
  assert.equal(s.status, 'paid');
  // After payment the domain is no longer sent in saves
  input($('name'), 'Alpha Pro'); await tick(1700);
  assert.equal(s.name, 'Alpha Pro');
  // Dashboard shows setup progress
  w.location.hash = '#dashboard'; await tick(300);
  assert.match(d.querySelector('#p-dashboard .dgrid .stat .live').textContent, /Paid/);
  assert.equal($('tkl').children.length, 4);
  assert.deepEqual(errors, []);
});

test('backend mode: returning user gets their saved site loaded into the builder', async (t) => {
  const sb = fakeSupabase();
  sb.db.profiles.push({ id: USER.id, email: USER.email, full_name: 'Jane Doe', phone: '+254700000000' });
  sb.db.sites.push({ id: 's1', owner: USER.id, name: 'Saved Site', template: 'mint', background: 'heatmap', header: 'split', announcement: 'Hello', icon_shape: 'square', icon_place: 'footer',
    social: { tg: 'saved' }, menu: { ana: false }, bot_mode: 'none', embed_url: null, markup: 1.5, domain_mode: 'own', domain: 'mybrand.com', status: 'draft', deriv_app_id: '999', referral_url: null });
  const { w, d, $, errors } = boot({ sb }); t.after(() => w.close());
  await tick(200); sb.signInAs(USER); await tick(400);
  assert.equal(w.location.hash, '#home');
  assert.equal($('name').value, 'Saved Site'); assert.equal($('url').textContent, 'mybrand.com');
  assert.equal(d.querySelector('#tpls [data-t="mint"]').getAttribute('aria-pressed'), 'true');
  assert.equal(d.querySelector('#bgs [data-b="heatmap"]').getAttribute('aria-pressed'), 'true');
  assert.equal($('site').dataset.h, 'split'); assert.equal($('site').dataset.bg, 'heatmap');
  assert.equal(d.querySelector('#socs input[data-k="tg"]').value, 'saved');
  assert.equal(d.querySelector('#mnu input[data-m="ana"]').checked, false);
  assert.equal($('da').value, '999');
  assert.equal(sb.db.sites.length, 1, 'loading does not create a duplicate');
  await tick(1700); assert.equal(sb.db.sites[0].template, 'mint', 'loading does not overwrite the row');
  // Earnings page pads to 30 days with real data
  sb.db.commission_daily.push({ site_id: 's1', day: new Date().toISOString().slice(0, 10), contracts: 10, volume: 100, markup: 3.44 });
  w.location.hash = '#earnings'; await tick(300);
  assert.match($('ecs').textContent, /\$3\.44/); assert.ok(!/sample/i.test($('ecs').textContent));
  // Logout signs out of Supabase
  d.getElementById('lgo').dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await tick(100);
  assert.equal(sb.calls.signOut, 1);
  assert.deepEqual(errors.filter((e) => !/not implemented: navigation/i.test(e)), []);
});

test('tenant mode: a client domain shows only the live site, with working social links', async (t) => {
  const sb = fakeSupabase();
  sb.db.sites.push({ id: 's9', owner: 'u9', name: 'Zed Trades', template: 'ocean', background: 'waves', header: 'pill', announcement: 'Hi', icon_shape: 'round', icon_place: 'both',
    social: { ig: 'zedtrades' }, menu: {}, bot_mode: 'link', embed_url: null, markup: 2, domain_mode: 'new', domain: 'zedtrades.com', status: 'live', deriv_app_id: '777', referral_url: null });
  const { w, d, $, errors } = boot({ sb, url: 'https://zedtrades.com/', config: { APP_HOSTS: ['app.pipforge.test'] } });
  t.after(() => w.close());
  await tick(500);
  assert.ok(w.document.documentElement.classList.contains('tenant'));
  assert.equal(d.body.lastElementChild === $('site') || $('site').parentNode === d.body, true, 'site is a direct child of body');
  assert.equal($('sname').textContent, 'Zed Trades'); assert.equal(d.title, 'Zed Trades');
  assert.equal($('site').dataset.bg, 'waves'); assert.equal($('site').dataset.h, 'pill');
  // placeholder pages are hidden for visitors; working ones remain
  const tabs = [...d.querySelectorAll('#stabs .s-tab')].map((b) => b.dataset.tab);
  for (const k of ['ana', 'smt', 'aih', 'acc', 'man', 'blk', 'cht', 'cpy']) assert.ok(!tabs.includes(k), k + ' hidden');
  for (const k of ['home', 'bld', 'frb', 'tut', 'mkp']) assert.ok(tabs.includes(k), k + ' shown');
  // social links are not intercepted
  const a = d.querySelector('#sh a'); assert.match(a.href, /instagram\.com\/zedtrades/);
  const ev = new w.MouseEvent('click', { bubbles: true, cancelable: true }); a.dispatchEvent(ev);
  assert.equal(ev.defaultPrevented, false, 'link follows normally');
  // placeholders say so instead of faking it
  const load = d.querySelector('[data-load]'); const ev2 = new w.MouseEvent('click', { bubbles: true, cancelable: true }); load.dispatchEvent(ev2);
  assert.equal(ev2.defaultPrevented, true); assert.match($('toast').textContent, /coming soon/);
  assert.equal(sb.db.sites.length, 1, 'tenant mode never writes');
  assert.deepEqual(errors, []);
});

test('tenant mode: unknown or unpublished domain shows a plain not-live message', async (t) => {
  const sb = fakeSupabase();
  sb.db.sites.push({ id: 'd1', owner: 'u1', name: 'Draft', domain: 'draft.com', status: 'draft' });
  const { w, d, errors } = boot({ sb, url: 'https://draft.com/', config: { APP_HOSTS: ['app.pipforge.test'] } });
  t.after(() => w.close());
  await tick(400);
  assert.match(d.body.textContent, /draft\.com is not live yet/);
  assert.deepEqual(errors, []);
});

test('app host and missing APP_HOSTS both keep the builder app', async (t) => {
  const a = boot({ sb: fakeSupabase(), url: 'https://app.pipforge.test/', config: { APP_HOSTS: ['app.pipforge.test'] } });
  const b = boot({ sb: fakeSupabase(), url: 'https://anything.vercel.app/', config: {} });
  t.after(() => { a.w.close(); b.w.close(); });
  await tick(400);
  for (const x of [a, b]) { assert.ok(!x.d.documentElement.classList.contains('tenant')); assert.equal(x.w.location.hash, '#landing'); }
});
