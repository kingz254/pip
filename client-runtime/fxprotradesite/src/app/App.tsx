import { initSurvicate } from '../public-path';
import { lazy, Suspense, useEffect, useState } from 'react';
import { createBrowserRouter, createRoutesFromElements, Route, RouterProvider } from 'react-router-dom';
import ErrorBoundary from '@/components/error-boundary/ErrorBoundary';
import PWAInstallModal from '@/components/pwa-install-modal/PWAInstallModal';
import RoutePromptDialog from '@/components/route-prompt-dialog';
import { StoreProvider } from '@/hooks/useStore';
import CallbackPage from '@/pages/callback';
import Endpoint from '@/pages/endpoint';
import { Analytics } from '@vercel/analytics/react';
{
    /* import LearnMorePopup from '@/components/learn-more-popup/LearnMorePopup';*/
}
import { TAuthData } from '@/types/api-types';
import { initializeI18n, TranslationProvider } from '@deriv-com/translations';
import CoreStoreProvider from './CoreStoreProvider';
import './app-root.scss';

const Layout = lazy(() => import('../components/layout'));
const AppRoot = lazy(() => import('./app-root'));

// Error fallback component for routes
const RouteErrorFallback = () => (
    <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2>⚠️ Failed to load this page</h2>
        <p>Please try refreshing or going back to the home page.</p>
        <button
            onClick={() => (window.location.href = '/')}
            style={{
                padding: '10px 20px',
                marginTop: '20px',
                background: '#667eea',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px',
            }}
        >
            Go Home
        </button>
    </div>
);

// Define an interface for the BeforeInstallPromptEvent
interface BeforeInstallPromptEvent extends Event {
    readonly platforms: string[];
    readonly userChoice: Promise<{
        outcome: 'accepted' | 'dismissed';
        platform: string;
    }>;
    prompt(): Promise<void>;
}

const { TRANSLATIONS_CDN_URL, R2_PROJECT_NAME, CROWDIN_BRANCH_NAME } = process.env;
const i18nInstance = initializeI18n({
    cdnUrl: `${TRANSLATIONS_CDN_URL}/${R2_PROJECT_NAME}/${CROWDIN_BRANCH_NAME}`,
});

const router = createBrowserRouter(
    createRoutesFromElements(
        <Route
            path='/'
            errorElement={<RouteErrorFallback />}
            element={
                <Suspense>
                    <TranslationProvider defaultLang='EN' i18nInstance={i18nInstance}>
                        <StoreProvider>
                            <RoutePromptDialog />
                            <CoreStoreProvider>
                                <Layout />
                                {/*<LearnMorePopup />*/}
                            </CoreStoreProvider>
                        </StoreProvider>
                    </TranslationProvider>
                </Suspense>
            }
        >
            <Route index element={<AppRoot />} errorElement={<RouteErrorFallback />} />
            <Route path='endpoint' element={<Endpoint />} errorElement={<RouteErrorFallback />} />
            <Route path='callback' element={<CallbackPage />} errorElement={<RouteErrorFallback />} />
        </Route>
    )
);

function App() {
    const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
    const [showInstallModal, setShowInstallModal] = useState(false);

    useEffect(() => {
        initSurvicate();
        window?.dataLayer?.push({ event: 'page_load' });

        return () => {
            const survicateBox = document.getElementById('survicate-box');
            if (survicateBox) {
                survicateBox.style.display = 'none';
            }
        };
    }, []);

    useEffect(() => {
        const handleBeforeInstallPrompt = (event: Event) => {
            // Don't prevent immediately - only prevent if we won't show the prompt
            const typedEvent = event as BeforeInstallPromptEvent;
            const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
            const alreadyInstalled = localStorage.getItem('dbot_pwa_already_installed') === 'true';

            if (!isStandalone && !alreadyInstalled) {
                event.preventDefault(); // Only prevent if we'll show our custom prompt
                setDeferredInstallPrompt(typedEvent);
                setShowInstallModal(true);
            }
            // If already installed or standalone, let the browser handle it naturally
        };

        window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

        return () => {
            window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
        };
    }, []);

    const handlePWAInstall = async () => {
        setShowInstallModal(false);
        if (deferredInstallPrompt) {
            deferredInstallPrompt.prompt();
            const { outcome } = await deferredInstallPrompt.userChoice;
            if (outcome === 'accepted') {
                localStorage.setItem('dbot_pwa_already_installed', 'true');
                console.log('User accepted the PWA installation prompt');
            } else {
                console.log('User dismissed the PWA installation prompt');
            }
            setDeferredInstallPrompt(null);
        }
    };

    const handlePWAModalClose = () => {
        setShowInstallModal(false);
        sessionStorage.setItem('dbot_pwa_prompt_dismissed_this_session', 'true');
    };


    // ✅ Register the service worker (for PWA support)
    useEffect(() => {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker
                    .register('/service-worker.js')
                    .then(registration => {
                        console.log('Service Worker registered with scope:', registration.scope);
                    })
                    .catch(error => {
                        console.log('Service Worker registration failed:', error);
                    });
            });
        }
    }, []);

    return (
        <ErrorBoundary>
            <>
                <RouterProvider router={router} />
                <PWAInstallModal
                    show={showInstallModal && !!deferredInstallPrompt}
                    onInstall={handlePWAInstall}
                    onClose={handlePWAModalClose}
                />
                <Analytics />
            </>
        </ErrorBoundary>
    );
}

export default App;
