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
    const [error, setError] = useState('');
    const account = getSelectedAccount();
    return <header className='app-header' style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', padding: 12 }}>
        <AppLogo />
        <ClientSocialProfiles place='header' />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            {account ? <>
                <label>Account <select aria-label='Trading account' value={account.account_id} disabled={isAuthorizing}
                    onChange={event => { try { selectTradingAccount(event.target.value); setError(''); } catch { setError('Could not switch account.'); } }}>
                    {getTradingAccounts().map(a => <option key={a.account_id} value={a.account_id}>{a.account_type === 'demo' ? 'Demo' : 'Real'} · {a.currency} · {a.account_id}</option>)}
                </select></label>
                <strong>{Number(client.loginid === account.account_id ? client.balance : account.balance).toFixed(2)} {account.currency}</strong>
                <button onClick={() => { void logoutTradingSession().then(() => window.location.reload()).catch(() => setError('Logout could not complete. Please retry.')); }}>Log out</button>
            </> : <><a href='/api/deriv/login'>Log in</a><a href='/api/deriv/login?signup=1'>Sign up</a></>}
        </div>
        {error && <p role='alert'>{error}</p>}
    </header>;
});
export default AppHeader;
