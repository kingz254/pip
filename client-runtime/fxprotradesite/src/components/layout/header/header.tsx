import { useClientBranding } from '../../../pipforge/site-branding';
import { useStore } from '@/hooks/useStore';
import { useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useApiBase } from '@/hooks/useApiBase';
import { getTradingAccounts, getSelectedAccount, selectTradingAccount, logoutTradingSession } from '../../../pipforge/session';
import { CurrencyIcon } from '../../currency/currency-icon';
import { AppLogo } from '../app-logo';
import ClientSocialProfiles from '../client-social-profiles';
import './header.scss';

const money=(value:unknown)=>Number.isFinite(Number(value))?Number(value).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';
const AppHeader = observer(() => {
    const { isAuthorizing, isAuthorized } = useApiBase();
    const { client, ui } = useStore();
    const brand = useClientBranding();
    const [error,setError]=useState(''),[open,setOpen]=useState(false);
    const account=getSelectedAccount();
    const [group,setGroup]=useState<'real'|'demo'>(account?.account_type || 'demo');
    const menu=useRef<HTMLDivElement>(null);
    useEffect(()=>{setGroup(account?.account_type || 'demo')},[client.loginid,account?.account_type]);
    useEffect(()=>{const close=(event:PointerEvent)=>{if(!menu.current?.contains(event.target as Node))setOpen(false)};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close)},[]);
    const returnUrl=encodeURIComponent(window.parent!==window?window.parent.location.href:window.location.href);
    const balance=(a:ReturnType<typeof getTradingAccounts>[number])=>money(client.loginid===a.account_id?client.balance:a.balance);
    const changeAccount=(id:string)=>{if(ui.account_switcher_disabled_message){setError(ui.account_switcher_disabled_message);return}try{selectTradingAccount(id);setOpen(false);setError('')}catch{setError('Could not switch account.')}};
    return <header className='app-header' style={{display:'flex',gap:12,flexWrap:'wrap',alignItems:'center',padding:12}}>
        <AppLogo key={brand?.name+String(brand?.logo_data)} />
        <ClientSocialProfiles place='header' />
        <div className='pf-account' ref={menu} onKeyDown={event=>{if(event.key==='Escape')setOpen(false)}}>
          {account ? <>
            <button className='pf-account-trigger' data-account-type={account.account_type} aria-label='Trading account' aria-expanded={open} aria-controls='pf-account-menu' onClick={()=>setOpen(!open)}>
              <CurrencyIcon currency={account.currency} isVirtual={account.account_type==='demo'} />
              <span><small>{account.account_type==='demo'?'Demo account':'Real account'}</small><strong>{balance(account)} {account.currency}</strong></span>
              <svg viewBox='0 0 16 16' aria-hidden='true' className={open?'is-open':''}><path d='m4 6 4 4 4-4'/></svg>
            </button>
            {open && <div className='pf-account-menu' id='pf-account-menu'>
              <div className='pf-account-tabs' role='tablist' aria-label='Account type'>{(['real','demo'] as const).map(type=><button key={type} role='tab' aria-selected={group===type} onClick={()=>setGroup(type)}>{type==='real'?'Real':'Demo'}</button>)}</div>
              <div role='tabpanel'><h3>Deriv account</h3>{getTradingAccounts().filter(a=>a.account_type===group).map(a=><button className='pf-account-row' key={a.account_id} aria-pressed={a.account_id===account.account_id} disabled={isAuthorizing || !!ui.account_switcher_disabled_message} onClick={()=>changeAccount(a.account_id)}>
                <CurrencyIcon currency={a.currency} isVirtual={a.account_type==='demo'} /><span><b>{a.account_type==='demo'?'Demo':a.currency}</b><small>{a.account_id}</small></span><strong>{balance(a)} {a.currency}</strong>
              </button>)}{!getTradingAccounts().some(a=>a.account_type===group)&&<p>No {group} Options account is connected.</p>}</div>
              <button className='pf-account-logout' onClick={()=>{void logoutTradingSession().then(()=>window.location.reload()).catch(()=>setError('Logout could not complete. Please retry.'))}}>Logout <svg viewBox='0 0 20 20' aria-hidden='true'><path d='M8 3H3v14h5M12 6l4 4-4 4M7 10h9'/></svg></button>
            </div>}
            {isAuthorizing && <span role='status' className='pf-account-status'>Connecting…</span>}
            {!isAuthorizing && !isAuthorized && <span role='status' className='pf-account-status'>Reconnecting…</span>}
          </> : <><a className='pf-auth-login' href={'/api/deriv/login?return='+returnUrl}>Log in</a><a className='pf-auth-signup' href={'/api/deriv/login?signup=1&return='+returnUrl}>Sign up</a></>}
        </div>{error&&<p role='alert'>{error}</p>}
    </header>;
});
export default AppHeader;
