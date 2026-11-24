import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM, VirtualConsole } from 'jsdom';
import { readFileSync } from 'node:fs';
import { fakeSupabase } from './helpers/fakeSupabase.mjs';
import { tick } from './helpers/boot.mjs';

const html = readFileSync(new URL('../public/kingori.html', import.meta.url), 'utf8');
function open(sb) {
  const errors = []; const vc = new VirtualConsole(); vc.on('jsdomError', (e) => errors.push(String(e.message)));
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://admin.test/', virtualConsole: vc, beforeParse(w) { w.PF_SB = sb; w.PF_CONFIG = { SUPABASE_URL: 'x' }; } });
  return { w: dom.window, d: dom.window.document, errors };
}
function seed(sb) {
  sb.db.sites.push({ id: 's1', owner: 'u1', name: 'Alpha', domain: 'alpha.com', domain_mode: 'new', status: 'paid', deriv_app_id: 'client-app-123' });
  sb.db.orders.push({ id: 'o1', total_usd: 215 });
  sb.db.profiles.push({ id: 'u1', email: 'jane@gmail.com', full_name: '<img src=x onerror=alert(1)>', phone: '+254700000000' });
  for (const task of ['register_domain', 'connect_dns', 'issue_ssl', 'go_live']) sb.db.fulfilment_tasks.push({ id: 't-' + task, site_id: 's1', order_id: 'o1', task, status: 'todo' });
}

test('non-admin accounts see nothing', async () => {
  const sb = fakeSupabase(); seed(sb); sb.signInAs({ id: 'u2', email: 'x@gmail.com' });
  const { w, d, errors } = open(sb); await tick(150);
  assert.match(d.getElementById('msg').textContent, /not an admin/); assert.equal(d.querySelectorAll('.card').length, 0); assert.deepEqual(errors, []);
  w.close();
});

test('admin sees the queue, client details are text not HTML, and finishing the last task makes the site live', async () => {
  const sb = fakeSupabase(); seed(sb); sb.setAdmin(true); sb.signInAs({ id: 'admin', email: 'a@gmail.com' });
  sb.db.sites[0].status = 'live';
  sb.db.site_visits.push({ site_id: 's1', day: new Date().toISOString().slice(0, 10), views: 7 });
  const { w, d, errors } = open(sb); await tick(200);
  assert.equal(d.querySelectorAll('#list .card').length, 1);
  assert.equal(d.querySelector('#list .card h2').textContent, 'alpha.com');
  assert.ok(d.querySelector('#list .card .muted').textContent.includes('<img src=x'), 'shown literally');
  assert.equal(d.querySelector('.card img'), null, 'no injected element');
  assert.equal(d.querySelectorAll('#clients .card').length, 1);
  assert.ok(d.querySelector('#clients').textContent.includes('jane@gmail.com'));
  assert.equal(d.querySelector('#clients a[href="mailto:jane@gmail.com"]').textContent, 'jane@gmail.com');
  assert.equal(d.querySelector('#clients a[href="tel:+254700000000"]').textContent, '+254700000000');
  assert.ok(d.querySelector('#clients').textContent.includes('Deriv App ID: client-app-123'));
  d.querySelector('#clients textarea').value = 'A | @ | 76.76.21.21 | 60';
  w.confirm = () => true;
  d.querySelector('#clients button').click(); await tick(40);
  const dnsCall = sb.calls.invoke.find(([name]) => name === 'send-domain-dns');
  assert.equal(dnsCall[1].site_id, 's1');
  assert.equal(dnsCall[1].dns_records, 'A | @ | 76.76.21.21 | 60');
  assert.equal(d.querySelector('#clients textarea').value, '');
  assert.match(d.querySelector('#visits').textContent, /7 views/);
  for (let i = 0; i < 4; i++) {
    const btn = d.querySelector('.task button'); assert.ok(btn, 'task ' + i); btn.click(); await tick(120);
    assert.equal(sb.db.sites[0].status, i === 3 ? 'live' : 'provisioning');
  }
  assert.equal(d.querySelectorAll('.task.done').length, 4);
  w.close(); assert.deepEqual(errors, []);
});

