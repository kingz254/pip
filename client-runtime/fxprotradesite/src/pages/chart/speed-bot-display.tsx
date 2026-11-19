import { useState, useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { localize } from '@deriv-com/translations';
import { Button } from '@deriv-com/ui';
import { useStore } from '@/hooks/useStore';
import { api_base } from '@/external/bot-skeleton';
import { doUntilDone } from '@/external/bot-skeleton/services/tradeEngine/utils/helpers';
import { observer as globalObserver } from '@/external/bot-skeleton/utils/observer';
import './speed-bot-display.scss';
import EmojiAnimation from '@/components/emoji-animation';

// Available symbols and their display names
const AVAILABLE_SYMBOLS = [
    // Volatility Indices
    { value: 'R_10', label: 'Volatility 10 Index' },
    { value: 'R_25', label: 'Volatility 25 Index' },
    { value: 'R_50', label: 'Volatility 50 Index' },
    { value: 'R_75', label: 'Volatility 75 Index' },
    { value: 'R_100', label: 'Volatility 100 Index' },
    
    // 1-Second Volatility Indices
    { value: '1HZ10V', label: 'Volatility 10 (1s) Index' },
    { value: '1HZ15V', label: 'Volatility 15 (1s) Index' },
    { value: '1HZ25V', label: 'Volatility 25 (1s) Index' },
    { value: '1HZ30V', label: 'Volatility 30 (1s) Index' },
    { value: '1HZ50V', label: 'Volatility 50 (1s) Index' },
    { value: '1HZ75V', label: 'Volatility 75 (1s) Index' },
    { value: '1HZ90V', label: 'Volatility 90 (1s) Index' },
    { value: '1HZ100V', label: 'Volatility 100 (1s) Index' },
    
    // Daily Reset Indices
    { value: 'RDBEAR', label: 'Bear Market Index' },
    { value: 'RDBULL', label: 'Bull Market Index' },
    
    // Jump Indices
    { value: 'JD10', label: 'Jump 10 Index' },
    { value: 'JD25', label: 'Jump 25 Index' },
    { value: 'JD50', label: 'Jump 50 Index' },
    { value: 'JD75', label: 'Jump 75 Index' },
    { value: 'JD100', label: 'Jump 100 Index' },
    
    // Step Indices
    { value: 'STPRANDRNG', label: 'Step Index' },
];

// Available contract types
const CONTRACT_TYPES = [
    { value: 'CALLE', label: 'Rise', description: 'Price will be higher than entry spot' },
    { value: 'PUTE', label: 'Fall', description: 'Price will be lower than entry spot' },
    { value: 'DIGITEVEN', label: 'Even', description: 'Last digit will be even (0,2,4,6,8)' },
    { value: 'DIGITODD', label: 'Odd', description: 'Last digit will be odd (1,3,5,7,9)' },
    { value: 'DIGITOVER', label: 'Over', description: 'Last digit will be over selected barrier' },
    { value: 'DIGITUNDER', label: 'Under', description: 'Last digit will be under selected barrier' },
    { value: 'DIGITMATCH', label: 'Matches', description: 'Last digit will match selected number' },
    { value: 'DIGITDIFF', label: 'Differs', description: 'Last digit will differ from selected number' },
];

const SpeedBotDisplay = observer(() => {
    const { run_panel, transactions } = useStore();
    
    // Trading configuration state
    const [selectedSymbol, setSelectedSymbol] = useState('R_100');
    const [selectedContractType, setSelectedContractType] = useState('CALLE'); // Fixed: Use CALLE instead of CALL
    const [currentPrice, setCurrentPrice] = useState('Loading...');
    const [numberOfTicks, setNumberOfTicks] = useState<number | ''>(1); // Default to 1 tick
    const [stake, setStake] = useState<number | ''>(1); // Default to $1
    const [numberOfTrades, setNumberOfTrades] = useState<number | ''>(1); // Default to 1 trade
    const [barrier, setBarrier] = useState<number | ''>(''); // For over/under/matches/differs contracts
    const [tradeEachTick, setTradeEachTick] = useState(false); // Toggle for continuous trading
    
    // Trading state
    const [isTrading, setIsTrading] = useState(false);
    const [tradesExecuted, setTradesExecuted] = useState(0);
    const [isConnected, setIsConnected] = useState(false);
    
    // Emoji animation state
    const [showEmojiAnimation, setShowEmojiAnimation] = useState(false);
    const [isProfitPositive, setIsProfitPositive] = useState(false);
    
    // Define types for trade results
    interface TradeResult {
        success: boolean;
        contractId?: string;
        buy?: any;
        error?: string;
    }
    
    const [tradeResults, setTradeResults] = useState<TradeResult[]>([]);
    
    // WebSocket and refs
    const activeTradesRef = useRef(new Set());
    const sessionRunId = useRef(`speedbot_${Date.now()}`);
    const continuousTradingRef = useRef(false);
    const isTradingRef = useRef(false); // Ref to ensure tick handler has latest state
    
    // Initialize component and ensure default values are valid
    useEffect(() => {
        // Ensure default contract type exists in the list
        const defaultContractExists = CONTRACT_TYPES.find(ct => ct.value === selectedContractType);
        if (!defaultContractExists) {
            setSelectedContractType(CONTRACT_TYPES[0].value); // Set to first available contract
        }
        
        // Ensure default symbol exists in the list
        const defaultSymbolExists = AVAILABLE_SYMBOLS.find(sym => sym.value === selectedSymbol);
        if (!defaultSymbolExists) {
            setSelectedSymbol(AVAILABLE_SYMBOLS[0].value); // Set to first available symbol
        }
        
        // Set default values for inputs if they're empty
        if (numberOfTicks === '') {
            setNumberOfTicks(1);
        }
        if (stake === '') {
            setStake(1.00);
        }
        if (numberOfTrades === '') {
            setNumberOfTrades(1);
        }
        if (barrier === '') {
            setBarrier(5);
        }
        
        console.log('Speed Bot: Component initialized with defaults:', {
            symbol: selectedSymbol,
            contractType: selectedContractType
        });
    }, []); // Run once on mount
    
    // Initialize WebSocket for price updates using chart API
    useEffect(() => {
        if (!api_base?.api) {
            console.log('Speed Bot: API not ready, waiting...');
            setIsConnected(false);
            return;
        }

        const subscribeToPriceUpdates = () => {
            // Use the chart API for price subscriptions
            console.log(`Speed Bot: Subscribing to ${selectedSymbol} price updates`);
            
            const subscribeRequest = {
                ticks: selectedSymbol,
                subscribe: 1
            };

            // Use the existing API infrastructure
            api_base.api.send(subscribeRequest).then((response: any) => {
                if (response.error) {
                    console.error('Speed Bot: Error subscribing to ticks:', response.error);
                    setCurrentPrice('Error');
                    setIsConnected(false);
                } else {
                    console.log('Speed Bot: Successfully subscribed to price updates');
                    setIsConnected(true);
                    if (response.tick) {
                        setCurrentPrice(response.tick.quote.toFixed(4));
                    }
                }
            }).catch((error: any) => {
                console.error('Speed Bot: Error in price subscription:', error);
                setCurrentPrice('Error');
                setIsConnected(false);
            });

            // Listen for tick updates
            const subscription = api_base.api.onMessage()?.subscribe(({ data }: { data: any }) => {
                if (data.tick && data.tick.symbol === selectedSymbol) {
                    setCurrentPrice(data.tick.quote.toFixed(4));
                    setIsConnected(true);
                    
                    console.log(`Speed Bot: Tick received - Symbol: ${data.tick.symbol}, Price: ${data.tick.quote.toFixed(4)}, Continuous Trading: ${continuousTradingRef.current}, Is Trading: ${isTradingRef.current}`);
                    
                    // Handle continuous trading on each tick
                    if (continuousTradingRef.current && isTradingRef.current) {
                        console.log(`Speed Bot: New tick received at price ${data.tick.quote.toFixed(4)} - executing trade...`);
                        
                        // Execute trade on every tick without rate limiting
                        executeSingleTrade().then((result) => {
                            if (result.success) {
                                setTradesExecuted(prev => prev + 1);
                                console.log(`Speed Bot: Tick trade successful - Contract ID: ${result.contractId}`);
                            } else {
                                console.log(`Speed Bot: Tick trade failed - ${result.error}`);
                            }
                            setTradeResults(prev => [...prev, result]);
                        }).catch((error) => {
                            console.error('Speed Bot: Error in continuous trade execution:', error);
                            setTradeResults(prev => [...prev, { success: false, error: 'Trade execution failed' }]);
                        });
                    }
                }
            });

            return subscription;
        };

        const subscription = subscribeToPriceUpdates();
        
        return () => {
            if (subscription) {
                subscription.unsubscribe();
            }
        };
    }, [selectedSymbol]);

    // Subscribe to price updates when symbol changes
    useEffect(() => {
        if (!api_base?.api) {
            console.log('Speed Bot: API not available for price subscription');
            return;
        }
        
        // Reset price when symbol changes
        setCurrentPrice('Loading...');
        
        // Small delay to ensure the WebSocket is ready
        const timer = setTimeout(() => {
            console.log(`Speed Bot: Symbol changed to ${selectedSymbol}, subscribing to price updates`);
        }, 100);

        return () => clearTimeout(timer);
    }, [selectedSymbol]);

    // Add debugging for API state
    useEffect(() => {
        const interval = setInterval(() => {
            if (api_base?.api) {
                console.log('Speed Bot: API Status Check:', {
                    hasApi: !!api_base?.api,
                    readyState: api_base?.api?.ws?.readyState,
                    isConnected: api_base?.api?.ws?.readyState === 1,
                    connectionStatus: api_base?.api?.connectionStatus,
                });
            } else {
                console.log('Speed Bot: API not available');
            }
        }, 5000); // Check every 5 seconds
        
        return () => clearInterval(interval);
    }, []);

    // Register event listeners for speed bot run button integration
    useEffect(() => {
        const handleRunButtonStart = () => {
            if (!isTrading) {
                executeAllTrades();
            }
        };

        const handleRunButtonStop = () => {
            if (isTrading) {
                stopTrading();
            }
        };

        const handleStateRequest = () => {
            console.log('Speed Bot: State requested, emitting current state:', isTrading);
            globalObserver.emit('speed_bot.state_changed', { isRunning: isTrading });
        };

        globalObserver.register('speed_bot.start', handleRunButtonStart);
        globalObserver.register('speed_bot.stop', handleRunButtonStop);
        globalObserver.register('speed_bot.request_state', handleStateRequest);

        return () => {
            globalObserver.unregisterAll('speed_bot.start');
            globalObserver.unregisterAll('speed_bot.stop');
            globalObserver.unregisterAll('speed_bot.request_state');
        };
    }, [isTrading]); // Re-register when trading state changes

    // Sync isTrading state with ref for tick handler
    useEffect(() => {
        isTradingRef.current = isTrading;
    }, [isTrading]);

    // Emit initial state when component mounts or trading state changes
    useEffect(() => {
        globalObserver.emit('speed_bot.state_changed', { isRunning: isTrading });
    }, [isTrading]);
    
    // Contract type requires barrier input
    const requiresBarrier = () => {
        return ['DIGITOVER', 'DIGITUNDER', 'DIGITMATCH', 'DIGITDIFF'].includes(selectedContractType);
    };
    
    // Execute a single trade
    const executeSingleTrade = async (): Promise<TradeResult> => {
        console.log('Speed Bot: Starting executeSingleTrade...');
        
        try {
            interface ContractParameters {
                amount: number;
                basis: string;
                contract_type: string;
                currency: string;
                duration: number;
                duration_unit: string;
                symbol: string;
                barrier?: string;
            }
            
            const contractParameters: ContractParameters = {
                amount: typeof stake === 'number' ? stake : 1.00,
                basis: 'stake',
                contract_type: selectedContractType,
                currency: 'USD',
                duration: typeof numberOfTicks === 'number' ? numberOfTicks : 1,
                duration_unit: 't',
                symbol: selectedSymbol,
            };
            
            // Add barrier for contracts that need it
            if (requiresBarrier()) {
                const barrierValue = typeof barrier === 'number' ? barrier : 5;
                contractParameters.barrier = barrierValue.toString();
                console.log(`Speed Bot: Added barrier ${barrierValue} for contract type ${selectedContractType}`);
            }
            
            console.log('Speed Bot: Contract parameters:', contractParameters);
            console.log('Speed Bot: API available:', !!api_base?.api);
            
            if (!api_base?.api) {
                console.error('Speed Bot: API not available for trade execution');
                return { success: false, error: 'API not available' };
            }
            
            const buyRequest = {
                buy: 1,
                price: stake,
                parameters: contractParameters,
            };
            
            console.log('Speed Bot: Sending buy request:', buyRequest);
            
            const tradePromise = doUntilDone(() => 
                api_base.api.send(buyRequest), [], api_base
            );
            
            console.log('Speed Bot: Waiting for trade result...');
            const result = await tradePromise;
            console.log('Speed Bot: Trade result received:', result);
            
            if (result && result.buy) {
                const buy = result.buy;
                const contractId = buy.contract_id;
                
                console.log(`Speed Bot: Trade executed - Contract ID: ${contractId}`);
                
                // Track the trade
                activeTradesRef.current.add(contractId);
                
                // Create contract info for the run panel
                const contract_info = {
                    contract_id: buy.contract_id,
                    contract_type: selectedContractType,
                    transaction_ids: { buy: buy.transaction_id },
                    buy_price: typeof stake === 'number' ? stake : parseFloat(stake) || 0,
                    currency: 'USD',
                    symbol: selectedSymbol,
                    date_start: Math.floor(Date.now() / 1000),
                    run_id: sessionRunId.current,
                    display_name: `Speed Bot - ${CONTRACT_TYPES.find(ct => ct.value === selectedContractType)?.label}`,
                    transaction_time: Math.floor(Date.now() / 1000),
                    underlying: selectedSymbol,
                    longcode: buy.longcode || `Speed Bot trade on ${selectedSymbol}`,
                    display_message: `Speed Bot: ${CONTRACT_TYPES.find(ct => ct.value === selectedContractType)?.label} on ${selectedSymbol}`,
                };
                
                // Emit events for run panel integration
                globalObserver.emit('speed_bot.running');
                globalObserver.emit('bot.contract', contract_info);
                globalObserver.emit('bot.bot_ready');
                globalObserver.emit('contract.purchase_received', contractId);
                globalObserver.emit('contract.status', {
                    id: 'contract.purchase',
                    data: contract_info,
                    buy: buy,
                });
                
                // Update transactions store
                if (transactions) {
                    transactions.onBotContractEvent(contract_info);
                }
                
                return { success: true, contractId, buy };
            } else {
                throw new Error('Trade execution failed');
            }
        } catch (error) {
            console.error('Speed Bot trade error:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    };
    
    // Execute multiple trades
    const executeAllTrades = async () => {
        console.log('Speed Bot: executeAllTrades called');
        console.log('Speed Bot: Current state - isTrading:', isTrading, 'API ready:', !!api_base?.api);
        console.log('Speed Bot: Form values - stake:', stake, 'ticks:', numberOfTicks, 'trades:', numberOfTrades, 'tradeEachTick:', tradeEachTick);
        console.log('Speed Bot: Form valid:', isFormValid());
        console.log('Speed Bot: API base status:', {
            hasApiBase: !!api_base,
            hasApi: !!api_base?.api,
            apiReadyState: api_base?.api?.ws?.readyState,
            isConnected: api_base?.api?.ws?.readyState === 1
        });
        
        if (isTrading || !api_base?.api) {
            console.log('Speed Bot: Cannot execute trades - already trading or API not ready');
            return;
        }
        
        if (!isFormValid()) {
            console.error('Speed Bot: Form validation failed');
            console.log('Speed Bot: Validation details:', {
                hasValidStake: typeof stake === 'number' && stake >= 0.35,
                hasValidTicks: typeof numberOfTicks === 'number' && numberOfTicks >= 1,
                hasValidTrades: tradeEachTick || (typeof numberOfTrades === 'number' && numberOfTrades >= 1),
                hasValidBarrier: !requiresBarrier() || (typeof barrier === 'number' && barrier >= 0 && barrier <= 9),
            });
            return;
        }
        
        setIsTrading(true);
        isTradingRef.current = true; // Sync ref with state
        setTradesExecuted(0);
        setTradeResults([]);
        
        // Emit state change for the run button
        globalObserver.emit('speed_bot.state_changed', { isRunning: true });

        // Prepare run panel
        if (!run_panel.is_drawer_open) {
            run_panel.toggleDrawer(true);
        }
        run_panel.setActiveTabIndex(1);
        globalObserver.emit('bot.running');
        globalObserver.emit('bot.started', sessionRunId.current);
        
        if (tradeEachTick) {
            // Continuous trading mode
            console.log('Speed Bot: Starting continuous trading mode...');
            continuousTradingRef.current = true;
            
            // The actual trading will happen in the tick subscription
            // This mode continues until manually stopped
            // Note: isTrading remains true for continuous mode
            return; // Exit early to keep isTrading = true
        } else {
            // Bulk trading mode
            console.log(`Speed Bot: Starting execution of ${numberOfTrades} trades immediately...`);
            continuousTradingRef.current = false;
            
            // Create array of trade promises to execute all trades simultaneously
            const tradePromises: Promise<TradeResult>[] = [];
            
            for (let i = 0; i < Number(numberOfTrades); i++) {
                console.log(`Speed Bot: Preparing trade ${i + 1} of ${numberOfTrades}`);
                tradePromises.push(executeSingleTrade());
            }
            
            try {
                // Execute all trades simultaneously
                console.log(`Speed Bot: Executing ${numberOfTrades} trades simultaneously...`);
                const results = await Promise.all(tradePromises);
                
                // Update results and counts
                setTradeResults(results);
                const successfulTrades = results.filter(r => r.success).length;
                setTradesExecuted(successfulTrades);
                
                console.log(`Speed Bot: Completed ${successfulTrades}/${Number(numberOfTrades)} trades successfully`);
                
                // Show summary
                if (successfulTrades === Number(numberOfTrades)) {
                    console.log('🎉 All trades executed successfully!');
                } else {
                    console.log(`⚠️ ${Number(numberOfTrades) - successfulTrades} trades failed`);
                }
                
            } catch (error) {
                console.error('Speed Bot: Error executing trades:', error);
                // If Promise.all fails, we still want to show partial results
                setTradeResults([{ success: false, error: 'Failed to execute trades simultaneously' }]);
            }
            
            // Only set trading to false for bulk mode
            setIsTrading(false);
            isTradingRef.current = false; // Sync ref with state
            
            // Emit completion events (for bulk mode)
            globalObserver.emit('bot.stopped');
        }
    };
    
    // Validation helper
    const isFormValid = () => {
        const hasValidStake = typeof stake === 'number' && stake >= 0.35;
        const hasValidTicks = typeof numberOfTicks === 'number' && numberOfTicks >= 1;
        const hasValidTrades = tradeEachTick || (typeof numberOfTrades === 'number' && numberOfTrades >= 1);
        const hasValidBarrier = !requiresBarrier() || (typeof barrier === 'number' && barrier >= 0 && barrier <= 9);
        
        return hasValidStake && hasValidTicks && hasValidTrades && hasValidBarrier;
    };

    const stopTrading = () => {
        setIsTrading(false);
        isTradingRef.current = false; // Sync ref with state
        continuousTradingRef.current = false;
        globalObserver.emit('bot.stopped');
        
        // Emit state change for the run button
        globalObserver.emit('speed_bot.state_changed', { isRunning: false });
        
        // Get profit information and trigger emoji animation
        const total_profit = transactions?.statistics?.total_profit || 0;
        
        // Show emoji animation based on profit
        setIsProfitPositive(total_profit >= 0);
        setShowEmojiAnimation(true);
        
        // Hide emoji animation after 6 seconds
        setTimeout(() => {
            setShowEmojiAnimation(false);
        }, 6000);
        
        console.log('Speed Bot: Showing emoji animation with profit positive:', total_profit >= 0);
    };
    
    const selectedContractTypeInfo = CONTRACT_TYPES.find(ct => ct.value === selectedContractType);
    
    return (
        <div className='speed-bot-display'>
            {/* Show emoji animation when stopping trading and profit/loss is available */}
            {showEmojiAnimation && (
                <EmojiAnimation isPositive={isProfitPositive} />
            )}

            <div className='speed-bot-container'>
                <div className='trading-config-card'>
                    <div className='config-header'>
                        <h3>{localize('Trading Configuration')}</h3>
                        <div className='trading-mode-selector'>
                            <span className='mode-label'>{localize('Trading Mode:')}</span>
                            <div className='toggle-container'>
                                <span className={`mode-option ${!tradeEachTick ? 'active' : ''}`}>
                                    {localize('Bulk')}
                                </span>
                                <div className='toggle-wrapper'>
                                    <input
                                        type='checkbox'
                                        id='trading-mode-toggle'
                                        checked={tradeEachTick}
                                        onChange={(e) => setTradeEachTick(e.target.checked)}
                                        className='toggle-input'
                                    />
                                    <label htmlFor='trading-mode-toggle' className='toggle-track'>
                                        <span className='toggle-thumb'></span>
                                    </label>
                                </div>
                                <span className={`mode-option ${tradeEachTick ? 'active' : ''}`}>
                                    {localize('Trade each tick')}
                                </span>
                            </div>
                            <div className='mode-description'>
                                {tradeEachTick 
                                    ? localize('Execute one trade on every price tick') 
                                    : localize('Execute multiple trades at once')
                                }
                            </div>
                        </div>
                    </div>
                    
                    {/* Row 1: Symbol Selection & Current Price */}
                    <div className='config-row'>
                        <div className='config-group flex-3'>
                            <label htmlFor='symbol-select'>{localize('Symbol')}</label>
                            <select 
                                id='symbol-select'
                                value={selectedSymbol}
                                onChange={(e) => setSelectedSymbol(e.target.value)}
                                className='config-select'
                            >
                                {AVAILABLE_SYMBOLS.map(symbol => (
                                    <option key={symbol.value} value={symbol.value}>
                                        {symbol.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        
                        <div className='config-group flex-1'>
                            <label>{localize('Current Price')}</label>
                            <div className={`price-display ${isConnected ? 'connected' : 'disconnected'}`}>
                                {currentPrice}
                                <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
                                    {isConnected ? '●' : '○'}
                                </span>
                            </div>
                        </div>
                    </div>
                    
                    {/* Row 2: Contract Type & Number of Ticks/Barrier */}
                    <div className='config-row'>
                        <div className='config-group flex-3'>
                            <label htmlFor='contract-select'>{localize('Contract Type')}</label>
                            <select 
                                id='contract-select'
                                value={selectedContractType}
                                onChange={(e) => setSelectedContractType(e.target.value)}
                                className='config-select'
                            >
                                {CONTRACT_TYPES.map(contract => (
                                    <option key={contract.value} value={contract.value}>
                                        {contract.label}
                                    </option>
                                ))}
                            </select>
                            {selectedContractTypeInfo && (
                                <div className='contract-description'>
                                    {selectedContractTypeInfo.description}
                                </div>
                            )}
                        </div>
                        
                        <div className='config-group flex-1'>
                            {requiresBarrier() ? (
                                <>
                                    <label htmlFor='barrier-input'>
                                        {selectedContractType.includes('OVER') || selectedContractType.includes('UNDER') 
                                            ? localize('Barrier (0-9)') 
                                            : localize('Target Digit (0-9)')
                                        }
                                    </label>
                                    <input
                                        id='barrier-input'
                                        type='number'
                                        min='0'
                                        max='9'
                                        value={barrier}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            if (value === '') {
                                                setBarrier('');
                                            } else {
                                                const numValue = parseInt(value);
                                                if (!isNaN(numValue)) {
                                                    setBarrier(numValue);
                                                }
                                            }
                                        }}
                                        className='config-input'
                                        placeholder='Enter digit 0-9'
                                    />
                                </>
                            ) : (
                                <>
                                    <label htmlFor='ticks-input'>{localize('Number of Ticks')}</label>
                                    <input
                                        id='ticks-input'
                                        type='number'
                                        min='1'
                                        max='20'
                                        value={numberOfTicks}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            if (value === '') {
                                                setNumberOfTicks('');
                                            } else {
                                                const numValue = parseInt(value);
                                                if (!isNaN(numValue)) {
                                                    setNumberOfTicks(numValue);
                                                }
                                            }
                                        }}
                                        className='config-input'
                                        placeholder='Enter number of ticks'
                                    />
                                </>
                            )}
                        </div>
                    </div>
                    
                    {/* Row 3: Stake Amount & Number of Trades (conditional) */}
                    <div className='config-row'>
                        <div className='config-group flex-1'>
                            <label htmlFor='stake-input'>{localize('Stake Amount (USD)')}</label>
                            <input
                                id='stake-input'
                                type='number'
                                min='0.35'
                                step='0.01'
                                value={stake}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === '') {
                                        setStake('');
                                    } else {
                                        const numValue = parseFloat(value);
                                        if (!isNaN(numValue)) {
                                            setStake(numValue);
                                        }
                                    }
                                }}
                                className='config-input'
                                placeholder='Enter stake amount'
                            />
                        </div>
                        
                        {!tradeEachTick && (
                            <div className='config-group flex-1'>
                                <label htmlFor='trades-input'>{localize('Number of Trades')}</label>
                                <input
                                    id='trades-input'
                                    type='number'
                                    min='1'
                                    max='100'
                                    value={numberOfTrades}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        if (value === '') {
                                            setNumberOfTrades('');
                                        } else {
                                            const numValue = parseInt(value);
                                            if (!isNaN(numValue)) {
                                                setNumberOfTrades(numValue);
                                            }
                                        }
                                    }}
                                    className='config-input'
                                    placeholder='Enter number of trades'
                                />
                            </div>
                        )}
                    </div>
                    
                    {/* Additional row for ticks when barrier is shown */}
                    {requiresBarrier() && (
                        <div className='config-row'>
                            <div className='config-group flex-1'>
                                <label htmlFor='ticks-input'>{localize('Number of Ticks')}</label>
                                <input
                                    id='ticks-input'
                                    type='number'
                                    min='1'
                                    max='20'
                                    value={numberOfTicks}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        if (value === '') {
                                            setNumberOfTicks('');
                                        } else {
                                            const numValue = parseInt(value);
                                            if (!isNaN(numValue)) {
                                                setNumberOfTicks(numValue);
                                            }
                                        }
                                    }}
                                    className='config-input'
                                    placeholder='Enter number of ticks'
                                />
                            </div>
                            <div className='config-group flex-1'>
                                {/* Empty space for symmetry */}
                            </div>
                        </div>
                    )}
                    
                    {/* Execute Button */}
                    <div className='execute-section'>
                        <Button
                            onClick={isTrading ? stopTrading : executeAllTrades}
                            className={`execute-button ${isTrading ? 'stop-button' : 'start-button'}`}
                            disabled={!api_base?.api || (!isTrading && !isFormValid())}
                        >
                            {isTrading 
                                ? localize('Stop Trading') 
                                : tradeEachTick 
                                    ? localize('Start Continuous Trading')
                                    : localize('Execute Trades')
                            }
                        </Button>
                        
                        {!api_base?.api && (
                            <div className='api-status-warning'>
                                {localize('Waiting for API connection...')}
                            </div>
                        )}
                        
                        {api_base?.api && !isTrading && !isFormValid() && (
                            <div className='validation-warning'>
                                {localize('Please fill in all required fields with valid values to start trading')}
                            </div>
                        )}
                        
                        {isTrading && (
                            <div className='trading-progress'>
                                {tradeEachTick 
                                    ? localize('Continuous trading active... Trades executed: ') + tradesExecuted
                                    : localize('Executing trades...') + ` (${tradesExecuted}/${numberOfTrades})`
                                }
                            </div>
                        )}
                    </div>
                </div>
                
                {/* Trading Results */}
                {tradeResults.length > 0 && (
                    <div className='results-card'>
                        <h3>{localize('Trading Results')}</h3>
                        <div className='results-summary'>
                            <div className='result-stat'>
                                <span className='stat-label'>{localize('Total Trades:')}</span>
                                <span className='stat-value'>{tradeResults.length}</span>
                            </div>
                            <div className='result-stat'>
                                <span className='stat-label'>{localize('Successful:')}</span>
                                <span className='stat-value success'>
                                    {tradeResults.filter(r => r.success).length}
                                </span>
                            </div>
                            <div className='result-stat'>
                                <span className='stat-label'>{localize('Failed:')}</span>
                                <span className='stat-value error'>
                                    {tradeResults.filter(r => !r.success).length}
                                </span>
                            </div>
                        </div>
                        
                        <div className='results-list'>
                            {tradeResults.map((result, index) => (
                                <div key={index} className={`result-item ${result.success ? 'success' : 'error'}`}>
                                    <span className='result-number'>#{index + 1}</span>
                                    <span className='result-status'>
                                        {result.success ? '✓ Success' : '✗ Failed'}
                                    </span>
                                    {result.success && result.contractId && (
                                        <span className='result-contract'>
                                            Contract: {result.contractId}
                                        </span>
                                    )}
                                    {!result.success && result.error && (
                                        <span className='result-error'>{result.error}</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
});

export default SpeedBotDisplay;
