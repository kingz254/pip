import {it,expect,vi,afterEach} from 'vitest';
import {DerivWS} from './deriv-ws';
class Socket {
 static OPEN=1;static current:Socket;readyState=0;sent:Record<string,unknown>[]=[];
 onopen:(()=>void)|null=null;onclose:(()=>void)|null=null;onerror:(()=>void)|null=null;onmessage:((event:{data:string})=>void)|null=null;
 constructor(){Socket.current=this;queueMicrotask(()=>{this.readyState=1;this.onopen?.()})}
 send(value:string){this.sent.push(JSON.parse(value))}close(){this.readyState=3;this.onclose?.()}
 receive(value:unknown){this.onmessage?.({data:JSON.stringify(value)})}
}
afterEach(()=>vi.unstubAllGlobals());
it('can buy a fresh authenticated fixed-price digit quote without a stream ID',async()=>{
 vi.stubGlobal('WebSocket',Socket);const owner=new DerivWS(undefined,async()=> 'wss://fixture.test/demo?otp=one-use');await owner.connect();
 const request={proposal:1,amount:1,basis:'stake',contract_type:'DIGITDIFF',currency:'USD',underlying_symbol:'R_100',duration:1,duration_unit:'t',barrier:'7'};
 const quote=owner.send(request);Socket.current.receive({req_id:1,msg_type:'proposal',echo_req:request,proposal:{id:'a'.repeat(32),ask_price:1}});await quote;
 const buy=owner.send({buy:'a'.repeat(32),price:1});expect(Socket.current.sent[Socket.current.sent.length-1]).toMatchObject({buy:'a'.repeat(32),price:1});
 Socket.current.receive({req_id:2,buy:{contract_id:123}});await expect(buy).resolves.toMatchObject({buy:{contract_id:123}});
 await expect(owner.send({buy:'a'.repeat(32),price:1})).rejects.toThrow('fresh quote');owner.disconnect();
});
