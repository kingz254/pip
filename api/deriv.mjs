import { createDerivAuth } from '../scripts/deriv-auth.mjs';
import { createCredentialStore } from '../scripts/credential-store.mjs';
import { resolveSiteAuth } from '../scripts/site-auth-config.mjs';

export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  try {
    const config=await resolveSiteAuth(req.headers.host);
    if(!config){res.statusCode=403;res.end('This domain is not connected to a live Pipforge site.');return;}
    const url=new URL(req.url,config.origin);
    const route=url.searchParams.get('route');
    if(route!==null){url.pathname='/api/deriv/'+route;url.searchParams.delete('route');}
    if(!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.DERIV_SESSION_ENCRYPTION_KEY){
      if(url.pathname==='/api/deriv/session'){res.setHeader('Content-Type','application/json');res.end('{"authenticated":false,"configured":false}');return;}
      res.statusCode=503;res.setHeader('Content-Type','text/html');res.end('<h1>Account connection is not set up yet</h1><p>Please contact the site owner. Live market prices remain available without signing in.</p>');return;
    }
    const store=createCredentialStore({url:process.env.SUPABASE_URL,serviceKey:process.env.SUPABASE_SERVICE_ROLE_KEY,encryptionKey:process.env.DERIV_SESSION_ENCRYPTION_KEY});
    const handled=await createDerivAuth({...config,store})(req,res,url);
    if(!handled){res.statusCode=404;res.end('Not found');}
  }catch{res.statusCode=503;res.setHeader('Content-Type','application/json');res.end('{"error":"Account service is temporarily unavailable. Please try again."}');}
}
