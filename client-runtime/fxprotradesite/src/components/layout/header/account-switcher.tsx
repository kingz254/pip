import { selectTradingAccount } from '../../../pipforge/session';
import { useEffect, useState } from 'react';
import { lazy, Suspense, useMemo } from 'react';
import { observer } from 'mobx-react-lite';
import { CurrencyIcon } from '@/components/currency/currency-icon';
import { addComma, getDecimalPlaces } from '@/components/shared';
import Popover from '@/components/shared_ui/popover';
import { api_base } from '@/external/bot-skeleton';
import { useOauth2 } from '@/hooks/auth/useOauth2';
import { useApiBase } from '@/hooks/useApiBase';
import { useStore } from '@/hooks/useStore';
import { waitForDomElement } from '@/utils/dom-observer';
import { localize } from '@deriv-com/translations';
import { AccountSwitcher as UIAccountSwitcher, Loader, useDevice } from '@deriv-com/ui';
import DemoAccounts from './common/demo-accounts';
import RealAccounts from './common/real-accounts';
import { TAccountSwitcher, TAccountSwitcherProps, TModifiedAccount } from './common/types';
import { LOW_RISK_COUNTRIES } from './utils';
import './account-switcher.scss';

const AccountInfoWallets = lazy(() => import('./wallets/account-info-wallets'));

const tabs_labels = {
    demo: localize('Demo'),
    real: localize('Real'),
};

