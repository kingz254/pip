// Runs the real migration against an in-process Postgres (PGlite) and checks the security rules.
// Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const migration = readFileSync(new URL('../supabase/migrations/20261107000000_init.sql', import.meta.url), 'utf8');

// Minimal stand-in for Supabase's auth schema + roles.
const supabaseStub = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.role() returns text language sql stable as $$
    select nullif(current_setting('request.jwt.claim.role', true), '') $$;
  grant usage on schema public, auth to anon, authenticated, service_role;
  grant select on auth.users to authenticated, service_role;
  grant execute on function auth.uid(), auth.role() to anon, authenticated, service_role;
`;

const db = new PGlite();
await db.exec(supabaseStub);
await db.exec(migration);

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const ADMIN = '33333333-3333-3333-3333-333333333333';
await db.exec(`insert into auth.users(id,email) values ('${A}','a@gmail.com'),('${B}','b@gmail.com'),('${ADMIN}','admin@gmail.com');
               insert into public.admins values ('${ADMIN}');`);

// Run a statement as an API role. Returns {rows} or {error}.
async function as(role, uid, sql, params = []) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${uid ?? ''}',false), set_config('request.jwt.claim.role','${role}',false);`);
  try { return { rows: (await db.query(sql, params)).rows }; }
  catch (e) { return { error: e.message, code: e.code }; }
  finally { await db.exec('reset role'); }
}
const ok = (r, m) => assert.ok(!r.error, `${m}: ${r.error}`);
const denied = (r, m) => assert.ok(r.error, `${m}: expected an error but it succeeded`);

test('signup creates a profile automatically', async () => {
  const r = await as('authenticated', A, 'select email, full_name from public.profiles');
  ok(r, 'select'); assert.equal(r.rows.length, 1); assert.equal(r.rows[0].email, 'a@gmail.com');
});

test('profiles: users see only their own row and cannot write directly', async () => {
  const r = await as('authenticated', B, 'select id from public.profiles');
  assert.deepEqual(r.rows.map(x => x.id), [B]);
  denied(await as('authenticated', A, `update public.profiles set full_name='Hacker' where id='${A}'`), 'direct update');
  denied(await as('authenticated', A, `update public.profiles set consent_at=now() where id='${A}'`), 'direct consent');
});

test('complete_profile validates name, phone and consent', async () => {
  denied(await as('authenticated', A, `select public.complete_profile('A','+254700000000',true)`), 'short name');
  denied(await as('authenticated', A, `select public.complete_profile('Jane Doe','12345',true)`), 'short phone');
  denied(await as('authenticated', A, `select public.complete_profile('Jane Doe','+254700000000',false)`), 'no consent');
  denied(await as('anon', null, `select public.complete_profile('Jane Doe','+254700000000',true)`), 'anon');
  const r = await as('authenticated', A, `select * from public.complete_profile('  Jane Doe ','+254 700-000-000',true)`);
  ok(r, 'valid'); assert.equal(r.rows[0].full_name, 'Jane Doe'); assert.equal(r.rows[0].phone, '+254700000000'); assert.ok(r.rows[0].consent_at);
  const again = await as('authenticated', A, `select * from public.complete_profile('Jane D','+254711111111',true)`);
  ok(again, 'second call'); assert.deepEqual(again.rows[0].consent_at, r.rows[0].consent_at, 'consent time is kept');
});

test('pricing is readable by everyone; only service role may change it', async () => {
  const r = await as('anon', null, `select usd from public.pricing where key='setup'`);
  assert.equal(Number(r.rows[0].usd), 200);
  denied(await as('authenticated', A, `update public.pricing set usd=1 where key='setup'`), 'client price change');
  denied(await as('anon', null, `insert into public.tld_prices(tld,usd) values ('.free',0)`), 'client tld insert');
});

