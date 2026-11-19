export async function resolveSiteAuth(host, env=process.env, upstream=fetch) {
  const main=new URL(env.APP_ORIGIN || 'https://pip-coral-seven.vercel.app');
  if(host===main.host)return { origin:main.origin,clientId:env.DERIV_CLIENT_ID,redirectUri:env.DERIV_REDIRECT_URI };
  if(!/^[a-z0-9.-]+(?::\d+)?$/i.test(host||'') || !env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)return null;
  const domain=host.toLowerCase().replace(/^www\./,'');
  const response=await upstream(`${env.SUPABASE_URL}/rest/v1/rpc/public_site`,{method:'POST',headers:{apikey:env.SUPABASE_SERVICE_ROLE_KEY,Authorization:`Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({p_domain:domain}),signal:AbortSignal.timeout(10000)});
  if(!response.ok)return null;
  const site=await response.json();
  if(!site || site.domain!==domain || !/^[A-Za-z0-9_-]{1,128}$/.test(site.deriv_app_id||''))return null;
  const origin=`https://${host.toLowerCase()}`;
  return {origin,clientId:site.deriv_app_id,redirectUri:`${origin}/api/deriv/callback`,site};
}
