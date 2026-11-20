// Test-only transport: public market reads are live; every account operation is simulated.
(()=>{
 const Native=window.WebSocket;
 class MockSocket extends EventTarget {
  static CONNECTING=0;static OPEN=1;static CLOSING=2;static CLOSED=3;
  readyState=0;onopen=null;onclose=null;onerror=null;onmessage=null;
  constructor(url){super();this.url=url;this.account=url.includes('/real')?'CR123456':'DOT39098596';
   this.socket=new Native('wss://api.derivws.com/trading/v1/options/ws/public');
   this.socket.onopen=()=>{this.readyState=1;this.fire('open',new Event('open'))};
   this.socket.onmessage=event=>this.fire('message',new MessageEvent('message',{data:event.data}));
   this.socket.onclose=()=>{this.readyState=3;this.fire('close',new Event('close'))};
   this.socket.onerror=()=>this.fire('error',new Event('error'));
  }
  fire(type,event){this['on'+type]?.(event);this.dispatchEvent(event)}
  reply(request,data){queueMicrotask(()=>this.fire('message',new MessageEvent('message',{data:JSON.stringify({echo_req:request,req_id:request.req_id,...data})})))}
  send(raw){const r=JSON.parse(raw),msg=Object.keys(r).find(k=>!['req_id','subscribe','passthrough'].includes(k));
   if(r.balance)return this.reply(r,{msg_type:'balance',balance:{loginid:this.account,currency:'USD',balance:this.account.startsWith('DOT')?9998.88:0},...(r.subscribe?{subscription:{id:'balance-'+this.account}}:{})});
   if(r.transaction)return this.reply(r,{msg_type:'transaction',subscription:{id:'transactions-'+this.account}});
   if(r.proposal_open_contract)return this.reply(r,{msg_type:'proposal_open_contract',error:{code:'TestNoPositions',message:'The test account has no open positions.'}});
   if(['buy','sell','contract_update','cancel'].some(k=>k in r)){
    void fetch('/__test/events',{method:'POST',body:JSON.stringify({account:this.account,request:r})});
    return this.reply(r,{msg_type:msg,error:{code:'TestOrderReached',message:'The mock order reached execution. No real order was sent.'}});
   }
   if(r.forget&&String(r.forget).includes(this.account))return this.reply(r,{msg_type:'forget',forget:r.forget});
   if(['active_symbols','contracts_for','trading_times','time','ticks','ticks_history','proposal','forget','forget_all','ping'].some(k=>k in r)){this.socket.send(raw);return}
   return this.reply(r,{msg_type:msg,error:{code:'TestReadOnly',message:'Unavailable in the test fixture.'}});
  }
  close(){this.socket.close()}
 }
 window.WebSocket=MockSocket;
})();