test('sites: validation, isolation and protected columns', async () => {
  ok(await as('authenticated', A, `insert into public.sites(owner,name,domain) values ('${A}','Alpha','alpha.com')`), 'insert A');
  ok(await as('authenticated', B, `insert into public.sites(owner,name,domain) values ('${B}','Beta','beta.net')`), 'insert B');
  denied(await as('authenticated', A, `insert into public.sites(owner) values ('${B}')`), 'insert as someone else');
  denied(await as('authenticated', A, `insert into public.sites(owner) values ('${A}')`), 'second site for same owner');
  denied(await as('authenticated', B, `insert into public.sites(owner,status) values ('${B}','live')`), 'insert with status');
  const mine = await as('authenticated', A, 'select name from public.sites');
  assert.deepEqual(mine.rows.map(x => x.name), ['Alpha']);
  denied(await as('anon', null, 'select * from public.sites'), 'anon select');
  denied(await as('authenticated', A, `update public.sites set template='nope' where owner='${A}'`), 'bad template');
  denied(await as('authenticated', A, `update public.sites set markup=5 where owner='${A}'`), 'markup above 3');
  denied(await as('authenticated', A, `update public.sites set markup=-1 where owner='${A}'`), 'negative markup');
  denied(await as('authenticated', A, `update public.sites set deriv_app_id='12ab' where owner='${A}'`), 'app id letters');
  denied(await as('authenticated', A, `update public.sites set embed_url='javascript:alert(1)' where owner='${A}'`), 'embed js url');
  denied(await as('authenticated', A, `update public.sites set domain='Not A Domain' where owner='${A}'`), 'bad domain');
  denied(await as('authenticated', A, `update public.sites set status='live' where owner='${A}'`), 'self-promote to live');
  denied(await as('authenticated', A, `update public.sites set owner='${B}' where owner='${A}'`), 'change owner');
  const other = await as('authenticated', A, `update public.sites set name='Pwned' where owner='${B}' returning id`);
  assert.equal(other.rows.length, 0, 'cannot touch another site');
  ok(await as('authenticated', A, `update public.sites set template='gold', background='radar', markup=2.5, social='{"ig":"alpha"}', menu='{"ana":false}' where owner='${A}'`), 'valid update');
});

test('create_order prices on the server', async () => {
  const sid = (await db.query(`select id from public.sites where owner='${A}'`)).rows[0].id;
  const o = await as('authenticated', A, 'select * from public.create_order($1)', [sid]);
  ok(o, 'order'); const row = o.rows[0];
  assert.equal(Number(row.setup_usd), 200); assert.equal(Number(row.domain_usd), 15); assert.equal(Number(row.total_usd), 215);
  assert.equal((await db.query(`select status from public.sites where owner='${A}'`)).rows[0].status, 'pending_payment');
  denied(await as('authenticated', A, `insert into public.orders(owner,site_id,domain,domain_mode,setup_usd,total_usd) values ('${A}','${sid}','alpha.com','new',1,1)`), 'client inserts order');
  denied(await as('authenticated', B, 'select * from public.create_order($1)', [sid]), "order another person's site");
  denied(await as('anon', null, 'select * from public.create_order($1)', [sid]), 'anon order');
  const again = await as('authenticated', A, 'select * from public.create_order($1)', [sid]);
  ok(again, 'second order'); assert.notEqual(again.rows[0].id, row.id);
  assert.equal((await db.query(`select status from public.orders where id='${row.id}'`)).rows[0].status, 'cancelled');
  assert.equal((await as('authenticated', B, 'select id from public.orders')).rows.length, 0, 'B sees none of As orders');
});

test('own-domain orders charge the connection fee, not a domain fee', async () => {
  await db.exec(`update public.sites set domain_mode='own', domain='mybrand.com' where owner='${B}'`);
  const sid = (await db.query(`select id from public.sites where owner='${B}'`)).rows[0].id;
  const o = await as('authenticated', B, 'select * from public.create_order($1)', [sid]);
  ok(o, 'own order'); assert.equal(Number(o.rows[0].connection_usd), 10); assert.equal(Number(o.rows[0].domain_usd), 0); assert.equal(Number(o.rows[0].total_usd), 210);
});

test('unsupported endings and domain clashes are refused', async () => {
  const sid = (await db.query(`select id from public.sites where owner='${B}'`)).rows[0].id;
  await db.exec(`update public.sites set status='draft' where owner='${B}'`);
  await db.exec(`update public.sites set domain_mode='new', domain='beta.zzz' where owner='${B}'`);
  denied(await as('authenticated', B, 'select * from public.create_order($1)', [sid]), 'unsupported ending');
  await db.exec(`update public.sites set domain='alpha.com' where owner='${B}'`);   // A already claimed alpha.com
  const clash = await as('authenticated', B, 'select * from public.create_order($1)', [sid]);
  denied(clash, 'domain claimed by another client'); assert.match(clash.error, /already taken/);
  await db.exec(`update public.sites set domain='beta.net' where owner='${B}'`);
});

