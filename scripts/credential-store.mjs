import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

export function createCredentialStore({ url, serviceKey, encryptionKey, upstream=fetch }) {
  const key=Buffer.from(encryptionKey||'','base64');
  if (!url || new URL(url).protocol!=='https:' || !serviceKey || key.length!==32) throw new Error('Credential storage is not configured.');
  const headers={apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,'Content-Type':'application/json'};
  const rowId=(origin,kind,id)=>createHash('sha256').update(`${origin}|${kind}|${id}`).digest('hex');
  const encrypt=value=>{
    const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);
    const body=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
    return Buffer.concat([iv,cipher.getAuthTag(),body]).toString('base64');
  };
  const decrypt=value=>{
    const bytes=Buffer.from(value,'base64'),decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));
    decipher.setAuthTag(bytes.subarray(12,28));return JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8'));
  };
  const request=async(query,init={})=>{
    const response=await upstream(`${url}/rest/v1/deriv_oauth_sessions${query}`,{...init,headers:{...headers,...init.headers},signal:AbortSignal.timeout(15000)});
    if(!response.ok)throw new Error('Credential storage unavailable.');
    return response.status===204 || init.method==='POST'?null:response.json();
  };
  return {
    async get(origin,kind,id){if(!id)return undefined;const rows=await request(`?id=eq.${rowId(origin,kind,id)}&select=payload`);return rows?.[0]?decrypt(rows[0].payload):undefined;},
    async take(origin,kind,id){if(!id)return undefined;const rows=await request(`?id=eq.${rowId(origin,kind,id)}&select=payload`,{method:'DELETE',headers:{Prefer:'return=representation'}});return rows?.[0]?decrypt(rows[0].payload):undefined;},
    async set(origin,kind,id,value){await request('?expires_at=lt.'+new Date().toISOString(),{method:'DELETE'});await request('',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify({id:rowId(origin,kind,id),payload:encrypt(value),expires_at:new Date(value.expires).toISOString()})});},
    async delete(origin,kind,id){if(id)await request(`?id=eq.${rowId(origin,kind,id)}`,{method:'DELETE'});}
  };
}
