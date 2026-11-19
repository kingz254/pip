import { useClientBranding } from '../../../pipforge/site-branding';
import { useStore } from '@/hooks/useStore';
import { useState } from 'react';
import { observer } from 'mobx-react-lite';
import { useApiBase } from '@/hooks/useApiBase';
import { getTradingAccounts, getSelectedAccount, selectTradingAccount, logoutTradingSession } from '../../../pipforge/session';
import { AppLogo } from '../app-logo';
import ClientSocialProfiles from '../client-social-profiles';
import './header.scss';

const AppHeader = observer(() => {
    const { isAuthorizing } = useApiBase();
    const { client } = useStore();
    const brand = useClientBranding();
    const [error, setError] = useState('');
    const account = getSelectedAccount();
    const returnUrl = encodeURIComponent(window.parent !== window ? window.parent.location.href : window.location.href);
    const changeAccount = (id: string) => { try { selectTradingAccount(id); setError(''); } catch { setError('Could not switch account.'); } };
    return <header className='app-header' style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', padding: 12 }}>
        <AppLogo key={brand?.name + String(brand?.logo_data)} />
        <ClientSocialProfiles place='header' />
        <div className='pf-account' style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            {account ? <>
                {brand?.menu?.account_display === 'dropdown' ? <label>Account <select aria-label='Trading account' value={account.account_id} disabled={isAuthorizing} onChange={event => changeAccount(event.target.value)}>
                    {getTradingAccounts().map(a => <option key={a.account_id} value={a.account_id}>{a.account_type === 'demo' ? 'Demo' : 'Real'} · {a.currency} · {a.account_id}</option>)}
                </select></label> : <div role='group' aria-label='Trading account'>{getTradingAccounts().map(a => <button key={a.account_id} aria-pressed={a.account_id===account.account_id} disabled={isAuthorizing} onClick={()=>changeAccount(a.account_id)}>{a.account_type==='demo'?'Demo':'Real'} · {a.currency}</button>)}</div>}
                <strong>{Number(client.loginid === account.account_id ? client.balance : account.balance).toFixed(2)} {account.currency}</strong>
                <button onClick={() => { void logoutTradingSession().then(() => window.location.reload()).catch(() => setError('Logout could not complete. Please retry.')); }}>Log out</button>
            </> : <><a href={'/api/deriv/login?return='+returnUrl}>Log in</a><a href={'/api/deriv/login?signup=1&return='+returnUrl}>Sign up</a></>}
        </div>
        {error && <p role='alert'>{error}</p>}
    </header>;
});
export default AppHeader;
