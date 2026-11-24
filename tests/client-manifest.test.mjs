import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/client-manifest.mjs';
test('install manifest and icon use only the resolved tenant branding',async()=>{
 const before={url:process.env.SUPABASE_URL,key:process.env.SUPABASE_SERVICE_ROLE_KEY,fetch:globalThis.fetch};
 process.env.SUPABASE_URL='https://database.test';process.env.SUPABASE_SERVICE_ROLE_KEY='fixture';
 const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.from('fixture')]);let logoData=`data:image/png;base64,${png.toString('base64')}`;
 globalThis.fetch=async()=>Response.json({domain:'brand.test',name:'Brand Trades',deriv_app_id:'fixture',logo_data:logoData,menu:{tagline:'My trading desk'}});
 const send=async(url)=>{const response={headers:{},setHeader(k,v){this.headers[k]=v},end(value){this.body=value}};await handler({method:'GET',url,headers:{host:'brand.test'}},response);return response};
 try{const res=await send('/api/client-manifest');const manifest=JSON.parse(res.body);assert.equal(manifest.name,'Brand Trades — My trading desk');assert.equal(manifest.icons[0].src,'/api/client-manifest?icon=1');let icon=await send('/api/client-manifest?icon=1');assert.equal(icon.headers['Content-Type'],'image/png');assert.deepEqual(icon.body,png);logoData='data:image/png;base64,PHN2ZyBvbmxvYWQ9YWxlcnQoMSk+';icon=await send('/api/client-manifest?icon=1');assert.equal(icon.headers['Content-Type'],'image/svg+xml');assert.match(icon.body.toString(),/<svg/);logoData='data:image/svg+xml;base64,PHN2Zy8+';icon=await send('/api/client-manifest?icon=1');assert.equal(icon.headers['Content-Type'],'image/svg+xml');assert.match(icon.body.toString(),/<svg/);assert.equal(res.headers['Cache-Control'],'no-store');}
 finally{globalThis.fetch=before.fetch;for(const [key,value] of [['SUPABASE_URL',before.url],['SUPABASE_SERVICE_ROLE_KEY',before.key]]){if(value===undefined)delete process.env[key];else process.env[key]=value}}
});
