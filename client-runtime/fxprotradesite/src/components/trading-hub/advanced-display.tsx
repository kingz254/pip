import { useApiBase } from '@/hooks/useApiBase';
import { api_base } from '@/external/bot-skeleton';
import { getSelectedAccount, logoutTradingSession } from '../../pipforge/session';
import { redirectToLogin } from '@/components/shared/utils/login/login';
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { Button, Text, Input } from '@deriv-com/ui';
import classNames from 'classnames';
import { ProposalOpenContract } from '@deriv/api-types';
import './advanced-display.scss';
import { observer as globalObserver } from '../../external/bot-skeleton/utils/observer';
import { useStore } from '@/hooks/useStore';

// Symbol type for multi-symbol analysis
type SymbolType = 'R_10' | 'R_25' | 'R_50' | 'R_75' | 'R_100' | '1HZ10V' | '1HZ15V' | '1HZ25V' | '1HZ30V' | '1HZ50V' | '1HZ75V' | '1HZ90V' | '1HZ100V';
type SymbolTickData = {
    tickHistory: Array<{ time: number; quote: number }>;
    decimalPlaces: number;
    symbolWs?: WebSocket;
    currentDigit?: number; // Add tracking for current digit
};

type ParityType = 'even' | 'odd';
type DirectionType = 'rise' | 'fall' | 'unchanged';

// Add type for trading settings
interface TradingSettings {
    stake: number;
    martingale: number;
    takeProfit: number;
    stopLoss: number;
}

// Add new types for trade functionality
type TradeType = 'CALL' | 'PUT' | 'DIGITEVEN' | 'DIGITODD' | 'DIGITOVER' | 'DIGITUNDER';
type TradeStatus = 'idle' | 'pending' | 'success' | 'error';

interface TradeResponse {
    buy?: {
        contract_id: number;
        longcode: string;
        start_time: number;
        transaction_id: number;
        currency: string;
        buy_price: number;
    };
    error?: {
        code: string;
        message: string;
    };
}

// Add notification types
type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface Notification {
    id: number;
    message: string;
    type: NotificationType;
    timestamp: number;
    details?: string;
}

// Add TradeResult interface
interface TradeResult {
    id: number;
    contractId: number;
    type: string;
    symbol: SymbolType;
    entrySpot?: string;
    exitSpot?: string;
    stake: number;
    payout?: number;
    profit?: number;
    isWin?: boolean;
    timestamp: number;
    status?: 'open' | 'won' | 'lost' | 'pending';
    barrier?: string;
    duration?: string;
    currentSpot?: string; // Track current spot price while contract is active
    currentSpotTime?: number; // Time of last spot update
    entryTime?: number; // Entry spot timestamp
    exitTime?: number; // Exit spot timestamp
    remainingTime?: number; // Remaining time for contract in seconds
    purchaseTime?: number; // Time when contract was purchased
    progress?: number; // Progress percentage (0-100)
}

// Add new type for last trade information
interface LastTradeInfo {
    symbol: SymbolType;
    tradeType: TradeType;
    params: Record<string, any>;
    timestamp: number;
}

// Add App ID configuration constants
const APP_CONFIG = {
    local: '36300', // Local/test app ID
    staging: '111827', // Staging environment
    production: '111827', // Production app ID
};

// Add constants for localStorage keys
const STORAGE_KEYS = {
    TRADING_SETTINGS: 'trading_settings',
    TOTAL_PROFIT: 'total_profit',
    USER_EMAIL: 'userEmail',
};

// Add trade result tracking constants
const MAX_CONSECUTIVE_LOSSES = 3; // Stop after 3 consecutive losses
const PROFIT_TARGET = 50; // $50 profit target

