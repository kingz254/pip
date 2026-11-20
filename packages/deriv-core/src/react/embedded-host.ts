import type { DerivWS } from '../ws';
import type { DerivAccount } from '../types';
export type EmbeddedTradingHost = {
  getAccounts:()=>DerivAccount[];
  getSelectedAccount:()=>DerivAccount|null;
  getSocket:()=>Promise<DerivWS>;
  switchAccount:(id:string)=>void;
  logout:()=>Promise<void>;
  subscribe:(listener:()=>void)=>()=>void;
};
export function getEmbeddedTradingHost():EmbeddedTradingHost|null {
  if(typeof window==='undefined'||window.parent===window)return null;
  try {return window.parent.location.origin===window.location.origin?(window.parent as unknown as {PipforgeTrading?:EmbeddedTradingHost}).PipforgeTrading || null:null;}catch{return null;}
}
