import { resolveSiteAuth } from '../scripts/site-auth-config.mjs';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('Vary','Host');
 if(req.method!=='GET'){res.statusCode=405;res.end();return;}
 try{
 const config=await resolveSiteAuth(req.headers.host);const site=config?.site;
 if(!site){res.statusCode=404;res.end();return;}
 const icon=new URL(req.url,'https://local.test').searchParams.has('icon');
 if(icon){
 const match=site.logo_data?.match(/^data:(image\/(?:png|jpeg|webp|svg\+xml));base64,([A-Za-z0-9+/=]+)$/);
 res.setHeader('Content-Security-Policy',"default-src 'none'; sandbox");
 res.setHeader('Content-Type',match?match[1]:'image/svg+xml');
 res.end(match?Buffer.from(match[2],'base64'):'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" rx="36" fill="#18334b"/><text x="96" y="130" text-anchor="middle" font-family="sans-serif" font-size="110" fill="white">'+String(site.name||'T').slice(0,1).replace(/[^a-z0-9]/gi,'T')+'</text></svg>');return;
 }
 res.setHeader('Content-Type','application/manifest+json');res.end(JSON.stringify({id:'/',name:site.menu?.tagline?`${site.name} — ${String(site.menu.tagline).slice(0,80)}`:site.name,short_name:site.name,start_url:'/',scope:'/',display:'standalone',icons:[{src:'/api/client-manifest?icon=1',sizes:'any',purpose:'any'}]}));
 }catch{res.statusCode=503;res.end();}
}
