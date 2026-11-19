import { useEffect, useState } from 'react';
import clsx from 'clsx';
import Cookies from 'js-cookie';
import { Outlet } from 'react-router-dom';
import { api_base } from '@/external/bot-skeleton';
import { useOauth2 } from '@/hooks/auth/useOauth2';
import { requestOidcAuthentication } from '@deriv-com/auth-client';
import { useDevice } from '@deriv-com/ui';
import { crypto_currencies_display_order, fiat_currencies_display_order } from '../shared';
import { DisclaimerButton } from '../disclaimer';
import Footer from './footer';
import AppHeader from './header';
import Body from './main-body';
import NotificationBanner from '../notification-banner';
import CommunityFloatingIcon from '../community-floating-icon';
import NetworkSpeedIndicator from '../network-speed-indicator';
import ClientSocialProfiles from './client-social-profiles';
import './layout.scss';

const Layout = () => {
    const { isDesktop } = useDevice();

    const isCallbackPage = window.location.pathname === '/callback';

    return (
        <div className={clsx('layout', { responsive: isDesktop })}>
            {!isCallbackPage && <AppHeader />}
            {!isCallbackPage && <NotificationBanner />}
            <Body>
                <Outlet />
            </Body>
            {!isCallbackPage && <DisclaimerButton />}
            {!isCallbackPage && isDesktop && <Footer />}
            {!isCallbackPage && !isDesktop && <ClientSocialProfiles place='footer' />}
            {!isCallbackPage && <CommunityFloatingIcon />}
            {!isCallbackPage && <NetworkSpeedIndicator />}
        </div>
    );
};

export default Layout;
