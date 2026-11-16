import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createCredentialStore } from '../scripts/credential-store.mjs';
import { resolveSiteAuth } from '../scripts/site-auth-config.mjs';

test('durable credentials are encrypted and one-time transactions are consumed atomically',async()=>{
  const rows=new Map();let transmitted='';
  const upstream=async(url,init)=>{
    const id=new URL(url).searchParams.get('id')?.replace('eq.','');
    if(init.method==='POST'){const row=JSON.parse(init.body);transmitted=init.body;rows.set(row.id,row);return new Response(null,{status:204});}
    const row=rows.get(id);
    if(init.method==='DELETE')rows.delete(id);
    return Response.json(row?[row]:[]);
  };
  const options={url:'https://fixture.supabase.co',serviceKey:'fixture-service-key',encryptionKey:randomBytes(32).toString('base64'),upstream};
  const a=createCredentialStore(options),b=createCredentialStore(options);
  await a.set('https://one.test','transaction','fixture-id',{token:'fixture-private',expires:Date.now()+10000});
  assert.ok(!transmitted.includes('fixture-private'));
  assert.equal((await b.get('https://one.test','transaction','fixture-id')).token,'fixture-private');
  assert.equal(await b.get('https://other.test','transaction','fixture-id'),undefined);
  assert.equal((await b.take('https://one.test','transaction','fixture-id')).token,'fixture-private');
  assert.equal(await a.take('https://one.test','transaction','fixture-id'),undefined);
  await a.set('https://one.test','session','session-id',{token:'fixture-private',expires:Date.now()+10000});
  const row=[...rows.values()][0];row.payload=Buffer.from('tampered').toString('base64');
  await assert.rejects(()=>b.get('https://one.test','session','session-id'));
});

test('customer OAuth client comes from a live tenant record, never a request parameter',async()=>{
  const env={APP_ORIGIN:'https://pip-coral-seven.vercel.app',DERIV_CLIENT_ID:'owner-client',DERIV_REDIRECT_URI:'https://pip-coral-seven.vercel.app/api/deriv/callback',SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'fixture'};
  assert.equal((await resolveSiteAuth('pip-coral-seven.vercel.app',env)).clientId,'owner-client');
  const request=async()=>Response.json({domain:'customer.test',deriv_app_id:'customer-client'});
  const tenant=await resolveSiteAuth('customer.test',env,request);
  assert.equal(tenant.clientId,'customer-client');assert.equal(tenant.redirectUri,'https://customer.test/api/deriv/callback');
  assert.equal(await resolveSiteAuth('unregistered.test',env,request),null);
});
