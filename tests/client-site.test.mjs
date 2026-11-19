import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/client-site.mjs';

test('published runtime receives public settings only and retains visit reporting', async t=>{
  const keys=['APP_ORIGIN','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY'];
  const before=Object.fromEntries(keys.map(k=>[k,process.env[k]])),original=globalThis.fetch;
  t.after(()=>{globalThis.fetch=original;for(const k of keys){if(before[k]===undefined)delete process.env[k];else process.env[k]=before[k]}});
  Object.assign(process.env,{APP_ORIGIN:'https://builder.example',SUPABASE_URL:'https://db.example',SUPABASE_SERVICE_ROLE_KEY:'test-server-only'});
  const calls=[];
  globalThis.fetch=async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify(url.endsWith('/public_site')?{domain:'customer.example',deriv_app_id:'client_1',name:'Acme',template:'violet',secret:'private'}:{}),{status:200})};
  let body;const headers={};const res={setHeader:(k,v)=>headers[k]=v,end:value=>body=value};
  await handler({method:'GET',headers:{host:'customer.example'}},res);
  assert.equal(JSON.parse(body).name,'Acme');assert.equal(JSON.parse(body).secret,undefined);
  assert.equal(headers['Cache-Control'],'no-store');
  assert.ok(calls[1].url.endsWith('/record_public_site_visit'));
  assert.deepEqual(JSON.parse(calls[1].options.body),{p_domain:'customer.example'});
});
