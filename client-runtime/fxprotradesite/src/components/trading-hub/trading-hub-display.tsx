import React, { useState, useRef, useEffect } from 'react';
import './trading-hub-display.scss';
import { api_base } from '../../external/bot-skeleton/services/api/api-base';
import { doUntilDone } from '../../external/bot-skeleton/services/tradeEngine/utils/helpers';
import { observer as globalObserver } from '../../external/bot-skeleton/utils/observer';
import { useStore } from '@/hooks/useStore';
import useThemeSwitcher from '@/hooks/useThemeSwitcher';
import marketAnalyzer, { TradeRecommendation } from '../../services/market-analyzer';
import { botNotification } from '@/components/bot-notification/bot-notification';
import EmojiAnimation from '@/components/emoji-animation';

const TradingHubDisplay: React.FC = () => {
    const MINIMUM_STAKE = '0.35';
    const { is_dark_mode_on } = useThemeSwitcher();

    // Set all to false by default - they will be initialized from localStorage in useEffect
    const [isAutoDifferActive, setIsAutoDifferActive] = useState(false);
    const [isAutoOverUnderActive, setIsAutoOverUnderActive] = useState(false);
    const [isAutoO5U4Active, setIsAutoO5U4Active] = useState(false);
    const [isAutoMatchesActive, setIsAutoMatchesActive] = useState(false);
    const [recommendation, setRecommendation] = useState<TradeRecommendation | null>(null);
    const [marketStats, setMarketStats] = useState<Record<string, any>>({});
    const [stake, setStake] = useState(MINIMUM_STAKE);
    const [martingale, setMartingale] = useState('2');
    const [isTrading, setIsTrading] = useState(false);
    const [isContinuousTrading, setIsContinuousTrading] = useState(false);

    // Per-card trading state for decentralized run buttons
    const [cardsTradingState, setCardsTradingState] = useState<{
        o5u4: boolean;
        matches: boolean;
        overUnder: boolean;
        differ: boolean;
    }>({
        o5u4: false,
        matches: false,
        overUnder: false,
        differ: false
    });
    const [currentBarrier, setCurrentBarrier] = useState<number | null>(null);
    const [currentSymbol, setCurrentSymbol] = useState<string>('R_100');
    const [currentStrategy, setCurrentStrategy] = useState<string>('over');
    const tradingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const [sessionRunId, setSessionRunId] = useState<string>(`tradingHub_${Date.now()}`);
    const [isAnalysisReady, setIsAnalysisReady] = useState(false);
    const analysisReadinessInterval = useRef<NodeJS.Timeout | null>(null);
    const [analysisCount, setAnalysisCount] = useState(0);
    const [lastAnalysisTime, setLastAnalysisTime] = useState<string>('');
    const analysisInfoInterval = useRef<NodeJS.Timeout | null>(null);
    const [isTradeInProgress, setIsTradeInProgress] = useState(false);
    const [lastTradeId, setLastTradeId] = useState<string>('');
    const [tradeCount, setTradeCount] = useState(0);
    const lastTradeTime = useRef<number>(0);
    const minimumTradeCooldown = 3000; // 3 seconds minimum between trades
    const o5u4LastTradeTime = useRef<number>(0);
    const o5u4MinimumCooldown = 100; // Very short 100ms cooldown for maximum trading frequency
    const matchesLastTradeTime = useRef<number>(0);
    const matchesMinimumCooldown = 200; // Short 200ms cooldown for aggressive trading

    const [initialStake, setInitialStake] = useState(MINIMUM_STAKE);
    const [appliedStake, setAppliedStake] = useState(MINIMUM_STAKE);
    const [lastTradeWin, setLastTradeWin] = useState<boolean | null>(null);
    const [activeContractId, setActiveContractId] = useState<string | null>(null);
    const [consecutiveLosses, setConsecutiveLosses] = useState(0);
    
    // State variables for emoji animation
    const [showEmojiAnimation, setShowEmojiAnimation] = useState(false);
    const [isProfitPositive, setIsProfitPositive] = useState(false);

    const activeContractRef = useRef<string | null>(null);
    const [lastTradeResult, setLastTradeResult] = useState<string>('');

    const availableSymbols = ['R_10', 'R_25', 'R_50', 'R_75', 'R_100', 'RDBEAR', 'RDBULL', '1HZ10V', '1HZ15V', '1HZ25V', '1HZ30V', '1HZ50V', '1HZ75V', '1HZ90V', '1HZ100V'];

    const lastMartingaleActionRef = useRef<string>('initial');
    const lastWinTimeRef = useRef<number>(0);

    // Stop Loss and Take Profit - Always active
    const [stopLossAmount, setStopLossAmount] = useState('5.00');
    const [takeProfitAmount, setTakeProfitAmount] = useState('10.00');
    const stopLossAmountRef = useRef('5.00'); // Ref for immediate access in closures
    const takeProfitAmountRef = useRef('10.00'); // Ref for immediate access in closures
    const [cumulativeProfit, setCumulativeProfit] = useState(0);
    const cumulativeProfitRef = useRef(0); // Ref to track latest profit for interval closure
    const stopLossCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const isContinuousTradingRef = useRef(false); // Ref to track trading state in interval
    const slTpTriggeredRef = useRef(false); // Prevent multiple triggers

    // Per-card interval refs for independent trading loops
    const o5u4IntervalRef = useRef<NodeJS.Timeout | null>(null);
    const matchesIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const overUnderIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const differIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Per-card trading refs (for closures to have current values)
    const cardsTradingRefs = useRef({
        o5u4: false,
        matches: false,
        overUnder: false,
        differ: false
    });

    // Function to extract the last digit from a price based on its actual decimal places
    const getLastDigitFromPrice = (price: number): number => {
        // Convert to string to preserve exact decimal representation
        const priceStr = price.toString();
        
        // Find the decimal point
        const decimalIndex = priceStr.indexOf('.');
        
        if (decimalIndex === -1) {
            // No decimal point, last digit is the ones place
            const result = Math.abs(price) % 10;
            return result;
        }
        
        // Get the last character after decimal point
        const lastChar = priceStr[priceStr.length - 1];
        
        // Convert back to number, ensuring it's a valid digit 0-9
        const lastDigit = parseInt(lastChar, 10);
        
        // Fallback to modulo if parsing fails
        if (isNaN(lastDigit)) {
            console.warn(`getLastDigitFromPrice: Failed to parse last digit from ${priceStr}, using fallback`);
            return Math.abs(Math.floor(price * Math.pow(10, priceStr.length - decimalIndex - 1))) % 10;
        }
        
        return lastDigit;
    };

    // Function to analyze price precision for debugging
    const analyzePricePrecision = (prices: number[], symbol: string) => {
        const samplePrices = prices.slice(0, 5);
        console.log(`🔍 ${symbol} price samples:`, samplePrices.map(p => ({
            original: p,
            string: p.toString(),
            lastDigit: getLastDigitFromPrice(p),
            oldMethod: Math.floor((p * 100)) % 10
        })));
    };

    const { run_panel, transactions, client } = useStore();

    const [activeContracts, setActiveContracts] = useState<Record<string, any>>({});
    const contractUpdateInterval = useRef<NodeJS.Timeout | null>(null);
    const lastTradeRef = useRef<{ id: string | null; profit: number | null }>({ id: null, profit: null });
    const [winCount, setWinCount] = useState(0);
    const [lossCount, setLossCount] = useState(0);

    const currentStakeRef = useRef(MINIMUM_STAKE);
    const currentConsecutiveLossesRef = useRef(0);
    const contractSettledTimeRef = useRef(0);
    const waitingForSettlementRef = useRef(false);

    // O5U4 specific contract tracking
    const o5u4ActiveContracts = useRef<{
        over5ContractId: string | null;
        under4ContractId: string | null;
        over5Result: 'pending' | 'win' | 'loss' | null;
        under4Result: 'pending' | 'win' | 'loss' | null;
        bothSettled: boolean;
    }>({
        over5ContractId: null,
        under4ContractId: null,
        over5Result: null,
        under4Result: null,
        bothSettled: false
    });

    // Track last traded conditions to ensure we wait for NEW conditions
    const lastO5U4Conditions = useRef<{
        symbol: string | null;
        lastDigit: number | null;
        tradedAt: number | null;
    }>({
        symbol: null,
        lastDigit: null,
        tradedAt: null
    });

    // O5U4 bot - using market analyzer for all symbols
    const [o5u4Analysis, setO5u4Analysis] = useState<{
        bestSymbol: string | null;
        symbolsAnalysis: Record<string, any>;
        readySymbols: string[];
    }>({
        bestSymbol: null,
        symbolsAnalysis: {},
        readySymbols: []
    });

    // Matches bot - digit frequency analysis for all volatilities
    const [matchesAnalysis, setMatchesAnalysis] = useState<{
        digitFrequencies: Record<string, Record<number, number>>; // symbol -> digit -> frequency
        topDigits: Record<string, number[]>; // symbol -> top 5 digits
        readySymbols: string[];
        lastUpdated?: Record<string, number>; // symbol -> timestamp
        bestSymbol?: string | null; // symbol with highest total frequency
        symbolTotalFrequencies?: Record<string, number>; // symbol -> total frequency of top 5
        // Remove isAnalyzing - analyze silently
    }>({
        digitFrequencies: {},
        topDigits: {},
        readySymbols: [],
        lastUpdated: {},
        bestSymbol: null,
        symbolTotalFrequencies: {}
        // Remove isAnalyzing - analyze silently
    });

    // Active contracts for Matches strategy
    const matchesActiveContracts = useRef<{
        [symbol: string]: {
            [digit: number]: string | null; // digit -> contract_id
        }
    }>({});

    // Matches analysis interval ref for cleanup
    const matchesAnalysisIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Symbols grid toggle state (hidden by default)
    const [isSymbolsGridVisible, setIsSymbolsGridVisible] = useState(false);
    
    // Symbols overview toggle state (hidden by default)
    const [isSymbolsOverviewVisible, setIsSymbolsOverviewVisible] = useState(false);

    const manageMartingale = (
        action: 'init' | 'update' | 'get',
        params?: {
            newValue?: string;
        }
    ): string => {
        switch (action) {
            case 'init':
                if (params?.newValue) {
                    const validValue = Math.max(parseFloat(params.newValue), 1).toFixed(1);
                    console.log(`Martingale initialization from ${martingale} to ${validValue}`);
                    setMartingale(validValue);

                    try {
                        localStorage.setItem('tradingHub_martingale', validValue);
                    } catch (e) {
                        console.warn('Could not save martingale to localStorage', e);
                    }
                }
                break;

            case 'update':
                if (params?.newValue !== undefined) {
                    setMartingale(params.newValue);
                }
                break;

            case 'get':
                const storedValue = localStorage.getItem('tradingHub_martingale');
                if (storedValue) {
                    const parsedValue = parseFloat(storedValue);
                    if (!isNaN(parsedValue) && parsedValue >= 1) {
                        return storedValue;
                    }
                }
                return martingale;

            default:
                console.error('Unknown martingale management action:', action);
        }

        return martingale;
    };

    const manageStake = (
        action: 'init' | 'reset' | 'martingale' | 'update' | 'get',
        params?: {
            newValue?: string;
            lossCount?: number;
        }
    ): string => {
        switch (action) {
            case 'init':
                if (params?.newValue) {
                    const validValue = Math.max(parseFloat(params.newValue), parseFloat(MINIMUM_STAKE)).toFixed(2);
                    console.log(`Stake initialization from ${initialStake} to ${validValue}`);
                    setInitialStake(validValue);
                    setAppliedStake(validValue);
                    currentStakeRef.current = validValue;

                    try {
                        localStorage.setItem('tradingHub_initialStake', validValue);
                    } catch (e) {
                        console.warn('Could not save stake to localStorage', e);
                    }
                }
                break;

            case 'update':
                if (params?.newValue !== undefined) {
                    const inputValue = params.newValue;
                    setStake(inputValue);
                }
                break;

            case 'reset':
                const storedInitialStake = localStorage.getItem('tradingHub_initialStake') || initialStake;
                lastMartingaleActionRef.current = 'reset';
                lastWinTimeRef.current = Date.now();

                console.log(
                    `Resetting stake from ${currentStakeRef.current} to stored initial: ${storedInitialStake} (state value: ${initialStake})`
                );
                console.log(`Consecutive losses counter reset from ${currentConsecutiveLossesRef.current} to 0`);

                setAppliedStake(storedInitialStake);
                currentStakeRef.current = storedInitialStake;
                setConsecutiveLosses(0);
                currentConsecutiveLossesRef.current = 0;
                break;

            case 'martingale':
                if (lastMartingaleActionRef.current === 'martingale' && Date.now() - lastWinTimeRef.current < 2000) {
                    console.warn('Prevented duplicate martingale application - too soon after last martingale');
                    return currentStakeRef.current;
                }

                const prevLossCount = currentConsecutiveLossesRef.current;
                const newLossCount = params?.lossCount !== undefined ? params.lossCount : prevLossCount + 1;

                const maxLossCount = 10;
                const safeLossCount = Math.min(newLossCount, maxLossCount);

                currentConsecutiveLossesRef.current = safeLossCount;

                const baseStake = localStorage.getItem('tradingHub_initialStake') || initialStake;

                const currentMartingale = manageMartingale('get');
                const multiplier = parseFloat(currentMartingale);
                const validMultiplier = !isNaN(multiplier) && multiplier >= 1 ? multiplier : 1;

                const newStake = (parseFloat(baseStake) * Math.pow(validMultiplier, safeLossCount)).toFixed(2);

                console.log(`Martingale calculation details:`);
                console.log(`- Base stake: ${baseStake}`);
                console.log(`- Multiplier: ${validMultiplier}`);
                console.log(`- Previous loss count: ${prevLossCount}`);
                console.log(`- New loss count: ${safeLossCount}`);
                console.log(`- Formula: ${baseStake} × ${validMultiplier}^${safeLossCount} = ${newStake}`);

                lastMartingaleActionRef.current = 'martingale';
                currentStakeRef.current = newStake;
                setAppliedStake(newStake);
                setConsecutiveLosses(safeLossCount);
                break;

            case 'get':
                return currentStakeRef.current || initialStake;

            default:
                console.error('Unknown stake management action:', action);
        }

        return currentStakeRef.current;
    };

    useEffect(() => {
        try {
            const savedStake = localStorage.getItem('tradingHub_initialStake');
            if (savedStake) {
                console.log(`Loaded saved stake from storage: ${savedStake}`);
                setInitialStake(savedStake);
                setStake(savedStake);
                currentStakeRef.current = savedStake;
            }

            const savedMartingale = localStorage.getItem('tradingHub_martingale');
            if (savedMartingale) {
                console.log(`Loaded saved martingale from storage: ${savedMartingale}`);
                setMartingale(savedMartingale);
            }

            // Load strategy preferences from localStorage
            const savedAutoDiffer = localStorage.getItem('tradingHub_autoDifferActive');
            const savedOverUnder = localStorage.getItem('tradingHub_overUnderActive');
            const savedO5U4 = localStorage.getItem('tradingHub_o5u4Active');
            const savedMatches = localStorage.getItem('tradingHub_matchesActive');

            console.log(`Loading saved strategy states - Differ: ${savedAutoDiffer}, OverUnder: ${savedOverUnder}, O5U4: ${savedO5U4}, Matches: ${savedMatches}`);
            
            if (savedAutoDiffer !== null) {
                setIsAutoDifferActive(savedAutoDiffer === 'true');
            } else {
                // Default to false if not set
                setIsAutoDifferActive(false);
            }
            if (savedOverUnder !== null) {
                setIsAutoOverUnderActive(savedOverUnder === 'true');
            } else {
                setIsAutoOverUnderActive(false);
            }
            if (savedO5U4 !== null) {
                setIsAutoO5U4Active(savedO5U4 === 'true');
            } else {
                setIsAutoO5U4Active(false);
            }
            if (savedMatches !== null) {
                setIsAutoMatchesActive(savedMatches === 'true');
            } else {
                setIsAutoMatchesActive(false);
            }
            
            // Load stop loss and take profit amounts (always enabled)
            const savedStopLossAmount = localStorage.getItem('tradingHub_stopLossAmount');
            const savedTakeProfitAmount = localStorage.getItem('tradingHub_takeProfitAmount');

            if (savedStopLossAmount) {
                setStopLossAmount(savedStopLossAmount);
                stopLossAmountRef.current = savedStopLossAmount;
            }
            if (savedTakeProfitAmount) {
                setTakeProfitAmount(savedTakeProfitAmount);
                takeProfitAmountRef.current = savedTakeProfitAmount;
            }

            // Ensure only one strategy is active, prioritizing O5U4
            setTimeout(() => {
                console.log(`Strategy states after init - O5U4: ${isAutoO5U4Active}, Matches: ${isAutoMatchesActive}, OverUnder: ${isAutoOverUnderActive}, Differ: ${isAutoDifferActive}`);
                
                // Emergency fix: If we have multiple active strategies, prioritize O5U4
                if (isAutoO5U4Active) {
                    if (isAutoDifferActive) {
                        console.log('🚨 FIXING: Both O5U4 and Differ are active - disabling Differ to prioritize O5U4');
                        setIsAutoDifferActive(false);
                        localStorage.setItem('tradingHub_autoDifferActive', 'false');
                    }
                    if (isAutoOverUnderActive) {
                        console.log('🚨 FIXING: Both O5U4 and OverUnder are active - disabling OverUnder to prioritize O5U4');
                        setIsAutoOverUnderActive(false);
                        localStorage.setItem('tradingHub_overUnderActive', 'false');
                    }
                    if (isAutoMatchesActive) {
                        console.log('🚨 FIXING: Both O5U4 and Matches are active - disabling Matches to prioritize O5U4');
                        setIsAutoMatchesActive(false);
                        localStorage.setItem('tradingHub_matchesActive', 'false');
                    }
                }
            }, 100);
        } catch (e) {
            console.warn('Could not load settings from localStorage', e);
        }
    }, [client?.loginid]);

    // Sync cumulativeProfit state with ref for interval access
    // No longer need useEffect to sync - we update ref directly with state now
    
    useEffect(() => {
        const session_id = `tradingHub_${Date.now()}`;
        setSessionRunId(session_id);
        globalObserver.emit('bot.started', session_id);

        marketAnalyzer.start();

        analysisReadinessInterval.current = setInterval(() => {
            if (marketAnalyzer.isReadyForTrading()) {
                setIsAnalysisReady(true);
                if (analysisReadinessInterval.current) {
                    clearInterval(analysisReadinessInterval.current);
                }
            }
        }, 500);

        analysisInfoInterval.current = setInterval(() => {
            const info = marketAnalyzer.getAnalyticsInfo();
            setAnalysisCount(info.analysisCount);
            setLastAnalysisTime(info.lastAnalysisTime ? new Date(info.lastAnalysisTime).toLocaleTimeString() : '');
        }, 1000);

        // Aggressive O5U4 monitoring - trades on every met condition
        const o5u4MonitorInterval = setInterval(() => {
            if (isAutoO5U4Active && isContinuousTrading && !isTradeInProgress && 
                !o5u4ActiveContracts.current.over5ContractId && 
                !o5u4ActiveContracts.current.under4ContractId &&
                !slTpTriggeredRef.current && isContinuousTradingRef.current) {
                
                const now = Date.now();
                const timeSinceLastO5U4Trade = now - o5u4LastTradeTime.current;
                
                // Trade frequently whenever conditions are met
                if (timeSinceLastO5U4Trade >= o5u4MinimumCooldown) {
                    console.log('🔄 O5U4 Monitor: Aggressive check for conditions...');
                    console.log(`🔄 O5U4 Monitor: Best symbol available: ${o5u4Analysis.bestSymbol}`);
                    
                    if (checkO5U4Conditions()) {
                        console.log('🔄 O5U4 Monitor: CONDITIONS MET - executing trade immediately');
                        o5u4LastTradeTime.current = now;
                        executeO5U4Trade();
                    } else {
                        console.log('🔄 O5U4 Monitor: No conditions met - waiting');
                    }
                } else {
                    console.log(`🔄 O5U4 Monitor: Brief cooldown (${o5u4MinimumCooldown - timeSinceLastO5U4Trade}ms remaining)`);
                }
            }
        }, 1000); // Check every 1 second for maximum responsiveness

        // Aggressive Matches monitoring - trades when analysis is ready
        const matchesMonitorInterval = setInterval(() => {
            if (isAutoMatchesActive && isContinuousTrading && !isTradeInProgress && 
                !hasActiveMatchesContracts() &&
                !slTpTriggeredRef.current && isContinuousTradingRef.current) {
                
                const now = Date.now();
                const timeSinceLastMatchesTrade = now - matchesLastTradeTime.current;
                
                // Trade frequently whenever conditions are met
                if (timeSinceLastMatchesTrade >= matchesMinimumCooldown) {
                    console.log('🔄 Matches Monitor: Checking for ready symbols...');
                    console.log(`🔄 Matches Monitor: Ready symbols: ${matchesAnalysis.readySymbols.length}`);
                    
                    if (matchesAnalysis.readySymbols.length > 0) {
                        const volatilitySymbols = availableSymbols;
                        const readySymbol = volatilitySymbols.find(symbol => 
                            matchesAnalysis.readySymbols.includes(symbol) && 
                            matchesAnalysis.topDigits[symbol]?.length === 5
                        );
                        
                        if (readySymbol) {
                            console.log('🔄 Matches Monitor: CONDITIONS MET - executing trades immediately');
                            matchesLastTradeTime.current = now;
                            executeMatchesTrades();
                        } else {
                            console.log('🔄 Matches Monitor: Analysis not complete - waiting');
                        }
                    } else {
                        console.log('🔄 Matches Monitor: No ready symbols - waiting');
                    }
                } else {
                    console.log(`🔄 Matches Monitor: Brief cooldown (${matchesMinimumCooldown - timeSinceLastMatchesTrade}ms remaining)`);
                }
            }
        }, 1000); // Check every 1 second for maximum responsiveness

        // Stop Loss and Take Profit monitoring - Always active when trading
        stopLossCheckIntervalRef.current = setInterval(() => {
            if (isContinuousTradingRef.current && !slTpTriggeredRef.current) {
                const now = new Date().toLocaleTimeString();
                const currentProfit = cumulativeProfitRef.current;
                console.log(`[${now}] Checking SL/TP - P/L: $${currentProfit.toFixed(2)}, SL: -$${stopLossAmountRef.current}, TP: $${takeProfitAmountRef.current}`);
                checkStopLossAndTakeProfit();
            }
        }, 2000); // Check every 2 seconds

        // Store the interval reference for cleanup
        const cleanupO5U4Monitor = () => clearInterval(o5u4MonitorInterval);
        const cleanupMatchesMonitor = () => clearInterval(matchesMonitorInterval);

        const unsubscribe = marketAnalyzer.onAnalysis((newRecommendation, allStats) => {
            setRecommendation(newRecommendation);
            setMarketStats(allStats);

            // Update O5U4 analysis for all symbols
            console.log('📊 Market analyzer callback - updating O5U4 analysis...');
            analyzeO5U4AllSymbols(allStats);

            // Update Matches analysis continuously - AGGRESSIVE MODE (like O5U4)
            if (isAutoMatchesActive) {
                console.log('📊 Matches: Market analyzer callback - continuous analysis...');
                console.log('📊 Matches: marketStats available:', !!allStats, 'symbols count:', Object.keys(allStats || {}).length);
                analyzeMatchesFromMarketData(allStats);
            }

            // Check for O5U4 trade execution - AGGRESSIVE MODE (trade on every met condition)
            if (isAutoO5U4Active && isContinuousTrading && !isTradeInProgress &&
                !slTpTriggeredRef.current && isContinuousTradingRef.current) {
                console.log('📊 O5U4: Market analyzer callback - AGGRESSIVE checking...');
                const now = Date.now();
                const timeSinceLastO5U4Trade = now - o5u4LastTradeTime.current;
                
                console.log(`📊 O5U4: Time since last trade: ${timeSinceLastO5U4Trade}ms (cooldown: ${o5u4MinimumCooldown}ms)`);
                console.log(`📊 O5U4: Active contracts - Over5: ${o5u4ActiveContracts.current.over5ContractId}, Under4: ${o5u4ActiveContracts.current.under4ContractId}`);
                console.log(`📊 O5U4: Current best symbol from analysis: ${o5u4Analysis.bestSymbol}`);
                
                // Trade aggressively whenever conditions are met and no contracts are active
                if (timeSinceLastO5U4Trade >= o5u4MinimumCooldown && !activeContractRef.current && 
                    !o5u4ActiveContracts.current.over5ContractId && !o5u4ActiveContracts.current.under4ContractId) {
                    
                    console.log('📊 O5U4: Ready to trade - checking conditions...');
                    
                    // Check conditions immediately - trade on every met condition
                    if (checkO5U4Conditions()) {
                        console.log('📊 O5U4: CONDITIONS MET - executing trade immediately');
                        o5u4LastTradeTime.current = now;
                        executeO5U4Trade();
                    } else {
                        console.log('📊 O5U4: No conditions met at this moment');
                    }
                } else {
                    console.log('📊 O5U4: Not ready (contracts active or brief cooldown)');
                }
            }

            if (isContinuousTrading && isAutoOverUnderActive && newRecommendation) {
                setCurrentStrategy(newRecommendation.strategy);
                setCurrentSymbol(newRecommendation.symbol);
            }
        });

        const contractSettlementHandler = (response: any) => {
            if (
                response?.id === 'contract.settled' &&
                response?.data &&
                lastTradeRef.current?.id !== response.data.contract_id
            ) {
                const contract_info = response.data;

                // Handle O5U4 dual contracts
                if (isAutoO5U4Active && 
                    (contract_info.contract_id === o5u4ActiveContracts.current.over5ContractId || 
                     contract_info.contract_id === o5u4ActiveContracts.current.under4ContractId)) {
                    
                    const isOver5 = contract_info.contract_id === o5u4ActiveContracts.current.over5ContractId;
                    const isWin = contract_info.profit >= 0;
                    
                    console.log(`O5U4 ${isOver5 ? 'Over 5' : 'Under 4'} contract ${contract_info.contract_id} settled with ${isWin ? 'WIN' : 'LOSS'}.`);
                    
                    // Update the result for this contract
                    if (isOver5) {
                        o5u4ActiveContracts.current.over5Result = isWin ? 'win' : 'loss';
                    } else {
                        o5u4ActiveContracts.current.under4Result = isWin ? 'win' : 'loss';
                    }
                    
                    // Check if both contracts are now settled
                    if (o5u4ActiveContracts.current.over5Result !== 'pending' && 
                        o5u4ActiveContracts.current.under4Result !== 'pending' && 
                        !o5u4ActiveContracts.current.bothSettled) {
                        
                        o5u4ActiveContracts.current.bothSettled = true;
                        
                        const over5Won = o5u4ActiveContracts.current.over5Result === 'win';
                        const under4Won = o5u4ActiveContracts.current.under4Result === 'win';
                        
                        console.log(`O5U4 Both contracts settled via handler. Over5: ${over5Won ? 'WIN' : 'LOSS'}, Under4: ${under4Won ? 'WIN' : 'LOSS'}`);
                        
                        // Update cumulative profit for stop loss/take profit (state + ref)
                        const newProfit = cumulativeProfitRef.current + contract_info.profit;
                        cumulativeProfitRef.current = newProfit;
                        setCumulativeProfit(newProfit);
                        console.log(`💰 Updated cumulative profit: $${newProfit.toFixed(2)}`);
                        
                        // Process combined result
                        if (over5Won || under4Won) {
                            setLastTradeWin(true);
                            setLastTradeResult('WIN');
                            manageStake('reset');
                            console.log('O5U4: At least one contract won - resetting stake');
                        } else {
                            setLastTradeWin(false);
                            setLastTradeResult('LOSS');
                            manageStake('martingale');
                            console.log('O5U4: Both contracts lost - applying martingale');
                        }
                        
                        lastTradeRef.current = {
                            id: o5u4ActiveContracts.current.over5ContractId!,
                            profit: contract_info.profit, // This will be updated with total profit in the interval
                        };
                        
                        // Reset O5U4 tracking immediately for faster next trade
                        o5u4ActiveContracts.current = {
                            over5ContractId: null,
                            under4ContractId: null,
                            over5Result: null,
                            under4Result: null,
                            bothSettled: false
                        };

                        activeContractRef.current = null;
                        
                        // Reset and wait for NEW conditions before next trade
                        if (isContinuousTrading && isAutoO5U4Active) {
                            console.log('O5U4: Trade completed - now waiting for NEW conditions');
                            // Don't immediately check - let the market analyzer detect new conditions naturally
                        }
                    }
                    
                    return; // Don't process as regular contract
                }

                // Handle Matches contracts
                let isMatchesContract = false;
                for (const symbol in matchesActiveContracts.current) {
                    for (const digit in matchesActiveContracts.current[symbol]) {
                        if (matchesActiveContracts.current[symbol][digit] === contract_info.contract_id) {
                            isMatchesContract = true;
                            const isWin = contract_info.profit >= 0;
                            console.log(`🎯 Matches: ${symbol} digit ${digit} contract ${contract_info.contract_id} settled with ${isWin ? 'WIN' : 'LOSS'} (profit: ${contract_info.profit})`);
                            
                            // Remove from activeContracts display
                            setActiveContracts(prev => {
                                const newContracts = { ...prev };
                                delete newContracts[contract_info.contract_id];
                                console.log(`🎯 Matches: Contract ${contract_info.contract_id} removed from UI display`);
                                return newContracts;
                            });
                            
                            // Remove from tracking
                            matchesActiveContracts.current[symbol][digit] = null;
                            
                            // Check how many contracts are still active
                            const remainingContracts = Object.values(matchesActiveContracts.current).reduce((total, symbolContracts) => {
                                return total + Object.values(symbolContracts).filter(contractId => contractId !== null).length;
                            }, 0);
                            console.log(`🎯 Matches: ${remainingContracts} contracts still active`);
                            
                            break;
                        }
                    }
                    if (isMatchesContract) break;
                }
                
                if (isMatchesContract) {
                    return; // Don't process as regular contract
                }

                // Regular single contract handling
                if (contract_info.contract_id === activeContractRef.current) {
                    const isWin = contract_info.profit >= 0;
                    setLastTradeWin(isWin);
                    setLastTradeResult(isWin ? 'WIN' : 'LOSS');

                    console.log(`Contract ${contract_info.contract_id} settled with ${isWin ? 'WIN' : 'LOSS'}.`);
                    console.log(
                        `Current stake: ${currentStakeRef.current}, Initial: ${initialStake}, Consecutive losses: ${currentConsecutiveLossesRef.current}`
                    );

                    lastTradeRef.current = {
                        id: contract_info.contract_id,
                        profit: contract_info.profit,
                    };

                    // Update cumulative profit for stop loss/take profit (state + ref)
                    const newProfit = cumulativeProfitRef.current + contract_info.profit;
                    cumulativeProfitRef.current = newProfit;
                    setCumulativeProfit(newProfit);
                    console.log(`💰 Cumulative P/L: $${newProfit.toFixed(2)}`);

                    if (isWin) {
                        manageStake('reset');
                    } else {
                        manageStake('martingale');
                    }

                    activeContractRef.current = null;
                }
            }
        };

        globalObserver.register('contract.status', (response: any) => {
            if (response?.data?.is_sold) {
                contractSettlementHandler({
                    id: 'contract.settled',
                    data: response.data,
                });
            }
        });

        globalObserver.register('contract.settled', contractSettlementHandler);

        contractUpdateInterval.current = setInterval(async () => {
            // Handle Matches multiple contracts separately
            if (isAutoMatchesActive && Object.keys(matchesActiveContracts.current).length > 0) {
                try {
                    let allMatchesSettled = true;
                    let totalMatchesProfit = 0;
                    let matchesWinCount = 0;
                    let totalMatchesContracts = 0;
                    let primaryMatchesContractId: string | null = null;

                    for (const symbol in matchesActiveContracts.current) {
                        for (const digit in matchesActiveContracts.current[symbol]) {
                            const contractId = matchesActiveContracts.current[symbol][digit];
                            if (contractId) {
                                totalMatchesContracts++;
                                if (!primaryMatchesContractId) {
                                    primaryMatchesContractId = contractId; // First contract as primary
                                }

                                try {
                                    const response = await api_base.api.send({
                                        proposal_open_contract: 1,
                                        contract_id: contractId,
                                    });

                                    const contract = response?.proposal_open_contract;
                                    if (contract) {
                                        setActiveContracts(prev => ({
                                            ...prev,
                                            [contract.contract_id]: contract,
                                        }));

                                        if (contract.is_sold === 1) {
                                            console.log(`🎯 Matches: Contract ${contractId} for digit ${digit} settled with profit: ${contract.profit}`);
                                            totalMatchesProfit += contract.profit;
                                            if (contract.profit > 0) matchesWinCount++;
                                        } else {
                                            allMatchesSettled = false;
                                        }
                                    }
                                } catch (error) {
                                    console.error(`Error checking Matches contract ${contractId}:`, error);
                                }
                            }
                        }
                    }

                    // If all Matches contracts are settled, process the combined result
                    if (allMatchesSettled && totalMatchesContracts > 0) {
                        const matchesWon = matchesWinCount > 0;
                        console.log(`🎯 Matches: All ${totalMatchesContracts} contracts settled. Wins: ${matchesWinCount}, Total profit: ${totalMatchesProfit}`);

                        // Update cumulative profit for stop loss/take profit (state + ref)
                        const newProfit = cumulativeProfitRef.current + totalMatchesProfit;
                        cumulativeProfitRef.current = newProfit;
                        setCumulativeProfit(newProfit);
                        console.log(`💰 Cumulative P/L: $${newProfit.toFixed(2)}`);

                        if (matchesWon) {
                            setLastTradeWin(true);
                            setLastTradeResult('WIN');
                            manageStake('reset');
                            console.log('🎯 Matches: At least one contract won - resetting stake');
                        } else {
                            setLastTradeWin(false);
                            setLastTradeResult('LOSS');
                            manageStake('martingale');
                            console.log('🎯 Matches: All contracts lost - applying martingale');
                        }

                        // Record the trade result using primary contract
                        lastTradeRef.current = {
                            id: primaryMatchesContractId!,
                            profit: totalMatchesProfit,
                        };

                        contractSettledTimeRef.current = Date.now();

                        // Clean up contracts
                        setActiveContracts(prev => {
                            const newContracts = { ...prev };
                            for (const symbol in matchesActiveContracts.current) {
                                for (const digit in matchesActiveContracts.current[symbol]) {
                                    const contractId = matchesActiveContracts.current[symbol][digit];
                                    if (contractId) {
                                        delete newContracts[contractId];
                                    }
                                }
                            }
                            return newContracts;
                        });

                        // Reset Matches tracking for continuous trading
                        matchesActiveContracts.current = {};
                        activeContractRef.current = null;
                    }
                } catch (error) {
                    console.error('Error tracking Matches contracts:', error);
                }
                return; // Skip regular single contract tracking for Matches
            }

            // Handle O5U4 dual contracts separately
            if (isAutoO5U4Active && o5u4ActiveContracts.current.over5ContractId && o5u4ActiveContracts.current.under4ContractId && !o5u4ActiveContracts.current.bothSettled) {
                try {
                    const over5Id = o5u4ActiveContracts.current.over5ContractId;
                    const under4Id = o5u4ActiveContracts.current.under4ContractId;

                    // Check both contracts
                    const over5Response = await api_base.api.send({
                        proposal_open_contract: 1,
                        contract_id: over5Id,
                    });

                    const under4Response = await api_base.api.send({
                        proposal_open_contract: 1,
                        contract_id: under4Id,
                    });

                    let over5Contract = over5Response?.proposal_open_contract;
                    let under4Contract = under4Response?.proposal_open_contract;

                    // Update active contracts state
                    if (over5Contract) {
                        setActiveContracts(prev => ({
                            ...prev,
                            [over5Contract.contract_id]: over5Contract,
                        }));
                    }

                    if (under4Contract) {
                        setActiveContracts(prev => ({
                            ...prev,
                            [under4Contract.contract_id]: under4Contract,
                        }));
                    }

                    // Check if contracts are settled
                    let over5Settled = over5Contract?.is_sold === 1;
                    let under4Settled = under4Contract?.is_sold === 1;

                    // Update results for settled contracts
                    if (over5Settled && o5u4ActiveContracts.current.over5Result === 'pending') {
                        const isWin = over5Contract.profit >= 0;
                        o5u4ActiveContracts.current.over5Result = isWin ? 'win' : 'loss';
                        console.log(`O5U4 Over 5 contract ${over5Id} settled: ${isWin ? 'WIN' : 'LOSS'}, Profit: ${over5Contract.profit}`);
                    }

                    if (under4Settled && o5u4ActiveContracts.current.under4Result === 'pending') {
                        const isWin = under4Contract.profit >= 0;
                        o5u4ActiveContracts.current.under4Result = isWin ? 'win' : 'loss';
                        console.log(`O5U4 Under 4 contract ${under4Id} settled: ${isWin ? 'WIN' : 'LOSS'}, Profit: ${under4Contract.profit}`);
                    }

                    // If both contracts are settled, process the combined result
                    if (over5Settled && under4Settled && !o5u4ActiveContracts.current.bothSettled) {
                        o5u4ActiveContracts.current.bothSettled = true;
                        
                        const over5Won = o5u4ActiveContracts.current.over5Result === 'win';
                        const under4Won = o5u4ActiveContracts.current.under4Result === 'win';
                        const totalProfit = (over5Contract?.profit || 0) + (under4Contract?.profit || 0);

                        console.log(`O5U4 Both contracts settled. Over5: ${over5Won ? 'WIN' : 'LOSS'}, Under4: ${under4Won ? 'WIN' : 'LOSS'}, Total Profit: ${totalProfit}`);

                        // Update cumulative profit for stop loss/take profit (state + ref)
                        const newProfit = cumulativeProfitRef.current + totalProfit;
                        cumulativeProfitRef.current = newProfit;
                        setCumulativeProfit(newProfit);
                        console.log(`💰 Cumulative P/L: $${newProfit.toFixed(2)}`);

                        // Update trade counts
                        if (over5Won || under4Won) {
                            setWinCount(prev => prev + 1);
                            setLastTradeResult('WIN');
                            setLastTradeWin(true);
                            manageStake('reset');
                            console.log('O5U4: At least one contract won - resetting stake');
                        } else {
                            setLossCount(prev => prev + 1);
                            setLastTradeResult('LOSS');
                            setLastTradeWin(false);
                            manageStake('martingale');
                            console.log('O5U4: Both contracts lost - applying martingale');
                        }

                        // Record the trade result
                        lastTradeRef.current = {
                            id: over5Id, // Use over5 contract ID as primary
                            profit: totalProfit,
                        };

                        contractSettledTimeRef.current = Date.now();

                        // Clean up contracts
                        setActiveContracts(prev => {
                            const newContracts = { ...prev };
                            delete newContracts[over5Id];
                            delete newContracts[under4Id];
                            return newContracts;
                        });

                        // Reset O5U4 tracking immediately for continuous trading
                        o5u4ActiveContracts.current = {
                            over5ContractId: null,
                            under4ContractId: null,
                            over5Result: null,
                            under4Result: null,
                            bothSettled: false
                        };

                        activeContractRef.current = null;
                    }
                } catch (error) {
                    console.error('Error tracking O5U4 contracts:', error);
                }
                return; // Skip regular single contract tracking for O5U4
            }

            // Regular single contract tracking for other bots
            if (!activeContractRef.current) return;
            try {
                const response = await api_base.api.send({
                    proposal_open_contract: 1,
                    contract_id: activeContractRef.current,
                });
                if (response?.proposal_open_contract) {
                    const contract = response.proposal_open_contract;

                    setActiveContracts(prev => ({
                        ...prev,
                        [contract.contract_id]: contract,
                    }));

                    if (contract.is_sold === 1) {
                        const contractId = contract.contract_id;

                        if (lastTradeRef.current?.id === contractId) {
                            console.log(`Contract ${contractId} already processed, skipping duplicate settlement`);
                            return;
                        }

                        const isWin = contract.profit >= 0;
                        const profit = contract.profit;

                        lastTradeRef.current = { id: contractId, profit };
                        contractSettledTimeRef.current = Date.now();

                        console.log(
                            `Contract ${contractId} sold. Result: ${isWin ? 'WIN' : 'LOSS'}, Profit: ${profit}`
                        );
                        console.log(
                            `Current stake before update: ${currentStakeRef.current}, Consecutive losses: ${currentConsecutiveLossesRef.current}`
                        );

                        // Update cumulative profit for stop loss/take profit (state + ref)
                        const newProfit = cumulativeProfitRef.current + profit;
                        cumulativeProfitRef.current = newProfit;
                        setCumulativeProfit(newProfit);
                        console.log(`💰 Cumulative P/L: $${newProfit.toFixed(2)}`);

                        if (isWin) {
                            setWinCount(prev => prev + 1);
                            manageStake('reset');
                            setLastTradeResult('WIN');
                        } else {
                            setLossCount(prev => prev + 1);
                            manageStake('martingale');
                            setLastTradeResult('LOSS');
                        }

                        setActiveContracts(prev => {
                            const newContracts = { ...prev };
                            delete newContracts[contractId];
                            return newContracts;
                        });
                        activeContractRef.current = null;
                    }
                }
            } catch (error) {
                console.error('Error tracking contract:', error);
            }
        }, 1000);

        return () => {
            if (tradingIntervalRef.current) {
                clearInterval(tradingIntervalRef.current);
            }
            if (analysisReadinessInterval.current) {
                clearInterval(analysisReadinessInterval.current);
            }
            if (analysisInfoInterval.current) {
                clearInterval(analysisInfoInterval.current);
            }
            cleanupO5U4Monitor(); // Clean up the O5U4 dedicated monitor
            cleanupMatchesMonitor(); // Clean up the Matches dedicated monitor
            if (contractUpdateInterval.current) {
                clearInterval(contractUpdateInterval.current);
            }
            if (stopLossCheckIntervalRef.current) {
                clearInterval(stopLossCheckIntervalRef.current);
            }
            globalObserver.emit('bot.stopped');
            marketAnalyzer.stop();
            unsubscribe();
            globalObserver.unregisterAll('contract.status');
            globalObserver.unregisterAll('contract.settled');
            
            // Clean up Matches analysis interval
            if (matchesAnalysisIntervalRef.current) {
                clearInterval(matchesAnalysisIntervalRef.current);
            }
        };
    }, []);

    useEffect(() => {
        currentStakeRef.current = initialStake;
    }, [initialStake]);

    // Load symbols grid visibility preference from localStorage
    useEffect(() => {
        const savedPreference = localStorage.getItem('trading-hub-symbols-grid-visible');
        if (savedPreference !== null) {
            setIsSymbolsGridVisible(savedPreference === 'true');
        }
    }, []);

    // Load symbols overview visibility preference from localStorage
    useEffect(() => {
        const savedOverviewPreference = localStorage.getItem('trading-hub-symbols-overview-visible');
        if (savedOverviewPreference !== null) {
            setIsSymbolsOverviewVisible(savedOverviewPreference === 'true');
        }
    }, []);

    // Initialize Matches analysis if it was active on page load
    useEffect(() => {
        // Run when isAutoMatchesActive changes (including when loaded from localStorage)
        if (isAutoMatchesActive) {
            console.log('🎯 Matches: Initializing analysis (page load or activation)');
            
            // Small delay to ensure market analyzer is ready
            const initTimeout = setTimeout(() => {
                startMatchesAnalysis();
            }, 1000);
            
            // Set up aggressive periodic refresh every 5 seconds (like O5U4)
            const matchesAnalysisInterval = setInterval(() => {
                if (isAutoMatchesActive && marketStats) {
                    console.log('🔄 Matches: Aggressive periodic analysis refresh using market data...');
                    // Use market data instead of separate API calls
                    analyzeMatchesFromMarketData(marketStats);
                }
            }, 5000); // Aggressive refresh every 5 seconds
            
            // Store interval for cleanup
            matchesAnalysisIntervalRef.current = matchesAnalysisInterval;
            
            // Cleanup function
            return () => {
                clearTimeout(initTimeout);
                if (matchesAnalysisIntervalRef.current) {
                    clearInterval(matchesAnalysisIntervalRef.current);
                    matchesAnalysisIntervalRef.current = null;
                }
            };
        } else {
            // Clean up when deactivated
            if (matchesAnalysisIntervalRef.current) {
                clearInterval(matchesAnalysisIntervalRef.current);
                matchesAnalysisIntervalRef.current = null;
            }
        }
    }, [isAutoMatchesActive]); // Depend on isAutoMatchesActive so it runs when loaded from localStorage

    // Register event listeners for trading hub run button integration
    useEffect(() => {
        const handleRunButtonStart = () => {
            console.log(`🔴 RUN BUTTON CLICKED - Active cards: O5U4: ${isAutoO5U4Active}, Matches: ${isAutoMatchesActive}, OverUnder: ${isAutoOverUnderActive}, Differ: ${isAutoDifferActive}`);
            if (!isContinuousTrading) {
                startTrading();
            }
        };

        const handleRunButtonStop = () => {
            if (isContinuousTrading) {
                stopTrading();
            }
        };

        const handleStateRequest = () => {
            console.log('Trading Hub: State requested, emitting current state:', isContinuousTrading);
            globalObserver.emit('trading_hub.state_changed', { isRunning: isContinuousTrading });
        };

        globalObserver.register('trading_hub.start', handleRunButtonStart);
        globalObserver.register('trading_hub.stop', handleRunButtonStop);
        globalObserver.register('trading_hub.request_state', handleStateRequest);

        return () => {
            globalObserver.unregisterAll('trading_hub.start');
            globalObserver.unregisterAll('trading_hub.stop');
            globalObserver.unregisterAll('trading_hub.request_state');
        };
    }, [isContinuousTrading]); // Re-register when trading state changes

    // Emit initial state when component mounts or trading state changes
    React.useEffect(() => {
        globalObserver.emit('trading_hub.state_changed', { isRunning: isContinuousTrading });
    }, [isContinuousTrading]);

    useEffect(() => {
        if (isContinuousTrading) {
            // Use a faster interval for more responsive trading
            const intervalTime = isAutoO5U4Active ? 500 : 2000; // 500ms for O5U4, 2000ms for others
            
            tradingIntervalRef.current = setInterval(() => {
                const now = Date.now();
                const timeSinceLastTrade = now - lastTradeTime.current;
                const timeSinceSettlement = now - contractSettledTimeRef.current;
                
                // Skip if trade is in progress or active contract exists
                if (isTradeInProgress || activeContractRef.current !== null || 
                    (isAutoO5U4Active && (o5u4ActiveContracts.current.over5ContractId || o5u4ActiveContracts.current.under4ContractId)) ||
                    (isAutoMatchesActive && hasActiveMatchesContracts())) {
                    if (!waitingForSettlementRef.current) {
                        console.log(
                            `Trade skipped: ${
                                isTradeInProgress
                                    ? 'Trade in progress'
                                    : activeContractRef.current 
                                        ? 'Waiting for previous contract settlement'
                                        : (isAutoMatchesActive && hasActiveMatchesContracts())
                                            ? 'Matches contracts are active'
                                            : 'O5U4 contracts are active'
                            }`
                        );
                    }

                    if (activeContractRef.current || o5u4ActiveContracts.current.over5ContractId || (isAutoMatchesActive && hasActiveMatchesContracts())) {
                        waitingForSettlementRef.current = true;
                    }
                    return;
                }

                waitingForSettlementRef.current = false;

                // Different cooldown times for different strategies
                let requiredCooldown = minimumTradeCooldown;
                let lastTradeTimeRef = lastTradeTime;
                
                if (isAutoO5U4Active) {
                    requiredCooldown = o5u4MinimumCooldown;
                    lastTradeTimeRef = o5u4LastTradeTime;
                } else if (isAutoMatchesActive) {
                    requiredCooldown = matchesMinimumCooldown;
                    lastTradeTimeRef = matchesLastTradeTime;
                }

                if (timeSinceLastTrade < requiredCooldown && lastTradeTimeRef.current > 0) {
                    return; // Still in cooldown
                }

                if (timeSinceSettlement < 500) { // Reduced from 1000ms to 500ms for O5U4 faster recovery
                    console.log('Recent settlement, waiting for martingale calculation to complete...');
                    return;
                }

                // Check if stop loss/take profit triggered - abort trading
                if (slTpTriggeredRef.current || !isContinuousTradingRef.current) {
                    console.log('🚫 Continuous trading aborted - SL/TP triggered or trading stopped');
                    if (tradingIntervalRef.current) {
                        clearInterval(tradingIntervalRef.current);
                        tradingIntervalRef.current = null;
                    }
                    return;
                }

                if (isAutoO5U4Active) {
                    executeO5U4Trade();
                } else if (isAutoMatchesActive) {
                    // For Matches, we need to check if analysis is ready and we're not already in progress
                    const bestSymbol = matchesAnalysis.bestSymbol;
                    if (bestSymbol && 
                        matchesAnalysis.readySymbols.includes(bestSymbol) && 
                        matchesAnalysis.topDigits[bestSymbol]?.length === 5 && 
                        !isTradeInProgress) {
                        console.log(`🎯 Continuous: Best symbol ${bestSymbol} ready, executing trades...`);
                        executeMatchesTrades();
                    } else {
                        // Log why we're not trading for debugging
                        console.log('🎯 Continuous: Matches not ready', {
                            hasBestSymbol: !!bestSymbol,
                            bestSymbol: bestSymbol,
                            isSymbolReady: bestSymbol ? matchesAnalysis.readySymbols.includes(bestSymbol) : false,
                            hasTopDigits: bestSymbol ? matchesAnalysis.topDigits[bestSymbol]?.length === 5 : false,
                            isTradeInProgress: isTradeInProgress,
                            readySymbolsCount: matchesAnalysis.readySymbols.length
                        });
                    }
                } else if (isAutoOverUnderActive) {
                    executeDigitOverTrade();
                } else if (isAutoDifferActive) {
                    executeDigitDifferTrade();
                }
            }, intervalTime);
        } else {
            if (tradingIntervalRef.current) {
                clearInterval(tradingIntervalRef.current);
                tradingIntervalRef.current = null;
            }
        }
        return () => {
            if (tradingIntervalRef.current) {
                clearInterval(tradingIntervalRef.current);
            }
        };
    }, [isContinuousTrading, isAutoDifferActive, isAutoOverUnderActive, isAutoO5U4Active, isAutoMatchesActive, isTradeInProgress]);

    const toggleAutoDiffer = () => {
        if (!isAutoDifferActive && isAutoOverUnderActive) {
            setIsAutoOverUnderActive(false);
            localStorage.setItem('tradingHub_overUnderActive', 'false');
        }
        if (!isAutoDifferActive && isAutoO5U4Active) {
            setIsAutoO5U4Active(false);
            localStorage.setItem('tradingHub_o5u4Active', 'false');
        }
        if (!isAutoDifferActive && isAutoMatchesActive) {
            setIsAutoMatchesActive(false);
            localStorage.setItem('tradingHub_matchesActive', 'false');
            // Stop Matches analysis when deactivating
            stopMatchesAnalysis();
            if (matchesAnalysisIntervalRef.current) {
                clearInterval(matchesAnalysisIntervalRef.current);
                matchesAnalysisIntervalRef.current = null;
            }
        }
        const newValue = !isAutoDifferActive;
        setIsAutoDifferActive(newValue);
        localStorage.setItem('tradingHub_autoDifferActive', newValue.toString());
        if (isContinuousTrading) {
            stopTrading();
        }
    };

    const toggleAutoOverUnder = () => {
        if (!isAutoOverUnderActive && isAutoDifferActive) {
            setIsAutoDifferActive(false);
            localStorage.setItem('tradingHub_autoDifferActive', 'false');
        }
        if (!isAutoOverUnderActive && isAutoO5U4Active) {
            setIsAutoO5U4Active(false);
            localStorage.setItem('tradingHub_o5u4Active', 'false');
        }
        if (!isAutoOverUnderActive && isAutoMatchesActive) {
            setIsAutoMatchesActive(false);
            localStorage.setItem('tradingHub_matchesActive', 'false');
            // Stop Matches analysis when deactivating
            stopMatchesAnalysis();
            if (matchesAnalysisIntervalRef.current) {
                clearInterval(matchesAnalysisIntervalRef.current);
                matchesAnalysisIntervalRef.current = null;
            }
        }
        const newValue = !isAutoOverUnderActive;
        setIsAutoOverUnderActive(newValue);
        localStorage.setItem('tradingHub_overUnderActive', newValue.toString());
        if (isContinuousTrading) {
            stopTrading();
        }
    };

    const toggleAutoO5U4 = () => {
        console.log(`🎯 O5U4 Toggle clicked! Current state: ${isAutoO5U4Active}`);
        
        // Check balance validation when activating O5U4
        if (!isAutoO5U4Active) {
            const stakeAmount = parseFloat(stake || '0');
            const accountBalance = parseFloat(client?.balance || '0');
            const totalO5U4Cost = stakeAmount * 2; // O5U4 uses 2 contracts
            
            console.log(`💰 O5U4 Balance check: Stake ${stakeAmount} × 2 = ${totalO5U4Cost} vs Balance ${accountBalance}`);
            
            if (totalO5U4Cost > accountBalance) {
                const message = `⚠️ O5U4 requires stake × 2 = $${totalO5U4Cost.toFixed(2)} but your balance is only $${accountBalance.toFixed(2)}. Please use a smaller stake to activate O5U4.`;
                console.warn(message);
                
                // Show notification using botNotification
                botNotification(message);
                
                // Don't activate O5U4
                return;
            }
        }
        
        if (!isAutoO5U4Active && isAutoDifferActive) {
            setIsAutoDifferActive(false);
            localStorage.setItem('tradingHub_autoDifferActive', 'false');
        }
        if (!isAutoO5U4Active && isAutoOverUnderActive) {
            setIsAutoOverUnderActive(false);
            localStorage.setItem('tradingHub_overUnderActive', 'false');
        }
        if (!isAutoO5U4Active && isAutoMatchesActive) {
            setIsAutoMatchesActive(false);
            localStorage.setItem('tradingHub_matchesActive', 'false');
            // Stop Matches analysis when deactivating
            stopMatchesAnalysis();
            if (matchesAnalysisIntervalRef.current) {
                clearInterval(matchesAnalysisIntervalRef.current);
                matchesAnalysisIntervalRef.current = null;
            }
        }
        
        const newState = !isAutoO5U4Active;
        console.log(`🎯 O5U4 New state will be: ${newState}`);
        setIsAutoO5U4Active(newState);
        localStorage.setItem('tradingHub_o5u4Active', newState.toString());
        
        // If activating O5U4 and trading is active, immediately check for conditions
        if (newState && isContinuousTrading) {
            console.log('🎯 O5U4 activated during continuous trading - checking for immediate trade opportunities');
            console.log(`Current O5U4 analysis:`, o5u4Analysis);
            setTimeout(() => {
                console.log('🎯 O5U4 delayed activation check...');
                console.log(`Best symbol: ${o5u4Analysis.bestSymbol}`);
                console.log(`Conditions check result: ${checkO5U4Conditions()}`);
                
                if (checkO5U4Conditions() && !isTradeInProgress && !activeContractRef.current && 
                    !o5u4ActiveContracts.current.over5ContractId && !o5u4ActiveContracts.current.under4ContractId) {
                    console.log('🎯 O5U4: Immediate trade opportunity found on activation');
                    executeO5U4Trade();
                } else {
                    console.log('🎯 O5U4: No immediate opportunity - will wait for market analyzer');
                }
            }, 100); // Small delay to ensure state is updated
        } else if (newState) {
            console.log('🎯 O5U4 activated but not in continuous trading mode');
        }
        
        if (isContinuousTrading) {
            console.log('🛑 Stopping trading due to strategy change');
            stopTrading();
        }
    };

    const toggleAutoMatches = () => {
        console.log(`🎯 Matches Toggle clicked! Current state: ${isAutoMatchesActive}`);
        
        // Check balance validation when activating Matches
        if (!isAutoMatchesActive) {
            const stakeAmount = parseFloat(stake || '0');
            const accountBalance = parseFloat(client?.balance || '0');
            const totalMatchesCost = stakeAmount * 5; // Matches uses 5 contracts
            
            console.log(`💰 Matches Balance check: Stake ${stakeAmount} × 5 = ${totalMatchesCost} vs Balance ${accountBalance}`);
            
            if (totalMatchesCost > accountBalance) {
                const message = `⚠️ Matches requires stake × 5 = $${totalMatchesCost.toFixed(2)} but your balance is only $${accountBalance.toFixed(2)}. Please use a smaller stake to activate Matches.`;
                console.warn(message);
                
                // Show notification using botNotification
                botNotification(message);
                
                // Don't activate Matches
                return;
            }
        }
        
        if (!isAutoMatchesActive && isAutoDifferActive) {
            setIsAutoDifferActive(false);
            localStorage.setItem('tradingHub_autoDifferActive', 'false');
        }
        if (!isAutoMatchesActive && isAutoOverUnderActive) {
            setIsAutoOverUnderActive(false);
            localStorage.setItem('tradingHub_overUnderActive', 'false');
        }
        if (!isAutoMatchesActive && isAutoO5U4Active) {
            setIsAutoO5U4Active(false);
            localStorage.setItem('tradingHub_o5u4Active', 'false');
        }
        
        const newState = !isAutoMatchesActive;
        console.log(`🎯 Matches New state will be: ${newState}`);
        setIsAutoMatchesActive(newState);
        localStorage.setItem('tradingHub_matchesActive', newState.toString());
        
        // Analysis setup/cleanup is now handled by useEffect
        if (newState) {
            console.log('🎯 Matches activated - analysis will start via useEffect');
        } else {
            console.log('🎯 Matches deactivated - analysis will stop via useEffect');
            stopMatchesAnalysis();
        }
        
        if (isContinuousTrading) {
            console.log('🛑 Stopping trading due to strategy change');
            stopTrading();
        }
    };

    // Toggle symbols grid visibility
    const toggleSymbolsGrid = () => {
        setIsSymbolsGridVisible(prev => !prev);
        // Optionally save preference to localStorage
        localStorage.setItem('trading-hub-symbols-grid-visible', (!isSymbolsGridVisible).toString());
    };

    // Toggle symbols overview visibility
    const toggleSymbolsOverview = () => {
        setIsSymbolsOverviewVisible(prev => !prev);
        // Save preference to localStorage
        localStorage.setItem('trading-hub-symbols-overview-visible', (!isSymbolsOverviewVisible).toString());
    };

    // Matches strategy functions
    const analyzeMatchesFromMarketData = async (allStats: Record<string, any>) => {
        console.log('📊 Matches: Analyzing from real-time market data...');
        console.log('📊 Matches: Available market data symbols:', Object.keys(allStats));
        console.log('📊 Matches: Using corrected digit extraction for continuous analysis');
        
        // Remove analyzing state - analyze silently
        
        const volatilitySymbols = availableSymbols;
        const newDigitFrequencies: Record<string, Record<number, number>> = {};
        const newTopDigits: Record<string, number[]> = {};
        const newReadySymbols: string[] = [];
        const newLastUpdated: Record<string, number> = {};
        const symbolTotalFrequencies: Record<string, number> = {};
        const now = Date.now();

        // Instead of using potentially incorrect market analyzer digitCounts,
        // fetch fresh tick data for each symbol with our corrected digit extraction
        const analysisPromises = volatilitySymbols.map(async (symbol) => {
            try {
                console.log(`📊 Matches: Fetching fresh tick data for ${symbol}...`);
                const response = await api_base.api.send({
                    ticks_history: symbol,
                    count: 500, // Use 500 ticks for comprehensive analysis
                    end: 'latest',
                    style: 'ticks'
                });
                
                if (response.history?.prices && response.history.prices.length >= 10) {
                    const digitFrequencies: Record<number, number> = {};
                    
                    // Debug: Log actual response data
                    console.log(`📊 ${symbol}: Received ${response.history.prices.length} ticks (requested 500)`);
                    
                    // Debug: Sample the first few prices to see their format
                    const samplePrices = response.history.prices.slice(0, 5);
                    console.log(`📊 ${symbol}: Sample prices:`, samplePrices);
                    
                    // Initialize frequency counters
                    for (let i = 0; i <= 9; i++) {
                        digitFrequencies[i] = 0;
                    }
                    
                    // Count digit frequencies using our corrected method
                    let validTickCount = 0;
                    let invalidTickCount = 0;
                    
                    response.history.prices.forEach((price: number, index: number) => {
                        if (typeof price === 'number' && !isNaN(price)) {
                            const lastDigit = getLastDigitFromPrice(price);
                            
                            // Debug: Log first few extractions
                            if (index < 5) {
                                console.log(`📊 ${symbol}: Price ${price} -> Last digit ${lastDigit}`);
                            }
                            
                            if (lastDigit >= 0 && lastDigit <= 9) {
                                digitFrequencies[lastDigit]++;
                                validTickCount++;
                            } else {
                                invalidTickCount++;
                                console.warn(`📊 ${symbol}: Invalid digit ${lastDigit} from price ${price}`);
                            }
                        } else {
                            invalidTickCount++;
                            console.warn(`📊 ${symbol}: Invalid price at index ${index}:`, price);
                        }
                    });
                    
                    // Debug: Log frequency distribution
                    console.log(`📊 ${symbol}: Valid ticks: ${validTickCount}, Invalid: ${invalidTickCount}`);
                    console.log(`📊 ${symbol}: Digit frequencies:`, digitFrequencies);
                    
                    // Verify total
                    const totalFrequencyCheck = Object.values(digitFrequencies).reduce((sum, count) => sum + count, 0);
                    console.log(`📊 ${symbol}: Total frequency check: ${totalFrequencyCheck} (should equal ${validTickCount})`);
                    
                    // Convert frequencies to percentages
                    const digitPercentages: Record<number, number> = {};
                    for (let digit = 0; digit <= 9; digit++) {
                        digitPercentages[digit] = totalFrequencyCheck > 0 ? (digitFrequencies[digit] / totalFrequencyCheck) * 100 : 0;
                    }
                    
                    console.log(`📊 ${symbol}: Digit percentages:`, digitPercentages);
                    
                    // Get top 5 most frequent digits based on percentages
                    const topDigitsWithPerc = Object.entries(digitPercentages)
                        .sort(([,a], [,b]) => b - a)
                        .slice(0, 5);
                    
                    const topDigits = topDigitsWithPerc.map(([digit]) => parseInt(digit));
                    const totalTopPercentage = topDigitsWithPerc.reduce((sum, [, perc]) => sum + perc, 0);
                    
                    console.log(`📊 ${symbol}: Top 5 digits with percentages:`, topDigitsWithPerc.map(([digit, perc]) => `${digit}: ${perc.toFixed(2)}%`));
                    console.log(`📊 ${symbol}: Total top 5 percentage: ${totalTopPercentage.toFixed(2)}%`);
                    
                    return {
                        symbol,
                        digitFrequencies,
                        digitPercentages,
                        topDigits,
                        totalTopPercentage,
                        sampleSize: response.history.prices.length
                    };
                } else {
                    console.log(`📊 Matches: ${symbol} - insufficient fresh data (${response.history?.prices?.length || 0} ticks)`);
                    return null;
                }
            } catch (error) {
                console.error(`📊 Matches: Error fetching data for ${symbol}:`, error);
                return null;
            }
        });

        try {
            const results = await Promise.all(analysisPromises);
            
            // Process successful results
            results.forEach(result => {
                if (result) {
                    newDigitFrequencies[result.symbol] = result.digitFrequencies;
                    newTopDigits[result.symbol] = result.topDigits;
                    newReadySymbols.push(result.symbol);
                    newLastUpdated[result.symbol] = now;
                    symbolTotalFrequencies[result.symbol] = result.totalTopPercentage; // Use percentage instead of raw count
                }
            });

            // Determine the best symbol (highest total percentage of top 5 digits)
            let bestSymbol: string | null = null;
            let bestTotalPercentage = 0;
            
            Object.entries(symbolTotalFrequencies).forEach(([symbol, totalPerc]) => {
                if (totalPerc > bestTotalPercentage) {
                    bestTotalPercentage = totalPerc;
                    bestSymbol = symbol;
                }
            });

            if (bestSymbol) {
                console.log(`📊 Matches: Best symbol determined - ${bestSymbol} (total top 5 percentage: ${bestTotalPercentage.toFixed(2)}%)`);
            }

            // Only update if we have some ready symbols or this is the first update
            if (newReadySymbols.length > 0 || matchesAnalysis.readySymbols.length === 0) {
                // Update state with corrected analysis data
                setMatchesAnalysis(prev => ({
                    ...prev,
                    digitFrequencies: newDigitFrequencies,
                    topDigits: newTopDigits,
                    readySymbols: newReadySymbols,
                    lastUpdated: newLastUpdated,
                    bestSymbol: bestSymbol,
                    symbolTotalFrequencies: symbolTotalFrequencies
                    // Remove isAnalyzing - analyze silently
                }));

                const readyCount = newReadySymbols.length;
                console.log(`📊 Matches: Continuous analysis complete - ${readyCount} symbols ready`);
            } else {
                // Remove isAnalyzing state update - analyze silently
                console.log('📊 Matches: No symbols ready from continuous analysis');
            }
        } catch (error) {
            console.error('📊 Matches: Error in continuous analysis:', error);
            // Remove isAnalyzing state update - analyze silently
        }
    };

    const analyzeMatchesContinuous = async () => {
        // Remove analyzing check - allow silent overlapping analysis
        
        console.log('📊 Matches: Continuous analysis triggered by market callback');        const volatilitySymbols = availableSymbols;
        
        // Only refresh symbols that need updating (haven't been analyzed recently)
        const now = Date.now();
        const staleThreshold = 30000; // 30 seconds
        
        const symbolsToRefresh = volatilitySymbols.filter(symbol => {
            const lastUpdate = matchesAnalysis.lastUpdated?.[symbol] || 0;
            return (now - lastUpdate) > staleThreshold;
        });
        
        if (symbolsToRefresh.length === 0) {
            console.log('📊 Matches: All symbols are up-to-date, skipping analysis');
            return;
        }
        
        console.log(`📊 Matches: Refreshing ${symbolsToRefresh.length} symbols: ${symbolsToRefresh.join(', ')}`);
        
        // Quick analysis for refreshing symbols
        const analysisPromises = symbolsToRefresh.map(async (symbol) => {
            try {
                const response = await api_base.api.send({
                    ticks_history: symbol,
                    count: 500,
                    end: 'latest',
                    style: 'ticks'
                });
                
                if (response.history?.prices) {
                    const digitFrequencies: Record<number, number> = {};
                    
                    // Initialize frequency counters
                    for (let i = 0; i <= 9; i++) {
                        digitFrequencies[i] = 0;
                    }
                    
                    // Count digit frequencies from last digits
                    response.history.prices.forEach((price: number) => {
                        const lastDigit = getLastDigitFromPrice(price);
                        digitFrequencies[lastDigit]++;
                    });
                    
                    // Get top 5 most frequent digits
                    const topDigits = Object.entries(digitFrequencies)
                        .sort(([,a], [,b]) => b - a)
                        .slice(0, 5)
                        .map(([digit]) => parseInt(digit));
                    
                    console.log(`📊 Matches: ${symbol} updated - top digits: ${topDigits.join(',')}`);
                    return { symbol, digitFrequencies, topDigits, timestamp: now };
                }
            } catch (error) {
                console.error(`📊 Matches: Error updating ${symbol}:`, error);
                return null;
            }
        });
        
        const results = await Promise.all(analysisPromises);
        
        // Update state with refreshed data
        setMatchesAnalysis(prev => {
            const newState = { ...prev };
            
            results.forEach(result => {
                if (result) {
                    newState.digitFrequencies[result.symbol] = result.digitFrequencies;
                    newState.topDigits[result.symbol] = result.topDigits;
                    
                    // Add to ready symbols if not already there
                    if (!newState.readySymbols.includes(result.symbol)) {
                        newState.readySymbols.push(result.symbol);
                    }
                    
                    // Update timestamp tracking
                    if (!newState.lastUpdated) newState.lastUpdated = {};
                    newState.lastUpdated[result.symbol] = result.timestamp;
                }
            });
            
            return newState;
        });
        
        console.log(`📊 Matches: Continuous analysis completed for ${results.filter(r => r).length} symbols`);
    };

    const startMatchesAnalysis = async () => {
        console.log('🔍 Starting Matches digit frequency analysis...');
        console.log('🔍 Fixed digit extraction - now using actual decimal precision per symbol');
        console.log('🔍 Available symbols for analysis:', availableSymbols);
        // Remove analyzing state - analyze silently
        
        const volatilitySymbols = availableSymbols;
        
        // Analyze all symbols in parallel for faster results
        const analysisPromises = volatilitySymbols.map(async (symbol) => {
            try {
                console.log(`🔍 Analyzing symbol: ${symbol}`);
                // Get 500 ticks of historical data for frequency analysis
                const response = await api_base.api.send({
                    ticks_history: symbol,
                    count: 500,
                    end: 'latest',
                    style: 'ticks'
                });
                
                console.log(`🔍 ${symbol} API response:`, response);
                
                if (response.history?.prices) {
                    console.log(`🔍 ${symbol} got ${response.history.prices.length} prices`);
                    const digitFrequencies: Record<number, number> = {};
                    
                    // Initialize frequency counters
                    for (let i = 0; i <= 9; i++) {
                        digitFrequencies[i] = 0;
                    }
                    
                    // Count digit frequencies from last digits
                    response.history.prices.forEach((price: number) => {
                        const lastDigit = getLastDigitFromPrice(price);
                        digitFrequencies[lastDigit]++;
                    });
                    
                    // Convert to percentages
                    const totalTicks = response.history.prices.length;
                    const digitPercentages: Record<number, number> = {};
                    for (let i = 0; i <= 9; i++) {
                        digitPercentages[i] = totalTicks > 0 ? (digitFrequencies[i] / totalTicks) * 100 : 0;
                    }
                    
                    // Get top 5 most frequent digits based on percentages
                    const topDigitsWithPerc = Object.entries(digitPercentages)
                        .sort(([,a], [,b]) => b - a)
                        .slice(0, 5);
                    
                    const topDigits = topDigitsWithPerc.map(([digit]) => parseInt(digit));
                    const totalTopPercentage = topDigitsWithPerc.reduce((sum, [, perc]) => sum + perc, 0);
                    
                    console.log(`🔍 ${symbol} digit percentages:`, Object.entries(digitPercentages).map(([d, p]) => `${d}: ${p.toFixed(2)}%`).join(', '));
                    console.log(`🔍 ${symbol} top 5 digits:`, topDigitsWithPerc.map(([d, p]) => `${d}(${p.toFixed(2)}%)`).join(', '));
                    console.log(`🔍 ${symbol} total top 5 percentage: ${totalTopPercentage.toFixed(2)}%`);
                    
                    return { symbol, digitFrequencies, digitPercentages, topDigits, totalTopPercentage };
                } else {
                    console.warn(`🔍 ${symbol} - No price data in response:`, response);
                    return null;
                }
            } catch (error) {
                console.error(`❌ Error analyzing ${symbol}:`, error);
                return null;
            }
        });
        
        // Wait for all analyses to complete
        const results = await Promise.all(analysisPromises);
        console.log(`🔍 Analysis promises completed. Valid results: ${results.filter(r => r !== null).length}/${results.length}`);
        
        // Update state with all results
        const newDigitFrequencies: Record<string, Record<number, number>> = {};
        const newTopDigits: Record<string, number[]> = {};
        const newReadySymbols: string[] = [];
        const newLastUpdated: Record<string, number> = {};
        const symbolTotalFrequencies: Record<string, number> = {};
        const now = Date.now();
        
        results.forEach(result => {
            if (result) {
                newDigitFrequencies[result.symbol] = result.digitFrequencies;
                newTopDigits[result.symbol] = result.topDigits;
                newReadySymbols.push(result.symbol);
                newLastUpdated[result.symbol] = now;
                
                // Use total percentage of top 5 digits for ranking
                symbolTotalFrequencies[result.symbol] = result.totalTopPercentage;
                
                console.log(`✅ ${result.symbol} analysis - top digits: ${result.topDigits.join(',')}, total percentage: ${result.totalTopPercentage.toFixed(2)}%`);
            }
        });
        
        console.log(`🔍 Ready symbols: ${newReadySymbols.join(', ')}`);
        console.log(`🔍 Total frequencies:`, symbolTotalFrequencies);
        
        // Determine the best symbol (highest total percentage of top 5 digits)
        let bestSymbol: string | null = null;
        let bestTotalPercentage = 0;
        
        Object.entries(symbolTotalFrequencies).forEach(([symbol, totalPerc]) => {
            if (totalPerc > bestTotalPercentage) {
                bestTotalPercentage = totalPerc;
                bestSymbol = symbol;
            }
        });

        if (bestSymbol) {
            console.log(`✅ Matches: Best symbol determined - ${bestSymbol} (total percentage: ${bestTotalPercentage.toFixed(2)}%)`);
        }
        
        setMatchesAnalysis(prev => ({
            ...prev,
            digitFrequencies: newDigitFrequencies,
            topDigits: newTopDigits,
            readySymbols: newReadySymbols,
            lastUpdated: newLastUpdated,
            bestSymbol: bestSymbol,
            symbolTotalFrequencies: symbolTotalFrequencies
            // Remove isAnalyzing - analyze silently
        }));
        
        console.log(`✅ Matches analysis completed! Ready symbols: ${newReadySymbols.length}, Best symbol: ${bestSymbol}`);
    };
    
    const stopMatchesAnalysis = () => {
        console.log('🛑 Stopping Matches analysis');
        setMatchesAnalysis({
            digitFrequencies: {},
            topDigits: {},
            readySymbols: [],
            lastUpdated: {},
            bestSymbol: null,
            symbolTotalFrequencies: {}
        });
        
        // Clear active contracts from UI display
        setActiveContracts(prev => {
            const newContracts = { ...prev };
            Object.keys(newContracts).forEach(contractId => {
                if (newContracts[contractId]?.strategy === 'Matches') {
                    delete newContracts[contractId];
                }
            });
            return newContracts;
        });
        
        // Clear active contracts tracking
        matchesActiveContracts.current = {};
        console.log('🛑 Matches contracts cleared');
    };
    
    const hasActiveMatchesContracts = () => {
        const activeCount = Object.values(matchesActiveContracts.current).reduce((total, symbolContracts) => {
            return total + Object.values(symbolContracts).filter(contractId => contractId !== null).length;
        }, 0);
        
        console.log(`🎯 Matches Contract Check: ${activeCount} active contracts`);
        if (activeCount > 0) {
            console.log('🎯 Active contract details:', matchesActiveContracts.current);
        }
        
        return activeCount > 0;
    };
    
    const executeMatchesTrades = async () => {
        // Critical check: Is API available?
        if (!api_base || !api_base.api) {
            console.error('❌ CRITICAL: api_base.api is not available for Matches! Cannot execute trades.');
            return;
        }
        
        // Check API connection state
        if (api_base.api.connection?.readyState !== 1) {
            console.warn('⚠️ API connection not ready for Matches. State:', api_base.api.connection?.readyState);
            return;
        }
        
        console.log('✅ Matches: API is available and connected');
        
        // Check if stop loss/take profit triggered - abort immediately
        if (slTpTriggeredRef.current || !isContinuousTradingRef.current) {
            console.log('🚫 Matches trade execution aborted - SL/TP triggered or trading stopped');
            return;
        }
        
        if (!isAutoMatchesActive || isTradeInProgress) return;
        
        // Check if there are already active Matches contracts
        if (hasActiveMatchesContracts()) {
            console.log('🎯 Matches: Contracts already active, skipping new trade request');
            return;
        }
        
        // Use the best symbol instead of just any ready symbol
        const bestSymbol = matchesAnalysis.bestSymbol;
        if (!bestSymbol || !matchesAnalysis.readySymbols.includes(bestSymbol) || 
            matchesAnalysis.topDigits[bestSymbol]?.length !== 5) {
            console.log('🎯 Matches: Best symbol not ready for trading', {
                bestSymbol,
                isReady: bestSymbol ? matchesAnalysis.readySymbols.includes(bestSymbol) : false,
                hasTopDigits: bestSymbol ? matchesAnalysis.topDigits[bestSymbol]?.length === 5 : false
            });
            return;
        }
        
        const topDigits = matchesAnalysis.topDigits[bestSymbol];
        const totalFreq = matchesAnalysis.symbolTotalFrequencies?.[bestSymbol] || 0;
        console.log(`🎯 Matches: Executing 5 trades on BEST SYMBOL ${bestSymbol} (freq: ${totalFreq}) with digits:`, topDigits);
        
        setIsTradeInProgress(true);
        
        // Update Matches trade timing
        matchesLastTradeTime.current = Date.now();
        
        try {
            // Execute 5 trades simultaneously - one for each top digit on the best symbol
            const tradePromises = topDigits.map(async (digit) => {
                try {
                    const proposal = await doUntilDone(() =>
                        api_base.api.send({
                            proposal: 1,
                            amount: stake,
                            basis: 'stake',
                            contract_type: 'DIGITMATCH',
                            currency: client.currency,
                            symbol: bestSymbol,
                            barrier: digit.toString(),
                            duration: 1,
                            duration_unit: 't'
                        }), [], api_base
                    );
                    
                    if (!proposal.proposal?.id) {
                        throw new Error(`No proposal ID for digit ${digit}`);
                    }
                    
                    const buyResponse = await doUntilDone(() =>
                        api_base.api.send({
                            buy: proposal.proposal.id,
                            price: parseFloat(stake)
                        }), [], api_base
                    );
                    
                    if (buyResponse.buy?.contract_id) {
                        console.log(`🎯 Matches: Trade executed for digit ${digit}: ${buyResponse.buy.contract_id}`);
                        
                        // Store contract ID
                        if (!matchesActiveContracts.current[bestSymbol]) {
                            matchesActiveContracts.current[bestSymbol] = {};
                        }
                        matchesActiveContracts.current[bestSymbol][digit] = buyResponse.buy.contract_id;
                        
                        // Emit purchase event for run panel visibility
                        globalObserver.emit('contract.purchase_received', buyResponse.buy.contract_id);
                        
                        return { digit, contractId: buyResponse.buy.contract_id, buyResponse: buyResponse.buy };
                    }
                } catch (error) {
                    console.error(`🎯 Matches: Error trading digit ${digit}:`, error);
                    return { digit, error };
                }
            });
            
            // Final check before executing trades - abort if SL/TP triggered
            if (slTpTriggeredRef.current || !isContinuousTradingRef.current) {
                console.log('🚫 Matches trade execution aborted at final checkpoint - SL/TP triggered');
                setIsTradeInProgress(false);
                return;
            }
            
            const results = await Promise.all(tradePromises);
            console.log('🎯 Matches: All trades completed:', results);
            
            // Post-execution check - if SL/TP triggered during execution, don't add contracts to tracking
            if (slTpTriggeredRef.current || !isContinuousTradingRef.current) {
                console.log('🚫 Matches contracts purchased but not tracked - SL/TP triggered during execution');
                setIsTradeInProgress(false);
                return;
            }
            
            // Add contracts to activeContracts state for UI display
            const successfulTrades = results.filter((result): result is { digit: number; contractId: string; buyResponse: any } => 
                result && result.contractId && !result.error);
                
            if (successfulTrades.length > 0) {
                // Set the first successful trade as the primary active contract for tracking
                const primaryTrade = successfulTrades[0];
                activeContractRef.current = primaryTrade.contractId;
                setActiveContractId(primaryTrade.contractId);
                
                // Generate trade ID and update counters
                const tradeId = `matches_${bestSymbol}_${Date.now()}`;
                setLastTradeId(tradeId);
                setTradeCount(prevCount => prevCount + 1);
                lastTradeTime.current = Date.now();
                
                console.log(
                    `Starting Matches trade #${tradeCount + 1}: ${tradeId} with ${successfulTrades.length} contracts, stake ${stake} each (total: ${parseFloat(stake) * successfulTrades.length})`
                );
                
                // Emit transaction events for each successful trade
                globalObserver.emit('trading_hub.running');
                globalObserver.emit('bot.bot_ready');
                
                setActiveContracts(prev => {
                    const newContracts = { ...prev };
                    successfulTrades.forEach(trade => {
                        // Create contract info for run panel
                        const contract_info = {
                            contract_id: trade.contractId,
                            contract_type: 'DIGITMATCH',
                            transaction_ids: { buy: trade.buyResponse.transaction_id || trade.contractId },
                            buy_price: parseFloat(stake),
                            currency: client.currency,
                            symbol: bestSymbol,
                            barrier: trade.digit.toString(),
                            date_start: Math.floor(Date.now() / 1000),
                            barrier_display_value: trade.digit.toString(),
                            contract_parameter: trade.digit.toString(),
                            parameter_type: 'digit_match',
                            entry_tick_time: Math.floor(Date.now() / 1000),
                            exit_tick_time: Math.floor(Date.now() / 1000) + 1,
                            run_id: sessionRunId,
                            display_name: `Matches Bot - Digit ${trade.digit}`,
                            transaction_time: Math.floor(Date.now() / 1000),
                            underlying: bestSymbol,
                            longcode: `Win if last digit equals ${trade.digit} on ${bestSymbol}.`,
                            display_message: `Matches Bot: Digit ${trade.digit} on ${bestSymbol}`,
                            duration: 1,
                            duration_unit: 't',
                            amount: parseFloat(stake),
                            basis: 'stake'
                        };
                        
                        // Emit all required events for run panel visibility
                        globalObserver.emit('bot.contract', contract_info);
                        globalObserver.emit('contract.status', {
                            id: 'contract.purchase',
                            data: contract_info,
                            buy: trade.buyResponse,
                        });
                        
                        // Add to transactions
                        transactions.onBotContractEvent(contract_info);
                        
                        newContracts[trade.contractId] = {
                            contract_id: trade.contractId,
                            buy_price: parseFloat(stake),
                            status: 'open',
                            purchase_time: Date.now(),
                            strategy: 'Matches',
                            digit: trade.digit,
                            symbol: bestSymbol,
                            type: 'DIGITMATCH'
                        };
                    });
                    return newContracts;
                });
                
                console.log(`🎯 Matches: Added ${successfulTrades.length} contracts to UI display and transactions`);
                console.log(`Matches trades executed: ${successfulTrades.map(t => `Digit ${t.digit}`).join(', ')} on ${bestSymbol}`);
            } else {
                console.error('🎯 Matches: No successful trades executed');
                globalObserver.emit('ui.log.error', 'Matches trade execution failed: No successful trades');
            }
            
        } catch (error) {
            console.error('🎯 Matches: Error executing trades:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            botNotification(`Matches trading error: ${errorMessage}`);
        } finally {
            setIsTradeInProgress(false);
        }
    };

    const checkStopLossAndTakeProfit = () => {
        // Prevent multiple triggers
        if (slTpTriggeredRef.current) {
            return;
        }
        
        const currentProfit = cumulativeProfitRef.current;
        const slThreshold = parseFloat(stopLossAmountRef.current);
        const tpThreshold = parseFloat(takeProfitAmountRef.current);
        
        // Check stop loss
        if (currentProfit <= -slThreshold) {
            console.log(`\n🛑🛑🛑 STOP LOSS HIT! 🛑🛑🛑`);
            console.log(`Current P/L: $${currentProfit.toFixed(2)}`);
            console.log(`Stop Loss Threshold: -$${slThreshold.toFixed(2)}`);
            console.log(`Stopping trading immediately...\n`);
            
            // Set triggered flag immediately
            slTpTriggeredRef.current = true;
            
            // Clear the monitoring interval immediately
            if (stopLossCheckIntervalRef.current) {
                clearInterval(stopLossCheckIntervalRef.current);
                stopLossCheckIntervalRef.current = null;
            }
            
            // Stop trading immediately
            stopTrading();
            
            // Show notification
            botNotification(
                `🛑 STOP LOSS HIT! Loss: $${Math.abs(currentProfit).toFixed(2)} | Threshold: $${slThreshold.toFixed(2)}`
            );
            
            return;
        }

        // Check take profit
        if (currentProfit >= tpThreshold) {
            console.log(`\n🎯🎯🎯 TAKE PROFIT HIT! 🎯🎯🎯`);
            console.log(`Current P/L: $${currentProfit.toFixed(2)}`);
            console.log(`Take Profit Threshold: $${tpThreshold.toFixed(2)}`);
            console.log(`Stopping trading immediately...\n`);
            
            // Set triggered flag immediately
            slTpTriggeredRef.current = true;
            
            // Clear the monitoring interval immediately
            if (stopLossCheckIntervalRef.current) {
                clearInterval(stopLossCheckIntervalRef.current);
                stopLossCheckIntervalRef.current = null;
            }
            
            // Stop trading immediately
            stopTrading();
            
            // Show notification
            botNotification(
                `🎯 TAKE PROFIT HIT! Profit: $${currentProfit.toFixed(2)} | Threshold: $${tpThreshold.toFixed(2)}`
            );
            
            return;
        }
    };

    const closeAllActiveContracts = async (reason: string) => {
        console.log(`🔒 Closing all active contracts due to: ${reason}`);
        
        const contractIds = Object.keys(activeContracts);
        if (contractIds.length === 0) {
            console.log('No active contracts to close');
            return;
        }

        for (const contractId of contractIds) {
            try {
                console.log(`Attempting to sell contract ${contractId}...`);
                const response = await api_base.api.send({
                    sell: contractId,
                    price: 0, // Sell at current market price
                });
                
                if (response?.sell) {
                    console.log(`✅ Successfully sold contract ${contractId} for ${response.sell.sold_for}`);
                } else {
                    console.warn(`⚠️ Could not sell contract ${contractId}`);
                }
            } catch (error) {
                console.error(`❌ Error selling contract ${contractId}:`, error);
            }
        }

        // Clear active contracts
        setActiveContracts({});
        activeContractRef.current = null;
        o5u4ActiveContracts.current = {
            over5ContractId: null,
            under4ContractId: null,
            over5Result: null,
            under4Result: null,
            bothSettled: false
        };
        matchesActiveContracts.current = {};
    };

    const handleSaveSettings = () => {
        const validStake =
            stake === ''
                ? MINIMUM_STAKE
                : Math.max(parseFloat(stake) || parseFloat(MINIMUM_STAKE), parseFloat(MINIMUM_STAKE)).toFixed(2);
        
        // Check if stake exceeds account balance
        const stakeAmount = parseFloat(validStake);
        const accountBalance = parseFloat(client?.balance || '0');
        
        console.log(`💰 Balance check: Stake ${stakeAmount} vs Balance ${accountBalance}`);
        
        if (stakeAmount > accountBalance) {
            // Show notification that stake exceeds balance
            const message = `⚠️ Stake amount $${stakeAmount} exceeds your account balance of $${accountBalance.toFixed(2)}. Please use a smaller stake amount.`;
            console.warn(message);
            
            // Show notification using botNotification
            botNotification(message);
            
            // Reset stake to a safe amount (max of balance or minimum stake)
            const safeStake = Math.min(accountBalance, parseFloat(MINIMUM_STAKE)).toFixed(2);
            setStake(safeStake);
            manageStake('init', { newValue: safeStake });
            console.log(`💰 Stake reset to safe amount: ${safeStake}`);
            return;
        }
        
        // Additional check for O5U4: stake × 2 should not exceed balance
        if (isAutoO5U4Active) {
            const totalO5U4Cost = stakeAmount * 2;
            
            console.log(`💰 O5U4 Balance check: Stake ${stakeAmount} × 2 = ${totalO5U4Cost} vs Balance ${accountBalance}`);
            
            if (totalO5U4Cost > accountBalance) {
                const message = `⚠️ O5U4 requires stake × 2 = $${totalO5U4Cost.toFixed(2)} but your balance is only $${accountBalance.toFixed(2)}. Please use a smaller stake. O5U4 will be disabled.`;
                console.warn(message);
                
                // Show notification using botNotification
                botNotification(message);
                
                // Disable O5U4 since current stake is too high
                setIsAutoO5U4Active(false);
                localStorage.setItem('tradingHub_o5u4Active', 'false');
                
                // Set stake to maximum safe amount for O5U4 (balance / 2)
                const maxO5U4Stake = Math.floor((accountBalance / 2) * 100) / 100; // Floor to 2 decimals
                const safeO5U4Stake = Math.max(maxO5U4Stake, parseFloat(MINIMUM_STAKE)).toFixed(2);
                setStake(safeO5U4Stake);
                manageStake('init', { newValue: safeO5U4Stake });
                console.log(`💰 Stake adjusted for O5U4 compatibility: ${safeO5U4Stake}`);
                return;
            }
        }
        
        // Additional check for Matches: stake × 5 should not exceed balance
        if (isAutoMatchesActive) {
            const totalMatchesCost = stakeAmount * 5;
            
            console.log(`💰 Matches Balance check: Stake ${stakeAmount} × 5 = ${totalMatchesCost} vs Balance ${accountBalance}`);
            
            if (totalMatchesCost > accountBalance) {
                const message = `⚠️ Matches requires stake × 5 = $${totalMatchesCost.toFixed(2)} but your balance is only $${accountBalance.toFixed(2)}. Please use a smaller stake. Matches will be disabled.`;
                console.warn(message);
                
                // Show notification using botNotification
                botNotification(message);
                
                // Disable Matches since current stake is too high
                setIsAutoMatchesActive(false);
                localStorage.setItem('tradingHub_matchesActive', 'false');
                
                // Set stake to maximum safe amount for Matches (balance / 5)
                const maxMatchesStake = Math.floor((accountBalance / 5) * 100) / 100; // Floor to 2 decimals
                const safeMatchesStake = Math.max(maxMatchesStake, parseFloat(MINIMUM_STAKE)).toFixed(2);
                setStake(safeMatchesStake);
                manageStake('init', { newValue: safeMatchesStake });
                console.log(`💰 Stake adjusted for Matches compatibility: ${safeMatchesStake}`);
                return;
            }
        }
        
        console.log(`Saving stake settings from ${initialStake} to ${validStake}`);
        manageStake('init', { newValue: validStake });

        if (validStake !== stake) {
            setStake(validStake);
        }

        const validMartingale = martingale === '' ? '2' : Math.max(parseFloat(martingale) || 1, 1).toFixed(1);
        console.log(`Saving martingale settings from ${martingale} to ${validMartingale}`);
        manageMartingale('init', { newValue: validMartingale });

        if (validMartingale !== martingale) {
            setMartingale(validMartingale);
        }

        // Save stop loss and take profit amounts to localStorage
        localStorage.setItem('tradingHub_stopLossAmount', stopLossAmount);
        localStorage.setItem('tradingHub_takeProfitAmount', takeProfitAmount);
        console.log(`Saved SL/TP settings - SL: $${stopLossAmount}, TP: $${takeProfitAmount}`);

        // setIsSettingsOpen(false);
    };

    const getRandomBarrier = () => Math.floor(Math.random() * 10);
    const getRandomSymbol = () => {
        const randomIndex = Math.floor(Math.random() * availableSymbols.length);
        return availableSymbols[randomIndex];
    };

    const prepareRunPanelForTradingHub = () => {
        if (!run_panel.is_drawer_open) {
            run_panel.toggleDrawer(true);
        }
        run_panel.setActiveTabIndex(1);
        globalObserver.emit('bot.running');
        const new_session_id = `tradingHub_${Date.now()}`;
        setSessionRunId(new_session_id);
        globalObserver.emit('bot.started', new_session_id);
    };

    const executeDigitDifferTrade = async () => {
        console.log('🎯 DIFFER TRADE EXECUTION FUNCTION CALLED - Active cards: ' + 
            `O5U4: ${isAutoO5U4Active}, Matches: ${isAutoMatchesActive}, OverUnder: ${isAutoOverUnderActive}, Differ: ${isAutoDifferActive}`);
        
        // Critical check: Is API available?
        if (!api_base || !api_base.api) {
            console.error('❌ CRITICAL: api_base.api is not available for Differ! Cannot execute trades.');
            return;
        }
        
        // Check API connection state
        if (api_base.api.connection?.readyState !== 1) {
            console.warn('⚠️ API connection not ready for Differ. State:', api_base.api.connection?.readyState);
            return;
        }
        
        console.log('✅ Differ: API is available and connected');
        
        // Check if stop loss/take profit triggered - abort immediately
        if (slTpTriggeredRef.current || !isContinuousTradingRef.current) {
            console.log('🚫 Trade execution aborted - SL/TP triggered or trading stopped');
            return;
        }
            
        if (isTradeInProgress) {
            console.log('Trade already in progress, skipping new trade request');
            return;
        }

        try {
            setIsTradeInProgress(true);
            setIsTrading(true);
            const barrier = getRandomBarrier();
            const symbol = getRandomSymbol();
            setCurrentBarrier(barrier);
            setCurrentSymbol(symbol);

            const tradeId = `differ_${symbol}_${barrier}_${Date.now()}`;
            setLastTradeId(tradeId);
            setTradeCount(prevCount => prevCount + 1);
            lastTradeTime.current = Date.now();

            const currentTradeStake = manageStake('get');
            console.log(
                `Starting trade #${tradeCount + 1}: ${tradeId} with stake ${currentTradeStake} (consecutive losses: ${currentConsecutiveLossesRef.current})`
            );

            const opts = {
                amount: +currentTradeStake,
                basis: 'stake',
                contract_type: 'DIGITDIFF',
                currency: 'USD',
                duration: 1,
                duration_unit: 't',
                symbol: symbol,
                barrier: barrier.toString(),
            };

            // Create an array to store all trade promises
            const trades = [];

            // Standard trade for current account
            const standardTradePromise = doUntilDone(() =>
                api_base.api.send({
                    buy: 1,
                    price: opts.amount,
                    parameters: opts,
                }), [], api_base
            );
            trades.push(standardTradePromise);

            // Check copy trading settings from header
            

            // Final check before executing trades - abort if SL/TP triggered
            if (slTpTriggeredRef.current || !isContinuousTradingRef.current) {
                console.log('🚫 Differ trade execution aborted at final checkpoint - SL/TP triggered');
                setIsTradeInProgress(false);
                return;
            }

            // Execute all trades
            const results = await Promise.all(trades);
            const successfulTrades = results.filter(result => result && result.buy);

            // Post-execution check - if SL/TP triggered during execution, don't add contracts to tracking
            if (slTpTriggeredRef.current || !isContinuousTradingRef.current) {
                console.log('🚫 Differ contracts purchased but not tracked - SL/TP triggered during execution');
                setIsTradeInProgress(false);
                return;
            }

            if (successfulTrades.length > 0) {
                const result = successfulTrades[0]; // Use the main account result for UI updates
                const buy = result.buy;

                const contractId = buy.contract_id;
                console.log(`Trade purchased. Contract ID: ${contractId}, Stake: ${currentTradeStake}`);
                activeContractRef.current = contractId;
                setActiveContractId(contractId);

                setActiveContracts(prev => ({
                    ...prev,
                    [contractId]: {
                        contract_id: contractId,
                        buy_price: opts.amount,
                        status: 'open',
                        purchase_time: Date.now(),
                    },
                }));

                const contract_info = {
                    contract_id: buy.contract_id,
                    contract_type: opts.contract_type,
                    transaction_ids: { buy: buy.transaction_id },
                    buy_price: opts.amount,
                    currency: opts.currency,
                    symbol: opts.symbol,
                    barrier: opts.barrier,
                    date_start: Math.floor(Date.now() / 1000),
                    barrier_display_value: barrier.toString(),
                    contract_parameter: barrier.toString(),
                    parameter_type: 'differ_barrier',
                    entry_tick_time: Math.floor(Date.now() / 1000),
                    exit_tick_time: Math.floor(Date.now() / 1000) + opts.duration,
                    run_id: sessionRunId,
                    display_name: 'Digit Differs',
                    transaction_time: Math.floor(Date.now() / 1000),
                    underlying: symbol,
                    longcode: `Digit ${barrier} differs from last digit of last tick on ${symbol}.`,
                    display_message: `Contract parameter: Differ from ${barrier} on ${symbol}`,
                };

                globalObserver.emit('trading_hub.running');
                globalObserver.emit('bot.contract', contract_info);
                globalObserver.emit('bot.bot_ready');
                globalObserver.emit('contract.purchase_received', buy.contract_id);
                globalObserver.emit('contract.status', {
                    id: 'contract.purchase',
                    data: contract_info,
                    buy,
                });

                transactions.onBotContractEvent(contract_info);
                console.log(`Trade executed: ${opts.contract_type} with barrier ${opts.barrier} on ${opts.symbol}`);

                if (successfulTrades.length > 1) {
                    console.log(`Successfully placed ${successfulTrades.length} trades (including copy trades)`);
                }
            } else {
                console.error('Trade purchase failed: No buy response received');
                globalObserver.emit('ui.log.error', 'Trade purchase failed: No buy response received');
            }
        } catch (error) {
            console.error('Trade execution error:', error);
            globalObserver.emit('ui.log.error', `Trade execution error: ${error}`);
        } finally {
            setIsTrading(false);
            setTimeout(() => {
                setIsTradeInProgress(false);
            }, 1000);
        }
    };

    const executeDigitOverTrade = async () => {
        // Critical check: Is API available?
        if (!api_base || !api_base.api) {
            console.error('❌ CRITICAL: api_base.api is not available for Over/Under! Cannot execute trades.');
            return;
        }
        
        // Check API connection state
        if (api_base.api.connection?.readyState !== 1) {
            console.warn('⚠️ API connection not ready for Over/Under. State:', api_base.api.connection?.readyState);
            return;
        }
        
        console.log('✅ Over/Under: API is available and connected');
        
        // Check if stop loss/take profit triggered - abort immediately
        if (slTpTriggeredRef.current || !isContinuousTradingRef.current) {
            console.log('🚫 Trade execution aborted - SL/TP triggered or trading stopped');
            return;
        }
        
        if (isTradeInProgress) {
            console.log('Trade already in progress, skipping new trade request');
            return;
        }

        try {
            setIsTradeInProgress(true);
            setIsTrading(true);
            if (!isAnalysisReady) {
                console.log('Waiting for market analysis to be ready...');
                await marketAnalyzer.waitForAnalysisReady();
                console.log('Market analysis ready, proceeding with trade');
            }
            const latestRecommendation = await marketAnalyzer.getLatestRecommendation();
            const tradeRec = latestRecommendation || {
                symbol: 'R_100',
                strategy: 'over',
                barrier: '2',
                overPercentage: 0,
                underPercentage: 0,
            };
            const symbol = tradeRec.symbol;
            const strategy = tradeRec.strategy;
            const barrier = tradeRec.strategy === 'over' ? '2' : '7';
            const contract_type = tradeRec.strategy === 'over' ? 'DIGITOVER' : 'DIGITUNDER';

            const tradeId = `${contract_type.toLowerCase()}_${symbol}_${barrier}_${Date.now()}`;
            setLastTradeId(tradeId);
            setTradeCount(prevCount => prevCount + 1);
            lastTradeTime.current = Date.now();

            const currentTradeStake = manageStake('get');
            console.log(
                `Starting trade #${tradeCount + 1}: ${tradeId} with stake ${currentTradeStake} (consecutive losses: ${currentConsecutiveLossesRef.current})`
            );
            setCurrentBarrier(parseInt(barrier, 10));
            setCurrentSymbol(symbol);
            setCurrentStrategy(strategy);
            const opts = {
                amount: +currentTradeStake,
                basis: 'stake',
                contract_type,
                currency: 'USD',
                duration: 1,
                duration_unit: 't',
                symbol,
                barrier,
            };

            const trades = [];

            const standardTradePromise = doUntilDone(() =>
                api_base.api.send({
                    buy: 1,
                    price: opts.amount,
                    parameters: opts,
                }), [], api_base
            );
            trades.push(standardTradePromise);

            

            // Final check before executing trades - abort if SL/TP triggered
            if (slTpTriggeredRef.current || !isContinuousTradingRef.current) {
                console.log('🚫 Over/Under trade execution aborted at final checkpoint - SL/TP triggered');
                setIsTradeInProgress(false);
                return;
            }

            const results = await Promise.all(trades);
            const successfulTrades = results.filter(result => result && result.buy);

            // Post-execution check - if SL/TP triggered during execution, don't add contracts to tracking
            if (slTpTriggeredRef.current || !isContinuousTradingRef.current) {
                console.log('🚫 Over/Under contracts purchased but not tracked - SL/TP triggered during execution');
                setIsTradeInProgress(false);
                return;
            }

            if (successfulTrades.length > 0) {
                const result = successfulTrades[0];
                const buy = result.buy;

                const contractId = buy.contract_id;
                console.log(`Trade purchased. Contract ID: ${contractId}, Stake: ${currentTradeStake}`);
                activeContractRef.current = contractId;
                setActiveContractId(contractId);

                setActiveContracts(prev => ({
                    ...prev,
                    [contractId]: {
                        contract_id: contractId,
                        buy_price: opts.amount,
                        status: 'open',
                        purchase_time: Date.now(),
                    },
                }));

                const contract_info = {
                    contract_id: buy.contract_id,
                    contract_type: opts.contract_type,
                    transaction_ids: { buy: buy.transaction_id },
                    buy_price: opts.amount,
                    currency: opts.currency,
                    symbol: opts.symbol,
                    barrier: opts.barrier,
                    date_start: Math.floor(Date.now() / 1000),
                    barrier_display_value: barrier,
                    contract_parameter: barrier,
                    parameter_type: strategy === 'over' ? 'over_barrier' : 'under_barrier',
                    entry_tick_time: Math.floor(Date.now() / 1000),
                    exit_tick_time: Math.floor(Date.now() / 1000) + opts.duration,
                    run_id: sessionRunId,
                    display_name: strategy === 'over' ? 'Digit Over' : 'Digit Under',
                    transaction_time: Math.floor(Date.now() / 1000),
                    underlying: symbol,
                    longcode: `Last digit is ${strategy} ${barrier} on ${symbol}.`,
                    display_message: `Contract parameter: ${strategy === 'over' ? 'Over' : 'Under'} ${barrier} on ${symbol}`,
                };

                globalObserver.emit('trading_hub.running');
                globalObserver.emit('bot.contract', contract_info);
                globalObserver.emit('bot.bot_ready');
                globalObserver.emit('contract.purchase_received', buy.contract_id);
                globalObserver.emit('contract.status', {
                    id: 'contract.purchase',
                    data: contract_info,
                    buy,
                });

                transactions.onBotContractEvent(contract_info);
                console.log(`Trade executed: ${opts.contract_type} with barrier ${opts.barrier} on ${opts.symbol}`);

                if (successfulTrades.length > 1) {
                    console.log(`Successfully placed ${successfulTrades.length} trades (including copy trades)`);
                }
            } else {
                console.error('Trade purchase failed: No buy response received');
                globalObserver.emit('ui.log.error', 'Trade purchase failed: No buy response received');
            }
        } catch (error) {
            console.error('Trade execution error:', error);
            globalObserver.emit('ui.log.error', `Trade execution error: ${error}`);
        } finally {
            setIsTrading(false);
            setTimeout(() => {
                setIsTradeInProgress(false);
            }, 1000);
        }
    };

    const executeO5U4Trade = async () => {
        console.log('🎯 O5U4 TRADE EXECUTION FUNCTION CALLED - Active cards: ' + 
            `O5U4: ${isAutoO5U4Active}, Matches: ${isAutoMatchesActive}, OverUnder: ${isAutoOverUnderActive}, Differ: ${isAutoDifferActive}`);
        
        // Critical check: Is API available?
        if (!api_base || !api_base.api) {
            console.error('❌ CRITICAL: api_base.api is not available! Cannot execute trades.');
            console.error('   api_base:', api_base);
            console.error('   api_base.api:', api_base?.api);
            setIsTradeInProgress(false);
            return;
        }
        
        // Check API connection state
        if (api_base.api.connection?.readyState !== 1) {
            console.warn('⚠️ API connection not ready. State:', api_base.api.connection?.readyState);
            setIsTradeInProgress(false);
            return;
        }
        
        console.log('✅ API is available and connected');
        
        // Check if stop loss/take profit triggered - abort immediately
        if (slTpTriggeredRef.current || !isContinuousTradingRef.current) {
            console.log('🚫 Trade execution aborted - SL/TP triggered or trading stopped');
            return;
        }
            
        if (isTradeInProgress) {
            console.log('O5U4: Trade already in progress, skipping new trade request');
            return;
        }

        // Check if O5U4 contracts are already active
        if (o5u4ActiveContracts.current.over5ContractId || o5u4ActiveContracts.current.under4ContractId) {
            console.log('O5U4: Contracts already active, skipping new trade request');
            return;
        }

        try {
            setIsTradeInProgress(true);
            setIsTrading(true);

            // Check if conditions are met with detailed logging
            if (!checkO5U4Conditions()) {
                console.log('O5U4: Conditions not met, skipping trade');
                // Don't return early - reset flags and continue monitoring
                setIsTrading(false);
                setIsTradeInProgress(false);
                return;
            }

            const symbol = o5u4Analysis.bestSymbol!; // Use the best symbol found by analysis
            setCurrentSymbol(symbol);

            // Record the conditions we're trading on
            lastO5U4Conditions.current = {
                symbol: symbol,
                lastDigit: null, // Could add last digit tracking if needed
                tradedAt: Date.now()
            };

            const bestAnalysis = o5u4Analysis.symbolsAnalysis[symbol];
            console.log(`O5U4: EXECUTING TRADE on ${symbol}: ${bestAnalysis.reason} (score: ${bestAnalysis.score})`);

            const tradeId = `o5u4_${symbol}_${Date.now()}`;
            setLastTradeId(tradeId);
            setTradeCount(prevCount => prevCount + 1);
            lastTradeTime.current = Date.now();
            o5u4LastTradeTime.current = Date.now(); // Update O5U4 specific timer

            const currentTradeStake = manageStake('get');
            console.log(
                `Starting O5U4 trade #${tradeCount + 1}: ${tradeId} with stake ${currentTradeStake} (consecutive losses: ${currentConsecutiveLossesRef.current})`
            );

            // Create trades array for both over 5 and under 4
            const trades = [];

            // Over 5 trade
            const overOpts = {
                amount: +currentTradeStake,
                basis: 'stake',
                contract_type: 'DIGITOVER',
                currency: 'USD',
                duration: 1,
                duration_unit: 't',
                symbol: symbol,
                barrier: '5',
            };

            // Under 4 trade
            const underOpts = {
                amount: +currentTradeStake,
                basis: 'stake',
                contract_type: 'DIGITUNDER',
                currency: 'USD',
                duration: 1,
                duration_unit: 't',
                symbol: symbol,
                barrier: '4',
            };

            // Standard over 5 trade
            const overTradePromise = doUntilDone(() =>
                api_base.api.send({
                    buy: 1,
                    price: overOpts.amount,
                    parameters: overOpts,
                }), [], api_base
            );
            trades.push(overTradePromise);

            // Standard under 4 trade
            const underTradePromise = doUntilDone(() =>
                api_base.api.send({
                    buy: 1,
                    price: underOpts.amount,
                    parameters: underOpts,
                }), [], api_base
            );
            trades.push(underTradePromise);

            // Check copy trading settings
            

            // Final check before executing trades - abort if SL/TP triggered
            if (slTpTriggeredRef.current || !isContinuousTradingRef.current) {
                console.log('🚫 O5U4 trade execution aborted at final checkpoint - SL/TP triggered');
                setIsTradeInProgress(false);
                return;
            }

            // Execute all trades
            const results = await Promise.all(trades);
            const successfulTrades = results.filter(result => result && result.buy);

            // Post-execution check - if SL/TP triggered during execution, don't add contracts to tracking
            if (slTpTriggeredRef.current || !isContinuousTradingRef.current) {
                console.log('🚫 O5U4 contracts purchased but not tracked - SL/TP triggered during execution');
                setIsTradeInProgress(false);
                return;
            }

            if (successfulTrades.length >= 2) { // At least the main over and under trades should succeed
                const overResult = successfulTrades[0];
                const underResult = successfulTrades[1];
                
                const overBuy = overResult.buy;
                const underBuy = underResult.buy;

                console.log(`O5U4 trades purchased. Over 5 Contract ID: ${overBuy.contract_id}, Under 4 Contract ID: ${underBuy.contract_id}, Stake each: ${currentTradeStake}`);
                
                // For O5U4, track both contracts in the special O5U4 tracking
                o5u4ActiveContracts.current = {
                    over5ContractId: overBuy.contract_id,
                    under4ContractId: underBuy.contract_id,
                    over5Result: 'pending',
                    under4Result: 'pending',
                    bothSettled: false
                };

                // Set the first contract as active for UI purposes
                activeContractRef.current = overBuy.contract_id;
                setActiveContractId(overBuy.contract_id);

                // Track both contracts
                setActiveContracts(prev => ({
                    ...prev,
                    [overBuy.contract_id]: {
                        contract_id: overBuy.contract_id,
                        buy_price: overOpts.amount,
                        status: 'open',
                        purchase_time: Date.now(),
                        trade_type: 'over_5'
                    },
                    [underBuy.contract_id]: {
                        contract_id: underBuy.contract_id,
                        buy_price: underOpts.amount,
                        status: 'open',
                        purchase_time: Date.now(),
                        trade_type: 'under_4'
                    }
                }));

                // Create contract info for the over 5 trade
                const overContractInfo = {
                    contract_id: overBuy.contract_id,
                    contract_type: overOpts.contract_type,
                    transaction_ids: { buy: overBuy.transaction_id },
                    buy_price: overOpts.amount,
                    currency: overOpts.currency,
                    symbol: overOpts.symbol,
                    barrier: overOpts.barrier,
                    date_start: Math.floor(Date.now() / 1000),
                    barrier_display_value: '5',
                    contract_parameter: '5',
                    parameter_type: 'over_barrier',
                    entry_tick_time: Math.floor(Date.now() / 1000),
                    exit_tick_time: Math.floor(Date.now() / 1000) + overOpts.duration,
                    run_id: sessionRunId,
                    display_name: 'O5U4 Bot - Over 5',
                    transaction_time: Math.floor(Date.now() / 1000),
                    underlying: symbol,
                    longcode: `Last digit over 5 on ${symbol}.`,
                    display_message: `O5U4 Bot: Over 5 on ${symbol}`,
                };

                // Create contract info for the under 4 trade
                const underContractInfo = {
                    contract_id: underBuy.contract_id,
                    contract_type: underOpts.contract_type,
                    transaction_ids: { buy: underBuy.transaction_id },
                    buy_price: underOpts.amount,
                    currency: underOpts.currency,
                    symbol: underOpts.symbol,
                    barrier: underOpts.barrier,
                    date_start: Math.floor(Date.now() / 1000),
                    barrier_display_value: '4',
                    contract_parameter: '4',
                    parameter_type: 'under_barrier',
                    entry_tick_time: Math.floor(Date.now() / 1000),
                    exit_tick_time: Math.floor(Date.now() / 1000) + underOpts.duration,
                    run_id: sessionRunId,
                    display_name: 'O5U4 Bot - Under 4',
                    transaction_time: Math.floor(Date.now() / 1000),
                    underlying: symbol,
                    longcode: `Last digit under 4 on ${symbol}.`,
                    display_message: `O5U4 Bot: Under 4 on ${symbol}`,
                };

                globalObserver.emit('trading_hub.running');
                globalObserver.emit('bot.contract', overContractInfo);
                globalObserver.emit('bot.contract', underContractInfo);
                globalObserver.emit('bot.bot_ready');
                globalObserver.emit('contract.purchase_received', overBuy.contract_id);
                globalObserver.emit('contract.purchase_received', underBuy.contract_id);
                globalObserver.emit('contract.status', {
                    id: 'contract.purchase',
                    data: overContractInfo,
                    buy: overBuy,
                });
                globalObserver.emit('contract.status', {
                    id: 'contract.purchase',
                    data: underContractInfo,
                    buy: underBuy,
                });

                transactions.onBotContractEvent(overContractInfo);
                transactions.onBotContractEvent(underContractInfo);
                console.log(`O5U4 trades executed: Over 5 and Under 4 on ${symbol}`);

                if (successfulTrades.length > 2) {
                    console.log(`Successfully placed ${successfulTrades.length} trades (including copy trades)`);
                }
            } else {
                console.error('O5U4 trade purchase failed: Insufficient successful trades');
                globalObserver.emit('ui.log.error', 'O5U4 trade purchase failed: Insufficient successful trades');
            }
        } catch (error) {
            console.error('O5U4 trade execution error:', error);
            globalObserver.emit('ui.log.error', `O5U4 trade execution error: ${error}`);
        } finally {
            setIsTrading(false);
            // Reduce timeout for O5U4 to allow faster successive trades
            setTimeout(() => {
                setIsTradeInProgress(false);
                
                // Reset and wait for new conditions
                if (isContinuousTrading && isAutoO5U4Active && 
                    !o5u4ActiveContracts.current.over5ContractId && 
                    !o5u4ActiveContracts.current.under4ContractId) {
                    
                    console.log('O5U4: Trade execution completed - waiting for new conditions');
                    // Don't schedule immediate follow-up - wait for market analyzer to detect new conditions
                }
            }, 500); // Reduced from 1000ms to 500ms for faster recovery
        }
    };

    // Analyze O5U4 conditions across all symbols
    const analyzeO5U4AllSymbols = (allStats: Record<string, any>) => {
        const symbolsAnalysis: Record<string, any> = {};
        const readySymbols: string[] = [];
        let bestSymbol: string | null = null;
        let bestScore = 0;

        let totalReady = 0;
        let totalMeetingConditions = 0;

        availableSymbols.forEach(symbol => {
            const stats = allStats[symbol];
            if (!stats || !stats.digitCounts || stats.sampleSize < 20) {
                symbolsAnalysis[symbol] = {
                    ready: false,
                    meetsConditions: false,
                    reason: stats ? `Insufficient data (${stats.sampleSize} ticks)` : 'No data'
                };
                return;
            }

            totalReady++;
            readySymbols.push(symbol);
            const analysis = checkO5U4ConditionsForSymbol(stats);
            symbolsAnalysis[symbol] = {
                ready: true,
                meetsConditions: analysis.meetsConditions,
                reason: analysis.reason,
                lastDigit: stats.currentLastDigit,
                sampleSize: stats.sampleSize,
                leastAppearing: analysis.leastAppearing,
                mostAppearing: analysis.mostAppearing,
                score: analysis.score
            };

            if (analysis.meetsConditions) {
                totalMeetingConditions++;
                console.log(`O5U4: ${symbol} meets conditions - ${analysis.reason} (score: ${analysis.score})`);
            }

            // Find the best symbol (highest score among those that meet conditions)
            if (analysis.meetsConditions && analysis.score > bestScore) {
                bestScore = analysis.score;
                bestSymbol = symbol;
            }
        });

        // Log summary only when conditions change or when we have a best symbol
        const previousBest = o5u4Analysis.bestSymbol;
        if (bestSymbol !== previousBest) {
            console.log(`O5U4 Analysis: ${totalReady}/${availableSymbols.length} symbols ready, ${totalMeetingConditions} meeting conditions. Best: ${bestSymbol || 'None'}`);
        }

        setO5u4Analysis({
            bestSymbol,
            symbolsAnalysis,
            readySymbols
        });
    };

    // Check O5U4 conditions for a specific symbol
    const checkO5U4ConditionsForSymbol = (stats: any): {
        meetsConditions: boolean;
        reason: string;
        leastAppearing: number;
        mostAppearing: number;
        score: number;
    } => {
        const lastDigitValue = stats.currentLastDigit;
        
        // Condition 1: Last digit is 4 or 5
        if (lastDigitValue !== 4 && lastDigitValue !== 5) {
            return {
                meetsConditions: false,
                reason: `Last digit ${lastDigitValue} is not 4 or 5`,
                leastAppearing: -1,
                mostAppearing: -1,
                score: 0
            };
        }
        
        // Find least and most appearing digits
        const digitCounts = stats.digitCounts;
        const countEntries = digitCounts.map((count: number, digit: number) => ({
            digit,
            count
        })).filter((entry: any) => entry.count > 0);
        
        if (countEntries.length === 0) {
            return {
                meetsConditions: false,
                reason: 'No digit counts available',
                leastAppearing: -1,
                mostAppearing: -1,
                score: 0
            };
        }
        
        const sortedByCounts = countEntries.sort((a: any, b: any) => a.count - b.count);
        const leastAppearing = sortedByCounts[0].digit;
        const mostAppearing = sortedByCounts[sortedByCounts.length - 1].digit;
        
        // Condition 2: Least appearing digit is 4 or 5
        if (leastAppearing !== 4 && leastAppearing !== 5) {
            return {
                meetsConditions: false,
                reason: `Least appearing digit ${leastAppearing} is not 4 or 5`,
                leastAppearing,
                mostAppearing,
                score: 0
            };
        }
        
        // Condition 3: Most appearing is >5 or <4
        if (!(mostAppearing > 5 || mostAppearing < 4)) {
            return {
                meetsConditions: false,
                reason: `Most appearing digit ${mostAppearing} is not >5 or <4`,
                leastAppearing,
                mostAppearing,
                score: 0
            };
        }
        
        // Calculate score based on frequency differences and sample size
        const leastCount = sortedByCounts[0].count;
        const mostCount = sortedByCounts[sortedByCounts.length - 1].count;
        const frequencyDifference = mostCount - leastCount;
        const score = frequencyDifference * (stats.sampleSize / 100); // Normalize by sample size
        
        return {
            meetsConditions: true,
            reason: `All conditions met: last=${lastDigitValue}, least=${leastAppearing}, most=${mostAppearing}`,
            leastAppearing,
            mostAppearing,
            score
        };
    };

    // Helper function to check O5U4 conditions (updated to use best symbol)
    const checkO5U4Conditions = (): boolean => {
        const hasValidSymbol = o5u4Analysis.bestSymbol !== null;
        console.log(`🔍 O5U4 Condition Check: Best symbol = ${o5u4Analysis.bestSymbol}, Has valid = ${hasValidSymbol}`);
        
        if (!hasValidSymbol) {
            console.log('🔍 O5U4: No valid symbol found - waiting for conditions');
            return false;
        }

        const currentSymbol = o5u4Analysis.bestSymbol;
        console.log(`🔍 O5U4: CONDITIONS MET - ${currentSymbol} is ready to trade`);
        
        // Always return true when we have a valid symbol - trade every time conditions are met
        return true;
    };

    // Individual card run/stop handlers for O5U4
    const handleCardRunO5U4 = () => {
        console.log('🎯 O5U4 Card: RUN button clicked');
        if (cardsTradingState.o5u4) {
            handleCardStopO5U4();
        } else {
            startCardTrading('o5u4');
        }
    };

    const handleCardStopO5U4 = () => {
        console.log('⛔ O5U4 Card: STOP button clicked');
        cardsTradingRefs.current.o5u4 = false;
        setCardsTradingState(prev => ({ ...prev, o5u4: false }));
        if (o5u4IntervalRef.current) {
            clearInterval(o5u4IntervalRef.current);
            o5u4IntervalRef.current = null;
        }
    };

    // Individual card run/stop handlers for Matches
    const handleCardRunMatches = () => {
        console.log('🎯 Matches Card: RUN button clicked');
        if (cardsTradingState.matches) {
            handleCardStopMatches();
        } else {
            startCardTrading('matches');
        }
    };

    const handleCardStopMatches = () => {
        console.log('⛔ Matches Card: STOP button clicked');
        cardsTradingRefs.current.matches = false;
        setCardsTradingState(prev => ({ ...prev, matches: false }));
        if (matchesIntervalRef.current) {
            clearInterval(matchesIntervalRef.current);
            matchesIntervalRef.current = null;
        }
    };

    // Individual card run/stop handlers for Over/Under
    const handleCardRunOverUnder = () => {
        console.log('🎯 Over/Under Card: RUN button clicked');
        if (cardsTradingState.overUnder) {
            handleCardStopOverUnder();
        } else {
            startCardTrading('overUnder');
        }
    };

    const handleCardStopOverUnder = () => {
        console.log('⛔ Over/Under Card: STOP button clicked');
        cardsTradingRefs.current.overUnder = false;
        setCardsTradingState(prev => ({ ...prev, overUnder: false }));
        if (overUnderIntervalRef.current) {
            clearInterval(overUnderIntervalRef.current);
            overUnderIntervalRef.current = null;
        }
    };

    // Individual card run/stop handlers for Differ
    const handleCardRunDiffer = () => {
        console.log('🎯 Differ Card: RUN button clicked');
        if (cardsTradingState.differ) {
            handleCardStopDiffer();
        } else {
            startCardTrading('differ');
        }
    };

    const handleCardStopDiffer = () => {
        console.log('⛔ Differ Card: STOP button clicked');
        cardsTradingRefs.current.differ = false;
        setCardsTradingState(prev => ({ ...prev, differ: false }));
        if (differIntervalRef.current) {
            clearInterval(differIntervalRef.current);
            differIntervalRef.current = null;
        }
    };

    // Core function to start individual card trading
    const startCardTrading = (cardType: 'o5u4' | 'matches' | 'overUnder' | 'differ') => {
        console.log(`🚀 Starting ${cardType} card trading`);
        
        prepareRunPanelForTradingHub();
        cardsTradingRefs.current[cardType] = true;
        setCardsTradingState(prev => ({ ...prev, [cardType]: true }));
        slTpTriggeredRef.current = false;
        
        // CRITICAL: Set the continuous trading flag so trades can execute
        isContinuousTradingRef.current = true;
        console.log(`✅ Set isContinuousTradingRef.current = true for ${cardType} card trading`);

        const persistedStake = localStorage.getItem('tradingHub_initialStake') || initialStake;
        console.log(`Trading with stake: ${persistedStake}`);

        setAppliedStake(persistedStake);
        currentStakeRef.current = persistedStake;
        setConsecutiveLosses(0);
        currentConsecutiveLossesRef.current = 0;

        // Create independent interval for this card
        const intervalDelay = cardType === 'o5u4' ? 100 : cardType === 'matches' ? 200 : 3000;
        
        // Track if a trade is currently executing for this card
        let isExecuting = false;
        
        const executeCardTrade = async () => {
            // Check if SL/TP triggered or card stopped (using ref for current value)
            if (slTpTriggeredRef.current || !cardsTradingRefs.current[cardType]) {
                return;
            }

            // Prevent overlapping trade executions
            if (isExecuting) {
                console.log(`⏳ ${cardType}: Trade already executing, skipping`);
                return;
            }

            try {
                isExecuting = true;
                console.log(`📍 ${cardType}: Starting trade execution`);
                
                switch (cardType) {
                    case 'o5u4':
                        if (isAutoO5U4Active && checkO5U4Conditions()) {
                            console.log(`🎯 O5U4: Conditions met, executing trade`);
                            await executeO5U4Trade();
                        } else {
                            console.log(`🔍 O5U4: Conditions not met or strategy inactive`);
                        }
                        break;
                    case 'matches':
                        if (isAutoMatchesActive && matchesAnalysis.readySymbols.length > 0) {
                            console.log(`🎯 Matches: Analysis ready, executing trades`);
                            await executeMatchesTrades();
                        } else {
                            console.log(`🔍 Matches: Not ready or strategy inactive`);
                        }
                        break;
                    case 'overUnder':
                        if (isAutoOverUnderActive) {
                            console.log(`🎯 Over/Under: Executing trade`);
                            await executeDigitOverTrade();
                        } else {
                            console.log(`🔍 Over/Under: Strategy inactive`);
                        }
                        break;
                    case 'differ':
                        if (isAutoDifferActive) {
                            console.log(`🎯 Differ: Executing trade`);
                            await executeDigitDifferTrade();
                        } else {
                            console.log(`🔍 Differ: Strategy inactive`);
                        }
                        break;
                }
            } catch (error) {
                console.error(`❌ Error in ${cardType} trading:`, error);
            } finally {
                isExecuting = false;
                console.log(`✅ ${cardType}: Trade execution completed`);
            }
        };

        // Execute first trade immediately
        console.log(`⏱️ ${cardType}: Executing initial trade`);
        executeCardTrade();

        const intervalRef = cardType === 'o5u4' ? o5u4IntervalRef : 
                           cardType === 'matches' ? matchesIntervalRef :
                           cardType === 'overUnder' ? overUnderIntervalRef :
                           differIntervalRef;

        intervalRef.current = setInterval(executeCardTrade, intervalDelay);
        console.log(`⏲️ ${cardType}: Interval set with ${intervalDelay}ms delay`);
    };

    const startTrading = () => {
        console.log('🚀 START TRADING clicked!');
        console.log(`Current strategy states - O5U4: ${isAutoO5U4Active}, Matches: ${isAutoMatchesActive}, OverUnder: ${isAutoOverUnderActive}, Differ: ${isAutoDifferActive}`);
        console.log('🚀 Strategy priority: 1. O5U4, 2. Matches, 3. OverUnder, 4. Differ');
        console.log(`💰 Stop Loss/Take Profit enabled - Monitoring will start. SL: -$${stopLossAmount}, TP: $${takeProfitAmount}`);
        
        prepareRunPanelForTradingHub();
        setIsContinuousTrading(true);
        isContinuousTradingRef.current = true; // Set ref immediately
        slTpTriggeredRef.current = false; // Reset triggered flag
        
        // Emit state change for the run button
        globalObserver.emit('trading_hub.state_changed', { isRunning: true });

        const persistedStake = localStorage.getItem('tradingHub_initialStake') || initialStake;
        console.log(`Starting trading with persisted stake: ${persistedStake}`);

        setAppliedStake(persistedStake);
        currentStakeRef.current = persistedStake;
        setConsecutiveLosses(0);
        currentConsecutiveLossesRef.current = 0;
        contractSettledTimeRef.current = 0;
        waitingForSettlementRef.current = false;

        setTimeout(() => {
            console.log('🚀 Starting strategy execution after delay...');
            
            // Check if stop loss/take profit triggered during startup delay
            if (slTpTriggeredRef.current || !isContinuousTradingRef.current) {
                console.log('🚫 Strategy execution aborted - SL/TP triggered or trading stopped during startup');
                return;
            }
            
            console.log(`🚀 STRATEGY CHECK - O5U4: ${isAutoO5U4Active ? 'ACTIVE' : 'inactive'}, Matches: ${isAutoMatchesActive ? 'ACTIVE' : 'inactive'}, OverUnder: ${isAutoOverUnderActive ? 'ACTIVE' : 'inactive'}, Differ: ${isAutoDifferActive ? 'ACTIVE' : 'inactive'}`);
            // Check which strategy is active and execute in order of priority
            
            // Check if O5U4 is active first (since you mentioned this is your issue)
            if (isAutoO5U4Active) {
                // For O5U4, check immediately and execute if conditions are met
                console.log('🚀 O5U4: Starting trading - checking immediate conditions');
                console.log(`🚀 O5U4: Current best symbol: ${o5u4Analysis.bestSymbol}`);
                console.log(`🚀 O5U4: Market analyzer running: ${marketAnalyzer ? 'YES' : 'NO'}`);
                
                if (checkO5U4Conditions()) {
                    console.log('🚀 O5U4: Immediate conditions met on start - executing trade');
                    executeO5U4Trade();
                } else {
                    console.log('🚀 O5U4: No immediate conditions met on start - waiting for next opportunity');
                }
            } else if (isAutoMatchesActive) {
                // For Matches, check if analysis is ready and execute if conditions are met
                console.log('🚀 Matches: Starting trading - checking analysis status');
                console.log(`🚀 Matches: Ready symbols: ${matchesAnalysis.readySymbols.length}`);
                
                if (matchesAnalysis.readySymbols.length > 0) {
                    const volatilitySymbols = availableSymbols;
                    const readySymbol = volatilitySymbols.find(symbol => 
                        matchesAnalysis.readySymbols.includes(symbol) && 
                        matchesAnalysis.topDigits[symbol]?.length === 5
                    );
                    
                    if (readySymbol) {
                        console.log('🚀 Matches: Analysis ready on start - executing trades');
                        executeMatchesTrades();
                    } else {
                        console.log('🚀 Matches: Analysis not complete on start - waiting for completion');
                    }
                } else {
                    console.log('🚀 Matches: No analysis available on start - waiting for first analysis');
                }
            } else if (isAutoOverUnderActive) {
                console.log('🚀 Executing OverUnder strategy');
                executeDigitOverTrade();
            } else if (isAutoDifferActive) {
                console.log('🚀 Executing DigitDiffer strategy');
                executeDigitDifferTrade();
            } else {
                console.log('🚀 No strategy selected!');
            }
        }, isAutoO5U4Active ? 100 : 500); // Faster start for O5U4
    };

    const stopTrading = () => {
        console.log('Stopping continuous trading...');
        setIsContinuousTrading(false);
        isContinuousTradingRef.current = false; // Update ref immediately
        setIsTrading(false);
        
        // Reset cumulative profit when stopping
        console.log(`💰 Session ended with cumulative profit: $${cumulativeProfit.toFixed(2)}`);
        setCumulativeProfit(0);
        cumulativeProfitRef.current = 0; // Also reset the ref
        
        globalObserver.emit('bot.stopped');
        
        // Emit state change for the run button
        globalObserver.emit('trading_hub.state_changed', { isRunning: false });
        
        // Get profit information and trigger emoji animation
        const total_profit = transactions?.statistics?.total_profit || 0;
        
        // Show emoji animation based on profit
        setIsProfitPositive(total_profit >= 0);
        setShowEmojiAnimation(true);
        
        // Hide emoji animation after 6 seconds
        setTimeout(() => {
            setShowEmojiAnimation(false);
        }, 6000);
        
        console.log('Trading Hub: Showing emoji animation with profit positive:', total_profit >= 0);
        
        manageStake('reset');
        
        // Reset O5U4 contract tracking when stopping
        o5u4ActiveContracts.current = {
            over5ContractId: null,
            under4ContractId: null,
            over5Result: null,
            under4Result: null,
            bothSettled: false
        };

        // Reset last conditions tracking
        lastO5U4Conditions.current = {
            symbol: null,
            lastDigit: null,
            tradedAt: null
        };
    };

    const handleTrade = () => (isContinuousTrading ? stopTrading() : startTrading());

    const isStrategyActive = isAutoDifferActive || isAutoOverUnderActive || isAutoO5U4Active || isAutoMatchesActive;

    const displayStake = () => {
        if (parseFloat(appliedStake) === parseFloat(initialStake)) {
            return `$${parseFloat(appliedStake).toFixed(2)}`;
        } else {
            return `$${parseFloat(appliedStake).toFixed(2)} (Base: $${parseFloat(initialStake).toFixed(2)})`;
        }
    };

    // Tabbed interface state
    const [activeTab, setActiveTab] = useState<'o5u4' | 'matches' | 'over-under' | 'differ'>('o5u4');

    return (
        <div className={`trading-hub-tabbed ${is_dark_mode_on ? 'theme--dark' : 'theme--light'}`}>
            {/* Show emoji animation when stopping trading and profit/loss is available */}
            {showEmojiAnimation && (
                <EmojiAnimation isPositive={isProfitPositive} />
            )}
            
            <div className='trading-hub-content'>
                {/* Header Section */}
                <div className='hub-header'>
                    <div className='header-main'>
                        <div className='logo-section'>
                            <div className='logo-icon'>
                                <svg viewBox='0 0 24 24' width='24' height='24'>
                                    <path d='M13 2L3 14h9l-1 8 10-12h-9l1-8z' fill='url(#gradient1)' />
                                    <defs>
                                        <linearGradient id='gradient1' x1='0%' y1='0%' x2='100%' y2='100%'>
                                            <stop offset='0%' stopColor='#6366F1' />
                                            <stop offset='100%' stopColor='#8B5CF6' />
                                        </linearGradient>
                                    </defs>
                                </svg>
                            </div>
                            <div className='title-group'>
                                <h1 className='hub-title'>Trading Hub</h1>
                                <p className='hub-subtitle'>AI-Powered Strategies</p>
                            </div>
                        </div>

                        <div className='settings-controls'>
                            <div className='control-group'>
                                <label htmlFor='stake-input'>Stake ($)</label>
                                <input
                                    id='stake-input'
                                    type='number'
                                    min={MINIMUM_STAKE}
                                    step='0.01'
                                    value={stake}
                                    onChange={e => {
                                        const value = e.target.value;
                                        manageStake('update', { newValue: value });
                                    }}
                                    onBlur={handleSaveSettings}
                                    disabled={isContinuousTrading}
                                    className='compact-input'
                                />
                            </div>

                            <div className='control-group'>
                                <label htmlFor='martingale-input'>Martingale</label>
                                <input
                                    id='martingale-input'
                                    type='number'
                                    min='1'
                                    step='0.1'
                                    value={martingale}
                                    onChange={e => {
                                        const value = e.target.value;
                                        manageMartingale('update', { newValue: value });
                                    }}
                                    onBlur={handleSaveSettings}
                                    disabled={isContinuousTrading}
                                    className='compact-input'
                                />
                            </div>

                            <div className='control-group stop-loss-group'>
                                <label htmlFor='stop-loss-input'>Stop Loss ($)</label>
                                <input
                                    id='stop-loss-input'
                                    type='number'
                                    min='0.01'
                                    step='0.01'
                                    value={stopLossAmount}
                                    onChange={e => {
                                        const value = e.target.value;
                                        setStopLossAmount(value);
                                        stopLossAmountRef.current = value;
                                    }}
                                    onBlur={handleSaveSettings}
                                    disabled={isContinuousTrading}
                                    className='compact-input'
                                    placeholder='5.00'
                                />
                            </div>

                            <div className='control-group take-profit-group'>
                                <label htmlFor='take-profit-input'>Take Profit ($)</label>
                                <input
                                    id='take-profit-input'
                                    type='number'
                                    min='0.01'
                                    step='0.01'
                                    value={takeProfitAmount}
                                    onChange={e => {
                                        const value = e.target.value;
                                        setTakeProfitAmount(value);
                                        takeProfitAmountRef.current = value;
                                    }}
                                    onBlur={handleSaveSettings}
                                    disabled={isContinuousTrading}
                                    className='compact-input'
                                    placeholder='10.00'
                                />
                            </div>
                        </div>
                    </div>

                    {/* Status Bar */}
                    <div className='status-bar'>
                        <div className='status-item'>
                            <div className='status-dot'></div>
                            <span>Market Connected</span>
                        </div>
                        <div className='status-separator'></div>
                        <div className='status-item'>
                            <span>Stake: {displayStake()}</span>
                        </div>
                        {isContinuousTrading && (
                            <>
                                <div className='status-separator'></div>
                                <div className={`status-item profit-tracker ${cumulativeProfit >= 0 ? 'positive' : 'negative'}`}>
                                    <span>Session P/L: ${cumulativeProfit.toFixed(2)}</span>
                                    <span className='threshold stop-loss' title='Stop Loss'>SL: -${stopLossAmount}</span>
                                    <span className='threshold take-profit' title='Take Profit'>TP: ${takeProfitAmount}</span>
                                </div>
                            </>
                        )}
                        {Object.keys(activeContracts).length > 0 && (
                            <>
                                <div className='status-separator'></div>
                                <div className='status-item active-trade'>
                                    <div className='pulse-dot'></div>
                                    <span>Live Trade</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Strategy Cards */}
                {/* Tab Navigation */}
                <div className='tabs-container'>
                    <div className='tabs-header'>
                        <button
                            className={`tab-button ${activeTab === 'o5u4' ? 'active' : ''}`}
                            onClick={() => setActiveTab('o5u4')}
                        >
                            <span className='tab-icon'>🎯</span>
                            <span className='tab-label'>O5U4</span>
                            {isAutoO5U4Active && <div className='tab-indicator'></div>}
                        </button>
                        <button
                            className={`tab-button ${activeTab === 'matches' ? 'active' : ''}`}
                            onClick={() => setActiveTab('matches')}
                        >
                            <span className='tab-icon'>🔢</span>
                            <span className='tab-label'>Matches</span>
                            {isAutoMatchesActive && <div className='tab-indicator'></div>}
                        </button>
                        <button
                            className={`tab-button ${activeTab === 'over-under' ? 'active' : ''}`}
                            onClick={() => setActiveTab('over-under')}
                        >
                            <span className='tab-icon'>📊</span>
                            <span className='tab-label'>Over/Under</span>
                            {isAutoOverUnderActive && <div className='tab-indicator'></div>}
                        </button>
                        <button
                            className={`tab-button ${activeTab === 'differ' ? 'active' : ''}`}
                            onClick={() => setActiveTab('differ')}
                        >
                            <span className='tab-icon'>⚖️</span>
                            <span className='tab-label'>Differ</span>
                            {isAutoDifferActive && <div className='tab-indicator'></div>}
                        </button>
                    </div>

                    {/* Tab Content Area */}
                    <div className='tabs-content'>
                        {/* O5U4 Tab */}
                        {activeTab === 'o5u4' && (
                            <div className='tab-panel o5u4-panel'>
                                <div className='panel-header'>
                                    <div className='header-left'>
                                        <h2>Over 5 / Under 4 Strategy</h2>
                                        <p>Dual digit prediction on consecutive ticks</p>
                                    </div>
                                    <div className='header-right'>
                                        <span className={`strategy-badge ${isAutoO5U4Active ? 'active' : 'inactive'}`}>
                                            {isAutoO5U4Active ? '● ACTIVE' : '○ INACTIVE'}
                                        </span>
                                    </div>
                                </div>

                                <div className='panel-body'>
                                    <div className='strategy-info'>
                                        <p>
                                            This advanced strategy trades over 5 and under 4 contracts simultaneously,
                                            capturing digit movement patterns for quick profits on every tick.
                                        </p>
                                    </div>

                                    {o5u4Analysis.bestSymbol && (
                                        <div className='current-analysis'>
                                            <h3>Current Analysis</h3>
                                            <div className='analysis-grid'>
                                                <div className='analysis-item'>
                                                    <label>Best Symbol</label>
                                                    <value>{o5u4Analysis.bestSymbol}</value>
                                                </div>
                                                <div className='analysis-item'>
                                                    <label>Score</label>
                                                    <value>{o5u4Analysis.symbolsAnalysis[o5u4Analysis.bestSymbol]?.score.toFixed(2)}</value>
                                                </div>
                                                <div className='analysis-item'>
                                                    <label>Least Appearing</label>
                                                    <value>{o5u4Analysis.symbolsAnalysis[o5u4Analysis.bestSymbol]?.leastAppearing}</value>
                                                </div>
                                                <div className='analysis-item'>
                                                    <label>Most Appearing</label>
                                                    <value>{o5u4Analysis.symbolsAnalysis[o5u4Analysis.bestSymbol]?.mostAppearing}</value>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {cardsTradingState.o5u4 && (
                                        <div className='trading-status active'>
                                            <div className='status-badge'>🔴 TRADING LIVE</div>
                                            <div className='trade-stats'>
                                                <div className='stat-row'>
                                                    <span>Contracts Active:</span>
                                                    <strong>
                                                        {(o5u4ActiveContracts.current.over5ContractId ? 1 : 0) + 
                                                         (o5u4ActiveContracts.current.under4ContractId ? 1 : 0)}
                                                    </strong>
                                                </div>
                                                <div className='stat-row'>
                                                    <span>Last Trade:</span>
                                                    <strong>{lastO5U4Conditions.current?.symbol || 'N/A'}</strong>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className='panel-footer'>
                                    <button
                                        className={`toggle-btn ${isAutoO5U4Active ? 'active' : ''}`}
                                        onClick={toggleAutoO5U4}
                                        disabled={cardsTradingState.o5u4}
                                    >
                                        {isAutoO5U4Active ? '✓ Activated' : 'Activate Strategy'}
                                    </button>
                                    <button
                                        className={`trade-btn ${cardsTradingState.o5u4 ? 'stop' : 'start'} ${!isAutoO5U4Active ? 'disabled' : ''}`}
                                        onClick={handleCardRunO5U4}
                                        disabled={!isAutoO5U4Active}
                                    >
                                        {cardsTradingState.o5u4 ? '⏹ STOP TRADING' : '▶ START TRADING'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Matches Tab */}
                        {activeTab === 'matches' && (
                            <div className='tab-panel matches-panel'>
                                <div className='panel-header'>
                                    <div className='header-left'>
                                        <h2>Frequency Matches Strategy</h2>
                                        <p>Pattern-based digit frequency analysis</p>
                                    </div>
                                    <div className='header-right'>
                                        <span className={`strategy-badge ${isAutoMatchesActive ? 'active' : 'inactive'}`}>
                                            {isAutoMatchesActive ? '● ACTIVE' : '○ INACTIVE'}
                                        </span>
                                    </div>
                                </div>

                                <div className='panel-body'>
                                    <div className='strategy-info'>
                                        <p>
                                            Analyzes digit frequency patterns across multiple markets to identify
                                            the most likely next digit, then executes DIGITMATCH contracts.
                                        </p>
                                    </div>

                                    {matchesAnalysis.readySymbols.length > 0 && (
                                        <div className='current-analysis'>
                                            <h3>Ready Markets ({matchesAnalysis.readySymbols.length})</h3>
                                            <div className='symbols-list'>
                                                {matchesAnalysis.readySymbols.map((sym, idx) => (
                                                    <span key={idx} className='symbol-tag'>{sym}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {cardsTradingState.matches && (
                                        <div className='trading-status active'>
                                            <div className='status-badge'>🔴 TRADING LIVE</div>
                                            <div className='trade-stats'>
                                                <div className='stat-row'>
                                                    <span>Active Contracts:</span>
                                                    <strong>{Object.values(matchesActiveContracts.current).filter(id => id).length}</strong>
                                                </div>
                                                <div className='stat-row'>
                                                    <span>Symbols Covered:</span>
                                                    <strong>{matchesAnalysis.readySymbols.length}</strong>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className='panel-footer'>
                                    <button
                                        className={`toggle-btn ${isAutoMatchesActive ? 'active' : ''}`}
                                        onClick={toggleAutoMatches}
                                        disabled={cardsTradingState.matches}
                                    >
                                        {isAutoMatchesActive ? '✓ Activated' : 'Activate Strategy'}
                                    </button>
                                    <button
                                        className={`trade-btn ${cardsTradingState.matches ? 'stop' : 'start'} ${!isAutoMatchesActive ? 'disabled' : ''}`}
                                        onClick={handleCardRunMatches}
                                        disabled={!isAutoMatchesActive}
                                    >
                                        {cardsTradingState.matches ? '⏹ STOP TRADING' : '▶ START TRADING'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Over/Under Tab */}
                        {activeTab === 'over-under' && (
                            <div className='tab-panel over-under-panel'>
                                <div className='panel-header'>
                                    <div className='header-left'>
                                        <h2>Auto Over/Under Strategy</h2>
                                        <p>AI-powered barrier position prediction</p>
                                    </div>
                                    <div className='header-right'>
                                        <span className={`strategy-badge ${isAutoOverUnderActive ? 'active' : 'inactive'}`}>
                                            {isAutoOverUnderActive ? '● ACTIVE' : '○ INACTIVE'}
                                        </span>
                                    </div>
                                </div>

                                <div className='panel-body'>
                                    <div className='strategy-info'>
                                        <p>
                                            Uses advanced machine learning to analyze market patterns and automatically
                                            positions over/under contracts on detected trend changes.
                                        </p>
                                    </div>

                                    {isAutoOverUnderActive && !isAnalysisReady && (
                                        <div className='analyzing'>
                                            <div className='spinner'></div>
                                            <p>Running AI analysis...</p>
                                        </div>
                                    )}

                                    {isAutoOverUnderActive && isAnalysisReady && recommendation && (
                                        <div className='current-analysis'>
                                            <h3>Current Recommendation</h3>
                                            <div className='recommendation'>
                                                <div className='rec-item confidence-high'>
                                                    <label>Confidence Level</label>
                                                    <value>HIGH</value>
                                                </div>
                                                <div className='rec-item'>
                                                    <label>Most Frequent Digit</label>
                                                    <value className='digit'>{recommendation.mostFrequentDigit}</value>
                                                </div>
                                                <div className='rec-item'>
                                                    <label>Current Last Digit</label>
                                                    <value className='digit'>{recommendation.currentLastDigit}</value>
                                                </div>
                                                <div className='rec-item'>
                                                    <label>Analyses Run</label>
                                                    <value>{analysisCount}</value>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {cardsTradingState.overUnder && (
                                        <div className='trading-status active'>
                                            <div className='status-badge'>🔴 TRADING LIVE</div>
                                            <div className='trade-stats'>
                                                <div className='stat-row'>
                                                    <span>Current Contract:</span>
                                                    <strong>{lastTradeId?.split('_')[0] || 'N/A'}</strong>
                                                </div>
                                                <div className='stat-row'>
                                                    <span>Total Trades:</span>
                                                    <strong>{tradeCount}</strong>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className='panel-footer'>
                                    <button
                                        className={`toggle-btn ${isAutoOverUnderActive ? 'active' : ''}`}
                                        onClick={toggleAutoOverUnder}
                                        disabled={cardsTradingState.overUnder}
                                    >
                                        {isAutoOverUnderActive ? '✓ Activated' : 'Activate Strategy'}
                                    </button>
                                    <button
                                        className={`trade-btn ${cardsTradingState.overUnder ? 'stop' : 'start'} ${!isAutoOverUnderActive ? 'disabled' : ''}`}
                                        onClick={handleCardRunOverUnder}
                                        disabled={!isAutoOverUnderActive}
                                    >
                                        {cardsTradingState.overUnder ? '⏹ STOP TRADING' : '▶ START TRADING'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Differ Tab */}
                        {activeTab === 'differ' && (
                            <div className='tab-panel differ-panel'>
                                <div className='panel-header'>
                                    <div className='header-left'>
                                        <h2>Auto Differ Strategy</h2>
                                        <p>Random digit difference analysis</p>
                                    </div>
                                    <div className='header-right'>
                                        <span className={`strategy-badge ${isAutoDifferActive ? 'active' : 'inactive'}`}>
                                            {isAutoDifferActive ? '● ACTIVE' : '○ INACTIVE'}
                                        </span>
                                    </div>
                                </div>

                                <div className='panel-body'>
                                    <div className='strategy-info'>
                                        <p>
                                            Analyzes digit differences across randomized barriers to find optimal
                                            DIGITDIFF positions and execute rapid-fire trades.
                                        </p>
                                    </div>

                                    {currentBarrier !== null && (
                                        <div className='current-analysis'>
                                            <h3>Active Configuration</h3>
                                            <div className='analysis-grid'>
                                                <div className='analysis-item'>
                                                    <label>Current Barrier</label>
                                                    <value>{currentBarrier}</value>
                                                </div>
                                                <div className='analysis-item'>
                                                    <label>Current Symbol</label>
                                                    <value>{currentSymbol || 'N/A'}</value>
                                                </div>
                                                <div className='analysis-item'>
                                                    <label>Prediction Target</label>
                                                    <value>{currentPrediction || 'N/A'}</value>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {cardsTradingState.differ && (
                                        <div className='trading-status active'>
                                            <div className='status-badge'>🔴 TRADING LIVE</div>
                                            <div className='trade-stats'>
                                                <div className='stat-row'>
                                                    <span>Active Contract:</span>
                                                    <strong>{activeContractRef.current ? 'YES' : 'NONE'}</strong>
                                                </div>
                                                <div className='stat-row'>
                                                    <span>Total Executed:</span>
                                                    <strong>{tradeCount}</strong>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className='panel-footer'>
                                    <button
                                        className={`toggle-btn ${isAutoDifferActive ? 'active' : ''}`}
                                        onClick={toggleAutoDiffer}
                                        disabled={cardsTradingState.differ}
                                    >
                                        {isAutoDifferActive ? '✓ Activated' : 'Activate Strategy'}
                                    </button>
                                    <button
                                        className={`trade-btn ${cardsTradingState.differ ? 'stop' : 'start'} ${!isAutoDifferActive ? 'disabled' : ''}`}
                                        onClick={handleCardRunDiffer}
                                        disabled={!isAutoDifferActive}
                                    >
                                        {cardsTradingState.differ ? '⏹ STOP TRADING' : '▶ START TRADING'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className='strategy-grid' style={{display: 'none'}}>
                    <div className={`strategy-card ${isAutoDifferActive ? 'active' : ''}`}>
                        <div className='card-header'>
                            <div className='strategy-icon'>
                                <svg viewBox='0 0 24 24' width='24' height='24'>
                                    <path
                                        d='M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM7.5 18c-.83 0-1.5-.67-1.5-1.5S6.67 15 7.5 15s1.5.67 1.5 1.5S8.33 18 7.5 18zm0-9C6.67 9 6 8.33 6 7.5S6.67 6 7.5 6 9 6.67 9 7.5 8.33 9 7.5 9zm4.5 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm4.5 4.5c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm0-9c-.83 0-1.5-.67-1.5-1.5S15.67 6 16.5 6s1.5.67 1.5 1.5S17.33 9 16.5 9z'
                                        fill='currentColor'
                                    />
                                </svg>
                            </div>
                            <div className='strategy-title'>
                                <h4>AutoDiffer</h4>
                                <p>Random Digit Analysis</p>
                            </div>
                            <div className={`strategy-status ${isAutoDifferActive ? 'on' : 'off'}`}>
                                {isAutoDifferActive ? 'ON' : 'OFF'}
                            </div>
                        </div>
                        <div className='card-content'>
                            <p>Automatically analyzes random barriers and symbols for optimal digit differ trades.</p>
                            {isAutoDifferActive && currentBarrier !== null && (
                                <div className='active-info'>
                                    <span className='info-label'>Current Target:</span>
                                    <span className='info-value'>
                                        Barrier {currentBarrier} on {currentSymbol}
                                    </span>
                                </div>
                            )}
                        </div>
                        <div className='card-footer'>
                            <button
                                className={`strategy-toggle ${isAutoDifferActive ? 'active' : ''}`}
                                onClick={toggleAutoDiffer}
                                disabled={cardsTradingState.differ}
                            >
                                {isAutoDifferActive ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                                className={`card-run-btn ${cardsTradingState.differ ? 'stop' : 'start'} ${!isAutoDifferActive ? 'disabled' : ''}`}
                                onClick={handleCardRunDiffer}
                                disabled={!isAutoDifferActive}
                                title={cardsTradingState.differ ? 'Stop trading' : 'Start trading'}
                            >
                                <div className='run-btn-content'>
                                    <svg viewBox='0 0 24 24' width='16' height='16'>
                                        {cardsTradingState.differ ? (
                                            <>
                                                <rect x='6' y='4' width='4' height='16' fill='currentColor' />
                                                <rect x='14' y='4' width='4' height='16' fill='currentColor' />
                                            </>
                                        ) : (
                                            <polygon points='5,3 19,12 5,21' fill='currentColor' />
                                        )}
                                    </svg>
                                    <span>{cardsTradingState.differ ? 'STOP' : 'RUN'}</span>
                                </div>
                            </button>
                        </div>
                    </div>

                    <div className={`strategy-card ${isAutoOverUnderActive ? 'active' : ''}`}>
                        <div className='card-header'>
                            <div className='strategy-icon'>
                                <svg viewBox='0 0 24 24' width='24' height='24'>
                                    <path
                                        d='M21.99 4c0-1.1-.89-2-2-2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4-.01-18zM18 14H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z'
                                        fill='currentColor'
                                    />
                                    <circle cx='8' cy='7' r='1' fill='currentColor'/>
                                    <circle cx='12' cy='7' r='1' fill='currentColor'/>
                                    <circle cx='16' cy='7' r='1' fill='currentColor'/>
                                    <path
                                        d='M20 16v-1.5c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5V16c-.55 0-1 .45-1 1v3c0 .55.45 1 1 1h4c.55 0 1-.45 1-1v-3c0-.55-.45-1-1-1z'
                                        fill='currentColor'
                                        opacity='0.7'
                                    />
                                </svg>
                            </div>
                            <div className='strategy-title'>
                                <h4>Auto Over/Under</h4>
                                <p>AI Pattern Recognition</p>
                            </div>
                            <div className={`strategy-status ${isAutoOverUnderActive ? 'on' : 'off'}`}>
                                {isAutoOverUnderActive ? 'ON' : 'OFF'}
                            </div>
                        </div>
                        <div className='card-content'>
                            <p>Uses advanced AI to identify patterns and recommend optimal over/under positions.</p>
                            {isAutoOverUnderActive && !isAnalysisReady && (
                                <div className='analyzing-state'>
                                    <div className='spinner'></div>
                                    <span>Analyzing markets...</span>
                                </div>
                            )}
                            {isAutoOverUnderActive && isAnalysisReady && recommendation && (
                                <div className='recommendation-card'>
                                    <div className='rec-header'>
                                        <span className='rec-label'>Recommendation</span>
                                        <span className='rec-confidence'>High Confidence</span>
                                    </div>
                                    <div className='rec-details'>
                                        <div className='rec-item'>
                                            <span>Strategy:</span>
                                            <strong>{recommendation.strategy === 'over' ? 'OVER 2' : 'UNDER 7'}</strong>
                                        </div>
                                        <div className='rec-item'>
                                            <span>Symbol:</span>
                                            <strong>{recommendation.symbol}</strong>
                                        </div>
                                        <div className='rec-item'>
                                            <span>Pattern:</span>
                                            <span className='pattern-text'>{recommendation.reason}</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className='card-footer'>
                            <button
                                className={`strategy-toggle ${isAutoOverUnderActive ? 'active' : ''}`}
                                onClick={toggleAutoOverUnder}
                                disabled={cardsTradingState.overUnder}
                            >
                                {isAutoOverUnderActive ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                                className={`card-run-btn ${cardsTradingState.overUnder ? 'stop' : 'start'} ${!isAutoOverUnderActive ? 'disabled' : ''}`}
                                onClick={handleCardRunOverUnder}
                                disabled={!isAutoOverUnderActive}
                                title={cardsTradingState.overUnder ? 'Stop trading' : 'Start trading'}
                            >
                                <div className='run-btn-content'>
                                    <svg viewBox='0 0 24 24' width='16' height='16'>
                                        {cardsTradingState.overUnder ? (
                                            <>
                                                <rect x='6' y='4' width='4' height='16' fill='currentColor' />
                                                <rect x='14' y='4' width='4' height='16' fill='currentColor' />
                                            </>
                                        ) : (
                                            <polygon points='5,3 19,12 5,21' fill='currentColor' />
                                        )}
                                    </svg>
                                    <span>{cardsTradingState.overUnder ? 'STOP' : 'RUN'}</span>
                                </div>
                            </button>
                        </div>
                    </div>

                    <div className={`strategy-card ${isAutoO5U4Active ? 'active' : ''}`}>
                        <div className='card-header'>
                            <div className='strategy-icon'>
                                <svg viewBox='0 0 24 24' width='24' height='24'>
                                    <path
                                        d='M6 2h12v6h-12z'
                                        fill='currentColor'
                                        opacity='0.7'
                                    />
                                    <path
                                        d='M9 10h6l3 8H6l3-8z'
                                        fill='currentColor'
                                    />
                                    <path
                                        d='M10 6v2h4V6'
                                        stroke='currentColor'
                                        strokeWidth='2'
                                        fill='none'
                                    />
                                    <text x='9' y='7' fontSize='6' fill='white' fontWeight='bold'>5</text>
                                    <text x='6' y='16' fontSize='6' fill='white' fontWeight='bold'>4</text>
                                    <path
                                        d='M14 4v4m-4-4v4'
                                        stroke='currentColor'
                                        strokeWidth='1'
                                    />
                                </svg>
                            </div>
                            <div className='strategy-title'>
                                <h4>Auto O5 U4</h4>
                                <p>Dual Digit Strategy</p>
                            </div>
                            <div className={`strategy-status ${isAutoO5U4Active ? 'on' : 'off'}`}>
                                {isAutoO5U4Active ? 'ON' : 'OFF'}
                            </div>
                        </div>
                        <div className='card-content'>
                            <p>Simultaneously trades Over 5 and Under 4 based on digit frequency analysis across all volatility indices.</p>
                            
                            {isAutoO5U4Active && (
                                <div className='o5u4-info'>
                                    {o5u4Analysis.readySymbols.length === 0 ? (
                                        <div className='analyzing-state'>
                                            <div className='spinner'></div>
                                            <span>Analyzing all markets...</span>
                                        </div>
                                    ) : (
                                        <>
                                            {isSymbolsOverviewVisible && (
                                                <div className='symbols-overview'>
                                                    <div className='overview-header'>
                                                        <div className='header-title'>
                                                            <span>Market Analysis ({o5u4Analysis.readySymbols.length}/12 ready)</span>
                                                            {isAutoO5U4Active && (
                                                                <div className='live-indicator'>
                                                                    <div className='live-dot'></div>
                                                                    <span>LIVE</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className='header-actions'>
                                                            {o5u4Analysis.bestSymbol && (
                                                                <span className='best-symbol'>Best: {o5u4Analysis.bestSymbol}</span>
                                                            )}
                                                            <button 
                                                                className='symbols-overview-toggle'
                                                                onClick={toggleSymbolsOverview}
                                                                title={isSymbolsOverviewVisible ? 'Hide overview' : 'Show overview'}
                                                            >
                                                                <svg 
                                                                    width='16' 
                                                                    height='16' 
                                                                    viewBox='0 0 24 24' 
                                                                    fill='none'
                                                                    stroke='currentColor' 
                                                                    strokeWidth='2'
                                                                >
                                                                    <path d={isSymbolsOverviewVisible ? 'M18 6L6 18M6 6l12 12' : 'M3 12h18m-9-9v18'} />
                                                                </svg>
                                                            </button>
                                                            <button 
                                                                className='symbols-grid-toggle'
                                                                onClick={toggleSymbolsGrid}
                                                                title={isSymbolsGridVisible ? 'Hide symbols grid' : 'Show symbols grid'}
                                                            >
                                                            <svg 
                                                                width='16' 
                                                                height='16' 
                                                                viewBox='0 0 24 24' 
                                                                fill='none'
                                                                className={`toggle-icon ${isSymbolsGridVisible ? 'expanded' : 'collapsed'}`}
                                                            >
                                                                <path 
                                                                    d='M7 10L12 15L17 10' 
                                                                    stroke='currentColor' 
                                                                    strokeWidth='2' 
                                                                    strokeLinecap='round' 
                                                                    strokeLinejoin='round'
                                                                />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className={`symbols-grid ${isSymbolsGridVisible ? '' : 'collapsed'}`}>
                                                    {availableSymbols.map(symbol => {
                                                        const analysis = o5u4Analysis.symbolsAnalysis[symbol];
                                                        const isBest = symbol === o5u4Analysis.bestSymbol;
                                                        return (
                                                            <div key={symbol} className={`symbol-status ${analysis?.ready ? 'ready' : 'loading'} ${analysis?.meetsConditions ? 'meets-conditions' : ''} ${isBest ? 'best' : ''}`}>
                                                                <div className='symbol-name'>{symbol}</div>
                                                                <div className='symbol-info'>
                                                                    {analysis?.ready ? (
                                                                        <>
                                                                            <div className='digit-info'>
                                                                                <span>Last: {analysis.lastDigit}</span>
                                                                            </div>
                                                                            <div className={`condition-indicator ${analysis.meetsConditions ? 'met' : 'not-met'}`}>
                                                                                {analysis.meetsConditions ? '✓' : '✗'}
                                                                            </div>
                                                                        </>
                                                                    ) : (
                                                                        <div className='loading-indicator'>...</div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            )}

                                            {o5u4Analysis.bestSymbol && (
                                                <div className='best-symbol-details'>
                                                    <div className='details-header'>
                                                        <span>Trading Opportunity: {o5u4Analysis.bestSymbol}</span>
                                                    </div>
                                                    <div className='details-content'>
                                                        <div className='detail-item'>
                                                            <span>Conditions:</span>
                                                            <span className='success-text'>All Met ✓</span>
                                                        </div>
                                                        <div className='detail-item'>
                                                            <span>Score:</span>
                                                            <strong>{o5u4Analysis.symbolsAnalysis[o5u4Analysis.bestSymbol]?.score?.toFixed(1) || 'N/A'}</strong>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {!o5u4Analysis.bestSymbol && o5u4Analysis.readySymbols.length > 0 && (
                                                <div className='no-opportunities'>
                                                    <span className='warning-text'>No trading opportunities found</span>
                                                    
                                                </div>
                                            )}

                                            {!isSymbolsOverviewVisible && (
                                                <div className='overview-collapsed'>
                                                    <button 
                                                        className='show-overview-btn'
                                                        onClick={toggleSymbolsOverview}
                                                        title='Show market analysis'
                                                    >
                                                        <svg width='14' height='14' viewBox='0 0 24 24' fill='none'>
                                                            <path d='M7 14l5-5 5 5' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'/>
                                                        </svg>
                                                        <span>Market Analysis</span>
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className='card-footer'>
                            <button
                                className={`strategy-toggle ${isAutoO5U4Active ? 'active' : ''}`}
                                onClick={toggleAutoO5U4}
                                disabled={cardsTradingState.o5u4}
                            >
                                {isAutoO5U4Active ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                                className={`card-run-btn ${cardsTradingState.o5u4 ? 'stop' : 'start'} ${!isAutoO5U4Active ? 'disabled' : ''}`}
                                onClick={handleCardRunO5U4}
                                disabled={!isAutoO5U4Active}
                                title={cardsTradingState.o5u4 ? 'Stop trading' : 'Start trading'}
                            >
                                <div className='run-btn-content'>
                                    <svg viewBox='0 0 24 24' width='16' height='16'>
                                        {cardsTradingState.o5u4 ? (
                                            <>
                                                <rect x='6' y='4' width='4' height='16' fill='currentColor' />
                                                <rect x='14' y='4' width='4' height='16' fill='currentColor' />
                                            </>
                                        ) : (
                                            <polygon points='5,3 19,12 5,21' fill='currentColor' />
                                        )}
                                    </svg>
                                    <span>{cardsTradingState.o5u4 ? 'STOP' : 'RUN'}</span>
                                </div>
                            </button>
                        </div>
                    </div>

                    <div className={`strategy-card ${isAutoMatchesActive ? 'active' : ''}`}>
                        <div className='card-header'>
                            <div className='strategy-icon'>
                                <svg viewBox='0 0 24 24' width='24' height='24'>
                                    <path
                                        d='M3 3h18v2H3z'
                                        fill='currentColor'
                                        opacity='0.7'
                                    />
                                    <path
                                        d='M6 8h3v3H6zM11 8h3v3h-3zM16 8h3v3h-3z'
                                        fill='currentColor'
                                    />
                                    <path
                                        d='M6 13h3v3H6zM16 13h3v3h-3z'
                                        fill='currentColor'
                                        opacity='0.8'
                                    />
                                    <text x='7.5' y='10' fontSize='3' fill='white' fontWeight='bold'>5</text>
                                    <text x='12.5' y='10' fontSize='3' fill='white' fontWeight='bold'>1</text>
                                    <text x='17.5' y='10' fontSize='3' fill='white' fontWeight='bold'>7</text>
                                    <text x='7.5' y='15' fontSize='3' fill='white' fontWeight='bold'>3</text>
                                    <text x='17.5' y='15' fontSize='3' fill='white' fontWeight='bold'>9</text>
                                </svg>
                            </div>
                            <div className='strategy-title'>
                                <h4>Matches</h4>
                                <p>Digit Frequency Strategy</p>
                            </div>
                            <div className={`strategy-status ${isAutoMatchesActive ? 'on' : 'off'}`}>
                                {isAutoMatchesActive ? 'ON' : 'OFF'}
                            </div>
                        </div>
                        <div className='card-content'>
                            <p>Analyzes 500 ticks across all volatility symbols to identify the 5 most frequent digits, then executes simultaneous DIGITMATCH trades.</p>
                            
                            {isAutoMatchesActive && (
                                <div className='matches-info'>
                                    {matchesAnalysis.readySymbols.length === 0 ? (
                                        <div className='no-analysis'>
                                            <div className='loading-indicator'>
                                                <div className='spinner'></div>
                                                <span className='info-text'>Analyzing 15 volatility symbols...</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            {isSymbolsOverviewVisible && (
                                                <div className='symbols-overview'>
                                                    <div className='overview-header'>
                                                        <div className='header-title'>
                                                            <span>Frequency Analysis ({matchesAnalysis.readySymbols.length}/5 symbols ready)</span>
                                                            {isAutoMatchesActive && (
                                                                <div className='live-indicator'>
                                                                    <div className='live-dot'></div>
                                                                    <span>LIVE</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                        <div className='header-actions'>
                                                            {matchesAnalysis.bestSymbol && (
                                                                <span className='best-symbol'>Best: {matchesAnalysis.bestSymbol}</span>
                                                            )}
                                                            {matchesAnalysis.readySymbols.length > 0 && (
                                                                <span className='ready-count'>{matchesAnalysis.readySymbols.length} Ready</span>
                                                            )}
                                                            <button 
                                                                className='symbols-overview-toggle'
                                                                onClick={toggleSymbolsOverview}
                                                                title={isSymbolsOverviewVisible ? 'Hide overview' : 'Show overview'}
                                                            >
                                                                <svg 
                                                                    width='16' 
                                                                    height='16' 
                                                                    viewBox='0 0 24 24' 
                                                                    fill='none'
                                                                    stroke='currentColor' 
                                                                    strokeWidth='2'
                                                                >
                                                                    <path d={isSymbolsOverviewVisible ? 'M18 6L6 18M6 6l12 12' : 'M3 12h18m-9-9v18'} />
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                
                                                    <div className='symbols-grid'>
                                                        {availableSymbols.map(symbol => {
                                                        const isReady = matchesAnalysis.readySymbols.includes(symbol);
                                                        const topDigits = matchesAnalysis.topDigits[symbol] || [];
                                                        const frequencies = matchesAnalysis.digitFrequencies[symbol] || {};
                                                        const isBest = symbol === matchesAnalysis.bestSymbol;
                                                        const totalFreq = matchesAnalysis.symbolTotalFrequencies?.[symbol] || 0;
                                                        
                                                        return (
                                                            <div key={symbol} className={`symbol-status ${isReady ? 'ready' : 'loading'} ${topDigits.length === 5 ? 'complete' : ''} ${isBest ? 'best' : ''}`}>
                                                                <div className='symbol-name'>
                                                                    {symbol}
                                                                    {isBest && <span className='best-indicator'>★</span>}
                                                                </div>
                                                                <div className='symbol-info'>
                                                                    {isReady && topDigits.length === 5 ? (
                                                                        <>
                                                                            <div className='top-digits-preview'>
                                                                                {topDigits.slice(0, 3).map((digit) => (
                                                                                    <span key={digit} className='digit-mini'>
                                                                                        {digit}
                                                                                    </span>
                                                                                ))}
                                                                                {topDigits.length > 3 && <span className='more'>+{topDigits.length - 3}</span>}
                                                                            </div>
                                                                            {totalFreq > 0 && (
                                                                                <div className='total-frequency'>
                                                                                    Total: {totalFreq.toFixed(2)}%
                                                                                </div>
                                                                            )}
                                                                        </>
                                                                    ) : isReady ? (
                                                                        <div className='processing-indicator'>Processing...</div>
                                                                    ) : (
                                                                        <div className='loading-indicator'>...</div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            )}

                                            {matchesAnalysis.readySymbols.length > 0 && matchesAnalysis.bestSymbol && (
                                                <div className='trading-readiness'>
                                                    {(() => {
                                                        const bestSymbol = matchesAnalysis.bestSymbol;
                                                        const isReady = matchesAnalysis.readySymbols.includes(bestSymbol) && 
                                                                        matchesAnalysis.topDigits[bestSymbol]?.length === 5;
                                                        
                                                        if (isReady) {
                                                            const topDigits = matchesAnalysis.topDigits[bestSymbol];
                                                            const totalFreq = matchesAnalysis.symbolTotalFrequencies?.[bestSymbol] || 0;
                                                            return (
                                                                <div className='ready-to-trade'>
                                                                    <div className='readiness-header'>
                                                                        <span className='success-text'>Best Market Ready: {bestSymbol} ⭐</span>
                                                                        <span className='frequency-badge'>Total Freq: {totalFreq.toFixed(2)}%</span>
                                                                    </div>
                                                                    <div className='trade-preview'>
                                                                        <div className='preview-item'>
                                                                            <span>Top 5 Frequent Digits:</span>
                                                                            <div className='digit-list'>
                                                                                {topDigits.map((digit, index) => {
                                                                                    const freq = matchesAnalysis.digitFrequencies[bestSymbol]?.[digit] || 0;
                                                                                    return (
                                                                                        <span key={digit} className={`digit-badge ${index === 0 ? 'highest' : ''}`}>
                                                                                            {digit} ({freq})
                                                                                        </span>
                                                                                    );
                                                                                })}
                                                                            </div>
                                                                        </div>
                                                                        <div className='preview-item'>
                                                                            <span>Strategy:</span>
                                                                            <span className='strategy-text'>5 simultaneous DIGITMATCH trades on {bestSymbol}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        } else {
                                                            return (
                                                                <div className='analysis-progress'>
                                                                    <span>Best market ({bestSymbol}) analysis in progress...</span>
                                                                </div>
                                                            );
                                                        }
                                                    })()}
                                                </div>
                                            )}

                                            {!isSymbolsOverviewVisible && (
                                                <div className='overview-collapsed'>
                                                    <button 
                                                        className='show-overview-btn'
                                                        onClick={toggleSymbolsOverview}
                                                        title='Show frequency analysis'
                                                    >
                                                        <svg width='14' height='14' viewBox='0 0 24 24' fill='none'>
                                                            <path d='M7 14l5-5 5 5' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round'/>
                                                        </svg>
                                                        <span>Frequency Analysis</span>
                                                    </button>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className='card-footer'>
                            <button
                                className={`strategy-toggle ${isAutoMatchesActive ? 'active' : ''}`}
                                onClick={toggleAutoMatches}
                                disabled={cardsTradingState.matches}
                            >
                                {isAutoMatchesActive ? 'Deactivate' : 'Activate'}
                            </button>
                            <button
                                className={`card-run-btn ${cardsTradingState.matches ? 'stop' : 'start'} ${!isAutoMatchesActive ? 'disabled' : ''}`}
                                onClick={handleCardRunMatches}
                                disabled={!isAutoMatchesActive}
                                title={cardsTradingState.matches ? 'Stop trading' : 'Start trading'}
                            >
                                <div className='run-btn-content'>
                                    <svg viewBox='0 0 24 24' width='16' height='16'>
                                        {cardsTradingState.matches ? (
                                            <>
                                                <rect x='6' y='4' width='4' height='16' fill='currentColor' />
                                                <rect x='14' y='4' width='4' height='16' fill='currentColor' />
                                            </>
                                        ) : (
                                            <polygon points='5,3 19,12 5,21' fill='currentColor' />
                                        )}
                                    </svg>
                                    <span>{cardsTradingState.matches ? 'STOP' : 'RUN'}</span>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Stats Dashboard */}
                <div className='stats-dashboard'>
                    {(winCount > 0 || lossCount > 0) && (
                        <div className='stats-grid'>
                            <div className='stat-card wins'>
                                <div className='stat-icon'>
                                    <svg viewBox='0 0 24 24' width='20' height='20'>
                                        <path
                                            d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'
                                            fill='currentColor'
                                        />
                                    </svg>
                                </div>
                                <div className='stat-content'>
                                    <span className='stat-value'>{winCount}</span>
                                    <span className='stat-label'>Wins</span>
                                </div>
                            </div>

                            <div className='stat-card losses'>
                                <div className='stat-icon'>
                                    <svg viewBox='0 0 24 24' width='20' height='20'>
                                        <path
                                            d='M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'
                                            fill='currentColor'
                                        />
                                    </svg>
                                </div>
                                <div className='stat-content'>
                                    <span className='stat-value'>{lossCount}</span>
                                    <span className='stat-label'>Losses</span>
                                </div>
                            </div>

                            <div className='stat-card winrate'>
                                <div className='stat-icon'>
                                    <svg viewBox='0 0 24 24' width='20' height='20'>
                                        <path
                                            d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z'
                                            fill='currentColor'
                                        />
                                    </svg>
                                </div>
                                <div className='stat-content'>
                                    <span className='stat-value'>
                                        {winCount + lossCount > 0
                                            ? Math.round((winCount / (winCount + lossCount)) * 100)
                                            : 0}
                                        %
                                    </span>
                                    <span className='stat-label'>Win Rate</span>
                                </div>
                            </div>

                            {consecutiveLosses > 0 && (
                                <div className='stat-card martingale'>
                                    <div className='stat-icon'>
                                        <svg viewBox='0 0 24 24' width='20' height='20'>
                                            <path
                                                d='M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z'
                                                fill='currentColor'
                                            />
                                        </svg>
                                    </div>
                                    <div className='stat-content'>
                                        <span className='stat-value'>{consecutiveLosses}</span>
                                        <span className='stat-label'>Martingale</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {lastTradeResult && (
                        <div className={`last-trade-result ${lastTradeResult.toLowerCase()}`}>
                            <div className='result-icon'>
                                {lastTradeResult === 'WIN' ? (
                                    <svg viewBox='0 0 24 24' width='16' height='16'>
                                        <path
                                            d='M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z'
                                            fill='currentColor'
                                        />
                                    </svg>
                                ) : (
                                    <svg viewBox='0 0 24 24' width='16' height='16'>
                                        <path
                                            d='M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'
                                            fill='currentColor'
                                        />
                                    </svg>
                                )}
                            </div>
                            <span>Last Trade: {lastTradeResult}</span>
                        </div>
                    )}
                </div>

                {/* AI Analysis Info */}
                {isAutoOverUnderActive && isAnalysisReady && (
                    <div className='analysis-info'>
                        <div className='analysis-header'>
                            <div className='ai-badge'>
                                <svg viewBox='0 0 24 24' width='16' height='16'>
                                    <path
                                        d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z'
                                        fill='currentColor'
                                    />
                                    <path d='M8 12l2 2 4-4' fill='white' />
                                </svg>
                                AI Analysis
                            </div>
                            <span className='analysis-time'>
                                {analysisCount} analyses • Last: {lastAnalysisTime || 'N/A'}
                            </span>
                        </div>
                        <div className='analysis-details'>
                            <div className='detail-item'>
                                <span>Most Frequent Digit:</span>
                                <strong>{recommendation?.mostFrequentDigit}</strong>
                            </div>
                            <div className='detail-item'>
                                <span>Current Last Digit:</span>
                                <strong>{recommendation?.currentLastDigit}</strong>
                            </div>
                            <div className='detail-item'>
                                <span>Total Trades:</span>
                                <strong>{tradeCount}</strong>
                                {isTradeInProgress && (
                                    <span className='trade-lock'>
                                        <div className='lock-icon'>🔒</div>
                                        Trade in progress
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TradingHubDisplay;
