import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { observer } from 'mobx-react-lite';
import ErrorBoundary from '@/components/error-component/error-boundary';
import ErrorComponent from '@/components/error-component/error-component';
import ClientSiteLoader from '@/components/loader/client-site-loader';
import TradingAssesmentModal from '@/components/trading-assesment-modal';
import { api_base } from '@/external/bot-skeleton';
import { useStore } from '@/hooks/useStore';
import './app-root.scss';


const AppContent = lazy(() => import('./app-content'));


const ErrorComponentWrapper = observer(() => {
    const { common } = useStore();


    if (!common.error) return null;


    return (
        <ErrorComponent
            header={common.error?.header}
            message={common.error?.message}
            redirect_label={common.error?.redirect_label}
            redirectOnClick={common.error?.redirectOnClick}
            should_clear_error_on_click={common.error?.should_clear_error_on_click}
            setError={common.setError}
            redirect_to={common.error?.redirect_to}
            should_redirect={common.error?.should_redirect}
        />
    );
});


const AppRoot = () => {
    const store = useStore();
    const api_base_initialized = useRef(false);
    const [is_api_initialized, setIsApiInitialized] = useState(false);


    useEffect(() => {
        const initializeApi = async () => {
            if (!api_base_initialized.current) {
                try {
                    await Promise.race([
                        api_base.init(),
                        new Promise((_, reject) => 
                            setTimeout(() => reject(new Error('API init timeout')), 10000)
                        )
                    ]);
                    api_base_initialized.current = true;
                    setIsApiInitialized(true);
                } catch (error) {
                    console.error('API initialization error:', error);
                    // Force initialization to complete after error
                    api_base_initialized.current = true;
                    setIsApiInitialized(true);
                }
            }
        };


        initializeApi();
    }, []);


    if (!store || !is_api_initialized) return <ClientSiteLoader />;


    return (
        <Suspense fallback={null}>
            <ErrorBoundary root_store={store}>
                <ErrorComponentWrapper />
                <AppContent />
                <TradingAssesmentModal />
            </ErrorBoundary>
        </Suspense>
    );
};


export default AppRoot;
