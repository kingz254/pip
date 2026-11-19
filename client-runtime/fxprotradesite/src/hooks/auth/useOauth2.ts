import { logoutTradingSession } from '../../pipforge/session';
export const useOauth2 = ({ handleLogout, client }: { handleLogout?: () => Promise<void>; client?: any } = {}) => ({
    isOAuth2Enabled: true,
    oAuthLogout: async () => { client?.setIsLoggingOut(true); await logoutTradingSession(); await handleLogout?.(); window.location.reload(); },
});
