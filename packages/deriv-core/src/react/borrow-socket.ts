import type { DerivWS } from '../ws';
// A template may release its subscriptions, but must never close the app's socket.
export function borrowSocket(owner:DerivWS) {
 let released=false;
 const cleanup=new Set<()=>unknown>();
 const track=(stop:()=>unknown)=>{
   if(released){void Promise.resolve(stop()).catch(()=>{});return()=>{}};
   const release=()=>{cleanup.delete(release);return stop()};cleanup.add(release);return release;
 };
 const release=()=>{if(released)return;released=true;for(const stop of [...cleanup]){try{void Promise.resolve(stop()).catch(()=>{})}catch{}}cleanup.clear()};
 const socket=new Proxy(owner,{get(target,key){
   if(key==='disconnect')return release;
   if(key==='subscribe')return async(...args:Parameters<DerivWS['subscribe']>)=>{const sub=await target.subscribe(...args);return {...sub,unsubscribe:track(sub.unsubscribe)}};
   const value=Reflect.get(target,key,target);
   if(typeof value!=='function')return value;
   if(typeof key==='string'&&/^on[A-Z]/.test(key))return(...args:unknown[])=>track(value.apply(target,args));
   return value.bind(target);
 }});
 return {socket,release};
}
