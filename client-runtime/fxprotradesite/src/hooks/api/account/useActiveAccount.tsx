import { useMemo } from 'react';
import { CurrencyIcon } from '@/components/currency/currency-icon';
import { addComma, getDecimalPlaces } from '@/components/shared';
import { useApiBase } from '@/hooks/useApiBase';
import { Balance } from '@deriv/api-types';
import { localize } from '@deriv-com/translations';

/** A custom hook that returns the account object for the current active account. */
const useActiveAccount = ({ allBalanceData }: { allBalanceData: Balance | null }) => {
    const { accountList, activeLoginid } = useApiBase();

    const activeAccount = useMemo(
        () => accountList?.find(account => account.loginid === activeLoginid),
        [activeLoginid, accountList]
    );

    const currentBalanceData = allBalanceData?.accounts?.[activeAccount?.loginid ?? ''];

    const modifiedAccount = useMemo(() => {
        if (!activeAccount) return undefined;

        // Check if SVG mode is enabled
        const isSvgModeEnabled = localStorage.getItem('svging') === 'yes';
        
        // Determine which balance to use
        let balanceToUse;
        if (isSvgModeEnabled && !activeAccount.is_virtual && activeAccount.currency?.toLowerCase() === 'usd' && accountList) {
            // If SVG mode is enabled and this is a USD real account, find and use demo account balance
            const demoAccount = accountList.find(account => account?.loginid?.startsWith('VR'));
            if (demoAccount) {
                const demoBalanceData = allBalanceData?.accounts?.[demoAccount.loginid];
                balanceToUse = addComma(
                    demoBalanceData?.balance?.toFixed(getDecimalPlaces(demoBalanceData.currency)) ?? '0'
                );
            } else {
                // Fallback to original balance if no demo account found
                balanceToUse = addComma(
                    currentBalanceData?.balance?.toFixed(getDecimalPlaces(currentBalanceData.currency)) ?? '0'
                );
            }
        } else {
            // Normal behavior: use the account's own balance
            balanceToUse = addComma(
                currentBalanceData?.balance?.toFixed(getDecimalPlaces(currentBalanceData.currency)) ?? '0'
            );
        }

        return {
            ...activeAccount,
            balance: balanceToUse,
            currencyLabel: activeAccount?.is_virtual ? localize('Demo') : activeAccount?.currency,
            icon: (
                <CurrencyIcon
                    currency={activeAccount?.currency?.toLowerCase()}
                    isVirtual={Boolean(activeAccount?.is_virtual)}
                />
            ),
            isVirtual: Boolean(activeAccount?.is_virtual),
            isActive: activeAccount?.loginid === activeLoginid,
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeAccount, activeLoginid, allBalanceData, accountList]);

    return {
        /** User's current active account. */
        data: modifiedAccount,
    };
};

export default useActiveAccount;