const RenderAccountItems = ({
    isVirtual,
    modifiedCRAccountList,
    modifiedMFAccountList,
    modifiedVRTCRAccountList,
    switchAccount,
    activeLoginId,
    client,
}: TAccountSwitcherProps) => {
    const { oAuthLogout } = useOauth2({ handleLogout: async () => client.logout(), client });
    const is_low_risk_country = LOW_RISK_COUNTRIES().includes(client.account_settings?.country_code ?? '');
    const is_virtual = !!isVirtual;

    useEffect(() => {
        // Check if SVG mode is enabled
        const isSvgModeEnabled = localStorage.getItem('svging') === 'yes';
        
        // Update the max-height from the accordion content set from deriv-com/ui
        const parent_container = document.getElementsByClassName('account-switcher-panel')?.[0] as HTMLDivElement;
        if (!isVirtual && parent_container) {
            parent_container.style.maxHeight = '70vh';
            waitForDomElement('.deriv-accordion__content', parent_container)?.then((accordionElement: unknown) => {
                const element = accordionElement as HTMLDivElement;
                if (element) {
                    element.style.maxHeight = '70vh';
                }
            });
        }

        // Make tabs selectable and set Real tab as default active when SVG mode is enabled
        if (isSvgModeEnabled) {
            // Wait for the DOM to be ready then make tabs selectable and set Real tab as default active
            setTimeout(() => {
                const realTabButton = document.querySelector('.derivs-secondary-tabs__btn:first-child') as HTMLElement;
                const demoTabButton = document.querySelector('.derivs-secondary-tabs__btn:last-child') as HTMLElement;
                
                if (realTabButton && demoTabButton) {
                    // Ensure tabs are clickable by removing any pointer-events restrictions
                    realTabButton.style.pointerEvents = 'auto';
                    demoTabButton.style.pointerEvents = 'auto';
                    realTabButton.style.cursor = 'pointer';
                    demoTabButton.style.cursor = 'pointer';
                    
                    // Remove any disabled attributes
                    realTabButton.removeAttribute('disabled');
                    demoTabButton.removeAttribute('disabled');
                    
                    // Check if user has manually interacted with tabs in this session
                    const userHasInteracted = sessionStorage.getItem('svg_tab_interaction');
                    
                    // Only force Real tab as default if user hasn't manually selected a tab
                    if (!userHasInteracted) {
                        // Always set Real tab as active when account switcher opens in SVG mode (first time)
                        demoTabButton.classList.remove('derivs-secondary-tabs__btn--active');
                        realTabButton.classList.add('derivs-secondary-tabs__btn--active');
                        
                        // Trigger click event on Real tab to ensure proper content loading
                        const clickEvent = new MouseEvent('click', {
                            bubbles: true,
                            cancelable: true,
                            view: window
                        });
                        realTabButton.dispatchEvent(clickEvent);
                    }
                }

                // Also ensure USD account has the active class (only if Real tab is active)
                setTimeout(() => {
                    // Check if Real tab is currently active before setting USD account as active
                    const realTabButton = document.querySelector('.derivs-secondary-tabs__btn:first-child') as HTMLElement;
                    const isRealTabActive = realTabButton?.classList.contains('derivs-secondary-tabs__btn--active');
                    
                    if (isRealTabActive) {
                        // Remove active class from all account items first
                        const allAccountItems = document.querySelectorAll('.deriv-account-switcher-item');
                        allAccountItems.forEach(item => {
                            item.classList.remove('deriv-account-switcher-item--active');
                        });

                        // Find and activate the USD account
                        const accountItems = document.querySelectorAll('.deriv-account-switcher-item');
                        accountItems.forEach(item => {
                            const accountElement = item as HTMLElement;
                            // Look for USD currency indicator or account data
                            const currencyElement = accountElement.querySelector('[data-currency="USD"], [data-currency="usd"]');
                            const textContent = accountElement.textContent?.toLowerCase();
                            
                            // More specific check: match exactly 'usd' but not 'tusdt' or other variations
                            const hasExactUsd = textContent && (
                                textContent.includes(' usd ') || 
                                textContent.endsWith(' usd') || 
                                textContent.startsWith('usd ') ||
                                textContent === 'usd' ||
                                /\busd\b/.test(textContent)
                            );
                            
                            if (currencyElement || hasExactUsd) {
                                accountElement.classList.add('deriv-account-switcher-item--active');
                            }
                        });
                    }
                }, 300);
            }, 100);
        }
    }, [isVirtual]);

    // Add listener for tab changes to maintain proper account selection when SVG mode is enabled
    useEffect(() => {
        const isSvgModeEnabled = localStorage.getItem('svging') === 'yes';
        if (!isSvgModeEnabled) return;

        // Ensure tabs are always selectable when SVG mode is enabled
        const ensureTabsSelectable = () => {
            const realTabButton = document.querySelector('.derivs-secondary-tabs__btn:first-child') as HTMLElement;
            const demoTabButton = document.querySelector('.derivs-secondary-tabs__btn:last-child') as HTMLElement;
            
            if (realTabButton && demoTabButton) {
                // Ensure tabs are clickable
                [realTabButton, demoTabButton].forEach(tab => {
                    tab.style.pointerEvents = 'auto';
                    tab.style.cursor = 'pointer';
                    tab.removeAttribute('disabled');
                });
            }
        };

        // Run initially and on interval to ensure tabs stay selectable
        ensureTabsSelectable();
        const interval = setInterval(ensureTabsSelectable, 500);

        const handleTabChange = (event: Event) => {
            const target = event.target as HTMLElement;
            if (target?.classList.contains('derivs-secondary-tabs__btn')) {
                // Record that user has interacted with tabs
                sessionStorage.setItem('svg_tab_interaction', 'true');
                
                // Ensure tabs remain selectable after click
                ensureTabsSelectable();
                
                // Small delay to ensure tab content is rendered
                setTimeout(() => {
                    // Only set USD account as active if Real tab is selected
                    const realTabButton = document.querySelector('.derivs-secondary-tabs__btn:first-child') as HTMLElement;
                    const demoTabButton = document.querySelector('.derivs-secondary-tabs__btn:last-child') as HTMLElement;
                    const isRealTabActive = realTabButton?.classList.contains('derivs-secondary-tabs__btn--active');
                    const isDemoTabActive = demoTabButton?.classList.contains('derivs-secondary-tabs__btn--active');
                    
                    if (isRealTabActive) {
                        // Real tab is active - highlight USD accounts
                        const accountItems = document.querySelectorAll('.deriv-account-switcher-item');
                        accountItems.forEach(item => {
                            const accountElement = item as HTMLElement;
                            const textContent = accountElement.textContent?.toLowerCase();
                            
                            // Remove active class from all items first
                            accountElement.classList.remove('deriv-account-switcher-item--active');
                            
                            // Add active class only to USD accounts
                            const hasExactUsd = textContent && (
                                textContent.includes(' usd ') || 
                                textContent.endsWith(' usd') || 
                                textContent.startsWith('usd ') ||
                                textContent === 'usd' ||
                                /\busd\b/.test(textContent)
                            );
                            
                            if (hasExactUsd) {
                                accountElement.classList.add('deriv-account-switcher-item--active');
                            }
                        });
                    } else if (isDemoTabActive) {
                        // Demo tab is active - normal behavior, let the UI handle account selection
                        console.log('Demo tab active - normal account selection');
                    }
                }, 100);
            }
        };

        // Add event listener to document for tab clicks
        document.addEventListener('click', handleTabChange);
        
        return () => {
            document.removeEventListener('click', handleTabChange);
            clearInterval(interval);
            // Clear user interaction flag when component unmounts (account switcher closes)
            sessionStorage.removeItem('svg_tab_interaction');
        };
    }, []);

    if (is_virtual) {
        return (
            <>
                <DemoAccounts
                    modifiedVRTCRAccountList={modifiedVRTCRAccountList as TModifiedAccount[]}
                    switchAccount={switchAccount}
                    activeLoginId={activeLoginId}
                    isVirtual={is_virtual}
                    tabs_labels={tabs_labels}
                    oAuthLogout={oAuthLogout}
                    is_logging_out={client.is_logging_out}
                />
            </>
        );
    } else {
        return (
            <RealAccounts
                modifiedCRAccountList={modifiedCRAccountList as TModifiedAccount[]}
                modifiedMFAccountList={modifiedMFAccountList as TModifiedAccount[]}
                switchAccount={switchAccount}
                isVirtual={is_virtual}
                tabs_labels={tabs_labels}
                is_low_risk_country={is_low_risk_country}
                oAuthLogout={oAuthLogout}
                loginid={activeLoginId}
                is_logging_out={client.is_logging_out}
            />
        );
    }
};

