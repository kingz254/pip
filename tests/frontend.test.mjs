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
  assert.equal(d.querySelectorAll('#tpls .tpl').length, 45);
  assert.equal(d.querySelectorAll('#bgs .chip').length, 37);
  assert.equal(d.querySelector('#bgs .bg-choice-group:last-child .chip:last-child').dataset.b, 'none', 'no background is the final choice');
  for (const id of ['img-chart','img-mesh','img-grid','img-watercolor','img-trade-1','img-trade-2','img-trade-3','img-trade-4','img-trade-5','img-trade-6','img-trade-7','img-trade-8','img-trade-9','img-botanical','img-art-nouveau','waves','bars','ticker','trend','spiral','spark','gauge','ticks','pulsegrid','matrix','radar','heatmap','comet','aurora','auroraVeil','starlight']) assert.equal(d.querySelector(`#bgs [data-b="${id}"]`), null, `removed background ${id}`);
  for (const group of d.querySelectorAll('#bgs .bg-choice-group')) {
    const names = [...group.querySelectorAll('.chip')].map((button) => button.textContent);
    assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)), 'background choices are alphabetical within each group');
  }
  const themeNames = [...d.querySelectorAll('#tpls .tpl b')].map((button) => button.textContent);
  assert.deepEqual(themeNames, [...themeNames].sort((a, b) => a.localeCompare(b)), 'themes are alphabetical');
  assert.equal(d.querySelectorAll('#tpls [data-t^="market-"]').length, 10, 'restored market palettes are selectable');
  for (const id of ['digits','moneyrain','network','motion-breeze','motion-candlelight','motion-cloud-drift','motion-dusk-bloom','motion-ink-wash','motion-koi-glide','motion-prism-shift','motion-silk-current','motion-slow-orbit','motion-tidal-glass','img-bougainvillea','img-checker-weave','img-cloudbank','img-ceramic','img-fan-palm','img-marbled-stone','img-moon-phase','img-origami','img-sunprint','img-tulip']) assert.ok(d.querySelector(`#bgs [data-b="${id}"]`), `retained background ${id}`);
  for (const id of ['dock-arc','dock-capsule','dock-frost','dock-island','dock-orbit','dock-shelf','dock-soft','dock-spring','dock-stacked','dock-underline']) assert.ok(d.querySelector(`#hds [data-v="${id}"]`), `header choice ${id}`);
  const fontCards = [...d.querySelectorAll('#font-options .font-card')];
  assert.equal(fontCards.length, 15);
  assert.equal(new Set(fontCards.map((card) => card.dataset.font)).size, 15, 'font choices are distinct');
  assert.ok(fontCards.every((card) => card.querySelector('.font-sample')?.textContent.includes('Aa Bb 123')));
  assert.deepEqual(fontCards.map((card) => card.querySelector('b').textContent), fontCards.map((card) => card.querySelector('b').textContent).sort((a, b) => a.localeCompare(b)), 'fonts are alphabetical');
  const headerNames = [...d.querySelectorAll('#hds .chip')].map((button) => button.textContent);
  assert.deepEqual(headerNames, [...headerNames].sort((a, b) => a.localeCompare(b)), 'header styles are alphabetical');
  assert.equal(d.querySelector('#font-options').closest('.font-control').querySelector('.lab').textContent, '15 distinct typefaces');
  assert.equal(d.querySelector('[data-tab="typ"]').textContent, 'Fonts');
  assert.equal(d.querySelector('#blur-amount').textContent, '75%');
  input($('blur-range'), '82');
  assert.equal(d.querySelector('#blur-amount').textContent, '82%', 'blur percentage follows the slider in real time');
  assert.equal($('site').style.getPropertyValue('--pf-client-blur'), '19.68px', 'preview blur follows slider value');
  for (const b of d.querySelectorAll('#bgs .chip')) click(b);
  for (const t of d.querySelectorAll('#tpls .tpl')) click(t);
  input($('name'), 'Alpha Trades'); assert.equal($('url').textContent, 'alphatrades.site');
  click(d.querySelector('#dmm button')); input($('dow'), 'https://www.MyBrand.com/x');
  assert.equal($('url').textContent, 'mybrand.com'); assert.match($('p-pricing').textContent, /\$200/); assert.doesNotMatch($('p-pricing').textContent, /Domain, per year/i);
  assert.deepEqual(errors, []);
});

