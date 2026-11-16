import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { useDevice } from '@deriv-com/ui';
import './main-body.scss';

type TMainBodyProps = {
    children: React.ReactNode;
};

const MainBody: React.FC<TMainBodyProps> = observer(({ children }) => {
    const { ui } = useStore() ?? {
        ui: {
            setDevice: () => {},
            setDarkMode: () => {},
            is_dark_mode_on: (window as any).__pfSiteTheme === 'dark',
        },
    };
    const { setDevice, is_dark_mode_on, setDarkMode } = ui;
    const { isDesktop, isMobile, isTablet } = useDevice();

    useEffect(() => {
        const initialTheme = (window as any).__pfSiteTheme;
        if (initialTheme === 'light' || initialTheme === 'dark') setDarkMode(initialTheme === 'dark');
        const applySiteTheme = (event: MessageEvent) => {
            if (
                event.source !== window.parent ||
                event.origin !== window.location.origin ||
                event.data?.type !== 'PF_SITE_BRANDING' ||
                !['light', 'dark'].includes(event.data.theme)
            ) return;
            setDarkMode(event.data.theme === 'dark');
        };
        window.addEventListener('message', applySiteTheme);
        return () => window.removeEventListener('message', applySiteTheme);
    }, [setDarkMode]);

    // Apply the theme from the ui store, which defaults to the OS preference
    // when the user hasn't explicitly chosen one (see UiStore.getInitialDarkMode).
    useEffect(() => {
        const body = document.querySelector('body');
        if (!body) return;
        if (is_dark_mode_on) {
            body.classList.remove('theme--light');
            body.classList.add('theme--dark');
        } else {
            body.classList.remove('theme--dark');
            body.classList.add('theme--light');
        }
    }, [is_dark_mode_on]);

    useEffect(() => {
        if (isMobile) {
            setDevice('mobile');
        } else if (isTablet) {
            setDevice('tablet');
        } else {
            setDevice('desktop');
        }
    }, [isDesktop, isMobile, isTablet, setDevice]);

    return <div className='main-body'>{children}</div>;
});

export default MainBody;
