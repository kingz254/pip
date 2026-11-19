import React from 'react';
import App from './App';
import { removeLegacyCredentials, restoreTradingSession } from '../pipforge/session';

export const AuthWrapper = () => {
    const [ready, setReady] = React.useState(false);
    const [error, setError] = React.useState('');
    React.useEffect(() => {
        let disposed = false;
        removeLegacyCredentials();
        restoreTradingSession().then(() => { if (!disposed) setReady(true); })
            .catch(() => { if (!disposed) setError('Could not restore your account. Please reload to try again.'); });
        return () => { disposed = true; };
    }, []);
    if (error) return <p role="alert">{error}</p>;
    return ready ? <App /> : <p role="status">Connecting your trading account…</p>;
};