test('demo mode: social links reject unsafe values', async (t) => {
  const { w, d, $, click, input, errors } = boot(); t.after(() => w.close());
  await tick(200);
  assert.equal(d.querySelectorAll('#socs .soc-field svg').length, 10, 'every social input has its platform icon');
  click($('gsi')); input($('ge'), 'x@gmail.com'); click($('gct')); input($('gn'), 'Xx Test'); input($('gp'), '0700000001'); $('gc').checked = true; click($('gdo')); await tick(50);
  for (const k of ['ig', 'x', 'ml', 'wa', 'tg']) input(d.querySelector(`#socs input[data-k="${k}"]`), 'javascript:alert(1)');
  const hrefs = [...d.querySelectorAll('#sh a')].map((a) => a.getAttribute('href'));
  assert.ok(hrefs.every((h) => /^(https:\/\/|mailto:)/.test(h)), hrefs.join(','));
  assert.deepEqual(errors, []);
});

test('backend mode: sign in, profile, autosave, domain check, order, USDT payment review, status', async (t) => {
  const sb = fakeSupabase({ domainStatus: (dm) => dm === 'taken.site' ? 'taken' : dm === 'uncertain.site' ? 'unknown' : dm.endsWith('.co.ke') ? 'manual' : 'free' });
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
  input($('name'), 'Alpha Trades'); click(d.querySelector('#tpls [data-t="gold"]')); click(d.querySelector('#bgs [data-b="candles"]'));
  await tick(1700);
  assert.equal(sb.db.sites.length, 1);
  let s = sb.db.sites[0];
  assert.equal(s.owner, USER.id); assert.equal(s.name, 'Alpha Trades'); assert.equal(s.template, 'gold'); assert.equal(s.background, 'candles');
  assert.equal(s.domain, 'alphatrades.site'); assert.equal(s.domain_mode, 'new'); assert.equal(s.markup, 1);
  assert.equal(s.status, 'draft', 'client never sets status');
  assert.equal($('dm'), null, 'markup is configured in Deriv, not Pipforge');
  input(d.querySelector('#socs input[data-k="ig"]'), 'alpha_trades');
  await tick(1700);
  assert.equal(JSON.stringify(s.social), JSON.stringify({ ig: 'alpha_trades' })); assert.equal(s.markup, 1);
  assert.equal(sb.db.sites.length, 1, 'updates, not a second insert');

  // Dashboard save validates and stores the Deriv details
  w.location.hash = '#dashboard'; await tick(50);
  input($('da'), '12 ab'); click($('dsave')); await tick(50); assert.equal(s.deriv_app_id, undefined);
  input($('da'), '123456'); input($('dr'), 'https://track.example/ref'); click($('dsave')); await tick(100);
  assert.equal(s.deriv_app_id, '123456'); assert.equal(s.referral_url, 'https://track.example/ref');

  // Domain availability: taken blocks, free proceeds
  w.location.hash = '#home'; await tick(30);
  assert.equal($('dchk').textContent, 'Check availability');
  input($('dn'), 'taken'); click($('dchk')); await tick(1100);
  assert.ok($('dst').classList.contains('bad')); click($('reserve')); await tick(300);
  assert.equal(sb.calls.rpc.filter((c) => c[0] === 'create_order').length, 0, 'no order for a taken domain');
  input($('dn'), 'alphatrades'); click($('dchk')); await tick(1100); assert.ok($('dst').classList.contains('ok'));
  assert.match(d.querySelector('#registrar-buy').href, /^https:\/\/www\.namecheap\.com\/domains\/registration\/results\.aspx\?domain=alphatrades\.site$/);
  assert.equal(d.querySelector('#registrar-buy').textContent, 'Buy now');
  assert.equal($('dchk'), null, 'availability action becomes the purchase action after a free result');
  assert.match($('dsg').textContent, /return and enter/i);
  input($('dn'), 'uncertain'); click($('dchk')); await tick(1100);
  assert.match($('dst').textContent, /could not verify/i); assert.equal($('dchk').textContent, 'Check availability'); assert.equal($('registrar-buy'), null);
  input($('dn'), 'alphatrades'); click($('dchk')); await tick(1100);

  // The customer buys the new domain directly, then returns to connect a domain they own.
  click(d.querySelector('#dmm button')); input($('dow'), 'alpha-trades.com');

  // Reserve -> server-priced order -> checkout page shows server totals
  click($('reserve')); await tick(1800);
  assert.equal(w.location.hash, '#checkout');
  assert.equal(sb.db.orders.length, 1); assert.equal($('sTot').textContent, '$200');
  assert.equal(d.querySelectorAll('#pm .payment-option').length, 3);
  assert.equal(d.querySelectorAll('#pm .payment-option svg').length, 3);
  assert.match($('pm').textContent, /USDT[\s\S]*TRC20[\s\S]*Card[\s\S]*Coming soon[\s\S]*M-Pesa[\s\S]*Coming soon/);
  // Show the configured TRC20 invoice, submit the transaction ID, then wait for admin verification.
  click($('pay')); await tick(20);
  assert.equal($('crypto-amount').textContent, '200.00 USDT');
  assert.equal($('crypto-address').textContent, 'TRZPJcgHgm4d6v864CwAa4AogMog6RWuHY');
  const txid = 'a'.repeat(64); input($('crypto-txid'), txid); click($('crypto-submit')); await tick(30);
  const submitted = sb.calls.rpc.find((c) => c[0] === 'submit_crypto_payment');
  assert.equal(submitted[1].p_order, sb.db.orders.find((o) => o.status !== 'cancelled').id);
  assert.equal(submitted[1].p_txid, txid);
  await tick(3600);
  assert.match($('pst').textContent, /Payment received/);
  assert.equal(s.status, 'paid');
  // After payment design changes require an explicit confirmation before saving.
  input($('name'), 'Alpha Pro'); await tick(1300);
  w.confirm = () => true;
  click(d.querySelector('[data-confirm-design]')); await tick(300);
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
  assert.equal($('site').dataset.bg, 'heatmap', 'legacy saved backgrounds still render even though they are no longer offered for new choices');
  assert.equal($('site').dataset.h, 'split'); assert.equal($('site').dataset.bg, 'heatmap');
  assert.equal(d.querySelector('#socs input[data-k="tg"]').value, 'saved');
  assert.equal(d.querySelector('#mnu input[data-m="id-analysis-tool"]').checked, false);
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
  assert.ok(sb.calls.rpc.some(([name, args]) => name === 'record_public_site_visit' && args.p_domain === 'zedtrades.com'), 'live tenant page records a visit');
  assert.equal(d.body.lastElementChild === $('site') || $('site').parentNode === d.body, true, 'site is a direct child of body');
  assert.equal($('sname').textContent, 'Zed Trades'); assert.equal(d.title, 'Zed Trades');
  assert.equal($('site').dataset.bg, 'waves'); assert.equal($('site').dataset.h, 'dock');
  // Legacy header values are normalized, and workspace sections remain available.
  const tabs = [...d.querySelectorAll('#stabs .s-tab')].map((b) => b.dataset.tab);
  for (const k of ['home', 'bld', 'ana', 'smt', 'aih', 'acc', 'man', 'blk', 'cht', 'cpy', 'frb']) assert.ok(tabs.includes(k), k + ' shown');
  assert.ok(!tabs.includes('mkp'), 'markup is configured in the customer’s Deriv app');
  // social links are not intercepted
  const a = d.querySelector('#sh a'); assert.match(a.href, /instagram\.com\/zedtrades/);
  const ev = new w.MouseEvent('click', { bubbles: true, cancelable: true }); a.dispatchEvent(ev);
  assert.equal(ev.defaultPrevented, false, 'link follows normally');
  // Tenant support routes visitors to the workspace guides.
  const help = d.querySelector('[data-fab="help"]'); const ev2 = new w.MouseEvent('click', { bubbles: true, cancelable: true }); help.dispatchEvent(ev2);
  assert.equal(ev2.defaultPrevented, true); assert.match($('toast').textContent, /Workspace guides/);
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
  const c = boot({ sb: fakeSupabase(), url: 'https://www.app.pipforge.test/', config: { APP_HOSTS: ['app.pipforge.test'] } });
  t.after(() => { a.w.close(); b.w.close(); c.w.close(); });
  await tick(400);
  for (const x of [a, b, c]) { assert.ok(!x.d.documentElement.classList.contains('tenant')); assert.equal(x.w.location.hash, '#landing'); }
});
