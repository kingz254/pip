import { generateDerivApiInstance } from '../external/bot-skeleton/services/api/appId';
import { getSelectedAccount, getTradingAccounts, selectTradingAccount, logoutTradingSession } from './session';
import { isAuthorized$ } from '../external/bot-skeleton/services/api/observables/connection-status-stream';
// Same-origin supplied templates borrow this socket; they never own or close it.
(window as any).PipforgeTrading={
 getAccounts:()=>getTradingAccounts(),getSelectedAccount,
 getSocket:async()=>{const api=await generateDerivApiInstance();return api.socket;},
 switchAccount:selectTradingAccount,logout:async()=>{await logoutTradingSession();window.location.reload()},
 subscribe:(listener:()=>void)=>{window.addEventListener('pf:account-changed',listener);const subscription=isAuthorized$.subscribe(listener);return()=>{window.removeEventListener('pf:account-changed',listener);subscription.unsubscribe()};},
};
