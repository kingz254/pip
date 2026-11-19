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
    ReactDOM.createRoot(document.getElementById('root')!).render(<AuthWrapper />);
}).catch(() => { document.getElementById('root')!.textContent = 'This domain is not connected to a live site, or the site service is temporarily unavailable. Please contact the site owner.'; });
