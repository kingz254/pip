import { useClientBranding } from '../../pipforge/site-branding';
import { useEffect, useState } from 'react';
import FuturisticLoader from './futuristic-loader';
import './client-site-loader.scss';

const ClientSiteLoader = () => {
    const [elapsed, setElapsed] = useState(false);
    const site = useClientBranding();

    useEffect(() => {
        const timer = window.setTimeout(() => setElapsed(true), 8000);
        return () => window.clearTimeout(timer);
    }, []);

    if (!site) return <FuturisticLoader message='Loading trading site...' />;
    if (elapsed) return <div className='pf-site-loader-error' role='alert'>We could not connect to the trading service. Refresh to try again.</div>;
    return (
        <div className='pf-site-loader' role='status' aria-live='polite'>
            <span className={`pf-site-loader__mark pf-site-loader__mark--${site.loader_style}`} aria-hidden='true' />
            <strong>{site.name}</strong>
            <span>Loading your trading workspace</span>
        </div>
    );
};

export default ClientSiteLoader;