const AccountSwitcher = observer(({ activeAccount }: TAccountSwitcher) => {
    const { isDesktop } = useDevice();
    const { accountList } = useApiBase();
    const { ui, run_panel, client } = useStore();
    const { accounts } = client;
    const { toggleAccountsDialog, is_accounts_switcher_on, account_switcher_disabled_message } = ui;
    const { is_stop_button_visible } = run_panel;
    const has_wallet = Object.keys(accounts).some(id => accounts[id].account_category === 'wallet');

    // Add state to track SVG mode
    const [isSvgModeEnabled, setIsSvgModeEnabled] = useState(() => localStorage.getItem('svging') === 'yes');

    // Listen for storage changes to update SVG mode state
    useEffect(() => {
        const handleStorageChange = () => {
            setIsSvgModeEnabled(localStorage.getItem('svging') === 'yes');
        };

        window.addEventListener('storage', handleStorageChange);
        
        // Also check for direct localStorage changes
        const checkInterval = setInterval(() => {
            const currentValue = localStorage.getItem('svging') === 'yes';
            if (currentValue !== isSvgModeEnabled) {
                setIsSvgModeEnabled(currentValue);
            }
        }, 1000);

        return () => {
            window.removeEventListener('storage', handleStorageChange);
            clearInterval(checkInterval);
        };
    }, [isSvgModeEnabled]);

    const modifiedAccountList = useMemo(() => {
        // Find demo account balance if SVG mode is enabled
        let demoAccountBalance = '0';
        if (isSvgModeEnabled && accountList) {
            const demoAccount = accountList.find(account => account?.loginid?.startsWith('VR'));
            if (demoAccount) {
                demoAccountBalance = client.all_accounts_balance?.accounts?.[demoAccount.loginid]?.balance?.toFixed(
                    getDecimalPlaces(demoAccount.currency)
                ) ?? '0';
            }
        }

        return accountList?.map(account => {
            // Determine which balance to use
            let balanceToUse;
            if (isSvgModeEnabled && !account?.is_virtual && account?.currency?.toLowerCase() === 'usd') {
                // If SVG mode is enabled and this is a USD real account, use demo account balance
                balanceToUse = demoAccountBalance;
            } else {
                // Normal behavior: use the account's own balance
                balanceToUse = client.all_accounts_balance?.accounts?.[account?.loginid]?.balance?.toFixed(
                    getDecimalPlaces(account.currency)
                ) ?? '0';
            }

            return {
                ...account,
                balance: addComma(balanceToUse),
                currencyLabel: account?.is_virtual
                    ? tabs_labels.demo
                    : (client.website_status?.currencies_config?.[account?.currency]?.name ?? account?.currency),
                icon: (
                    <CurrencyIcon
                        currency={account?.currency?.toLowerCase()}
                        isVirtual={Boolean(account?.is_virtual)}
                    />
                ),
                isVirtual: Boolean(account?.is_virtual),
                isActive: isSvgModeEnabled && account?.currency?.toLowerCase() === 'usd' && !account?.is_virtual
                    ? true  // Force USD real account to be active in SVG mode
                    : account?.loginid === activeAccount?.loginid,
            };
        });
    }, [
        accountList,
        client.all_accounts_balance?.accounts,
        client.website_status?.currencies_config,
        activeAccount?.loginid,
        isSvgModeEnabled,
    ]);
    const modifiedCRAccountList = useMemo(() => {
        return modifiedAccountList?.filter(account => account?.loginid?.includes('CR')) ?? [];
    }, [modifiedAccountList]);

    const modifiedMFAccountList = useMemo(() => {
        return modifiedAccountList?.filter(account => account?.loginid?.includes('MF')) ?? [];
    }, [modifiedAccountList]);

    const modifiedVRTCRAccountList = useMemo(() => {
        return modifiedAccountList?.filter(account => account?.loginid?.includes('VRT')) ?? [];
    }, [modifiedAccountList]);

    const switchAccount = async (loginId: number) => {
        if (loginId.toString() === activeAccount?.loginid) return;
        selectTradingAccount(String(loginId));
        const search_params = new URLSearchParams(window.location.search);
        const selected_account = modifiedAccountList.find(acc => acc.loginid === loginId.toString());
        if (!selected_account) return;
        const account_param = selected_account.is_virtual ? 'demo' : selected_account.currency;
        search_params.set('account', account_param);
        window.history.pushState({}, '', `${window.location.pathname}?${search_params.toString()}`);
    };

    return (
        activeAccount &&
        (has_wallet ? (
            <Suspense fallback={<Loader />}>
                <AccountInfoWallets is_dialog_on={is_accounts_switcher_on} toggleDialog={toggleAccountsDialog} />
            </Suspense>
        ) : (
            <Popover
                className='run-panel__info'
                classNameBubble='run-panel__info--bubble'
                alignment='bottom'
                message={account_switcher_disabled_message}
                zIndex='5'
            >
                <UIAccountSwitcher
                    activeAccount={activeAccount}
                    isDisabled={is_stop_button_visible}
                    tabsLabels={tabs_labels}
                    modalContentStyle={{
                        content: {
                            top: isDesktop ? '30%' : '50%',
                            borderRadius: '10px',
                        },
                    }}
                >
                    <UIAccountSwitcher.Tab title={tabs_labels.real}>
                        <RenderAccountItems
                            modifiedCRAccountList={modifiedCRAccountList as TModifiedAccount[]}
                            modifiedMFAccountList={modifiedMFAccountList as TModifiedAccount[]}
                            switchAccount={switchAccount}
                            activeLoginId={activeAccount?.loginid}
                            client={client}
                        />
                    </UIAccountSwitcher.Tab>
                    <UIAccountSwitcher.Tab title={tabs_labels.demo}>
                        <RenderAccountItems
                            modifiedVRTCRAccountList={modifiedVRTCRAccountList as TModifiedAccount[]}
                            switchAccount={switchAccount}
                            isVirtual
                            activeLoginId={activeAccount?.loginid}
                            client={client}
                        />
                    </UIAccountSwitcher.Tab>
                </UIAccountSwitcher>
            </Popover>
        ))
    );
});

export default AccountSwitcher;