test('payment confirmation is service-role only, idempotent, and creates fulfilment tasks', async () => {
  const o = (await db.query(`select id from public.orders where owner='${A}' and status='pending'`)).rows[0].id;
  denied(await as('authenticated', A, `select public.mark_order_paid('${o}','mpesa','ws_1','X')`), 'client marks paid');
  denied(await as('anon', null, `select public.mark_order_paid('${o}','mpesa','ws_1','X')`), 'anon marks paid');
  await db.exec(`insert into public.payments(order_id,provider,provider_ref,amount_minor,currency) values ('${o}','mpesa','ws_1',27950,'KES')`);
  await db.exec('set role service_role');
  const paid = (await db.query(`select * from public.mark_order_paid('${o}','mpesa','ws_1','QWE123')`)).rows[0];
  const paid2 = (await db.query(`select * from public.mark_order_paid('${o}','mpesa','ws_1','QWE123')`)).rows[0];
  await db.exec('reset role');
  assert.equal(paid.status, 'paid'); assert.deepEqual(paid2.paid_at, paid.paid_at);
  assert.equal((await db.query(`select count(*)::int n from public.fulfilment_tasks where order_id='${o}'`)).rows[0].n, 4, 'four tasks for a new domain');
  assert.equal((await db.query(`select status, receipt from public.payments where provider_ref='ws_1'`)).rows[0].status, 'succeeded');
  assert.equal((await db.query(`select status from public.sites where owner='${A}'`)).rows[0].status, 'paid');
});

test('after payment the domain is locked for the client', async () => {
  denied(await as('authenticated', A, `update public.sites set domain='other.com' where owner='${A}'`), 'domain change after paid');
  ok(await as('authenticated', A, `update public.sites set name='Alpha 2' where owner='${A}'`), 'design edits still allowed');
});

test('fulfilment: only admins complete tasks; site goes live after the last one', async () => {
  const tasks = (await db.query(`select id from public.fulfilment_tasks order by task`)).rows.map(r => r.id);
  denied(await as('authenticated', A, 'select public.admin_complete_task($1)', [tasks[0]]), 'client completes task');
  assert.equal((await as('authenticated', A, 'select id from public.fulfilment_tasks')).rows.length, 4, 'client can see their tasks');
  assert.equal((await as('authenticated', B, 'select id from public.fulfilment_tasks')).rows.length, 0, 'other client cannot');
  for (const [i, t] of tasks.entries()) {
    ok(await as('authenticated', ADMIN, 'select public.admin_complete_task($1,$2)', [t, 'done by test']), 'admin task');
    const st = (await db.query(`select status from public.sites where owner='${A}'`)).rows[0].status;
    assert.equal(st, i === tasks.length - 1 ? 'live' : 'provisioning');
  }
});

test('public_site exposes only live sites and no private fields', async () => {
  const live = await as('anon', null, `select public.public_site('ALPHA.com') as s`);
  const s = live.rows[0].s;
  assert.equal(s.name, 'Alpha 2'); assert.equal(s.template, 'gold'); assert.equal(Number(s.markup), 2.5);
  for (const k of ['owner', 'id', 'status', 'email', 'phone']) assert.ok(!(k in s), `${k} must not leak`);
  assert.equal((await as('anon', null, `select public.public_site('beta.net') as s`)).rows[0].s, null, 'draft sites are hidden');
  assert.equal((await as('anon', null, `select public.public_site('nothere.com') as s`)).rows[0].s, null);
});

test('commission rows are visible only to the site owner', async () => {
  const sid = (await db.query(`select id from public.sites where owner='${A}'`)).rows[0].id;
  await db.exec(`insert into public.commission_daily(site_id,day,contracts,volume,markup) values ('${sid}',current_date,10,100,3.44)`);
  assert.equal((await as('authenticated', A, 'select * from public.commission_daily')).rows.length, 1);
  assert.equal((await as('authenticated', B, 'select * from public.commission_daily')).rows.length, 0);
  denied(await as('authenticated', A, `insert into public.commission_daily(site_id,day,markup) values ('${sid}',current_date-1,999)`), 'client writes earnings');
});

test('draft sites can be deleted by the owner; sites with orders cannot', async () => {
  const C = '44444444-4444-4444-4444-444444444444';
  await db.exec(`insert into auth.users(id,email) values ('${C}','c@gmail.com')`);
  ok(await as('authenticated', C, `insert into public.sites(owner) values ('${C}')`), 'insert C');
  const d = await as('authenticated', C, `delete from public.sites where owner='${C}' returning id`);
  ok(d, 'delete draft'); assert.equal(d.rows.length, 1);
  const paid = await as('authenticated', A, `delete from public.sites where owner='${A}' returning id`);
  assert.ok(paid.error || paid.rows.length === 0, 'a paid site cannot be deleted by the client');
});
