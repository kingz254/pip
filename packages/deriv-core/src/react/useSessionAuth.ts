'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { fetchAccounts, getWebSocketOTP, logout as endSession } from '../auth/accounts';
import { initiateLogin, initiateSignUp } from '../auth/oauth';
import { restoreDerivSession } from '../auth/session';
import { getActiveLoginId, setActiveLoginId, setAccountType, storeDerivAccounts } from '../auth/storage';
import type { AuthState, DerivAccount } from '../types';

export function useSessionAuth() {
  const [authState,setAuthState]=useState<AuthState>('unauthenticated');
  const [accounts,setAccounts]=useState<DerivAccount[]>([]);
  const [activeAccountId,setActiveAccountId]=useState<string|null>(null);
  const [wsUrl,setWsUrl]=useState<string|undefined>();
  const [error,setError]=useState<string|null>(null);
  const generation=useRef(0);
  const switchAccount=useCallback(async(id:string)=>{
    const version=++generation.current;
    setWsUrl(undefined);
    try {
      const session=await restoreDerivSession();
      if(!session)throw new Error('Please connect your Deriv account.');
      const url=await getWebSocketOTP(id,session,'');
      if(version!==generation.current)return;
      setActiveLoginId(id);setActiveAccountId(id);
      setWsUrl(url);setAuthState('authenticated');setError(null);
    } catch(e){if(version===generation.current){setError(e instanceof Error?e.message:'Account unavailable');setAuthState('error');}}
  },[]);
  useEffect(()=>{
    const version=++generation.current;
    (async()=>{
      try {
        const session=await restoreDerivSession();if(!session||version!==generation.current)return;
        const list=await fetchAccounts(session,'');if(version!==generation.current)return;
        setAccounts(list);
        const selected=list.find(a=>a.account_id===getActiveLoginId())||list.find(a=>a.account_type==='demo')||list[0];
        if(selected){setAccountType(selected.account_type);await switchAccount(selected.account_id);}
      }catch(e){if(version===generation.current)setError(e instanceof Error?e.message:'Session unavailable');}
    })();
    return()=>{generation.current++;};
  },[switchAccount]);
  const logout=useCallback(()=>{generation.current++;endSession();setAccounts([]);setActiveAccountId(null);setWsUrl(undefined);setAuthState('unauthenticated');},[]);
  const login=useCallback(()=>initiateLogin({clientId:'',redirectUri:''}),[]);
  const signUp=useCallback(()=>initiateSignUp({clientId:'',redirectUri:''}),[]);
  const updateAccountBalance=useCallback((id:string,balance:string,currency?:string)=>setAccounts(current=>{
    const list=current.map(a=>a.account_id===id?{...a,balance,currency:currency||a.currency}:a);storeDerivAccounts(list);return list;
  }),[]);
  const activeAccount=useMemo(()=>accounts.find(a=>a.account_id===activeAccountId)||null,[accounts,activeAccountId]);
  return {authState,accounts,activeAccount,activeAccountId,wsUrl,login,signUp,logout,switchAccount,updateAccountBalance,error};
}
