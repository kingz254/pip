import { useEffect } from 'react';
import { observer } from 'mobx-react-lite';
import { api_base } from '@/external/bot-skeleton';
import { useStore } from '@/hooks/useStore';
import { useApiBase } from '@/hooks/useApiBase';
import { getSelectedAccount } from '../pipforge/session';
const CoreStoreProvider = observer(({ children }: { children: React.ReactNode }) => {
    const { client } = useStore();
    const { connectionStatus, authData, accountList, isAuthorized } = useApiBase();
    useEffect(() => {
        const account = getSelectedAccount();
        client.setIsLoggedIn(isAuthorized && !!account);
        client.setLoginId(account?.account_id || '');
        client.setAccountList(accountList);
        if (account) { client.setCurrency(account.currency); client.setBalance(String(authData?.balance ?? account.balance)); }
    }, [client, authData, accountList, isAuthorized]);
    useEffect(() => {
        const subscription = api_base.api?.onMessage().subscribe(({ data }) => {
            const account = getSelectedAccount();
            if (!data.error && data.balance && data.balance.loginid === account?.account_id) {
                client.setBalance(String(data.balance.balance));
                client.setCurrency(data.balance.currency);
            }
        });
        return () => subscription?.unsubscribe();
    }, [connectionStatus, client]);
    return <>{children}</>;
});
export default CoreStoreProvider;
