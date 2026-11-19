import React from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import Button from '@/components/shared_ui/button';
import { DBOT_TABS } from '@/constants/bot-contents';
import { useStore } from '@/hooks/useStore';
import {
    DerivLightBotBuilderIcon,
    DerivLightLocalDeviceIcon,
    DerivLightMyComputerIcon,
    DerivLightQuickStrategyIcon,
} from '@deriv/quill-icons/Illustration';
import { LabelPairedChartLineMdRegularIcon, LabelPairedLaptopMdRegularIcon, LabelPairedUsersMdRegularIcon } from '@deriv/quill-icons/LabelPaired';
import { rudderStackSendOpenEvent } from '../../analytics/rudderstack-common-events';
import { rudderStackSendDashboardClickEvent } from '../../analytics/rudderstack-dashboard';
import DashboardBotList from './bot-list/dashboard-bot-list';
import FreeBotSearchBar from './free-bot-search-bar';

type TCardProps = {
    has_dashboard_strategies: boolean;
    is_mobile: boolean;
};

type TCardAction = {
    id: string;
    label: string;
    icon: React.ReactElement;
    callback: () => void;
    variant?: 'primary' | 'secondary' | 'tertiary';
};

const Cards = observer(({ is_mobile, has_dashboard_strategies }: TCardProps) => {
    const { dashboard, load_modal, quick_strategy } = useStore();
    const { toggleLoadModal, setActiveTabIndex } = load_modal;
    const { setActiveTab } = dashboard;
    const { setFormVisibility } = quick_strategy;

    const openFileLoader = () => {
        toggleLoadModal();
        setActiveTabIndex(is_mobile ? 0 : 1);
        setActiveTab(DBOT_TABS.BOT_BUILDER);
    };

    const actions: TCardAction[] = [
        {
            id: 'my-computer',
            label: is_mobile ? 'Load Bot' : 'Load from Computer',
            icon: is_mobile ? (
                <DerivLightLocalDeviceIcon height='24px' width='24px' />
            ) : (
                <DerivLightMyComputerIcon height='24px' width='24px' />
            ),
            variant: 'primary',
            callback: () => {
                openFileLoader();
                rudderStackSendOpenEvent({
                    subpage_name: 'bot_builder',
                    subform_source: 'dashboard',
                    subform_name: 'quick_strategy',
                });
            },
        },
        {
            id: 'quick-strategy',
            label: 'Quick Strategy',
            icon: <DerivLightQuickStrategyIcon height='24px' width='24px' />,
            variant: 'primary',
            callback: () => {
                setActiveTab(DBOT_TABS.BOT_BUILDER);
                setFormVisibility(true);
                rudderStackSendOpenEvent({
                    subpage_name: 'bot_builder',
                    subform_source: 'dashboard',
                    subform_name: 'quick_strategy',
                });
            },
        },
        {
            id: 'bot-builder',
            label: 'Bot Builder',
            icon: <DerivLightBotBuilderIcon height='24px' width='24px' />,
            variant: 'secondary',
            callback: () => {
                setActiveTab(DBOT_TABS.BOT_BUILDER);
                rudderStackSendDashboardClickEvent({});
            },
        },
        {
            id: 'free-bots',
            label: 'Free Bots',
            icon: <LabelPairedLaptopMdRegularIcon height='24px' width='24px' />,
            variant: 'secondary',
            callback: () => {
                setActiveTab(DBOT_TABS.FREE_BOTS);
                rudderStackSendDashboardClickEvent({});
            },
        },
        {
            id: 'analysis-tool',
            label: 'Analysis Tools',
            icon: <LabelPairedChartLineMdRegularIcon height='24px' width='24px' />,
            variant: 'tertiary',
            callback: () => {
                setActiveTab(DBOT_TABS.ANALYSIS_TOOL);
                rudderStackSendDashboardClickEvent({});
            },
        },
    ];

    return React.useMemo(
        () => (
            <div className='dashboard-container'>
                <div className='dashboard-header'>
                    <h1 className='dashboard-title'>DBot Dashboard</h1>
                    <p className='dashboard-subtitle'>
                        Choose an action to get started with your trading bot
                    </p>
                </div>
                
                {/* Free Bot Search Bar */}
                <FreeBotSearchBar />
                
                <div className='dashboard-actions'>
                    {actions.map(action => {
                        const { label, callback, id, icon, variant } = action;
                        return (
                            <button
                                key={id}
                                id={id}
                                className={classNames('dashboard-btn', {
                                    'dashboard-btn--primary': variant === 'primary',
                                    'dashboard-btn--secondary': variant === 'secondary',
                                    'dashboard-btn--tertiary': variant === 'tertiary',
                                    'dashboard-btn--neon-glow': id === 'community',
                                    'dashboard-btn--mobile': is_mobile,
                                })}
                                onClick={callback}
                            >
                                <div className='dashboard-btn__icon'>{icon}</div>
                                <span className='dashboard-btn__text'>{label}</span>
                            </button>
                        );
                    })}
                </div>
                
                <DashboardBotList />
            </div>
        ),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [has_dashboard_strategies, is_mobile]
    );
});

export default Cards;