const AdvancedDisplay = observer(() => {
    // Get transactions store
    const { transactions } = useStore();
    const { connectionStatus } = useApiBase();

    // State
    const [isRunning, setIsRunning] = useState(false);
    const [status, setStatus] = useState('');
    const [referenceDigit, setReferenceDigit] = useState(5); // Default reference digit for over/under
    const [analysisCount, setAnalysisCount] = useState(120); // Default number of digits to analyze
    const [sessionRunId, setSessionRunId] = useState<string>(`advanced_${Date.now()}`); // Add sessionRunId

    // Add settings modal state
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [tradingSettings, setTradingSettings] = useState<TradingSettings>(() => {
        // Try to load settings from localStorage
        try {
            const savedSettings = localStorage.getItem(STORAGE_KEYS.TRADING_SETTINGS);
            if (savedSettings) {
                const parsedSettings = JSON.parse(savedSettings) as TradingSettings;
                // Ensure all required fields exist with defaults if missing
                return {
                    stake: parsedSettings.stake || 1,
                    martingale: parsedSettings.martingale || 2.0,
                    takeProfit: parsedSettings.takeProfit || 10,
                    stopLoss: parsedSettings.stopLoss || 5,
                };
            }
        } catch (error) {
            console.error('Error loading trading settings from localStorage:', error);
        }

        // Default settings if nothing in localStorage or error occurs
        return {
            stake: 1,
            martingale: 2.0,
            takeProfit: 10,
            stopLoss: 5,
        };
    });

    const [lastTradeInfo, setLastTradeInfo] = useState<LastTradeInfo | null>(null);

    // Add temporary input values to allow for empty states during editing
    const [referenceDigitInput, setReferenceDigitInput] = useState('5');
    const [analysisCountInput, setAnalysisCountInput] = useState('120');
    const [stakeInput, setStakeInput] = useState(() => {
        // Initialize stake input from trading settings
        try {
            const savedSettings = localStorage.getItem(STORAGE_KEYS.TRADING_SETTINGS);
            if (savedSettings) {
                const parsedSettings = JSON.parse(savedSettings) as TradingSettings;
                return String(parsedSettings.stake || 1);
            }
        } catch (error) {
            console.error('Error loading stake from localStorage:', error);
        }
        return '1';
    });

    // Maintain a history of recent ticks
    const [ticksHistory, setTicksHistory] = useState<number[]>([]);

    // State for multi-symbol analysis
    const [symbolTickData, setSymbolTickData] = useState<Record<SymbolType, SymbolTickData>>({
        R_10: { tickHistory: [], decimalPlaces: 2, currentDigit: undefined },
        R_25: { tickHistory: [], decimalPlaces: 2, currentDigit: undefined },
        R_50: { tickHistory: [], decimalPlaces: 2, currentDigit: undefined },
        R_75: { tickHistory: [], decimalPlaces: 2, currentDigit: undefined },
        R_100: { tickHistory: [], decimalPlaces: 2, currentDigit: undefined },
        '1HZ10V': { tickHistory: [], decimalPlaces: 2, currentDigit: undefined },
        '1HZ15V': { tickHistory: [], decimalPlaces: 2, currentDigit: undefined }, // Add new symbols
        '1HZ25V': { tickHistory: [], decimalPlaces: 2, currentDigit: undefined },
        '1HZ30V': { tickHistory: [], decimalPlaces: 2, currentDigit: undefined },
        '1HZ50V': { tickHistory: [], decimalPlaces: 2, currentDigit: undefined },
        '1HZ75V': { tickHistory: [], decimalPlaces: 2, currentDigit: undefined },
        '1HZ90V': { tickHistory: [], decimalPlaces: 2, currentDigit: undefined },
        '1HZ100V': { tickHistory: [], decimalPlaces: 2, currentDigit: undefined },
    });
    const [activeSymbols, setActiveSymbols] = useState<SymbolType[]>([]);
    const [tickCount, setTickCount] = useState(120);
    const webSocketRefs = useRef<Record<SymbolType, WebSocket | null>>({
        R_10: null,
        R_25: null,
        R_50: null,
        R_75: null,
        R_100: null,
        '1HZ10V': null,
        '1HZ15V': null, // Add new symbols
        '1HZ25V': null,
        '1HZ30V': null,
        '1HZ50V': null,
        '1HZ75V': null,
        '1HZ90V': null,
        '1HZ100V': null,
    });

    // Add trading states

    const [tradeStatus, setTradeStatus] = useState<TradeStatus>('idle');
    const [tradeMessage, setTradeMessage] = useState<string>('');
    const [activeTradeSymbol, setActiveTradeSymbol] = useState<SymbolType | null>(null);

    // Add trade history state
    const [tradeHistory, setTradeHistory] = useState<TradeResult[]>([]);
    const tradeIdCounter = useRef(0);

    // Add notifications state
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const notificationIdCounter = useRef(0);

    // Add additional trade tracking state
    const [consecutiveLosses, setConsecutiveLosses] = useState(0);
    const [consecutiveWins, setConsecutiveWins] = useState(0);
    const [totalWins, setTotalWins] = useState(0);
    const [totalLosses, setTotalLosses] = useState(0);
    const [totalProfit, setTotalProfit] = useState(0);

    // Add tracking for active contracts with more information
    const [activeContracts, setActiveContracts] = useState<Map<number, any>>(new Map());
    const [tradeResults, setTradeResults] = useState<any[]>([]);

    // Add a contract status tracking set to prevent duplicate profit calculations
    const processedContracts = useRef<Set<number>>(new Set());

    // Add new state for completed contract similar to trading-hub-display
    const [completedContract, setCompletedContract] = useState<ProposalOpenContract | null>(null);

    // Add authentication state
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [isAuthLoading, setIsAuthLoading] = useState<boolean>(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const [showAuthModal, setShowAuthModal] = useState<boolean>(false);
    const [apiToken, setApiToken] = useState<string>('');

    // Replace localStorage app ID retrieval with environment-based logic
    const getAppId = useCallback(() => {
        const host = window.location.hostname;
        if (host === 'localhost' || host === '127.0.0.1') {
            return APP_CONFIG.local;
        }
        // Check for staging environment if needed
        // if (host.includes('staging')) return APP_CONFIG.staging;

        return APP_CONFIG.production;
    }, []);

    // Add utility function to get readable contract type names
    const getReadableContractType = (type: string): string => {
        const typeMap: Record<string, string> = {
            CALL: 'Rise',
            PUT: 'Fall',
            DIGITEVEN: 'Even',
            DIGITODD: 'Odd',
            DIGITOVER: 'Over',
            DIGITUNDER: 'Under',
            DIGITDIFF: 'Differs',
            DIGITMATH: 'Matches',
        };

        return typeMap[type] || type;
    };

    // Add money formatting function similar to trading-hub-display
    const formatMoney = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(Math.abs(amount));
    };

    // Update tickCount when analysisCount changes
    useEffect(() => {
        setTickCount(analysisCount);
    }, [analysisCount]);

    // Function to toggle settings modal with useCallback to prevent recreating on every render
    const toggleSettingsModal = useCallback(() => {
        setIsSettingsModalOpen(prev => !prev);
    }, []);

    // Function to handle settings changes with useCallback - updated to save to localStorage
    const handleSettingChange = useCallback((field: keyof TradingSettings, value: string | boolean) => {
        setTradingSettings(prev => {
            // For numeric fields
            let updatedSettings = { ...prev };

            if (typeof value === 'string') {
                const numValue = parseFloat(value);
                if (!isNaN(numValue)) {
                    updatedSettings[field] = numValue;
                }
            }

            // Save to localStorage
            try {
                localStorage.setItem(STORAGE_KEYS.TRADING_SETTINGS, JSON.stringify(updatedSettings));
            } catch (error) {
                console.error('Error saving trading settings to localStorage:', error);
            }

            return updatedSettings;
        });
    }, []);

    // Function to save settings - updated to ensure localStorage is updated
    const saveSettings = useCallback(() => {
        // Here you could add validation if needed
        try {
            // Make sure settings are saved to localStorage
            localStorage.setItem(STORAGE_KEYS.TRADING_SETTINGS, JSON.stringify(tradingSettings));
            setStatus('Trading settings saved successfully');
            setIsSettingsModalOpen(false);
            setTimeout(() => setStatus(''), 3000);
        } catch (error) {
            console.error('Error saving settings:', error);
            setStatus('Error saving settings');
            setTimeout(() => setStatus(''), 3000);
        }
    }, [tradingSettings]);

    // Memoize the Settings Modal Component to prevent unnecessary re-renders
    const settingsModalComponent = useMemo(() => {
        if (!isSettingsModalOpen) return null;

        return (
            <div className='settings-modal-overlay' onClick={toggleSettingsModal}>
                <div className='settings-modal' onClick={e => e.stopPropagation()}>
                    <div className='settings-modal__header'>
                        <h3>Trading Settings</h3>
                        <button className='settings-modal__close-btn' onClick={toggleSettingsModal}>
                            <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                                <path d='M6 18L18 6M6 6l12 12' />
                            </svg>
                        </button>
                    </div>
                    <div className='settings-modal__content'>
                        <div className='settings-group'>
                            <div className='settings-group-title'>Trade Parameters</div>

                            <div className='settings-field'>
                                <label htmlFor='stake'>Stake Amount</label>
                                <input
                                    type='number'
                                    id='stake'
                                    value={tradingSettings.stake}
                                    onChange={e => handleSettingChange('stake', e.target.value)}
                                    min='0.35'
                                    step='0.01'
                                />
                            </div>

                            <div className='settings-field'>
                                <label htmlFor='martingale'>Martingale Factor</label>
                                <input
                                    type='number'
                                    id='martingale'
                                    value={tradingSettings.martingale}
                                    onChange={e => handleSettingChange('martingale', e.target.value)}
                                    min='1'
                                    step='0.1'
                                />
                            </div>
                        </div>

                        <div className='settings-group'>
                            <div className='settings-group-title'>Risk Management</div>

                            <div className='settings-field'>
                                <label htmlFor='takeProfit'>Take Profit (USD)</label>
                                <input
                                    type='number'
                                    id='takeProfit'
                                    value={tradingSettings.takeProfit}
                                    onChange={e => handleSettingChange('takeProfit', e.target.value)}
                                    min='0'
                                    step='1'
                                />
                            </div>

                            <div className='settings-field'>
                                <label htmlFor='stopLoss'>Stop Loss (USD)</label>
                                <input
                                    type='number'
                                    id='stopLoss'
                                    value={tradingSettings.stopLoss}
                                    onChange={e => handleSettingChange('stopLoss', e.target.value)}
                                    min='0'
                                    step='1'
                                />
                            </div>
                        </div>
                    </div>
                    <div className='settings-modal__footer'>
                        <Button onClick={toggleSettingsModal} variant='secondary'>
                            Cancel
                        </Button>
                        <Button onClick={saveSettings} className='futuristic-button'>
                            Save Settings
                        </Button>
                    </div>
                </div>
            </div>
        );
    }, [isSettingsModalOpen, tradingSettings, toggleSettingsModal, handleSettingChange, saveSettings]);

    // Show notification function
    const showNotification = useCallback((message: string, type: NotificationType = 'info', details?: string) => {
        const id = notificationIdCounter.current++;
        const newNotification: Notification = {
            id,
            message,
            type,
            timestamp: Date.now(),
            details,
        };

        setNotifications(prevNotifications => [...prevNotifications, newNotification]);

        // Auto-dismiss after a delay (longer for important notifications)
        const dismissDelay = type === 'error' ? 8000 : type === 'success' ? 5000 : 4000;
        setTimeout(() => {
            dismissNotification(id);
        }, dismissDelay);
    }, []);

    // Dismiss notification function
    const dismissNotification = useCallback((id: number) => {
        setNotifications(prevNotifications => prevNotifications.filter(notification => notification.id !== id));
    }, []);

    // Add a debug helper function to log contract activity
    const logContractActivity = (type: string, data: any) => {
        console.log(`[${new Date().toISOString()}] ${type}:`, JSON.stringify(data, null, 2));
    };

    // Enhance the WebSocket message handler to better track contracts
    useEffect(() => {
        let subscription: { unsubscribe: () => void } | undefined;
        let disposed = false;
        const attach = async () => {
            if (!api_base.api) await api_base.init();
            if (disposed) return;
            subscription = api_base.api?.onMessage().subscribe(({ data }) => {
            // Improved buy response handling
            if (data.buy !== undefined && data.echo_req?.passthrough?.workspace === 'advanced') {
                logContractActivity('Trade success response', data.buy);

                if (data.buy && typeof data.buy === 'object' && 'contract_id' in data.buy) {
                    // Immediately subscribe to this contract to ensure we get updates
                    

                    handleTradeSuccess(data);
                } else {
                    console.error('Received malformed buy response:', data);
                    setTradeStatus('error');
                    setTradeMessage('Received invalid trade response from server');
                    showNotification('Error in trade response format', 'error');
                }
            }

            // Enhanced contract updates handling with better logging
            if (data.proposal_open_contract) {
                const contract = data.proposal_open_contract;
                logContractActivity('Contract update', {
                    id: contract.contract_id,
                    type: contract.contract_type,
                    status: contract.status,
                    entry: contract.entry_tick,
                    exit: contract.exit_tick,
                    profit: contract.profit,
                    is_sold: contract.is_sold,
                });

                handleContractUpdate(contract);
            }

            if (data.error) {
                console.error('WebSocket error:', data.error);
                setTradeStatus('error');
                setTradeMessage(`Error: ${data.error.message || 'Unknown error'}`);
                showNotification(`Trade error: ${data.error.message}`, 'error');
                return;
            }

            });
        };
        void attach().catch(() => setTradeMessage('Could not connect. Please retry.'));
        return () => { disposed = true; subscription?.unsubscribe(); };
    }, [connectionStatus]);


    // Enhance the trade success handler to emit events for Run Panel, mirroring trading-hub-display
    const handleTradeSuccess = (data: TradeResponse) => {
        try {
            if (!data.buy || !data.buy.contract_id) {
                console.error('Invalid trade success data received:', data);
                setTradeStatus('error');
                setTradeMessage('Invalid trade data received');
                showNotification('Trade failed: Invalid response', 'error');
                return;
            }

            const buy = data.buy;
            const contractId = buy.contract_id;
            const purchaseTime = Date.now();
            const stake = Number(parseFloat(String(buy.buy_price)).toFixed(2));
            const longcode = buy.longcode;

            // --- Start: Extract Symbol from longcode ---
            let parsedSymbol: SymbolType = 'R_10'; // Default fallback
            const symbolMatch = longcode.match(/^([^_]+)/); // Match characters from the start until the first underscore
            if (
                symbolMatch &&
                ['R_10', 'R_25', 'R_50', 'R_75', 'R_100', '1HZ10V', '1HZ15V', '1HZ25V', '1HZ30V', '1HZ50V', '1HZ75V', '1HZ90V', '1HZ100V'].includes(
                    symbolMatch[1]
                )
            ) {
                parsedSymbol = symbolMatch[1] as SymbolType;
                console.log(`Parsed symbol from longcode: ${parsedSymbol}`);
            } else {
                // Fallback to activeTradeSymbol if parsing fails, but log a warning
                console.warn(
                    `Could not parse symbol from longcode: ${longcode}. Falling back to activeTradeSymbol: ${activeTradeSymbol}`
                );
                parsedSymbol = activeTradeSymbol || 'R_10'; // Use state as fallback
            }
            // --- End: Extract Symbol from longcode ---

            console.log('Processing trade success:', {
                contractId: contractId,
                price: stake,
                longcode: buy.longcode,
                parsedSymbol: parsedSymbol, // Log the symbol being used
            });

            // Determine contract type, barrier, and derived fields immediately
            let contractType = 'UNKNOWN';
            let barrier: string | undefined = undefined;
            let duration = 1; // Default duration
            let duration_unit = 't'; // Default duration unit
            let tick_count = 1; // Default tick count for digit contracts

            // --- Start: Improved longcode parsing ---
            if (longcode.includes('CALL')) contractType = 'CALL';
            else if (longcode.includes('PUT')) contractType = 'PUT';
            else if (longcode.includes('DIGITEVEN')) contractType = 'DIGITEVEN';
            else if (longcode.includes('DIGITODD')) contractType = 'DIGITODD';
            else if (longcode.includes('DIGITOVER')) {
                contractType = 'DIGITOVER';
                const match = longcode.match(/_(\d+)$/); // Barrier is usually at the end for digits
                if (match) barrier = match[1];
            } else if (longcode.includes('DIGITUNDER')) {
                contractType = 'DIGITUNDER';
                const match = longcode.match(/_(\d+)$/);
                if (match) barrier = match[1];
            } else if (longcode.includes('DIGITDIFF')) {
                contractType = 'DIGITDIFF';
                const match = longcode.match(/_(\d+)$/);
                if (match) barrier = match[1];
            } else if (longcode.includes('DIGITMATCH')) {
                contractType = 'DIGITMATCH';
                const match = longcode.match(/_(\d+)$/);
                if (match) barrier = match[1];
            }
            // --- End: Improved longcode parsing ---

            const durationMatch = longcode.match(/_(\d+)([t])$/); // Assuming only tick duration for digits
            if (durationMatch) {
                tick_count = parseInt(durationMatch[1], 10); // Digits usually use tick count
                duration = tick_count; // Set duration based on ticks
                duration_unit = durationMatch[2];
            } else {
                console.warn(`Could not parse duration/tick count from longcode: ${longcode}`);
            }

            // --- Start: Construct dependent fields AFTER parsing contractType ---
            let parameter_type = `${contractType.toLowerCase()}_barrier`; // Now uses the parsed contractType
            let display_name = getReadableContractType(contractType); // Now uses the parsed contractType
            let display_message = `Contract parameter: ${display_name} ${barrier || ''} on ${parsedSymbol}`;

            switch (
                contractType // Switch now uses the correctly parsed contractType
            ) {
                case 'DIGITDIFF':
                    parameter_type = 'differ_barrier';
                    display_name = 'Digit Differs';
                    display_message = `Contract parameter: Differ from ${barrier} on ${parsedSymbol}`;
                    break;
                case 'DIGITOVER':
                    parameter_type = 'over_barrier';
                    display_name = 'Digit Over';
                    display_message = `Contract parameter: Over ${barrier} on ${parsedSymbol}`;
                    break;
                case 'DIGITUNDER':
                    parameter_type = 'under_barrier';
                    display_name = 'Digit Under';
                    display_message = `Contract parameter: Under ${barrier} on ${parsedSymbol}`;
                    break;
                case 'DIGITMATCH':
                    parameter_type = 'match_barrier';
                    display_name = 'Digit Matches';
                    display_message = `Contract parameter: Matches ${barrier} on ${parsedSymbol}`;
                    break;
                case 'DIGITEVEN':
                    parameter_type = 'even_barrier';
                    display_name = 'Digit Even';
                    display_message = `Contract parameter: Even on ${parsedSymbol}`;
                    break;
                case 'DIGITODD':
                    parameter_type = 'odd_barrier';
                    display_name = 'Digit Odd';
                    display_message = `Contract parameter: Odd on ${parsedSymbol}`;
                    break;
                case 'CALL':
                    parameter_type = 'rise_barrier';
                    display_name = 'Rise';
                    display_message = `Contract parameter: Rise on ${parsedSymbol}`;
                    break;
                case 'PUT':
                    parameter_type = 'fall_barrier';
                    display_name = `Fall`;
                    display_message = `Contract parameter: Fall on ${parsedSymbol}`;
                    break;
            }
            // --- End: Construct dependent fields ---

            // Construct contract_info immediately with correct types
            const contract_info = {
                contract_id: contractId,
                contract_type: contractType,
                symbol: parsedSymbol, // Use the parsed symbol
                underlying: parsedSymbol, // Use the parsed symbol
                shortcode: ``,
                longcode: buy.longcode,
                run_id: sessionRunId,
                buy_price: Number(stake),
                currency: buy.currency || 'USD',
                date_start: Math.floor(purchaseTime / 1000),
                purchase_time: Math.floor(purchaseTime / 1000),
                entry_tick_time: Math.floor(purchaseTime / 1000),
                transaction_time: Math.floor(purchaseTime / 1000),
                barrier: barrier,
                barrier_display_value: barrier?.toString() || 'N/A',
                contract_parameter: barrier?.toString() || 'N/A',
                parameter_type: parameter_type,
                duration: Number(duration),
                duration_unit: duration_unit,
                tick_count: Number(tick_count),
                display_name: display_name,
                display_message: display_message,
                transaction_ids: { buy: Number(buy.transaction_id) },
                status: 'bought',
                is_sold: 0,
            };

            // Emit critical events for Run Panel first
            globalObserver.emit('trading_hub.running');
            globalObserver.emit('bot.contract', contract_info);
            globalObserver.emit('bot.bot_ready');
            globalObserver.emit('contract.purchase_received', contractId);
            globalObserver.emit('contract.status', {
                id: 'contract.purchase',
                data: contract_info,
                buy: buy,
            });

            // Update transactions store immediately after emitting
            transactions.onBotContractEvent(contract_info);
            console.log(`Trade executed via Advanced: ${contractType} with barrier ${barrier} on ${parsedSymbol}`);

            // Now perform other state updates for this component's UI
            setTradeStatus('success');
            setTradeMessage(`Trade successful! Contract ID: ${contractId} - ${buy.longcode}`);
            showNotification(`Trade placed successfully!`, 'success', `Contract ID: ${contractId} - Amount: $${stake}`);

            // Store contract in activeContracts map for internal tracking
            const internalTradeData = {
                ...contract_info,
                id: tradeIdCounter.current++,
                timestamp: purchaseTime,
                status: 'pending',
            };
            setActiveContracts(prev => {
                const updated = new Map(prev);
                updated.set(contractId, internalTradeData);
                return updated;
            });

            // Subscribe to contract updates (keep this for internal state management)
            subscribeToContract(contractId, {
                type: contractType,
                symbol: parsedSymbol, // Use parsedSymbol here too
                stake: stake,
                barrier: barrier,
            });

            // Reset status after 5 seconds (keep this)
            setTimeout(() => {
                setTradeStatus('idle');
                setTradeMessage('');
            }, 5000);
        } catch (error) {
            console.error('Error handling trade success:', error);
            setTradeStatus('error');
            setTradeMessage('Error processing trade response');
            showNotification('Error processing trade', 'error');
        }
    };

    // Enhance the contract update handler to emit events for Run Panel, mirroring trading-hub-display
    const handleContractUpdate = (contract: any) => {
        console.log('Handling contract update:', contract);

        if (!contract?.contract_id) return;

        const contractId = contract.contract_id;

        // Update internal activeContracts state
        if (contract.status === 'open' || !contract.is_sold) {
            setActiveContracts(prev => {
                const updated = new Map(prev);
                updated.set(contractId, {
                    ...(updated.get(contractId) || {}),
                    type: contract.contract_type,
                    entrySpot: contract.entry_spot,
                    barrier: contract.barrier,
                    buyPrice: contract.buy_price,
                    timestamp: Date.now(),
                    status: 'pending',
                    currentSpot: contract.current_spot,
                    currentSpotTime: contract.current_spot_time,
                    entryTime: contract.entry_tick_time,
                    exitTime: contract.exit_tick_time,
                    remainingTime: contract.date_expiry
                        ? contract.date_expiry - Math.floor(Date.now() / 1000)
                        : undefined,
                    progress:
                        contract.purchase_time && contract.date_expiry
                            ? Math.min(
                                  100,
                                  ((Math.floor(Date.now() / 1000) - contract.purchase_time) /
                                      (contract.date_expiry - contract.purchase_time)) *
                                      100
                              )
                            : undefined,
                });
                return updated;
            });
            return;
        }

        // Only process completed contracts for display and Run Panel update
        if (contract.is_sold) {
            console.log('Contract completed:', contract.contract_id, 'Profit:', contract.profit);

            if (processedContracts.current.has(contractId)) {
                console.log(`Contract ${contractId} already processed, skipping duplicate settlement.`);
                return;
            }
            processedContracts.current.add(contractId);

            setCompletedContract(contract);

            setActiveContracts(prev => {
                const updated = new Map(prev);
                const initialTradeData = updated.get(contract.contract_id);

                if (initialTradeData) {
                    const isWin = Number(contract.profit) > 0;
                    const status = isWin ? 'won' : 'lost';

                    const result: TradeResult = {
                        id: initialTradeData.id || tradeIdCounter.current++,
                        contractId: contract.contract_id,
                        type: contract.contract_type,
                        symbol: contract.underlying || initialTradeData.symbol || 'R_10',
                        entrySpot: contract.entry_tick_display_value,
                        exitSpot: contract.exit_tick_display_value,
                        stake: contract.buy_price,
                        payout: contract.payout,
                        profit: contract.profit,
                        isWin: isWin,
                        timestamp: initialTradeData.timestamp || Date.now(),
                        status: status,
                        barrier: contract.barrier,
                        duration:
                            contract.sell_time && contract.purchase_time
                                ? (contract.sell_time - contract.purchase_time).toFixed(1)
                                : 'N/A',
                        purchaseTime: contract.purchase_time * 1000,
                        entryTime: contract.entry_tick_time * 1000,
                        exitTime: contract.exit_tick_time * 1000,
                    };

                    console.log('Trade result processed:', result);

                    setTradeHistory(prevHistory => [result, ...prevHistory.slice(0, 49)]);

                    const currentTotalProfit = parseFloat(localStorage.getItem(STORAGE_KEYS.TOTAL_PROFIT) || '0');
                    const newTotalProfit = currentTotalProfit + parseFloat(String(result.profit || 0));
                    localStorage.setItem(STORAGE_KEYS.TOTAL_PROFIT, newTotalProfit.toString());

                    if (result.isWin) {
                        setTotalWins(prev => prev + 1);
                        setConsecutiveLosses(0);
                        setConsecutiveWins(prev => prev + 1);
                    } else {
                        setTotalLosses(prev => prev + 1);
                        setConsecutiveLosses(prev => prev + 1);
                        setConsecutiveWins(0);
                    }
                    setTotalProfit(newTotalProfit);

                    const final_contract_info = {
                        ...initialTradeData,
                        contract_id: contract.contract_id,
                        sell_price: Number(contract.sell_price),
                        profit: Number(contract.profit),
                        payout: Number(contract.payout),
                        status: status,
                        exit_tick_time: contract.exit_tick_time,
                        sell_time: contract.sell_time,
                        date_expiry: contract.date_expiry,
                        entry_tick: contract.entry_tick,
                        exit_tick: contract.exit_tick,
                        entry_tick_display_value: contract.entry_tick_display_value,
                        exit_tick_display_value: contract.exit_tick_display_value,
                        transaction_ids: {
                            buy: initialTradeData.transaction_ids?.buy || contract.transaction_ids?.buy,
                            sell: contract.transaction_ids?.sell,
                        },
                        is_expired: contract.is_expired ? 1 : 0,
                        is_intraday: contract.is_intraday ? 1 : 0,
                        is_path_dependent: contract.is_path_dependent ? 1 : 0,
                        is_settleable: contract.is_settleable ? 1 : 0,
                        is_sold: contract.is_sold ? 1 : 0,
                        is_valid_to_sell: contract.is_valid_to_sell ? 1 : 0,
                        profit_percentage: Number(contract.profit_percentage),
                        shortcode: contract.shortcode || initialTradeData.shortcode,
                        tick_count: contract.tick_count || initialTradeData.tick_count,
                        validation_error: contract.validation_error,
                        contract_type: contract.contract_type || initialTradeData.contract_type,
                        currency: contract.currency || initialTradeData.currency,
                        date_start: initialTradeData.date_start,
                        symbol: contract.underlying || initialTradeData.symbol || 'R_10',
                        underlying: contract.underlying || initialTradeData.underlying || 'R_10',
                        barrier: contract.barrier !== undefined ? String(contract.barrier) : initialTradeData.barrier,
                        barrier_display_value:
                            contract.barrier !== undefined
                                ? String(contract.barrier)
                                : initialTradeData.barrier_display_value,
                        contract_parameter:
                            contract.barrier !== undefined
                                ? String(contract.barrier)
                                : initialTradeData.contract_parameter,
                        parameter_type: initialTradeData.parameter_type,
                        entry_tick_time: contract.entry_tick_time || initialTradeData.entry_tick_time,
                        run_id: sessionRunId,
                        display_name: initialTradeData.display_name,
                        transaction_time: initialTradeData.transaction_time,
                        longcode: contract.longcode || initialTradeData.longcode,
                        display_message: initialTradeData.display_message,
                    };

                    globalObserver.emit('contract.status', { contract: final_contract_info });
                    transactions.onBotContractEvent(final_contract_info);

                    if (consecutiveLosses + 1 >= MAX_CONSECUTIVE_LOSSES) {
                        console.warn('Stopping bot due to consecutive losses.');
                        setIsRunning(false);
                        globalObserver.emit('bot.stopped');
                        showNotification(`Bot stopped: ${MAX_CONSECUTIVE_LOSSES} consecutive losses`, 'error');
                    } else if (newTotalProfit >= tradingSettings.takeProfit) {
                        console.warn('Stopping bot due to profit target reached.');
                        setIsRunning(false);
                        globalObserver.emit('bot.stopped');
                        showNotification(`Target profit of $${tradingSettings.takeProfit} reached!`, 'success');
                    } else if (newTotalProfit <= -tradingSettings.stopLoss) {
                        console.warn('Stopping bot due to stop loss reached.');
                        setIsRunning(false);
                        globalObserver.emit('bot.stopped');
                        showNotification(`Stop loss of $${tradingSettings.stopLoss} reached!`, 'error');
                    }

                    updated.delete(contract.contract_id);
                } else {
                    console.warn(
                        `Received sold update for unknown or already processed contract ID: ${contract.contract_id}`
                    );
                }
                return updated;
            });
        }
    };

    // Modified function to start/stop the analysis
    const toggleAnalysis = () => {
        if (isRunning) {
            setIsRunning(false);
            setStatus('Analysis stopped');
            globalObserver.emit('bot.stopped');
        } else {
            setSessionRunId(`advanced_${Date.now()}`);
            setTotalProfit(0);
            setTotalWins(0);
            setTotalLosses(0);
            setConsecutiveLosses(0);
            setConsecutiveWins(0);
            setTradeHistory([]);
            setActiveContracts(new Map());
            setCompletedContract(null);
            processedContracts.current.clear(); // Clear the processed set for the new session
            setIsRunning(true);
            setStatus('Analysis started - monitoring market patterns');
        }
    };

    // Enhanced debugging indicator in the UI to show active contracts
    const renderDebugInfo = () => {
        if (activeContracts.size === 0 && tradeHistory.length === 0) return null;

        return (
            <div className='debug-info'>
                {activeContracts.size > 0 && (
                    <>
                        <div>
                            <strong>Pending Contracts: {activeContracts.size}</strong>
                        </div>
                        {Array.from(activeContracts.entries()).map(([id, data]) => (
                            <div key={id} className='pending-contract-item'>
                                <span className='contract-id'>#{id}</span>
                                <span className='contract-type'>{data.display_name || data.type}</span>
                                <span className='contract-time'>{new Date(data.timestamp).toLocaleTimeString()}</span>
                            </div>
                        ))}
                        <hr style={{ margin: '8px 0', border: '0', borderTop: '1px dashed #ccc' }} />
                    </>
                )}
                <div className='completed-count'>
                    <span>
                        Completed Trades: {tradeHistory.filter(t => t.status === 'won' || t.status === 'lost').length}
                    </span>
                </div>
            </div>
        );
    };

    // Enhanced trade results rendering with better animations and UI
    const renderFinalTradeResults = () => {
        return (
            <>
                {/* Display latest trade result similar to trading-hub-display */}
                {completedContract && (
                    <div className='advanced-display__latest-result'>
                        <Text size='sm' weight='bold'>
                            Last Trade ({getReadableContractType(completedContract.contract_type)}):
                        </Text>
                        <Text
                            size='sm'
                            weight='bold'
                            className={classNames({
                                'profit--positive': Number(completedContract.profit) > 0,
                                'profit--negative': Number(completedContract.profit) < 0,
                            })}
                        >
                            {formatMoney(Number(completedContract.profit))}
                        </Text>
                    </div>
                )}

                {/* Trade history list - show both pending and completed trades */}
                <div className='trade-history'>
                    {tradeHistory.length === 0 && activeContracts.size === 0 ? (
                        <div className='trade-history-empty'>No trades yet. Place a trade to see results here.</div>
                    ) : (
                        <>
                            {/* Show pending trades first with animation */}
                            {Array.from(activeContracts.values()).map(contract => (
                                <div
                                    key={`pending-${contract.contractId || contract.id}`}
                                    className='trade-item pending'
                                >
                                    <div className='trade-item-header'>
                                        <div className='trade-symbol'>{getReadableContractType(contract.type)}</div>
                                        <div className='trade-time'>
                                            {new Date(contract.timestamp).toLocaleTimeString()}
                                        </div>
                                    </div>
                                    <div className='trade-item-details'>
                                        <div className='trade-detail'>
                                            <span className='label'>Stake:</span>
                                            <span className='value'>
                                                {formatMoney(contract.stake || contract.buyPrice || 0)}
                                            </span>
                                        </div>
                                        <div className='trade-detail'>
                                            <span className='label'>Status:</span>
                                            <span className='value' style={{ color: '#ff9800' }}>
                                                Processing
                                            </span>
                                        </div>
                                        <div className='trade-detail'>
                                            <span className='label'>Barrier:</span>
                                            <span className='value'>{contract.barrier || 'N/A'}</span>
                                        </div>
                                        <div className='trade-detail'>
                                            <span className='label'>Contract ID:</span>
                                            <span className='value' style={{ fontSize: '12px' }}>
                                                {contract.contractId}
                                            </span>
                                        </div>
                                    </div>
                                    <div
                                        className='progress-bar'
                                        style={{ width: `${Math.min((Date.now() - contract.timestamp) / 100, 100)}%` }}
                                    ></div>
                                </div>
                            ))}

                            {/* Show completed trades with filter */}
                            {tradeHistory
                                .filter(trade => trade.status === 'won' || trade.status === 'lost')
                                .map((trade, index) => (
                                    <div
                                        key={trade.contractId || trade.id}
                                        className={`trade-item ${trade.isWin ? 'win' : 'loss'} ${index === 0 ? 'newly-completed' : ''}`}
                                    >
                                        <div className='trade-item-header'>
                                            <div className='trade-symbol'>{getReadableContractType(trade.type)}</div>
                                            <div className='trade-time'>
                                                {trade.purchaseTime
                                                    ? new Date(trade.purchaseTime).toLocaleTimeString()
                                                    : new Date(trade.timestamp).toLocaleTimeString()}
                                            </div>
                                        </div>
                                        <div className='trade-item-details'>
                                            <div className='trade-detail'>
                                                <span className='label'>Stake:</span>
                                                <span className='value'>{formatMoney(trade.stake || 0)}</span>
                                            </div>
                                            <div className='trade-detail'>
                                                <span className='label'>Profit/Loss:</span>
                                                <span
                                                    className={`value ${
                                                        (trade.profit || 0) >= 0 ? 'positive' : 'negative'
                                                    }`}
                                                >
                                                    {(trade.profit || 0) >= 0 ? '+' : ''}
                                                    {formatMoney(Math.abs(trade.profit || 0))}
                                                </span>
                                            </div>
                                            <div className='trade-detail'>
                                                <span className='label'>Barrier:</span>
                                                <span className='value'>{trade.barrier || 'N/A'}</span>
                                            </div>
                                            <div className='trade-detail'>
                                                <span className='label'>Duration:</span>
                                                <span className='value'>{trade.duration || 'N/A'}s</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                        </>
                    )}
                </div>

                {/* Display trade summary stats */}
                {tradeHistory.filter(t => t.status === 'won' || t.status === 'lost').length > 0 && (
                    <div className='trade-history-summary'>
                        <div className='summary-item wins'>
                            <span>Wins: {totalWins}</span>
                        </div>
                        <div className='summary-item losses'>
                            <span>Losses: {totalLosses}</span>
                        </div>
                        <div className='summary-item profit'>
                            <span>Total Profit: </span>
                            <span className={totalProfit >= 0 ? 'positive' : 'negative'}>
                                {formatMoney(totalProfit)}
                            </span>
                        </div>
                    </div>
                )}
            </>
        );
    };

    // Improved subscription function with better contract tracking
    const subscribeToContract = useCallback(
        (
            contractId: number,
            contractData: {
                type: string;
                symbol: SymbolType;
                stake: number;
                barrier?: string;
            }
        ) => {
            if (!api_base.is_authorized) return;

            // Track more contract details
            setActiveContracts(prev => {
                const updated = new Map(prev);
                updated.set(contractId, {
                    ...contractData,
                    contractId,
                    timestamp: Date.now(),
                });
                return updated;
            });

        },
        []
    );

    // Function to request tick history and subscribe to updates
    const startWebSocket = (symbol: SymbolType) => {
        // Close existing connection if any
        if (webSocketRefs.current[symbol]) {
            webSocketRefs.current[symbol]?.close();
        }

        // Get app ID and create new WebSocket connection
        const appId = getAppId();
        const ws = new WebSocket('wss://api.derivws.com/trading/v1/options/ws/public');
        webSocketRefs.current[symbol] = ws;

        ws.onopen = () => {
            console.log(`Market data WebSocket opened for ${symbol} with app ID: ${appId}`);
            const request = {
                ticks_history: symbol,
                count: tickCount,
                end: 'latest',
                style: 'ticks',
                subscribe: 1,
            };
            ws.send(JSON.stringify(request));
        };

        ws.onmessage = event => {
            const data = JSON.parse(event.data);

            if (data.history) {
                // Process historical data
                const history = data.history.prices.map((price: string, index: number) => ({
                    time: data.history.times[index],
                    quote: parseFloat(price),
                }));

                // Detect decimal places
                const decimalPlaces = detectDecimalPlaces(history);

                // Get the current digit from the last tick
                const currentDigit =
                    history.length > 0 ? getLastDigit(history[history.length - 1].quote, decimalPlaces) : undefined;

                setSymbolTickData(prevData => ({
                    ...prevData,
                    [symbol]: {
                        ...prevData[symbol],
                        tickHistory: history,
                        decimalPlaces,
                        currentDigit,
                    },
                }));

                // Update the general ticksHistory for backward compatibility
                if (symbol === 'R_10') {
                    setTicksHistory(history.map(h => getLastDigit(h.quote, decimalPlaces)));
                }
            } else if (data.tick) {
                // Process tick updates
                const tickQuote = parseFloat(data.tick.quote);

                setSymbolTickData(prevData => {
                    const updatedHistory = [
                        ...prevData[symbol].tickHistory,
                        { time: data.tick.epoch, quote: tickQuote },
                    ];

                    // Get the current digit from the new tick
                    const currentDigit = getLastDigit(tickQuote, prevData[symbol].decimalPlaces);

                    // Keep only the last 'tickCount' ticks
                    if (updatedHistory.length > tickCount) {
                        updatedHistory.shift();
                    }

                    const updatedData = {
                        ...prevData,
                        [symbol]: {
                            ...prevData[symbol],
                            tickHistory: updatedHistory,
                            currentDigit,
                        },
                    };

                    // Update the general ticksHistory for backward compatibility
                    if (symbol === 'R_10') {
                        setTicksHistory(updatedHistory.map(h => getLastDigit(h.quote, prevData[symbol].decimalPlaces)));
                    }

                    return updatedData;
                });
            }
        };

        ws.onerror = error => {
            console.error(`WebSocket error for ${symbol}:`, error);
        };

        ws.onclose = () => {
            console.log(`WebSocket connection closed for ${symbol}`);
        };

        return ws;
    };

    // Function to detect decimal places from tick history
    const detectDecimalPlaces = (history: Array<{ time: number; quote: number }>) => {
        if (history.length === 0) return 2;

        const decimalCounts = history.map(tick => {
            const decimalPart = tick.quote.toString().split('.')[1] || '';
            return decimalPart.length;
        });

        return Math.max(...decimalCounts, 2);
    };

    // Function to extract the last digit
    const getLastDigit = (price: number, decimalPlaces: number = 2) => {
        const priceStr = price.toString();
        const priceParts = priceStr.split('.');
        let decimals = priceParts[1] || '';

        while (decimals.length < decimalPlaces) {
            decimals += '0';
        }

        return Number(decimals.slice(-1));
    };

    // Function to calculate percentage of even or odd digits in an array
    const calculateParityPercentage = (digits: number[], parityType: ParityType): number => {
        if (digits.length === 0) return 0;

        const matchingDigits = digits.filter(digit => {
            if (parityType === 'even') {
                return digit % 2 === 0; // Check for even digits (0,2,4,6,8)
            } else {
                return digit % 2 !== 0; // Check for odd digits (1,3,5,7,9)
            }
        });

        return (matchingDigits.length / digits.length) * 100;
    };

    // Function to analyze price directions (rise/fall/unchanged) for a symbol
    const analyzePriceDirections = (symbol: SymbolType): { rise: number; fall: number; unchanged: number } => {
        const data = symbolTickData[symbol];
        if (!data || data.tickHistory.length < 2) {
            return { rise: 0, fall: 0, unchanged: 0 };
        }

        let rises = 0;
        let falls = 0;
        let unchanged = 0;

        // Compare each tick with the previous one to determine direction
        for (let i = 1; i < data.tickHistory.length; i++) {
            const currentPrice = data.tickHistory[i].quote;
            const previousPrice = data.tickHistory[i - 1].quote;

            if (currentPrice > previousPrice) {
                rises++;
            } else if (currentPrice < previousPrice) {
                falls++;
            } else {
                unchanged++;
            }
        }

        const total = rises + falls + unchanged;

        return {
            rise: (rises / total) * 100,
            fall: (falls / total) * 100,
            unchanged: (unchanged / total) * 100,
        };
    };

    // Function to calculate over/under statistics for a symbol
    const calculateOverUnder = (symbol: SymbolType): { over: number; under: number; equal: number } => {
        const digits = getLastDigitsForSymbol(symbol);
        if (digits.length === 0) return { over: 0, under: 0, equal: 0 };

        let over = 0;
        let under = 0;
        let equal = 0;

        digits.forEach(digit => {
            if (digit > referenceDigit) over++;
            else if (digit < referenceDigit) under++;
            else equal++;
        });

        const total = digits.length;

        return {
            over: (over / total) * 100,
            under: (under / total) * 100,
            equal: (equal / total) * 100,
        };
    };

    // Function to get last digits for a symbol
    const getLastDigitsForSymbol = (symbol: SymbolType, count: number = 0): number[] => {
        const data = symbolTickData[symbol];
        if (!data || data.tickHistory.length === 0) return [];

        const history =
            count > 0 && count < data.tickHistory.length ? data.tickHistory.slice(-count) : data.tickHistory;

        return history.map(tick => getLastDigit(tick.quote, data.decimalPlaces));
    };

    // Function to handle reference digit change - now allows empty values
    const handleReferenceDigitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.target.value;
        setReferenceDigitInput(input);

        // Only update the actual value if it's a valid number
        const value = parseInt(input, 10);
        if (!isNaN(value) && value >= 0 && value <= 9) {
            setReferenceDigit(value);
        }
    };

    // Function to handle analysis count change - now allows empty values
    const handleAnalysisCountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.target.value;
        setAnalysisCountInput(input);

        // Only update the actual value if it's a valid number
        const value = parseInt(input, 10);
        if (!isNaN(value) && value > 0) {
            setAnalysisCount(value);
        }
    };

    // Function to handle stake input changes
    const handleStakeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const input = e.target.value;
        setStakeInput(input);

        // Update trading settings if valid
        const value = parseFloat(input);
        if (!isNaN(value) && value >= 0.35) {
            setTradingSettings(prev => {
                const updated = { ...prev, stake: value };
                try {
                    localStorage.setItem(STORAGE_KEYS.TRADING_SETTINGS, JSON.stringify(updated));
                } catch (error) {
                    console.error('Error saving stake to localStorage:', error);
                }
                return updated;
            });
        }
    }, []);

    // Function to apply settings and validate inputs
    const applySettings = () => {
        // Validate reference digit
        let referenceValue = parseInt(referenceDigitInput, 10);
        if (isNaN(referenceValue) || referenceValue < 0 || referenceValue > 9) {
            referenceValue = 5; // Default value if invalid
            setReferenceDigitInput('5');
        }
        setReferenceDigit(referenceValue);

        // Validate analysis count
        let countValue = parseInt(analysisCountInput, 10);
        if (isNaN(countValue) || countValue <= 0) {
            countValue = 120; // Default value if invalid
            setAnalysisCountInput('120');
        }
        setAnalysisCount(countValue);

        // Refresh WebSocket connections with the current settings
        activeSymbols.forEach(symbol => {
            startWebSocket(symbol);
        });
        setStatus('Settings applied successfully');
        setTimeout(() => setStatus(''), 3000);
    };

    // Initialize WebSockets when activeSymbols change
    useEffect(() => {
        // Clean up previous connections
        Object.keys(webSocketRefs.current).forEach(symbol => {
            if (webSocketRefs.current[symbol as SymbolType]) {
                webSocketRefs.current[symbol as SymbolType]?.close();
                webSocketRefs.current[symbol as SymbolType] = null;
            }
        });

        // Start new connections for active symbols
        activeSymbols.forEach(symbol => {
            startWebSocket(symbol);
        });

        // Clean up function
        return () => {
            Object.keys(webSocketRefs.current).forEach(symbol => {
                if (webSocketRefs.current[symbol as SymbolType]) {
                    webSocketRefs.current[symbol as SymbolType]?.close();
                }
            });
        };
    }, [activeSymbols, tickCount]);

    // Only use the mock generator when we have no active symbols
    // This prevents conflicts between real and mock data
    useEffect(() => {
        // Don't use mock data if we have active WebSocket connections
        if (activeSymbols.length > 0) return;

        const tickInterval = setInterval(() => {
            const newTick = Math.floor(Math.random() * 10);
            setTicksHistory(prev => {
                const updated = [...prev, newTick];
                // Keep the last 20 ticks at most to avoid growing too large
                return updated.length > 20 ? updated.slice(-20) : updated;
            });

            // Also update the current digit for R_10 in mock data
            setSymbolTickData(prevData => ({
                ...prevData,
                R_10: {
                    ...prevData.R_10,
                    currentDigit: newTick,
                },
            }));
        }, 1000);

        return () => clearInterval(tickInterval);
    }, [activeSymbols.length]);

    // Toggle a symbol in the active symbols list
    const toggleSymbol = (symbol: SymbolType) => {
        setActiveSymbols(prev => {
            if (prev.includes(symbol)) {
                return prev.filter(s => s !== symbol);
            } else {
                return [...prev, symbol];
            }
        });
    };

    // Add utility function to get readable symbol names
    const getSymbolDisplayName = (symbol: SymbolType): string => {
        const symbolMap: Record<SymbolType, string> = {
            R_10: 'Volatility 10',
            R_25: 'Volatility 25',
            R_50: 'Volatility 50',
            R_75: 'Volatility 75',
            R_100: 'Volatility 100',
            '1HZ10V': 'Volatility 10 (1s)',
            '1HZ15V': 'Volatility 15 (1s)',
            '1HZ25V': 'Volatility 25 (1s)',
            '1HZ30V': 'Volatility 30 (1s)',
            '1HZ50V': 'Volatility 50 (1s)',
            '1HZ75V': 'Volatility 75 (1s)',
            '1HZ90V': 'Volatility 90 (1s)',
            '1HZ100V': 'Volatility 100 (1s)',
        };
        return symbolMap[symbol] || symbol;
    };

    // Function to create digit distribution display for a symbol
    const renderDigitDistribution = (symbol: SymbolType) => {
        const digits = getLastDigitsForSymbol(symbol);
        if (digits.length === 0) return null;

        // Count occurrences of each digit
        const digitCounts = Array(10).fill(0);
        digits.forEach(digit => {
            digitCounts[digit]++;
        });

        // Calculate percentages
        const digitPercentages = digitCounts.map(count => (count / digits.length) * 100);

        // Find max and min percentages
        const maxPercentage = Math.max(...digitPercentages);
        const minPercentage = Math.min(...digitPercentages);

        // Get current digit for this symbol - ensure it's using the most recent value
        const currentDigit = symbolTickData[symbol].currentDigit;

        // Even/Odd percentages
        const evenPercentage = calculateParityPercentage(digits, 'even');
        const oddPercentage = calculateParityPercentage(digits, 'odd');

        // Rise/Fall percentages
        const directionStats = analyzePriceDirections(symbol);

        // Calculate over/under statistics
        const overUnderStats = calculateOverUnder(symbol);

        return (
            <div className='digit-analysis-card'>
                <h3>
                    {getSymbolDisplayName(symbol)} Analysis {currentDigit !== undefined && `- Current: ${currentDigit}`}
                </h3>

                <div className='digit-grid'>
                    {digitPercentages.map((percentage, digit) => {
                        // Create class name based on conditions
                        const classNames = ['digit-box'];

                        if (percentage === maxPercentage) classNames.push('highest');
                        else if (percentage === minPercentage) classNames.push('lowest');

                        // Explicitly check if this digit matches the current digit
                        if (currentDigit !== undefined && digit === currentDigit) {
                            classNames.push('current');
                        }

                        return (
                            <div
                                key={digit}
                                className={classNames.join(' ')}
                                title={`${percentage.toFixed(1)}% ${digit === currentDigit ? '(Current)' : ''}`}
                            >
                                <span className='digit'>{digit}</span>
                                <span className='percentage'>{percentage.toFixed(1)}%</span>
                            </div>
                        );
                    })}
                </div>

                <div className='direction-stats'>
                    <div className='direction-stat rise'>Rise: {directionStats.rise.toFixed(1)}%</div>
                    <div className='direction-buttons'>
                        <button
                            className={`stat-button rise-button ${
                                activeTradeSymbol === symbol && tradeStatus === 'pending' ? 'loading' : ''
                            }`}
                            onClick={() => handleRiseTrade(symbol)}
                            disabled={tradeStatus === 'pending'}
                        >
                            Rise
                        </button>
                        <button
                            className={`stat-button fall-button ${
                                activeTradeSymbol === symbol && tradeStatus === 'pending' ? 'loading' : ''
                            }`}
                            onClick={() => handleFallTrade(symbol)}
                            disabled={tradeStatus === 'pending'}
                        >
                            Fall
                        </button>
                    </div>
                    <div className='direction-stat fall'>Fall: {directionStats.fall.toFixed(1)}%</div>
                </div>

                <div className='parity-stats'>
                    <div className='parity-stat even'>Even: {evenPercentage.toFixed(1)}%</div>
                    <div className='parity-buttons'>
                        <button
                            className={`stat-button even-button ${
                                activeTradeSymbol === symbol && tradeStatus === 'pending' ? 'loading' : ''
                            }`}
                            onClick={() => handleEvenTrade(symbol)}
                            disabled={tradeStatus === 'pending'}
                        >
                            Even
                        </button>
                        <button
                            className={`stat-button odd-button ${
                                activeTradeSymbol === symbol && tradeStatus === 'pending' ? 'loading' : ''
                            }`}
                            onClick={() => handleOddTrade(symbol)}
                            disabled={tradeStatus === 'pending'}
                        >
                            Odd
                        </button>
                    </div>
                    <div className='parity-stat odd'>Odd: {oddPercentage.toFixed(1)}%</div>
                </div>

                <div className='overunder-stats'>
                    <div className='overunder-stat over'>
                        Over {referenceDigit}: {overUnderStats.over.toFixed(1)}%
                    </div>
                    <div className='overunder-buttons'>
                        <button
                            className={`stat-button over-button ${
                                activeTradeSymbol === symbol && tradeStatus === 'pending' ? 'loading' : ''
                            }`}
                            onClick={() => handleOverTrade(symbol)}
                            disabled={tradeStatus === 'pending'}
                        >
                            Over
                        </button>
                        <button
                            className={`stat-button under-button ${
                                activeTradeSymbol === symbol && tradeStatus === 'pending' ? 'loading' : ''
                            }`}
                            onClick={() => handleUnderTrade(symbol)}
                            disabled={tradeStatus === 'pending'}
                        >
                            Under
                        </button>
                    </div>
                    <div className='overunder-stat under'>
                        Under {referenceDigit}: {overUnderStats.under.toFixed(1)}%
                    </div>
                </div>

                <div className='recent-digits'>
                    {digits.slice(-10).map((digit, idx) => (
                        <span key={idx} className={`recent-digit ${digit % 2 === 0 ? 'even' : 'odd'}`}>
                            {digit}
                        </span>
                    ))}
                </div>
            </div>
        );
    };

    // Trade handlers for different contract types
    const handleRiseTrade = (symbol: SymbolType) => {
        placeTrade(symbol, 'CALL', {
            contract_type: 'CALL',
            duration: 5,
            duration_unit: 't',
        });
    };

    const handleFallTrade = (symbol: SymbolType) => {
        placeTrade(symbol, 'PUT', {
            contract_type: 'PUT',
            duration: 5,
            duration_unit: 't',
        });
    };

    const handleEvenTrade = (symbol: SymbolType) => {
        placeTrade(symbol, 'DIGITEVEN', {
            contract_type: 'DIGITEVEN',
            duration: 1,
            duration_unit: 't',
        });
    };

    const handleOddTrade = (symbol: SymbolType) => {
        placeTrade(symbol, 'DIGITODD', {
            contract_type: 'DIGITODD',
            duration: 1,
            duration_unit: 't',
        });
    };

    const handleOverTrade = (symbol: SymbolType) => {
        placeTrade(symbol, 'DIGITOVER', {
            contract_type: 'DIGITOVER',
            duration: 1,
            duration_unit: 't',
            barrier: referenceDigit.toString(),
        });
    };

    const handleUnderTrade = (symbol: SymbolType) => {
        placeTrade(symbol, 'DIGITUNDER', {
            contract_type: 'DIGITUNDER',
            duration: 1,
            duration_unit: 't',
            barrier: referenceDigit.toString(),
        });
    };

    const placeTrade = async (symbol: SymbolType, tradeType: TradeType, params: Record<string, any> = {}) => {
        try {
            console.log('Placing trade:', { symbol, tradeType, params });

            // Store the trade info for reference
            setLastTradeInfo({
                symbol,
                tradeType,
                params,
                timestamp: Date.now(),
            });

            if (!getSelectedAccount() || !api_base.is_authorized) {
                setShowAuthModal(true);
                setTradeMessage('Connect your Deriv account before trading.');
                return;
            }
            setActiveTradeSymbol(symbol);
            setTradeStatus('pending');
            setTradeMessage(`Placing ${tradeType} trade on ${symbol}...`);

            const stake = tradingSettings.stake;

            if (!stake || stake <= 0) {
                setTradeStatus('error');
                setTradeMessage('Invalid stake amount');
                return;
            }

            const tradeRequest = {
                passthrough: { workspace: 'advanced' },
                buy: '1',
                price: stake,
                parameters: {
                    amount: stake,
                    basis: 'stake',
                    contract_type: params.contract_type || tradeType,
                    currency: getSelectedAccount()!.currency,
                    underlying_symbol: symbol,
                    duration: params.duration || 1,
                    duration_unit: params.duration_unit || 't',
                    ...(params.barrier !== undefined ? { barrier: params.barrier } : {}),
                },
            };

            console.log('Sending trade request:', JSON.stringify(tradeRequest, null, 2));

            await api_base.api!.send(tradeRequest);

        } catch (error) {
            console.error('Error placing trade:', error);
            setTradeStatus('error');
            setTradeMessage('Error preparing trade request');
        }
    };

    useEffect(() => {
        const update = () => { setIsAuthenticated(!!getSelectedAccount()); setShowAuthModal(!getSelectedAccount()); };
        update();
        window.addEventListener('pf:account-changed', update);
        return () => window.removeEventListener('pf:account-changed', update);
    }, []);
    const handleAuthenticate = () => redirectToLogin();
    const handleLogout = () => { void logoutTradingSession().then(() => window.location.reload()); };

    // Authentication modal component
    const renderAuthModal = () => {
        if (!showAuthModal) return null;

        return (
            <div className='auth-modal-overlay'>
                <div className='auth-modal'>
                    <div className='auth-modal__header'>
                        <h3>Authentication Required</h3>
                        <button className='settings-modal__close-btn' onClick={() => setShowAuthModal(false)}>
                            <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                                <path d='M6 18L18 6M6 6l12 12' />
                            </svg>
                        </button>
                    </div>
                    <div className='auth-modal__content'>
                        <p className='auth-modal__description'>
                            Please log in with your Deriv account to access trading features.
                        </p>

                        {authError && <div className='auth-modal__error'>{authError}</div>}

                        <div className='auth-modal__login-section'>
                            <Button
                                className='auth-modal__login-button'
                                onClick={redirectToLogin}
                                disabled={isAuthLoading}
                            >
                                {isAuthLoading ? 'Processing...' : 'Log in with Deriv'}
                            </Button>
                        </div>

                        <div className='auth-modal__helper-text'>
                            <p>Secure authentication through Deriv's official login system.</p>
                            <p>You will be redirected to Deriv to complete the authentication process.</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Add auth status component in header
    const renderAuthStatus = () => {
        if (!isAuthenticated) return null;

        return (
            <div className='auth-status'>
                <span className='auth-status__indicator'></span>
                <span className='auth-status__text'>Authenticated</span>
                <button className='auth-status__logout' onClick={handleLogout}>
                    Log Out
                </button>
            </div>
        );
    };

    return (
        <div className='advanced-display'>
            {/* Authentication Modal */}
            {renderAuthModal()}

            <div className='advanced-display__header'>
                <Text size='md' weight='bold' className='advanced-display__title'>
                    Market Analysis Tools
                </Text>
                {renderAuthStatus()}
            </div>

            {/* Only show the main content if authenticated */}
            {isAuthenticated ? (
                <>
                    <div className='advanced-display__action-bar'>
                        <div className='action-buttons-group'>
                            <Button
                                className={`futuristic-button ${isRunning ? 'futuristic-button--active' : ''}`}
                                onClick={toggleAnalysis}
                            >
                                {isRunning ? 'Stop Analysis' : 'Start Analysis'}
                            </Button>

                            {/* Add settings gear icon */}
                            <div className='settings-icon' onClick={toggleSettingsModal} title='Trading Settings'>
                                <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                                    <path d='M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z' />
                                    <path d='M19.4 15C19.2669 15.3016 19.2272 15.6362 19.286 15.9606C19.3448 16.285 19.4995 16.5843 19.73 16.82L19.79 16.88C19.976 17.0657 20.1235 17.2863 20.2241 17.5291C20.3248 17.7719 20.3766 18.0322 20.3766 18.295C20.3766 18.5578 20.3248 18.8181 20.2241 19.0609C20.1235 19.3037 19.976 19.5243 19.79 19.71C19.6043 19.896 19.3837 20.0435 19.1409 20.1441C18.8981 20.2448 18.6378 20.2966 18.375 20.2966C18.1122 20.2966 17.8519 20.2448 17.6091 20.1441C17.3663 20.0435 17.1457 19.896 16.96 19.71L16.9 19.65C16.6643 19.4195 16.365 19.2648 16.0406 19.206C15.7162 19.1472 15.3816 19.1869 15.08 19.32C14.7842 19.4468 14.532 19.6572 14.3543 19.9255C14.1766 20.1938 14.0813 20.5082 14.08 20.83V21C14.08 21.5304 13.8693 22.0391 13.4942 22.4142C13.1191 22.7893 12.6104 23 12.08 23C11.5496 23 11.0409 22.7893 10.6658 22.4142C10.2907 22.0391 10.08 21.5304 10.08 21V20.91C10.0723 20.579 9.96512 20.258 9.77251 19.9887C9.5799 19.7194 9.31074 19.5143 9 19.4C8.69838 19.2669 8.36381 19.2272 8.03941 19.286C7.71502 19.3448 7.41568 19.4995 7.18 19.73L7.12 19.79C6.93425 19.976 6.71368 20.1235 6.47088 20.2241C6.22808 20.3248 5.96783 20.3766 5.705 20.3766C5.44217 20.3766 5.18192 20.3248 4.93912 20.2241C4.69632 20.1235 4.47575 19.976 4.29 19.79C4.10405 19.6043 3.95653 19.3837 3.85588 19.1409C3.75523 18.8981 3.70343 18.6378 3.70343 18.375C3.70343 18.1122 3.75523 17.8519 3.85588 17.6091C3.95653 17.3663 4.10405 17.1457 4.29 16.96L4.35 16.9C4.58054 16.6643 4.73519 16.365 4.794 16.0406C4.85282 15.7162 4.81312 15.3816 4.68 15.08C4.55324 14.7842 4.34276 14.532 4.07447 14.3543C3.80618 14.1766 3.49179 14.0813 3.17 14.08H3C2.46957 14.08 1.96086 13.8693 1.58579 13.4942C1.21071 13.1191 1 12.6104 1 12.08C1 11.5496 1.21071 11.0409 1.58579 10.6658C1.96086 10.2907 2.46957 10.08 3 10.08H3.09C3.42099 10.0723 3.742 9.96512 4.0113 9.77251C4.28059 9.5799 4.48572 9.31074 4.6 9C4.73312 8.69838 4.77282 8.36381 4.714 8.03941C4.65519 7.71502 4.50054 7.41568 4.27 7.18L4.21 7.12C4.02405 6.93425 3.87653 6.71368 3.77588 6.47088C3.67523 6.22808 3.62343 5.96783 3.62343 5.705C3.62343 5.44217 3.67523 5.18192 3.77588 4.93912C3.87653 4.69632 4.02405 4.47575 4.21 4.29C4.39575 4.10405 4.61632 3.95653 4.85912 3.85588C5.10192 3.75523 5.36217 3.70343 5.625 3.70343C5.88783 3.70343 6.14808 3.75523 6.39088 3.85588C6.63368 3.95653 6.85425 4.10405 7.04 4.29L7.1 4.35C7.33568 4.58054 7.63502 4.73519 7.95941 4.794C8.28381 4.85282 8.61838 4.81312 8.92 4.68H9C9.29577 4.55324 9.54802 4.34276 9.72569 4.07447C9.90337 3.80618 9.99872 3.49179 10 3.17V3C10 2.46957 10.2107 1.96086 10.5858 1.58579C10.9609 1.21071 11.4696 1 12 1C12.5304 1 13.0391 1.21071 13.4142 1.58579C13.7893 1.96086 14 2.46957 14 3V3.09C14.0013 3.41179 14.0966 3.72618 14.2743 3.99447C14.452 4.26276 14.7042 4.47324 15 4.6C15.3016 4.73312 15.6362 4.77282 15.9606 4.714C16.285 4.65519 16.5843 4.50054 16.82 4.27L16.88 4.21C17.0657 4.02405 17.2863 3.87653 17.5291 3.77588C17.7719 3.67523 18.0322 3.62343 18.295 3.62343C18.5578 3.62343 18.8181 3.67523 19.0609 3.77588C19.3037 3.87653 19.5243 4.02405 19.71 4.21C19.896 4.39575 20.0435 4.61632 20.1441 4.85912C20.2448 5.10192 20.2966 5.36217 20.2966 5.625C20.2966 5.88783 20.2448 6.14808 20.1441 6.39088C20.0435 6.63368 19.896 6.85425 19.71 7.04L19.65 7.1C19.4195 7.33568 19.2648 7.63502 19.206 7.95941C19.1472 8.28381 19.1869 8.61838 19.32 8.92V9C19.4468 9.29577 19.6572 9.54802 19.9255 9.72569C20.1938 9.90337 20.5082 9.99872 20.83 10H21C21.5304 10 22.0391 10.2107 22.4142 10.5858C22.7893 10.9609 23 11.4696 23 12C23 12.5304 22.7893 13.0391 22.4142 13.4142C22.0391 13.7893 21.5304 14 21 14H20.91C20.5882 14.0013 20.2738 14.0966 20.0055 14.2743C19.7372 14.452 19.5268 14.7042 19.4 15Z' />
                                </svg>
                            </div>
                        </div>
                    </div>

                    {/* Settings Modal - Use the memoized component directly */}
                    {settingsModalComponent}

                    {/* Analysis settings - Updated for better editability */}
                    <div className='analysis-settings'>
                        <div className='analysis-settings__input-group'>
                            <label htmlFor='stake-amount'>Stake Amount (USD):</label>
                            <input
                                id='stake-amount'
                                type='text'
                                value={stakeInput}
                                onChange={handleStakeChange}
                                className='analysis-settings__input editable-input'
                                data-testid='stake-amount-input'
                                aria-label='Stake amount for trades'
                                placeholder='Min: 0.35'
                            />
                        </div>
                        <div className='analysis-settings__input-group'>
                            <label htmlFor='reference-digit'>Reference Digit (0-9):</label>
                            <input
                                id='reference-digit'
                                type='text'
                                value={referenceDigitInput}
                                onChange={handleReferenceDigitChange}
                                className='analysis-settings__input editable-input'
                                data-testid='reference-digit-input'
                                aria-label='Reference digit for over/under analysis'
                                placeholder='Enter digit (0-9)'
                            />
                        </div>
                        <div className='analysis-settings__input-group'>
                            <label htmlFor='analysis-count'>Analysis Count:</label>
                            <input
                                id='analysis-count'
                                type='text'
                                value={analysisCountInput}
                                onChange={handleAnalysisCountChange}
                                className='analysis-settings__input editable-input'
                                data-testid='analysis-count-input'
                                aria-label='Number of ticks to analyze'
                                placeholder='Min: 10'
                            />
                        </div>
                        <Button className='analysis-settings__apply-button futuristic-button' onClick={applySettings}>
                            Apply Settings
                        </Button>
                    </div>

                    {/* Symbol selector for multi-symbol analysis */}
                    <div className='symbol-selector'>
                        <Text size='sm' weight='bold'>
                            Active Symbols:
                        </Text>
                        <div className='symbol-buttons'>
                            {(
                                [
                                    'R_10',
                                    'R_25',
                                    'R_50',
                                    'R_75',
                                    'R_100',
                                    '1HZ10V',
                                    '1HZ15V',
                                    '1HZ25V',
                                    '1HZ30V',
                                    '1HZ50V',
                                    '1HZ75V',
                                    '1HZ90V',
                                    '1HZ100V',
                                ] as SymbolType[]
                            ).map(symbol => (
                                <button
                                    key={symbol}
                                    className={`symbol-button ${activeSymbols.includes(symbol) ? 'active' : ''}`}
                                    onClick={() => toggleSymbol(symbol)}
                                    title={`${getSymbolDisplayName(symbol)} (${symbol})`}
                                >
                                    {getSymbolDisplayName(symbol)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Multi-symbol digit analysis */}
                    <div className='digit-analysis-container'>
                        {activeSymbols.map(symbol => renderDigitDistribution(symbol))}
                    </div>

                    {status && (
                        <div
                            className={`advanced-display__status advanced-display__status--${
                                status.includes('Error') ? 'error' : 'success'
                            }`}
                        >
                            {status}
                        </div>
                    )}

                    {/* Add trade status message */}
                    {tradeMessage && (
                        <div
                            className={`advanced-display__status advanced-display__status--${
                                tradeStatus === 'error' ? 'error' : tradeStatus === 'success' ? 'success' : 'info'
                            }`}
                        >
                            {tradeMessage}
                        </div>
                    )}

                    {/* Display current ticks history for user reference */}
                    {ticksHistory.length > 0 && (
                        <div className='ticks-history-container'>
                            <Text size='xs' weight='bold'>
                                Recent Ticks:
                            </Text>
                            <div className='ticks-display'>
                                {ticksHistory.slice(-10).map((tick, i) => (
                                    <span key={i} className={`tick-digit ${tick % 2 === 0 ? 'even' : 'odd'}`}>
                                        {tick}
                                    </span>
                                ))}
                            </div>
                            {ticksHistory.length >= 5 && (
                                <div className='parity-stats'>
                                    <Text size='xs'>
                                        Last {Math.min(ticksHistory.length, 10)} digits: Even:{' '}
                                        {calculateParityPercentage(ticksHistory.slice(-10), 'even').toFixed(1)}% | Odd:{' '}
                                        {calculateParityPercentage(ticksHistory.slice(-10), 'odd').toFixed(1)}%
                                    </Text>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Add Trade History Section with updated rendering */}
                    <div className='trade-history-container'>
                        <Text size='md' weight='bold' className='trade-history-title'>
                            <div>
                                <span className={`title-dot ${activeContracts.size > 0 ? 'active' : ''}`}></span>
                                Trade Results
                            </div>
                            {activeContracts.size > 0 && (
                                <span style={{ fontSize: '12px', color: '#4caf50' }}>
                                    {activeContracts.size} Active
                                </span>
                            )}
                        </Text>
                        {renderFinalTradeResults()}
                    </div>
                </>
            ) : (
                <div className='advanced-display__placeholder'>
                    <div className='advanced-display__placeholder-content'>
                        <svg
                            className='lock-icon'
                            viewBox='0 0 24 24'
                            width='48'
                            height='48'
                            fill='none'
                            stroke='currentColor'
                            strokeWidth='1.5'
                        >
                            <rect x='3' y='11' width='18' height='11' rx='2' />
                            <path d='M7 11V7a5 5 0 0110 0v4' />
                        </svg>
                        <Text size='md' weight='bold'>
                            Authentication Required
                        </Text>
                        <Text size='sm'>Please log in to access trading features</Text>
                    </div>
                </div>
            )}
        </div>
    );
});

export default AdvancedDisplay;
