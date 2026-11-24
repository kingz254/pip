export function createPremiumBots({url,serviceKey,upstream=fetch}) {
 const headers={apikey:serviceKey,Authorization:'Bearer '+serviceKey};
 async function read(table,params){const response=await upstream(url+'/rest/v1/'+table+'?'+new URLSearchParams(params),{headers,signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('Premium library unavailable');return response.json()}
 return async function premium({domain,accountId,botId}) {
  const sites=await read('sites',{domain:'eq.'+domain,status:'eq.live',select:'id'});const site=sites[0];if(!site)return null;
  const orders=await read('orders',{site_id:'eq.'+site.id,package:'eq.premium',status:'eq.paid',select:'id',limit:'1'});if(!orders.length)return null;
  const catalog=await read('premium_bot_catalog',{select:'id,name,execution_ready',order:'id.asc'});
  const grants=await read('premium_bot_grants',{site_id:'eq.'+site.id,account_id:'eq.'+accountId,revoked_at:'is.null',select:'bot_id'});
  const access=new Set(grants.map(g=>g.bot_id));
  if(!botId)return catalog.map(b=>({...b,unlocked:access.has(b.id)}));
  if(!catalog.some(b=>b.id===botId&&b.execution_ready)||!access.has(botId))return null;
  const sources=await read('premium_bot_sources',{bot_id:'eq.'+botId,select:'xml_content'});return sources[0]?.xml_content||null;
 };
}
