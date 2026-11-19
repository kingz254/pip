import { useEffect, useState } from 'react';
import { getSelectedAccount } from '../pipforge/session';
interface DerivUser { loginId: string; fullName: string; email?: string }
export async function getDerivUserInfo(): Promise<DerivUser | null> {
    const account = getSelectedAccount();
    return account ? { loginId: account.account_id, fullName: account.account_id } : null;
}
export const useDerivAuth = () => {
    const [user, setUser] = useState<DerivUser | null>(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const update = () => { void getDerivUserInfo().then(value => { setUser(value); setLoading(false); }); };
        update();
        window.addEventListener('pf:account-changed', update);
        return () => window.removeEventListener('pf:account-changed', update);
    }, []);
    return { user, loading };
};
