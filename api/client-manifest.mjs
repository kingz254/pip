import { resolveSiteAuth } from '../scripts/site-auth-config.mjs';
function safeLogo(data) {
 if(typeof data!=='string')return null;
 const m=data.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
 if(!m)return null;
 const bytes=Buffer.from(m[2],'base64');
 if(bytes.toString('base64')!==m[2])return null;
 const valid=m[1]==='image/png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):
  m[1]==='image/jpeg'?bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255:
  bytes.length>=12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
 return valid?{type:m[1],bytes}:null;
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('Vary','Host');
 if(req.method!=='GET'){res.statusCode=405;res.end();return;}
 try{
 const config=await resolveSiteAuth(req.headers.host);const site=config?.site;
 if(!site){res.statusCode=404;res.end();return;}
 const icon=new URL(req.url,'https://local.test').searchParams.has('icon');
 if(icon){
 const logo=safeLogo(site.logo_data);
 res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");
 res.setHeader('Content-Type',logo?logo.type:'image/svg+xml');
 res.end(logo?logo.bytes:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" rx="36" fill="#18334b"/><text x="96" y="130" text-anchor="middle" font-family="sans-serif" font-size="110" fill="white">'+String(site.name||'T').slice(0,1).replace(/[^a-z0-9]/gi,'T')+'</text></svg>');return;
 }
 res.setHeader('Content-Type','application/manifest+json');res.end(JSON.stringify({id:'/',name:site.menu?.tagline?`${site.name} — ${String(site.menu.tagline).slice(0,80)}`:site.name,short_name:site.name,start_url:'/',scope:'/',display:'standalone',icons:[{src:'/api/client-manifest?icon=1',sizes:'any',purpose:'any'}]}));
 }catch{res.statusCode=503;res.end();}
}
