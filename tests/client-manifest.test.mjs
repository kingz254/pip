import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/client-manifest.mjs';
test('install manifest and icon use only the resolved tenant branding',async()=>{
 const before={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY,fetch:globalThis.fetch};
 process.env.SUPABASE_URL='https://database.test';process.env.SUPABASE_SERVICE_ROLE_KEY='fixture';
 globalThis.fetch=async()=>Response.json({domain:'brand.test',name:'Brand Trades',deriv_app_id:'fixture',logo_data:'data:image/png;base64,aGVsbG8=',menu:{tagline:'My trading desk'}});
 const send=async(url)=>{const response={headers:{},setHeader(k,v){this.headers[k]=v},end(value){this.body=value}};await handler({method:'GET',url,headers:{host:'brand.test'}},response);return response};
 try{const res=await send('/api/client-manifest');const manifest=JSON.parse(res.body);assert.equal(manifest.name,'Brand Trades — My trading desk');assert.equal(manifest.icons[0].src,'/api/client-manifest?icon=1');const icon=await send('/api/client-manifest?icon=1');assert.equal(icon.headers['Content-Type'],'image/png');assert.equal(icon.body.toString(),'hello');assert.equal(res.headers['Cache-Control'],'no-store');}
 finally{globalThis.fetch=before.fetch;for(const [key,value] of [['SUPABASE_URL',before.url],['SUPABASE_SERVICE_ROLE_KEY',before.key]]){if(value===undefined)delete process.env[key];else process.env[key]=value}}
});
