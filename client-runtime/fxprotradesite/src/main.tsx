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

loadClientBranding().finally(() => {
    ReactDOM.createRoot(document.getElementById('root')!).render(<AuthWrapper />);
});
