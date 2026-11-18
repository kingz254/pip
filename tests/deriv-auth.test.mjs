import test from 'node:test';
import assert from 'node:assert/strict';
import { createDerivAuth } from '../scripts/deriv-auth.mjs';

const origin='https://pipforge.test';
function harness(options={}) {
  const calls=[];
  const upstream=async(url,init)=>{
    calls.push([url,init]);
    if(url.endsWith('/token'))return Response.json({access_token:'fixture-server-only',expires_in:3600});
    if(url.endsWith('/otp'))return Response.json({data:{url:'wss://api.derivws.com/trading/v1/options/ws/demo?otp=fixture-once'}});
    return Response.json({data:[{account_id:'DOT123',account_type:'demo',currency:'EUR',balance:100,group:'row',status:'active'}]});
  };
  const handler=createDerivAuth({origin,clientId:'fixture-client',redirectUri:origin+'/api/deriv/callback',upstream,...options});
  async function send(path,{method='GET',cookie='',requestOrigin=origin}={}){
    const res={status:0,headers:{},body:'',writeHead(status,headers){this.status=status;this.headers=headers||{};return this;},end(body=''){this.body+=body;}};
    await handler({method,headers:{host:'pipforge.test',origin:requestOrigin,cookie}},res,new URL(path,origin));return res;
  }
  return {send,calls};
}
const cookieValue=value=>value.split(';')[0];

test('Deriv OAuth rejects state mismatch and consumes transactions on error',async()=>{
  const {send,calls}=harness();
  const login=await send('/api/deriv/login?return=https://attacker.test/');
  const auth=new URL(login.headers.Location), cookie=cookieValue(login.headers['Set-Cookie']);
  assert.equal(auth.origin,'https://auth.deriv.com');assert.equal(auth.searchParams.get('scope'),'trade');
  assert.equal(auth.searchParams.get('code_challenge_method'),'S256');assert.match(login.headers['Set-Cookie'],/HttpOnly.*SameSite=Lax.*Secure/);
  assert.equal((await send('/api/deriv/callback?error=access_denied&state=wrong',{cookie})).status,302);
  assert.equal((await send('/api/deriv/callback?code=fixture&state='+auth.searchParams.get('state'),{cookie})).status,302);
  assert.equal(calls.length,0);
});

test('one shared server session keeps provider tokens private, checks account ownership, and logs out',async()=>{
  let clock=1000;
  const {send,calls}=harness({now:()=>clock});
  const login=await send('/api/deriv/login?return='+encodeURIComponent('/?site=example.test#client-preview'));
  const auth=new URL(login.headers.Location), pending=cookieValue(login.headers['Set-Cookie']);
  const callback=await send('/api/deriv/callback?code=fixture&state='+auth.searchParams.get('state'),{cookie:pending});
  assert.equal(callback.status,302);assert.equal(callback.headers.Location,'/?site=example.test#client-preview');
  assert.ok(!callback.body.includes('fixture-server-only'));
  const cookie=cookieValue(callback.headers['Set-Cookie'][1]);
  const session=await send('/api/deriv/session',{cookie});assert.equal(JSON.parse(session.body).authenticated,true);
  assert.ok(!session.body.includes('fixture-server-only'));
  const accounts=await send('/api/deriv/accounts',{cookie});assert.equal(JSON.parse(accounts.body).data[0].currency,'EUR');
  assert.equal((await send('/api/deriv/accounts/OTHER/otp',{cookie,method:'POST'})).status,403);
  assert.equal((await send('/api/deriv/accounts/DOT123/otp',{cookie,method:'POST',requestOrigin:'https://attacker.test'})).status,403);
  assert.equal((await send('/api/deriv/accounts/DOT123/otp',{cookie,method:'POST'})).status,200);
  assert.equal(calls.filter(([url])=>url.endsWith('/otp')).length,1);
  assert.equal(calls.at(-1)[1].headers.Authorization,'Bearer fixture-server-only');
  assert.equal((await send('/api/deriv/logout',{cookie,method:'POST'})).status,200);
  assert.equal(JSON.parse((await send('/api/deriv/session',{cookie})).body).authenticated,false);
  assert.equal((await send('/api/deriv/accounts',{cookie})).status,401);
  clock+=3600001;
});

test('OAuth callback returns a clear result to the tenant site',async()=>{
  const {send}=harness();
  const login=await send('/api/deriv/login?return='+encodeURIComponent('/?tab=charts#client-preview'));
  const auth=new URL(login.headers.Location),cookie=cookieValue(login.headers['Set-Cookie']);
  const callback=await send('/api/deriv/callback?error=access_denied&state='+auth.searchParams.get('state'),{cookie});
  assert.equal(callback.headers.Location,'/?tab=charts&deriv_login=cancelled#client-preview');
});

test('login requires an explicitly registered callback, and unauthenticated account data is gated',async()=>{
  const {send}=harness({redirectUri:undefined});
  assert.equal((await send('/api/deriv/login')).status,503);
  assert.equal((await send('/api/deriv/accounts')).status,401);
});
