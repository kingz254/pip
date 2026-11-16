import { describe, it, expect, vi, afterEach } from 'vitest';
import { DerivWS } from './deriv-ws';

class Socket {
  static OPEN=1;
  static instances: Socket[]=[];
  readyState=0;
  sent: Record<string,unknown>[]=[];
  onopen: (()=>void)|null=null;
  onmessage: ((event:{data:string})=>void)|null=null;
  onclose: (()=>void)|null=null;
  onerror: (()=>void)|null=null;
  constructor(public url:string){Socket.instances.push(this);queueMicrotask(()=>{this.readyState=1;this.onopen?.();});}
  send(text:string){this.sent.push(JSON.parse(text));}
  close(){this.readyState=3;this.onclose?.();}
  receive(value:unknown){this.onmessage?.({data:JSON.stringify(value)});}
}
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();Socket.instances=[];});

describe('Deriv connection generations',()=>{
  it('gets a fresh OTP after reconnect and rejects proposals from the previous connection',async()=>{
    vi.useFakeTimers();vi.stubGlobal('WebSocket',Socket);
    let generation=0;
    const ws=new DerivWS('unused',async()=>`wss://fixture.test/?otp=${++generation}`);
    await ws.connect();
    const first=Socket.instances[0];
    const quote=ws.send({proposal:1});first.receive({req_id:1,proposal:{id:'fixture-proposal'}});await quote;
    first.close();await vi.advanceTimersByTimeAsync(2000);
    expect(generation).toBe(2);expect(Socket.instances[1].url).not.toBe(first.url);
    await expect(ws.send({buy:'fixture-proposal',price:1})).rejects.toThrow('fresh quote');
    ws.disconnect();
  });
  it('blocks purchases on public sockets',async()=>{
    vi.stubGlobal('WebSocket',Socket);
    const ws=new DerivWS();await ws.connect();
    await expect(ws.send({buy:'fixture-proposal',price:1})).rejects.toThrow('fresh quote');
    expect(Socket.instances[0].sent).toHaveLength(0);ws.disconnect();
  });
});
