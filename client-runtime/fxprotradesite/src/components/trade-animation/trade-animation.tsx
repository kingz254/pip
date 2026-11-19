import React from 'react';
import classNames from 'classnames';
import { observer } from 'mobx-react-lite';
import ContractResultOverlay from '@/components/contract-result-overlay';
import { contract_stages } from '@/constants/contract-stage';
import { DBOT_TABS } from '@/constants/bot-contents';
import { popover_zindex } from '@/constants/z-indexes';
import { useStore } from '@/hooks/useStore';
import { LabelPairedPlayLgFillIcon, LabelPairedSquareLgFillIcon } from '@deriv/quill-icons/LabelPaired';
import { Localize } from '@deriv-com/translations';
import { rudderStackSendRunBotEvent } from '../../analytics/rudderstack-common-events';
import { observer as globalObserver } from '../../external/bot-skeleton/utils/observer';
import Button from '../shared_ui/button';
import CircularWrapper from './circular-wrapper';
import ContractStageText from './contract-stage-text';

type TTradeAnimation = {
    className?: string;
    should_show_overlay?: boolean;
};

const TradeAnimation = observer(({ className, should_show_overlay }: TTradeAnimation) => {
    const { dashboard, run_panel, summary_card } = useStore();
    const { client } = useStore();
    const { active_tab } = dashboard;
    const { is_contract_completed, profit } = summary_card;
    const {
        contract_stage,
        is_stop_button_visible,
        is_stop_button_disabled,
        onRunButtonClick,
        onStopBotClick,
        onStopButtonClick, // Add onStopButtonClick to trigger emoji animations
        performSelfExclusionCheck,
    } = run_panel;
    const { account_status } = client;
    const cashier_validation = account_status?.cashier_validation;
    const [shouldDisable, setShouldDisable] = React.useState(false);
    const [autoTabActiveDisplay, setAutoTabActiveDisplay] = React.useState('trading'); // Track active display in auto tab
    const [chartTabActiveDisplay, setChartTabActiveDisplay] = React.useState('smart-trading'); // Track active display in chart tab
    const [isTradingHubRunning, setIsTradingHubRunning] = React.useState(false); // Track trading hub state
    const [isSmartTradingRunning, setIsSmartTradingRunning] = React.useState(false); // Track smart trading state
    const [isSpeedBotRunning, setIsSpeedBotRunning] = React.useState(false); // Track speed bot state
    const is_unavailable_for_payment_agent = cashier_validation?.includes('WithdrawServiceUnavailableForPA');

    // perform self-exclusion checks which will be stored under the self-exclusion-store
    React.useEffect(() => {
        performSelfExclusionCheck();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Listen for tab display changes and state changes
    React.useEffect(() => {
        const handleAutoTabDisplayChange = (activeDisplay: string) => {
            console.log('Trade Animation: Auto tab display changed to:', activeDisplay);
            setAutoTabActiveDisplay(activeDisplay);
        };

        const handleChartTabDisplayChange = (activeDisplay: string) => {
            console.log('Trade Animation: Chart tab display changed to:', activeDisplay);
            setChartTabActiveDisplay(activeDisplay);
        };

        const handleTradingHubStateChange = (state: { isRunning: boolean }) => {
            console.log('Trade Animation: Trading hub state changed:', state);
            setIsTradingHubRunning(state.isRunning);
        };

        const handleSmartTradingStateChange = (state: { isRunning: boolean; strategyId: string }) => {
            console.log('Trade Animation: Smart trading state changed:', state);
            setIsSmartTradingRunning(state.isRunning);
        };

        const handleSpeedBotStateChange = (state: { isRunning: boolean }) => {
            console.log('Trade Animation: Speed bot state changed:', state);
            setIsSpeedBotRunning(state.isRunning);
        };

        globalObserver.register('auto_tab.display_changed', handleAutoTabDisplayChange);
        globalObserver.register('chart_tab.display_changed', handleChartTabDisplayChange);
        globalObserver.register('trading_hub.state_changed', handleTradingHubStateChange);
        globalObserver.register('smart_trading.state_changed', handleSmartTradingStateChange);
        globalObserver.register('speed_bot.state_changed', handleSpeedBotStateChange);

        // Request current states from all components after listeners are registered
        setTimeout(() => {
            globalObserver.emit('trading_hub.request_state');
            globalObserver.emit('smart_trading.request_state');
            globalObserver.emit('speed_bot.request_state');
        }, 100);

        return () => {
            globalObserver.unregisterAll('auto_tab.display_changed');
            globalObserver.unregisterAll('chart_tab.display_changed');
            globalObserver.unregisterAll('trading_hub.state_changed');
            globalObserver.unregisterAll('smart_trading.state_changed');
            globalObserver.unregisterAll('speed_bot.state_changed');
        };
    }, []);

    React.useEffect(() => {
        if (shouldDisable) {
            setTimeout(() => {
                setShouldDisable(false);
            }, 1000);
        }
    }, [shouldDisable]);

    const status_classes = ['', '', ''];
    const is_purchase_sent = contract_stage === (contract_stages.PURCHASE_SENT as unknown);
    const is_purchase_received = contract_stage === (contract_stages.PURCHASE_RECEIVED as unknown);

    let progress_status = contract_stage - (is_purchase_sent || is_purchase_received ? 2 : 3);

    if (progress_status >= 0) {
        if (progress_status < status_classes.length) {
            status_classes[progress_status] = 'active';
        }

        if (is_contract_completed) {
            progress_status += 1;
        }

        for (let i = 0; i < progress_status - 1; i++) {
            status_classes[i] = 'completed';
        }
    }

    const is_disabled = is_stop_button_disabled || shouldDisable;

    const button_props = React.useMemo(() => {
        // Check if we're on auto tab with trading hub display active
        const isOnTradingHub = active_tab === DBOT_TABS.AUTO && autoTabActiveDisplay === 'trading';
        // Check if we're on chart tab with smart trading display active
        const isOnSmartTrading = active_tab === DBOT_TABS.CHART && chartTabActiveDisplay === 'smart-trading';
        // Check if we're on chart tab with speed bot display active
        const isOnSpeedBot = active_tab === DBOT_TABS.CHART && chartTabActiveDisplay === 'speed-bot';
        
        const shouldShowStopButton = 
            isOnTradingHub ? isTradingHubRunning :
            isOnSmartTrading ? isSmartTradingRunning :
            isOnSpeedBot ? isSpeedBotRunning :
            is_stop_button_visible;
        
        console.log('Trade Animation Button Props Debug:', {
            active_tab,
            autoTabActiveDisplay,
            chartTabActiveDisplay,
            isOnTradingHub,
            isOnSmartTrading,
            isOnSpeedBot,
            isTradingHubRunning,
            isSmartTradingRunning,
            isSpeedBotRunning,
            is_stop_button_visible,
            shouldShowStopButton
        });
        
        if (shouldShowStopButton) {
            return {
                id: 'db-animation__stop-button',
                class: 'animation__stop-button',
                text: <Localize i18n_default_text='Stop' />,
                icon: <LabelPairedSquareLgFillIcon fill='#fff' />,
            };
        }
        return {
            id: 'db-animation__run-button',
            class: 'animation__run-button',
            text: <Localize i18n_default_text='Run' />,
            icon: <LabelPairedPlayLgFillIcon fill='#fff' />,
        };
    }, [is_stop_button_visible, active_tab, autoTabActiveDisplay, chartTabActiveDisplay, isTradingHubRunning, isSmartTradingRunning, isSpeedBotRunning]);
    const show_overlay = should_show_overlay && is_contract_completed;

    const TAB_NAMES = [
        'dashboard',
        'bot_builder', 
        'chart',
        'tutorial',
        'analysis_tool',
        'signals',
        'portfolio',
        'free_bots',
    ] as const;
    const getTabName = (index: number) => TAB_NAMES[index];

    // Define which tabs should show the run button
    const allowedTabs = [
        DBOT_TABS.DASHBOARD,    // 0: dashboard
        DBOT_TABS.BOT_BUILDER,  // 1: bot_builder 
        DBOT_TABS.CHART,        // 3: chart (smart trading/speed bot)
        DBOT_TABS.AUTO,         // 4: auto (trading hub)
        DBOT_TABS.ANALYSIS_TOOL, // 5: analysis_tool
        DBOT_TABS.SIGNALS,      // 6: signals
    ];
    const shouldShowButton = allowedTabs.includes(active_tab);

    return (
        <div className={classNames('animation__wrapper', className)}>
            {shouldShowButton && (
                <Button
                    is_disabled={is_disabled && !is_unavailable_for_payment_agent}
                    className={button_props.class}
                    id={button_props.id}
                    icon={button_props.icon}
                    onClick={() => {
                        console.log('Trade Animation: Button clicked!', {
                            active_tab,
                            autoTabActiveDisplay,
                            chartTabActiveDisplay,
                            isTradingHubRunning,
                            isSmartTradingRunning,
                            isSpeedBotRunning,
                            is_stop_button_visible
                        });
                        
                        setShouldDisable(true);
                        
                        // Check if we're on the auto tab and trading hub display is active
                        if (active_tab === DBOT_TABS.AUTO && autoTabActiveDisplay === 'trading') {
                            console.log('Trade Animation: Trading Hub action triggered');
                            // Use trading hub's start/stop functions
                            if (isTradingHubRunning) {
                                globalObserver.emit('trading_hub.stop');
                            } else {
                                globalObserver.emit('trading_hub.start');
                            }
                            return;
                        }
                        
                        // Check if we're on the chart tab and smart trading display is active
                        if (active_tab === DBOT_TABS.CHART && chartTabActiveDisplay === 'smart-trading') {
                            console.log('Trade Animation: Smart Trading action triggered');
                            // Use smart trading's start/stop functions
                            if (isSmartTradingRunning) {
                                globalObserver.emit('smart_trading.stop');
                            } else {
                                globalObserver.emit('smart_trading.start');
                            }
                            return;
                        }
                        
                        // Check if we're on the chart tab and speed bot display is active
                        if (active_tab === DBOT_TABS.CHART && chartTabActiveDisplay === 'speed-bot') {
                            console.log('Trade Animation: Speed Bot action triggered');
                            // Use speed bot's start/stop functions
                            if (isSpeedBotRunning) {
                                globalObserver.emit('speed_bot.stop');
                            } else {
                                globalObserver.emit('speed_bot.start');
                            }
                            return;
                        }
                        
                        // For other tabs, use the regular run panel functions
                        console.log('Trade Animation: Using default run panel actions');
                        if (is_stop_button_visible) {
                            onStopButtonClick(); // Call onStopButtonClick instead of onStopBotClick to trigger emoji animations
                            return;
                        }
                        onRunButtonClick();
                        // Only send analytics if we have a valid tab name
                        const tabName = getTabName(active_tab);
                        if (tabName) {
                            // Convert tab names to match expected analytics values
                            const analyticsTabName = tabName === 'chart' ? 'charts' : 
                                                    tabName === 'tutorial' ? 'tutorials' : 
                                                    tabName;
                            if (['dashboard', 'bot_builder', 'charts', 'tutorials'].includes(analyticsTabName)) {
                                rudderStackSendRunBotEvent({ 
                                    subpage_name: analyticsTabName as 'dashboard' | 'bot_builder' | 'charts' | 'tutorials'
                                });
                            }
                        }
                    }}
                    has_effect
                    {...(is_stop_button_visible || !is_unavailable_for_payment_agent ? { primary: true } : { green: true })}
                >
                    {button_props.text}
                </Button>
            )}
            <div
                className={classNames('animation__container', className, {
                    'animation--running': contract_stage > 0,
                    'animation--completed': show_overlay,
                })}
            >
                {show_overlay && <ContractResultOverlay profit={profit ?? 0} />}
                <span className='animation__text'>
                    <ContractStageText contract_stage={contract_stage} />
                </span>
                <div className='animation__progress'>
                    <div className='animation__progress-line'>
                        <div className={`animation__progress-bar animation__progress-${contract_stage}`} />
                    </div>
                    {status_classes.map((status_class, i) => (
                        <CircularWrapper key={`status_class-${status_class}-${i}`} className={status_class} />
                    ))}
                </div>
            </div>
        </div>
    );
});

export default TradeAnimation;
