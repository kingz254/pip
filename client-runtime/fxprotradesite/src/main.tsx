import ReactDOM from 'react-dom/client';
import { AuthWrapper } from './app/AuthWrapper';
import { AnalyticsInitializer } from './utils/analytics';
import { initChunkErrorHandler, checkAndRecoverFromChunkError } from './utils/chunk-error-handler';
import './styles/index.scss';
import { loadClientBranding } from './pipforge/site-branding';

// Initialize chunk error handling before rendering
initChunkErrorHandler();
checkAndRecoverFromChunkError();

AnalyticsInitializer();

loadClientBranding().then(() => {
    document.getElementById('pf-brand-bootstrap')?.remove();
    ReactDOM.createRoot(document.getElementById('root')!).render(<AuthWrapper />);
}).catch(() => {
    const root = document.getElementById('root')!;
    root.textContent = 'This domain is not connected to a live site, or the site service is temporarily unavailable. Please contact the site owner.';
    root.style.cssText = 'min-height:100vh;display:grid;place-items:center;padding:24px;text-align:center;background:#10131b;color:#f4f4f6;font:16px/1.5 system-ui,sans-serif';
    document.getElementById('pf-brand-bootstrap')?.remove();
});
