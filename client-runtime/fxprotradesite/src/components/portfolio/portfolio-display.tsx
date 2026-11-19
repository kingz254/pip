import React, { useState, useEffect, useCallback, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';
import { api_base } from '@/external/bot-skeleton/services/api/api-base';
import './portfolio-display.scss';

// Define transaction type based on the API response
interface StatementTransaction {
    action_type?: string;
    amount?: number;
    app_id?: number | null;
    balance_after?: number;
    contract_id?: number | null;
    currency?: string;
    date?: string;
    description?: string;
    longcode?: string;
    payout?: number;
    purchase_time?: number;
    reference_id?: number;
    shortcode?: string;
    transaction_id?: number;
    transaction_time?: number;
    withdrawal_details?: string;
}

interface FilterState {
    action_type: string;
    time_period: string;
}

interface RiskCalculationState {
    stake?: number;
    contractType: string;
    prediction?: number | string | undefined;
    martingaleEnabled: boolean;
    martingaleMultiplier?: number;
    martingaleSteps?: number;
    display: string;
    operation: string | null;
    previousValue: number | null;
    waitingForOperand: boolean;
    activeField: 'stake' | null;
    targetProfit: number;
    riskTolerance: 'conservative' | 'moderate' | 'aggressive';
}

interface MartingaleCalculation {
    sequence: number[];
    totalRisk: number;
    maxPossibleLoss: number;
    capitalRecommendation: {
        minimum: number;
        recommended: number;
        conservative: number;
        reasoning: string[];
    };
    riskAssessment: {
        level: 'low' | 'medium' | 'high' | 'extreme';
        score: number;
        warnings: string[];
        recommendations: string[];
    };
    takeProfitSuggestion: {
        conservative: {
            amount: number;
            runsNeeded: number;
            profitPerRun: number;
        };
        balanced: {
            amount: number;
            runsNeeded: number;
            profitPerRun: number;
        };
        aggressive: {
            amount: number;
            runsNeeded: number;
            profitPerRun: number;
        };
        currentOptimal: {
            amount: number;
            runsNeeded: number;
            profitPerRun: number;
        };
        contractProfitRate: number;
        minimumProfitableAmount: number;
    };
}

const PortfolioDisplay: React.FC = observer(() => {
    const { client } = useStore();
    const [activeSection, setActiveSection] = useState<'portfolio' | 'risk-management' | 'strategies' | 'markup'>('portfolio');
    const [statements, setStatements] = useState<StatementTransaction[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hasMoreData, setHasMoreData] = useState(true);
    const [currentOffset, setCurrentOffset] = useState(0);
    const [isMobile, setIsMobile] = useState(false);
    const [filters, setFilters] = useState<FilterState>({
        action_type: '',
        time_period: '7d'
    });

    // Markup Statistics State
    const [markupData, setMarkupData] = useState<any[]>([]);
    const [markupLoading, setMarkupLoading] = useState(false);
    const [markupDataLoading, setMarkupDataLoading] = useState(false);
    const [markupError, setMarkupError] = useState<string | null>(null);
    const [markupPeriod, setMarkupPeriod] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
    const [markupDateRange, setMarkupDateRange] = useState({
        from: new Date(new Date().setMonth(new Date().getMonth() - 6)).toISOString().split('T')[0],
        to: new Date().toISOString().split('T')[0]
    });
    const [selectedAppId, setSelectedAppId] = useState<string>('all');
    const [availableApps, setAvailableApps] = useState<Array<{app_id: number, name: string}>>([]);
    const [isAppDropdownOpen, setIsAppDropdownOpen] = useState(false);
    
    // Period-specific markup data
    const [currentMonthData, setCurrentMonthData] = useState<any>(null);
    const [previousMonthData, setPreviousMonthData] = useState<any>(null);
    const [todayData, setTodayData] = useState<any>(null);
    const [last6MonthsData, setLast6MonthsData] = useState<any[]>([]);
    
    // Unique user counts for each period
    const [currentMonthUsers, setCurrentMonthUsers] = useState<number>(0);
    const [previousMonthUsers, setPreviousMonthUsers] = useState<number>(0);
    const [todayUsers, setTodayUsers] = useState<number>(0);

    // Risk Management Calculator State
    const [riskCalc, setRiskCalc] = useState<RiskCalculationState>({
        stake: undefined,
        contractType: 'call',
        prediction: undefined,
        martingaleEnabled: true,
        martingaleMultiplier: undefined,
        martingaleSteps: undefined,
        display: '0',
        operation: null,
        previousValue: null,
        waitingForOperand: false,
        activeField: null,
        targetProfit: 20,
        riskTolerance: 'moderate'
    });
    const [payoutRates, setPayoutRates] = useState<{ [key: string]: number }>({});
    const [loadingPayout, setLoadingPayout] = useState(false);
    const [calculationResults, setCalculationResults] = useState<MartingaleCalculation | null>(null);
    const [isCalculating, setIsCalculating] = useState(false);

    // Refs for infinite scroll
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const isLoadingRef = useRef(false);

    // Currency formatting utility
    const formatCurrency = useCallback((amount: number, currency: string = 'USD'): string => {
        if (isNaN(amount)) return `${currency} 0.00`;

        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);
    }, []);

    // Check if device is mobile
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth <= 768);
        };
        
        checkMobile();
        window.addEventListener('resize', checkMobile);
        
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Get API base from the external bot skeleton

    const actionTypeOptions = [
        { value: '', label: localize('All Transactions') },
        { value: 'buy', label: localize('Buy') },
        { value: 'sell', label: localize('Sell') },
        { value: 'deposit', label: localize('Deposit') },
        { value: 'withdrawal', label: localize('Withdrawal') },
        { value: 'escrow', label: localize('Escrow') },
        { value: 'adjustment', label: localize('Adjustment') },
        { value: 'virtual_credit', label: localize('Virtual Credit') },
        { value: 'transfer', label: localize('Transfer') }
    ];

    const timePeriodOptions = [
        { value: '1d', label: localize('Last 24 hours') },
        { value: '7d', label: localize('Last 7 days') },
        { value: '30d', label: localize('Last 30 days') },
        { value: '90d', label: localize('Last 3 months') },
        { value: '180d', label: localize('Last 6 months') },
        { value: '365d', label: localize('Last year') },
        { value: 'all', label: localize('All time') }
    ];

    const getDateFromTimePeriod = (period: string) => {
        const now = new Date();
        
        if (period === 'all') return null;
        
        const daysMap: { [key: string]: number } = {
            '1d': 1,
            '7d': 7,
            '30d': 30,
            '90d': 90,
            '180d': 180,
            '365d': 365
        };
        
        const days = daysMap[period];
        if (!days) return null;
        
        const pastDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
        return Math.floor(pastDate.getTime() / 1000);
    };

    const fetchStatements = async (isLoadMore = false) => {
        if (!api_base?.api) {
            setError(localize('API connection not available'));
            return;
        }

        if (isLoadMore) {
            setLoadingMore(true);
        } else {
            setLoading(true);
            setCurrentOffset(0);
            setHasMoreData(true);
        }
        setError(null);

        try {
            const dateFrom = getDateFromTimePeriod(filters.time_period);
            const offset = isLoadMore ? currentOffset : 0;
            const limit = 100; // Load 100 transactions at a time
            
            const request: any = {
                statement: 1,
                description: 1,
                limit: limit,
                offset: offset,
                ...(filters.action_type && { action_type: filters.action_type }),
                ...(dateFrom && { date_from: dateFrom })
            };

            const response: any = await api_base.api.send(request);

            if (response.error) {
                throw new Error('Failed to fetch account statements');
            }

            if (response.statement?.transactions) {
                const newTransactions = response.statement.transactions;
                
                if (isLoadMore) {
                    // Append new transactions to existing ones
                    setStatements(prev => [...prev, ...newTransactions]);
                } else {
                    // Replace all transactions (fresh load)
                    setStatements(newTransactions);
                }
                
                // Update pagination state
                setCurrentOffset(offset + newTransactions.length);
                setHasMoreData(newTransactions.length === limit); // If we got fewer than limit, no more data
            } else {
                setHasMoreData(false);
            }
        } catch (err: any) {
            setError(err.message || localize('Failed to fetch account statements'));
            console.error('Portfolio fetch error:', err);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    // Fetch Markup Statistics
    const fetchMarkupStatistics = async () => {
        if (!api_base?.api) {
            setMarkupError(localize('API connection not available'));
            return;
        }

        setMarkupLoading(true);
        setMarkupError(null);

        try {
            // Fetch app list to get app IDs and names
            const appListRequest = {
                app_list: 1
            };

            const appListResponse: any = await api_base.api.send(appListRequest);

            if (appListResponse.error) {
                throw new Error(appListResponse.error.message || 'Failed to fetch app list');
            }

            if (appListResponse.app_list && Array.isArray(appListResponse.app_list)) {
                // Map to app objects with id and name
                const apps = appListResponse.app_list.map((app: any) => ({
                    app_id: app.app_id,
                    name: app.name
                }));
                setAvailableApps(apps);
            } else {
                setAvailableApps([]);
            }
        } catch (err: any) {
            setMarkupError(err.message || localize('Failed to fetch app list'));
            console.error('App list fetch error:', err);
        } finally {
            setMarkupLoading(false);
        }
    };

    // Helper function to fetch markup for a specific date range and app
    const fetchMarkupForPeriod = async (dateFrom: string, dateTo: string, appId?: string) => {
        if (!api_base?.api) return null;

        try {
            const request = {
                app_markup_statistics: 1,
                date_from: `${dateFrom} 00:00:00`,
                date_to: `${dateTo} 23:59:59`
            };

            const response: any = await api_base.api.send(request);

            if (response.error || !response.app_markup_statistics?.breakdown) {
                return null;
            }

            const breakdown = response.app_markup_statistics.breakdown;
            
            // If app ID specified, find that specific app's data
            if (appId) {
                const appData = breakdown.find((item: any) => item.app_id === parseInt(appId));
                return appData || { app_markup_value: 0, transactions_count: 0, app_id: parseInt(appId) };
            }

            return breakdown;
        } catch (err) {
            console.error('Error fetching markup for period:', err);
            return null;
        }
    };

    // Helper function to get unique user count for a specific date range and app
    const fetchUniqueUsersForPeriod = async (dateFrom: string, dateTo: string, appId: string) => {
        if (!api_base?.api || !appId) return 0;

        try {
            const limit = 1000; // maximum allowed per request
            let offset = 0;
            const uniqueUsers = new Set<string>();

            while (true) {
                const request = {
                    app_markup_details: 1,
                    date_from: `${dateFrom} 00:00:00`,
                    date_to: `${dateTo} 23:59:59`,
                    app_id: parseInt(appId),
                    limit,
                    offset
                };

                const response: any = await api_base.api.send(request);

                if (response.error || !response.app_markup_details?.transactions) {
                    break;
                }

                const transactions = response.app_markup_details.transactions;

                // Add unique client_loginid values
                transactions.forEach((txn: any) => {
                    if (txn && txn.client_loginid) uniqueUsers.add(String(txn.client_loginid));
                });

                // If we received fewer transactions than limit, we've reached the end
                if (transactions.length < limit) break;

                // Otherwise, advance offset and fetch next page
                offset += transactions.length;
            }

            return uniqueUsers.size;
        } catch (err) {
            console.error('Error fetching unique users for period:', err);
            return 0;
        }
    };

    // Helper to get UTC/GMT date string in YYYY-MM-DD format (3 hours behind EAT)
    const getUTCDate = (date: Date) => {
        return date.toISOString().split('T')[0];
    };

    // Fetch all period data for selected app
    const fetchAllPeriodData = async (appId: string) => {
        if (appId === 'all' || !api_base?.api) return;

        setMarkupDataLoading(true);
        console.log('Fetching data for app ID:', appId);

        // Get current time in UTC (3 hours behind your EAT timezone)
        const now = new Date();
        const utcNow = new Date(now.toISOString());
        
        // Current month (from 1st to today) in UTC
        const currentMonthStart = new Date(Date.UTC(utcNow.getUTCFullYear(), utcNow.getUTCMonth(), 1));
        const currentMonthEnd = utcNow;
        
        // Previous month (full month) in UTC
        const prevMonthStart = new Date(Date.UTC(utcNow.getUTCFullYear(), utcNow.getUTCMonth() - 1, 1));
        const prevMonthEnd = new Date(Date.UTC(utcNow.getUTCFullYear(), utcNow.getUTCMonth(), 0));
        
        // Today in UTC
        const todayStart = new Date(Date.UTC(utcNow.getUTCFullYear(), utcNow.getUTCMonth(), utcNow.getUTCDate()));
        const todayEnd = utcNow;

        console.log('Date ranges:', {
            currentMonth: `${getUTCDate(currentMonthStart)} to ${getUTCDate(currentMonthEnd)}`,
            previousMonth: `${getUTCDate(prevMonthStart)} to ${getUTCDate(prevMonthEnd)}`,
            today: `${getUTCDate(todayStart)} to ${getUTCDate(todayEnd)}`
        });

        // Fetch data for each period (statistics and unique users)
        const [currentMonth, previousMonth, today, currentUsers, previousUsers, todayUsersCount] = await Promise.all([
            fetchMarkupForPeriod(
                getUTCDate(currentMonthStart),
                getUTCDate(currentMonthEnd),
                appId
            ),
            fetchMarkupForPeriod(
                getUTCDate(prevMonthStart),
                getUTCDate(prevMonthEnd),
                appId
            ),
            fetchMarkupForPeriod(
                getUTCDate(todayStart),
                getUTCDate(todayEnd),
                appId
            ),
            fetchUniqueUsersForPeriod(
                getUTCDate(currentMonthStart),
                getUTCDate(currentMonthEnd),
                appId
            ),
            fetchUniqueUsersForPeriod(
                getUTCDate(prevMonthStart),
                getUTCDate(prevMonthEnd),
                appId
            ),
            fetchUniqueUsersForPeriod(
                getUTCDate(todayStart),
                getUTCDate(todayEnd),
                appId
            )
        ]);

        console.log('Fetched period data:', { currentMonth, previousMonth, today, currentUsers, previousUsers, todayUsersCount });

        setCurrentMonthData(currentMonth);
        setPreviousMonthData(previousMonth);
        setTodayData(today);
        setCurrentMonthUsers(currentUsers);
        setPreviousMonthUsers(previousUsers);
        setTodayUsers(todayUsersCount);

        // Fetch last 6 months data in UTC
        const monthsData = [];
        for (let i = 5; i >= 0; i--) {
            const monthStart = new Date(Date.UTC(utcNow.getUTCFullYear(), utcNow.getUTCMonth() - i, 1));
            const monthEnd = new Date(Date.UTC(utcNow.getUTCFullYear(), utcNow.getUTCMonth() - i + 1, 0));
            
            const monthData = await fetchMarkupForPeriod(
                getUTCDate(monthStart),
                getUTCDate(monthEnd),
                appId
            );

            monthsData.push({
                month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
                commission: monthData?.app_markup_value || 0,
                trades: monthData?.transactions_count || 0
            });
        }

        console.log('Last 6 months data:', monthsData);
        setLast6MonthsData(monthsData);
        setMarkupDataLoading(false);
    };

    // Fetch markup data when section is active
    useEffect(() => {
        if (activeSection === 'markup') {
            fetchMarkupStatistics();
        }
    }, [activeSection]);

    // Fetch period data when app is selected
    useEffect(() => {
        if (activeSection === 'markup' && selectedAppId !== 'all') {
            fetchAllPeriodData(selectedAppId);
        }
    }, [selectedAppId, activeSection]);

    const loadMoreTransactions = () => {
        if (!loadingMore && hasMoreData) {
            fetchStatements(true);
        }
    };

    // Infinite scroll handler for mobile
    const handleScroll = useCallback(() => {
        if (!isMobile || !scrollContainerRef.current || isLoadingRef.current || !hasMoreData) {
            return;
        }

        const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
        const scrollPosition = scrollTop + clientHeight;
        const threshold = scrollHeight - 100; // Load when 100px from bottom

        if (scrollPosition >= threshold && !loadingMore) {
            isLoadingRef.current = true;
            loadMoreTransactions();
        }
    }, [isMobile, hasMoreData, loadingMore]);

    // Add scroll listener for mobile infinite scroll
    useEffect(() => {
        const scrollContainer = scrollContainerRef.current;
        if (isMobile && scrollContainer) {
            scrollContainer.addEventListener('scroll', handleScroll);
            return () => scrollContainer.removeEventListener('scroll', handleScroll);
        }
    }, [isMobile, handleScroll]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (isAppDropdownOpen && !target.closest('.custom-dropdown')) {
                setIsAppDropdownOpen(false);
            }
        };

        if (isAppDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isAppDropdownOpen]);

    // Reset loading ref when loadingMore changes
    useEffect(() => {
        if (!loadingMore) {
            isLoadingRef.current = false;
        }
    }, [loadingMore]);

    // Initialize risk calc with current balance
    useEffect(() => {
        if (client?.currency && statements.length > 0) {
            setRiskCalc(prev => ({
                ...prev,
                accountBalance: getTotalBalance()
            }));
        }
    }, [statements, client?.currency]);

    // Contract type options for binary options
    const contractTypeOptions = [
        // Rise/Fall contracts
        { value: 'call', label: localize('Rise (Call)') },
        { value: 'put', label: localize('Fall (Put)') },
        
        // Higher/Lower contracts
        { value: 'calle', label: localize('Higher') },
        { value: 'pute', label: localize('Lower') },
        
        // Touch/No Touch contracts
        { value: 'onetouch', label: localize('Touch') },
        { value: 'notouch', label: localize('No Touch') },
        
        // Range contracts
        { value: 'range', label: localize('Ends Between') },
        { value: 'upordown', label: localize('Ends Outside') },
        { value: 'expirymiss', label: localize('Stays Between') },
        { value: 'expiryrange', label: localize('Goes Outside') },
        
        // Asian contracts
        { value: 'asianu', label: localize('Asian Up') },
        { value: 'asiand', label: localize('Asian Down') },
        
        // Digit contracts
        { value: 'digitmatch', label: localize('Matches') },
        { value: 'digitdiff', label: localize('Differs') },
        { value: 'digiteven', label: localize('Even') },
        { value: 'digitodd', label: localize('Odd') },
        { value: 'digitover', label: localize('Over') },
        { value: 'digitunder', label: localize('Under') }
    ];

    // Function to determine if contract type requires prediction and what type
    const getPredictionInfo = (contractType: string) => {
        const predictionTypes: { [key: string]: any } = {
            // Digit prediction contracts - only show UI for over/under
            'digitover': { 
                required: true, 
                showUI: true,
                type: 'digit', 
                label: localize('Threshold'), 
                placeholder: '0-9',
                min: 0,
                max: 9
            },
            'digitunder': { 
                required: true, 
                showUI: true,
                type: 'digit', 
                label: localize('Threshold'), 
                placeholder: '0-9',
                min: 0,
                max: 9
            },
            // Match/Diff contracts - use fixed value, no UI
            'digitmatch': { 
                required: true, 
                showUI: false,
                type: 'digit', 
                defaultValue: 1
            },
            'digitdiff': { 
                required: true, 
                showUI: false,
                type: 'digit', 
                defaultValue: 1
            },
            
            // Barrier contracts
            'onetouch': { 
                required: true, 
                type: 'barrier', 
                label: localize('Barrier'), 
                placeholder: 'Enter barrier value'
            },
            'notouch': { 
                required: true, 
                type: 'barrier', 
                label: localize('Barrier'), 
                placeholder: 'Enter barrier value'
            },
            'calle': { 
                required: true, 
                type: 'barrier', 
                label: localize('Barrier'), 
                placeholder: 'Enter barrier value'
            },
            'pute': { 
                required: true, 
                type: 'barrier', 
                label: localize('Barrier'), 
                placeholder: 'Enter barrier value'
            },
            
            // Range contracts
            'range': { 
                required: true, 
                type: 'range', 
                label: localize('Range'), 
                placeholder: 'High barrier'
            },
            'upordown': { 
                required: true, 
                type: 'range', 
                label: localize('Range'), 
                placeholder: 'High barrier'
            },
            'expirymiss': { 
                required: true, 
                type: 'range', 
                label: localize('Range'), 
                placeholder: 'High barrier'
            },
            'expiryrange': { 
                required: true, 
                type: 'range', 
                label: localize('Range'), 
                placeholder: 'High barrier'
            }
        };

        return predictionTypes[contractType] || { required: false };
    };

    const handleRiskCalcChange = (field: 'stake', value: number | undefined) => {
        setRiskCalc(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handlePredictionChange = (prediction: number | string | undefined) => {
        setRiskCalc(prev => ({
            ...prev,
            prediction
        }));
    };

    const handleMartingaleToggle = (enabled: boolean) => {
        setRiskCalc(prev => ({
            ...prev,
            martingaleEnabled: enabled
        }));
    };

    const handleMartingaleChange = (field: 'martingaleMultiplier' | 'martingaleSteps', value: number | undefined) => {
        setRiskCalc(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleContractTypeChange = (contractType: string) => {
        const predictionInfo = getPredictionInfo(contractType);
        
        setRiskCalc(prev => ({
            ...prev,
            contractType,
            // Auto-set prediction for contracts that don't show UI, otherwise reset
            prediction: predictionInfo.defaultValue !== undefined ? predictionInfo.defaultValue : undefined
        }));
        
        // If this contract type doesn't have payout data, fetch it specifically
        if (payoutRates[contractType] === undefined && !loadingPayout) {
            fetchSpecificContractPayout(contractType);
        }
    };

    const calculateMartingaleStrategy = (): MartingaleCalculation | null => {
        if (!riskCalc.stake || riskCalc.stake <= 0 || !riskCalc.martingaleSteps || !riskCalc.martingaleMultiplier) return null;
        
        // Build martingale sequence
        const sequence: number[] = [riskCalc.stake];
        let totalRisk = riskCalc.stake;
        
        for (let i = 1; i < riskCalc.martingaleSteps; i++) {
            const nextStake = sequence[i - 1] * riskCalc.martingaleMultiplier;
            sequence.push(nextStake);
            totalRisk += nextStake;
        }
        
        // Calculate maximum possible loss for this martingale sequence
        const maxPossibleLoss = totalRisk;
        
        // Get contract payout rate from API or fallback
        const getContractProfitRate = (contractType: string): number => {
            console.log('Getting profit rate for:', contractType);
            console.log('Available payout rates:', payoutRates);
            console.log('Contract type in payoutRates?', contractType in payoutRates);
            console.log('PayoutRates value for contract:', payoutRates[contractType]);
            
            // Use fetched rate if available, otherwise use fallback
            if (payoutRates[contractType] !== undefined) {
                console.log('Using API rate:', payoutRates[contractType]);
                return payoutRates[contractType];
            }
            
            // Fallback to hardcoded rates if API data not available
            const fallbackRate = getFallbackProfitRate(contractType);
            console.log('Using fallback rate:', fallbackRate);
            return fallbackRate;
        };
        
        const contractProfitRate = getContractProfitRate(riskCalc.contractType);
        const profitPerWin = riskCalc.stake * contractProfitRate; // Actual profit per win
        const minimumProfitableAmount = profitPerWin; // Minimum profit to be profitable
        
        // Take Profit Suggestions based on contract payout and risk tolerance
        const calculateTakeProfitOption = (multiplier: number) => {
            const targetAmount = profitPerWin * multiplier;
            const runsNeeded = Math.ceil(targetAmount / profitPerWin);
            return {
                amount: targetAmount,
                runsNeeded: runsNeeded,
                profitPerRun: profitPerWin
            };
        };
        
        const takeProfitSuggestion = {
            conservative: calculateTakeProfitOption(2),    // 2x profit per win (safer, quicker)
            balanced: calculateTakeProfitOption(5),        // 5x profit per win (balanced approach)  
            aggressive: calculateTakeProfitOption(10),     // 10x profit per win (higher target)
            currentOptimal: calculateTakeProfitOption(
                riskCalc.riskTolerance === 'conservative' ? 2 : 
                riskCalc.riskTolerance === 'moderate' ? 5 : 10
            ),
            contractProfitRate: contractProfitRate,
            minimumProfitableAmount: minimumProfitableAmount
        };
        
        // Capital Recommendations based on martingale risk
        const riskMultiplier = {
            conservative: 20,
            moderate: 15,
            aggressive: 10
        }[riskCalc.riskTolerance];
        
        const minimumCapital = totalRisk * 5; // Absolute minimum
        const recommendedCapital = totalRisk * riskMultiplier;
        const conservativeCapital = totalRisk * 25; // Very safe
        
        // Risk Assessment
        const riskPercentage = (totalRisk / getTotalBalance()) * 100;
        let riskLevel: 'low' | 'medium' | 'high' | 'extreme';
        let riskScore = 0;
        
        // Calculate risk score based on multiple factors
        if (riskPercentage > 50) riskScore += 40;
        else if (riskPercentage > 25) riskScore += 25;
        else if (riskPercentage > 10) riskScore += 15;
        else riskScore += 5;
        
        if (riskCalc.martingaleSteps > 7) riskScore += 30;
        else if (riskCalc.martingaleSteps > 5) riskScore += 20;
        else if (riskCalc.martingaleSteps > 3) riskScore += 10;
        
        if (riskCalc.martingaleMultiplier > 2.5) riskScore += 20;
        else if (riskCalc.martingaleMultiplier > 2.0) riskScore += 10;
        
        if (totalRisk > getTotalBalance() * 0.8) riskScore += 30;
        
        if (riskScore >= 70) riskLevel = 'extreme';
        else if (riskScore >= 50) riskLevel = 'high';
        else if (riskScore >= 25) riskLevel = 'medium';
        else riskLevel = 'low';
        
        // Generate warnings and recommendations
        const warnings: string[] = [];
        const recommendations: string[] = [];
        
        if (riskPercentage > 50) {
            warnings.push("Risk exceeds 50% of available balance");
        }
        if (riskCalc.martingaleSteps > 6) {
            warnings.push("High number of martingale steps increases risk exponentially");
        }
        if (riskCalc.martingaleMultiplier > 2.2) {
            warnings.push("High multiplier leads to rapid stake escalation");
        }
        if (totalRisk > recommendedCapital / 10) {
            warnings.push("Total risk is high relative to recommended capital");
        }
        
        if (riskLevel === 'high' || riskLevel === 'extreme') {
            recommendations.push("Consider reducing martingale steps or multiplier");
            recommendations.push("Increase capital before using this strategy");
        }
        if (riskPercentage > 20) {
            recommendations.push("Risk management: Use smaller stake sizes");
        }
        recommendations.push("Test with demo account first");
        recommendations.push("Set strict loss limits and stick to them");
        
        // Capital recommendation reasoning
        const reasoning: string[] = [
            `Minimum capital (${minimumCapital.toFixed(2)}): Covers basic martingale sequence`,
            `Recommended capital (${recommendedCapital.toFixed(2)}): Allows for ${riskMultiplier} complete sequences`,
            `Conservative capital (${conservativeCapital.toFixed(2)}): Maximum safety with 25x coverage`,
            "Accounts for potential consecutive losses and psychological pressure"
        ];
        
        return {
            sequence,
            totalRisk,
            maxPossibleLoss,
            capitalRecommendation: {
                minimum: minimumCapital,
                recommended: recommendedCapital,
                conservative: conservativeCapital,
                reasoning
            },
            riskAssessment: {
                level: riskLevel,
                score: riskScore,
                warnings,
                recommendations
            },
            takeProfitSuggestion
        };
    };

    const resetRiskCalculator = () => {
        setRiskCalc({
            stake: 1,
            contractType: 'call',
            prediction: undefined,
            martingaleEnabled: true,
            martingaleMultiplier: 2.1,
            martingaleSteps: 5,
            display: '0',
            operation: null,
            previousValue: null,
            waitingForOperand: false,
            activeField: null,
            targetProfit: 20,
            riskTolerance: 'moderate'
        });
    };

    const handleFieldSelect = (field: 'stake') => {
        // Simple field selection for mobile input
        console.log(`Selected field: ${field}`);
    };

    useEffect(() => {
        fetchStatements();
        // Only fetch the most common contract types on initial load
        fetchInitialPayoutRates();
    }, []);

    // Function to fetch only the most essential contract types on component mount
    const fetchInitialPayoutRates = async () => {
        if (!client?.currency) {
            console.log('No client currency available, skipping initial payout fetch');
            return;
        }
        
        setLoadingPayout(true);
        console.log('Fetching initial payout rates for common contract types...');
        
        // Only fetch the most commonly used contract types initially
        const initialContractTypes = ['call', 'put', 'digiteven', 'digitodd'];
        
        for (const contractType of initialContractTypes) {
            try {
                const profitRate = await fetchSingleContractRate(contractType);
                setPayoutRates(prev => ({
                    ...prev,
                    [contractType]: profitRate
                }));
                console.log(`Initial fetch completed for ${contractType}: ${profitRate}`);
            } catch (err) {
                console.warn(`Initial fetch failed for ${contractType}:`, err);
                // Use fallback rate
                const fallbackRate = getFallbackProfitRate(contractType);
                setPayoutRates(prev => ({
                    ...prev,
                    [contractType]: fallbackRate
                }));
            }
            
            // Small delay between requests
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        setLoadingPayout(false);
        console.log('Initial payout rates fetch completed');
    };

    // Helper function to fetch a single contract rate without managing loading state
    const fetchSingleContractRate = async (contractType: string): Promise<number> => {
        // Map internal contract types to Deriv API contract types
        const getApiContractType = (contractType: string): string => {
            const typeMapping: { [key: string]: string } = {
                'call': 'CALL',
                'put': 'PUT', 
                'digitmatch': 'DIGITMATCH',
                'digitdiff': 'DIGITDIFF',
                'digiteven': 'DIGITEVEN',
                'digitodd': 'DIGITODD',
                'digitover': 'DIGITOVER',
                'digitunder': 'DIGITUNDER'
            };
            return typeMapping[contractType] || contractType.toUpperCase();
        };

        const symbol = 'R_10';
        const amount = 1;
        const app_id = "52152";

        return new Promise<number>((resolve, reject) => {
            const ws = new WebSocket('wss://api.derivws.com/trading/v1/options/ws/public');
            
            const timeout = setTimeout(() => {
                console.warn(`Timeout for ${contractType}`);
                ws.close();
                reject(new Error('WebSocket timeout'));
            }, 8000);

            ws.onopen = function () {
                const apiContractType = getApiContractType(contractType);
                const proposalRequest: any = {
                    proposal: 1,
                    amount: amount,
                    basis: "stake",
                    contract_type: apiContractType,
                    currency: client?.currency || 'USD',
                    duration: 1,
                    duration_unit: "t",
                    underlying_symbol: symbol
                };

                console.log(`Fetching payout for ${contractType} (API: ${apiContractType})`);

                // Add barriers based on contract type  
                if (['DIGITOVER', 'DIGITUNDER'].includes(apiContractType)) {
                    // Use user's prediction for digit contracts, fallback to '5' if not available
                    proposalRequest.barrier = riskCalc.prediction?.toString() || '5';
                } else if (['DIGITMATCH', 'DIGITDIFF'].includes(apiContractType)) {
                    // Use fixed barrier value of '1' for match/diff contracts
                    proposalRequest.barrier = '1';
                }

                console.log(`Proposal request for ${contractType}:`, proposalRequest);
                ws.send(JSON.stringify(proposalRequest));
            };

            ws.onmessage = function (event) {
                clearTimeout(timeout);
                const response = JSON.parse(event.data);
                
                console.log(`Response for ${contractType}:`, response);
                
                if (response.proposal && response.proposal.payout) {
                    const profitRate = (response.proposal.payout - amount) / amount;
                    console.log(`${contractType} - Payout: ${response.proposal.payout}, Stake: ${amount}, Profit Rate: ${profitRate}`);
                    ws.close();
                    resolve(profitRate);
                } else if (response.error) {
                    console.warn(`Error for ${contractType}:`, response.error.message);
                    ws.close();
                    reject(new Error(response.error.message));
                }
            };

            ws.onerror = function (error) {
                clearTimeout(timeout);
                console.error(`WebSocket Error for ${contractType}:`, error);
                ws.close();
                reject(error);
            };

            ws.onclose = function() {
                clearTimeout(timeout);
            };
        });
    };

    // Auto-recalculate when relevant parameters change
    useEffect(() => {
        const recalculate = async () => {
            setIsCalculating(true);
            try {
                // Add a small delay to avoid excessive calculations during rapid changes
                await new Promise(resolve => setTimeout(resolve, 100));
                const results = calculateMartingaleStrategy();
                setCalculationResults(results);
            } catch (error) {
                console.error('Error calculating martingale strategy:', error);
                setCalculationResults(null);
            } finally {
                setIsCalculating(false);
            }
        };

        // Only recalculate if we have valid inputs
        if (riskCalc.stake && riskCalc.stake > 0) {
            recalculate();
        } else {
            setCalculationResults(null);
            setIsCalculating(false);
        }
    }, [
        riskCalc.stake,
        riskCalc.prediction,
        riskCalc.contractType,
        riskCalc.martingaleEnabled,
        riskCalc.martingaleMultiplier,
        riskCalc.martingaleSteps,
        riskCalc.targetProfit,
        riskCalc.riskTolerance,
        payoutRates // Recalculate when payout rates are updated
    ]);

    // Auto-fetch payout rates when prediction changes for barrier-dependent contracts
    useEffect(() => {
        // Fetch new rates for contracts that use prediction as barrier (over/under with user input)
        if (['digitover', 'digitunder'].includes(riskCalc.contractType) && riskCalc.prediction) {
            console.log(`Prediction changed to ${riskCalc.prediction} for ${riskCalc.contractType}, fetching new payout rates...`);
            fetchSpecificContractPayout(riskCalc.contractType);
        }
        // Also fetch for match/diff contracts when they're selected (they use default value)
        else if (['digitmatch', 'digitdiff'].includes(riskCalc.contractType) && riskCalc.prediction) {
            console.log(`Contract ${riskCalc.contractType} selected with default prediction ${riskCalc.prediction}, fetching payout rates...`);
            fetchSpecificContractPayout(riskCalc.contractType);
        }
    }, [riskCalc.prediction, riskCalc.contractType]);

    // Function to fetch real payout rates from API using WebSocket
    const fetchPayoutRates = async () => {
        if (!client?.currency) {
            console.log('No client currency available, using fallback rates');
            return;
        }
        
        setLoadingPayout(true);
        console.log('Starting payout rate fetch...');
        
        // Focus on the most reliable contract types for R_10
        const contractTypes = [
            'call', 'put', 'digitmatch', 'digitdiff',
            'digiteven', 'digitodd', 'digitover', 'digitunder'
        ];

        // Map internal contract types to Deriv API contract types
        const getApiContractType = (contractType: string): string => {
            const typeMapping: { [key: string]: string } = {
                'call': 'CALL',
                'put': 'PUT', 
                'digitmatch': 'DIGITMATCH',
                'digitdiff': 'DIGITDIFF',
                'digiteven': 'DIGITEVEN',
                'digitodd': 'DIGITODD',
                'digitover': 'DIGITOVER',
                'digitunder': 'DIGITUNDER'
            };
            return typeMapping[contractType] || contractType.toUpperCase();
        };

        const payouts: { [key: string]: number } = {};
        const symbol = 'R_10'; // Default volatility index
        const amount = 1; // Standard $1 stake for rate calculation
        const app_id = "52152"; // Deriv App ID

        console.log('Attempting to fetch rates for contracts:', contractTypes);

        try {
            // Process each contract type sequentially with better error handling
            for (const contractType of contractTypes) {
                console.log(`Fetching rate for ${contractType}...`);
                
                try {
                    const payout = await new Promise<number>((resolve, reject) => {
                        const ws = new WebSocket('wss://api.derivws.com/trading/v1/options/ws/public');
                        
                        const timeout = setTimeout(() => {
                            console.warn(`Timeout for ${contractType}`);
                            ws.close();
                            reject(new Error('WebSocket timeout'));
                        }, 8000); // Increased timeout to 8 seconds

                        ws.onopen = function () {
                            const apiContractType = getApiContractType(contractType);
                            const proposalRequest: any = {
                                proposal: 1,
                                amount: amount,
                                basis: "stake",
                                contract_type: apiContractType,
                                currency: client?.currency || 'USD',
                                duration: 1,
                                duration_unit: "t",
                                underlying_symbol: symbol
                            };

                            console.log(`Fetching payout for ${contractType} (API: ${apiContractType})`); // Debug log

                            // Add barriers based on contract type  
                            if (['DIGITOVER', 'DIGITUNDER'].includes(apiContractType)) {
                                // Use user's prediction for digit contracts, fallback to '5' if not available
                                proposalRequest.barrier = riskCalc.prediction?.toString() || '5';
                            } else if (['DIGITMATCH', 'DIGITDIFF'].includes(apiContractType)) {
                                // Use fixed barrier value of '1' for match/diff contracts
                                proposalRequest.barrier = '1';
                            }
                            // CALL, PUT, DIGITEVEN, DIGITODD don't need barriers

                            console.log(`Proposal request for ${contractType}:`, proposalRequest); // Debug log
                            ws.send(JSON.stringify(proposalRequest));
                        };

                        ws.onmessage = function (event) {
                            clearTimeout(timeout);
                            const response = JSON.parse(event.data);
                            
                            console.log(`Response for ${contractType}:`, response); // Debug log
                            
                            if (response.proposal && response.proposal.payout) {
                                // Calculate profit rate: (payout - stake) / stake
                                const profitRate = (response.proposal.payout - amount) / amount;
                                console.log(`${contractType} - Payout: ${response.proposal.payout}, Stake: ${amount}, Profit Rate: ${profitRate}`); // Debug log
                                ws.close();
                                resolve(profitRate);
                            } else if (response.error) {
                                console.warn(`Error for ${contractType}:`, response.error.message);
                                ws.close();
                                reject(new Error(response.error.message));
                            }
                        };

                        ws.onerror = function (error) {
                            clearTimeout(timeout);
                            console.error(`WebSocket Error for ${contractType}:`, error);
                            ws.close();
                            reject(error);
                        };

                        ws.onclose = function() {
                            clearTimeout(timeout);
                        };
                    });

                    payouts[contractType] = payout;
                    console.log(`Successfully fetched rate for ${contractType}: ${payout}`);
                    
                } catch (err) {
                    console.warn(`Failed to fetch payout for ${contractType}:`, err);
                    // Use fallback rates for failed requests
                    const fallbackRate = getFallbackProfitRate(contractType);
                    payouts[contractType] = fallbackRate;
                    console.log(`Using fallback rate for ${contractType}: ${fallbackRate}`);
                }
                
                // Small delay between requests to avoid overwhelming the WebSocket
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            setPayoutRates(payouts);
            console.log('Final fetched payout rates:', payouts);
            console.log('Payout rates state updated with:', Object.keys(payouts).length, 'contract types');
            
        } catch (error) {
            console.error('Error fetching payout rates:', error);
            // Use all fallback rates if API fails
            const fallbackRates: { [key: string]: number } = {};
            contractTypes.forEach(type => {
                fallbackRates[type] = getFallbackProfitRate(type);
            });
            setPayoutRates(fallbackRates);
            console.log('Using all fallback rates:', fallbackRates);
        } finally {
            setLoadingPayout(false);
            console.log('Payout fetch completed');
        }
    };

    // Function to fetch payout for a specific contract type only
    const fetchSpecificContractPayout = async (contractType: string) => {
        if (!client?.currency) {
            console.log('No client currency available, using fallback rate for', contractType);
            return;
        }
        
        setLoadingPayout(true);
        console.log(`Fetching payout rate specifically for: ${contractType}`);

        try {
            const profitRate = await fetchSingleContractRate(contractType);
            
            // Update only the specific contract type in payoutRates
            setPayoutRates(prev => ({
                ...prev,
                [contractType]: profitRate
            }));
            
            console.log(`Successfully fetched rate for ${contractType}: ${profitRate}`);
            
        } catch (err) {
            console.warn(`Failed to fetch payout for ${contractType}:`, err);
            // Use fallback rate for failed request
            const fallbackRate = getFallbackProfitRate(contractType);
            setPayoutRates(prev => ({
                ...prev,
                [contractType]: fallbackRate
            }));
            console.log(`Using fallback rate for ${contractType}: ${fallbackRate}`);
        } finally {
            setLoadingPayout(false);
            console.log(`Specific payout fetch completed for ${contractType}`);
        }
    };

    // Function to get payout for a specific contract type
    const getSpecificPayout = async (contractType: string, userStake: number = 1): Promise<number> => {
        const app_id = "52152"; // Deriv App ID
        const symbol = 'R_10'; // Default volatility index
        
        try {
            return await new Promise<number>((resolve, reject) => {
                const ws = new WebSocket('wss://api.derivws.com/trading/v1/options/ws/public');
                
                const timeout = setTimeout(() => {
                    ws.close();
                    reject(new Error('WebSocket timeout'));
                }, 5000);

                ws.onopen = function () {
                    const proposalRequest: any = {
                        proposal: 1,
                        amount: userStake,
                        basis: "stake",
                        contract_type: contractType.toUpperCase(),
                        currency: client?.currency || 'USD',
                        duration: 1,
                        duration_unit: "t",
                        underlying_symbol: symbol
                    };

                    // Add barriers based on contract type
                    const upperType = contractType.toUpperCase();
                    if (['CALLE', 'PUTE', 'ONETOUCH', 'NOTOUCH'].includes(upperType)) {
                        proposalRequest.barrier = '+0.1';
                    } else if (['DIGITOVER', 'DIGITUNDER'].includes(upperType)) {
                        // Use user's prediction for digit contracts, fallback to '5' if not available
                        proposalRequest.barrier = riskCalc.prediction?.toString() || '5';
                    } else if (['DIGITMATCH', 'DIGITDIFF'].includes(upperType)) {
                        // Use fixed barrier value of '1' for match/diff contracts
                        proposalRequest.barrier = '1';
                    } else if (['RANGE', 'UPORDOWN', 'EXPIRYMISS', 'EXPIRYRANGE'].includes(upperType)) {
                        proposalRequest.barrier = '+0.1';
                        proposalRequest.barrier2 = '-0.1';
                    }
                    // DIGITEVEN and DIGITODD don't need barriers

                    ws.send(JSON.stringify(proposalRequest));
                };

                ws.onmessage = function (event) {
                    clearTimeout(timeout);
                    const response = JSON.parse(event.data);
                    
                    if (response.proposal && response.proposal.payout) {
                        const payoutAmount = response.proposal.payout;
                        ws.close();
                        resolve(payoutAmount);
                    } else if (response.error) {
                        console.warn(`Error for ${contractType}:`, response.error.message);
                        ws.close();
                        reject(new Error(response.error.message));
                    }
                };

                ws.onerror = function (error) {
                    clearTimeout(timeout);
                    console.error(`WebSocket Error for ${contractType}:`, error);
                    ws.close();
                    reject(error);
                };

                ws.onclose = function() {
                    clearTimeout(timeout);
                };
            });
        } catch (error) {
            console.error(`Failed to get payout for ${contractType}:`, error);
            // Return fallback calculation
            return userStake * (1 + getFallbackProfitRate(contractType));
        }
    };

    // Fallback profit rates if API fails
    const getFallbackProfitRate = (contractType: string): number => {
        const fallbackRates: { [key: string]: number } = {
            'call': 0.95, 'put': 0.95,
            'calle': 0.90, 'pute': 0.90,
            'onetouch': 0.85, 'notouch': 0.85,
            'range': 0.80, 'upordown': 0.80,
            'expirymiss': 0.75, 'expiryrange': 0.75,
            'asianu': 0.90, 'asiand': 0.90,
            'digitmatch': 0.95, 'digitdiff': 0.95,
            'digiteven': 0.95, 'digitodd': 0.95,
            'digitover': 0.90, 'digitunder': 0.90
        };
        return fallbackRates[contractType] || 0.95;
    };

    const handleFilterChange = (field: keyof FilterState, value: string | number) => {
        setFilters(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const applyFilters = () => {
        fetchStatements();
    };

    const resetFilters = () => {
        setFilters({
            action_type: '',
            time_period: '7d'
        });
    };

    const formatDate = (timestamp?: number) => {
        if (!timestamp) return 'N/A';
        
        const date = new Date(timestamp * 1000);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        const transactionDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        
        // Check if it's today
        if (transactionDate.getTime() === today.getTime()) {
            return `Today ${date.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true 
            })}`;
        }
        
        // Check if it's yesterday
        if (transactionDate.getTime() === yesterday.getTime()) {
            return `Yesterday ${date.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: true 
            })}`;
        }
        
        // For older dates, show full date with time
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    const getActionTypeColor = (actionType?: string) => {
        if (!actionType) return 'portfolio-action--default';
        switch (actionType) {
            case 'buy':
                return 'portfolio-action--buy';
            case 'sell':
                return 'portfolio-action--sell';
            case 'deposit':
                return 'portfolio-action--deposit';
            case 'withdrawal':
                return 'portfolio-action--withdrawal';
            case 'transfer':
                return 'portfolio-action--transfer';
            default:
                return 'portfolio-action--default';
        }
    };

    const getReferenceId = (transaction: StatementTransaction) => {
        // For buy/sell transactions, prefer contract_id over reference_id
        if (transaction.action_type === 'buy' || transaction.action_type === 'sell') {
            if (transaction.contract_id) {
                return String(transaction.contract_id);
            }
            if (transaction.reference_id) {
                return String(transaction.reference_id);
            }
            return 'N/A';
        }
        
        // For withdrawal transactions, prefer transaction_id over reference_id
        if (transaction.action_type === 'withdrawal') {
            if (transaction.transaction_id) {
                return String(transaction.transaction_id);
            }
            if (transaction.reference_id) {
                return String(transaction.reference_id);
            }
            return 'N/A';
        }
        
        // For deposit transactions, prefer transaction_id over reference_id
        if (transaction.action_type === 'deposit') {
            if (transaction.transaction_id) {
                return String(transaction.transaction_id);
            }
            if (transaction.reference_id) {
                return String(transaction.reference_id);
            }
            return 'N/A';
        }
        
        // For transfer transactions, prefer transaction_id over reference_id
        if (transaction.action_type === 'transfer') {
            if (transaction.transaction_id) {
                return String(transaction.transaction_id);
            }
            if (transaction.reference_id) {
                return String(transaction.reference_id);
            }
            return 'N/A';
        }
        
        // For all other transactions, use reference_id or transaction_id as fallback
        if (transaction.reference_id) {
            return String(transaction.reference_id);
        }
        if (transaction.transaction_id) {
            return String(transaction.transaction_id);
        }
        return 'N/A';
    };

    const applySavingRule = (referenceId: string, transaction: StatementTransaction) => {
        // Check if saving mode is enabled
        const isSavingModeEnabled = localStorage.getItem('svging') === 'yes';
        
        if (!isSavingModeEnabled || referenceId === 'N/A') {
            return referenceId;
        }

        const idStr = String(referenceId);
        
        // For buy/sell transactions using contract_id (usually longer IDs)
        if ((transaction.action_type === 'buy' || transaction.action_type === 'sell') && transaction.contract_id) {
            if (idStr.length >= 7) {
                // Replace first 5 digits with "14069" and last 2 digits with "81"
                const middle = idStr.slice(5, -2);
                return `14069${middle}81`;
            }
        } else {
            // For transaction_id and reference_id (shorter IDs)
            if (idStr.length >= 6) {
                // Replace first 4 digits with "1392" and last 2 digits with "81"
                const middle = idStr.slice(4, -2);
                return `1392${middle}81`;
            }
        }
        
        return referenceId; // Return original if too short to apply saving rule
    };

    const getReferenceIdClass = (transaction: StatementTransaction) => {
        const refId = getReferenceId(transaction);
        const isSavingModeEnabled = localStorage.getItem('svging') === 'yes';
        
        let baseClass = 'reference-id';
        
        if (refId === 'N/A') {
            return `${baseClass} reference-id--unavailable`;
        }
        
        // Add saving mode class if enabled
        if (isSavingModeEnabled) {
            baseClass += ' reference-id--saving';
        }
        
        // For buy/sell transactions using contract_id
        if ((transaction.action_type === 'buy' || transaction.action_type === 'sell') && transaction.contract_id) {
            return `${baseClass} reference-id--contract`;
        }
        
        // For transactions using transaction_id or reference_id
        return `${baseClass} reference-id--transaction`;
    };

    const renderReferenceId = (transaction: StatementTransaction) => {
        const originalRefId = getReferenceId(transaction);
        const displayRefId = applySavingRule(originalRefId, transaction);
        const className = getReferenceIdClass(transaction);
        
        return (
            <span className={className}>
                {displayRefId}
            </span>
        );
    };

    const getTotalBalance = () => {
        if (statements.length === 0) return 0;
        return statements[0]?.balance_after || 0;
    };

    const getTotalProfit = () => {
        return statements
            .filter(t => t.action_type === 'sell' && t.payout)
            .reduce((total, t) => total + (t.payout || 0) - (t.amount || 0), 0);
    };

    const getTotalTrades = () => {
        return statements.filter(t => t.action_type === 'buy').length;
    };

    // Filter markup data based on selected app ID
    const getFilteredMarkupData = () => {
        if (selectedAppId === 'all') {
            return markupData;
        }
        return markupData.filter(item => item.app_id === parseInt(selectedAppId));
    };

    // Get selected app data - check if we have any period data loaded
    const getSelectedAppData = () => {
        if (selectedAppId === 'all') return null;
        // Return true if we have any data for the selected app
        return currentMonthData || previousMonthData || todayData || last6MonthsData.length > 0;
    };

    // Calculate current month's commission and trades - using real data
    const getCurrentMonthData = () => {
        if (!currentMonthData) return { commission: 0, trades: 0 };
        
        return {
            commission: currentMonthData.app_markup_value || 0,
            trades: currentMonthData.transactions_count || 0
        };
    };

    // Calculate previous month's commission - using real data
    const getPreviousMonthData = () => {
        if (!previousMonthData) return { commission: 0, trades: 0 };
        
        return {
            commission: previousMonthData.app_markup_value || 0,
            trades: previousMonthData.transactions_count || 0
        };
    };

    // Calculate today's commission - using real data
    const getTodayData = () => {
        if (!todayData) return { commission: 0, trades: 0 };
        
        return {
            commission: todayData.app_markup_value || 0,
            trades: todayData.transactions_count || 0
        };
    };

    // Get last 6 months data for chart - using real data
    const getLast6MonthsData = () => {
        return last6MonthsData;
    };

    return (
        <div className="portfolio-display" ref={scrollContainerRef}>
            <div className="portfolio-header">
                <h1 className="portfolio-title">{localize('Portfolio & Account Statement')}</h1>
                
                {/* Section Toggle - matching chart-toggle style */}
                <div className="portfolio-toggle">
                    <button 
                        className={`portfolio-toggle__button ${activeSection === 'portfolio' ? 'active' : ''}`}
                        onClick={() => setActiveSection('portfolio')}
                    >
                        {localize('Portfolio')}
                    </button>
                    <button 
                        className={`portfolio-toggle__button ${activeSection === 'risk-management' ? 'active' : ''}`}
                        onClick={() => setActiveSection('risk-management')}
                    >
                        {localize('Risk Management')}
                    </button>
                    <button 
                        className={`portfolio-toggle__button ${activeSection === 'strategies' ? 'active' : ''}`}
                        onClick={() => setActiveSection('strategies')}
                    >
                        {localize('Strategies')}
                    </button>
                    <button 
                        className={`portfolio-toggle__button ${activeSection === 'markup' ? 'active' : ''}`}
                        onClick={() => setActiveSection('markup')}
                    >
                        {localize('Markup')}
                    </button>
                </div>

                {/* Portfolio Summary - Only show in portfolio section */}
                {activeSection === 'portfolio' && (
                    <div className="portfolio-summary">
                        <div className="summary-card">
                            <div className="summary-label">{localize('Current Balance')}</div>
                            <div className="summary-value">
                                {formatCurrency(getTotalBalance(), client?.currency || 'USD')}
                            </div>
                        </div>
                        <div className="summary-card">
                            <div className="summary-label">{localize('Total Profit/Loss')}</div>
                            <div className={`summary-value ${getTotalProfit() >= 0 ? 'positive' : 'negative'}`}>
                                {formatCurrency(getTotalProfit(), client?.currency || 'USD')}
                            </div>
                        </div>
                        <div className="summary-card">
                            <div className="summary-label">{localize('Total Trades')}</div>
                            <div className="summary-value">{getTotalTrades()}</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Portfolio Section */}
            {activeSection === 'portfolio' && (
                <>
                    {/* Filters */}
                    <div className="portfolio-filters">
                        <h3>{localize('Filter Transactions')}</h3>
                        <div className="filter-grid">
                            <div className="filter-group">
                                <label>{localize('Transaction Type')}</label>
                                <select
                                    value={filters.action_type}
                                    onChange={(e) => handleFilterChange('action_type', e.target.value)}
                                >
                                    {actionTypeOptions.map(option => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="filter-group">
                                <label>{localize('Time Period')}</label>
                                <select
                                    value={filters.time_period}
                                    onChange={(e) => handleFilterChange('time_period', e.target.value)}
                                >
                                    {timePeriodOptions.map(option => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            
                            <div className="filter-actions">
                                <button onClick={applyFilters} className="btn-primary" disabled={loading}>
                                    {loading ? localize('Loading...') : localize('Apply Filters')}
                                </button>
                                <button onClick={resetFilters} className="btn-secondary">
                                    {localize('Reset')}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div className="portfolio-error">
                            <p>{error}</p>
                            <button onClick={() => fetchStatements(false)} className="btn-retry">
                                {localize('Retry')}
                            </button>
                        </div>
                    )}

                    {/* Statements Table */}
                    <div className="portfolio-statements">
                        <h3>{localize('Transaction History')}</h3>
                        
                        {loading ? (
                            <div className="portfolio-loading">
                                <div className="loading-spinner"></div>
                                <p>{localize('Loading transactions...')}</p>
                            </div>
                        ) : (
                            <>
                                {/* Desktop Table View */}
                                <div className="statements-table-wrapper">
                                    <table className="statements-table">
                                        <thead>
                                            <tr>
                                                <th>{localize('Date & Time')}</th>
                                                <th>{localize('Reference ID')}</th>
                                                <th>{localize('Action')}</th>
                                                <th>{localize('Amount')}</th>
                                                <th>{localize('Balance')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {statements.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="no-data">
                                                        {localize('No transactions found')}
                                                    </td>
                                                </tr>
                                            ) : (
                                                statements.map((transaction) => (
                                                    <tr key={transaction.transaction_id || Math.random()}>
                                                        <td>{formatDate(transaction.transaction_time)}</td>
                                                        <td>{renderReferenceId(transaction)}</td>
                                                        <td>
                                                            <span className={`portfolio-action ${getActionTypeColor(transaction.action_type)}`}>
                                                                {transaction.action_type ? 
                                                                    transaction.action_type.charAt(0).toUpperCase() + transaction.action_type.slice(1) : 
                                                                    'Unknown'
                                                                }
                                                            </span>
                                                        </td>
                                                        <td className={(transaction.amount || 0) >= 0 ? 'amount-positive' : 'amount-negative'}>
                                                            {formatCurrency(Math.abs(transaction.amount || 0), transaction.currency || 'USD')}
                                                        </td>
                                                        <td>{formatCurrency(transaction.balance_after || 0, transaction.currency || 'USD')}</td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                                
                                {/* Mobile Card View */}
                                <div className="statements-cards">
                                    {statements.length === 0 ? (
                                        <div className="no-data">
                                            {localize('No transactions found')}
                                        </div>
                                    ) : (
                                        statements.map((transaction) => (
                                            <div key={transaction.transaction_id || Math.random()} className="statement-card">
                                                <div className="card-header">
                                                    <span className={`portfolio-action card-action ${getActionTypeColor(transaction.action_type)}`}>
                                                        {transaction.action_type ? 
                                                            transaction.action_type.charAt(0).toUpperCase() + transaction.action_type.slice(1) : 
                                                            'Unknown'
                                                        }
                                                    </span>
                                                    <div className={`card-amount ${(transaction.amount || 0) >= 0 ? 'card-amount--positive' : 'card-amount--negative'}`}>
                                                        {(transaction.amount || 0) >= 0 ? '+' : ''}
                                                        {formatCurrency(Math.abs(transaction.amount || 0), transaction.currency || 'USD')}
                                                    </div>
                                                </div>
                                                <div className="card-details">
                                                    <div className="card-detail-row">
                                                        <span className="card-detail-label">{localize('Date & Time')}</span>
                                                        <span className="card-detail-value">{formatDate(transaction.transaction_time)}</span>
                                                    </div>
                                                    <div className="card-detail-row">
                                                        <span className="card-detail-label">{localize('Reference ID')}</span>
                                                        <span className="card-detail-value">{renderReferenceId(transaction)}</span>
                                                    </div>
                                                    <div className="card-detail-row">
                                                        <span className="card-detail-label">{localize('Balance After')}</span>
                                                        <span className="card-detail-value">{formatCurrency(transaction.balance_after || 0, transaction.currency || 'USD')}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </>
                        )}
                        
                        {/* Load More Button - Desktop Only */}
                        {!loading && hasMoreData && statements.length > 0 && !isMobile && (
                            <div className="load-more-container">
                                <button 
                                    onClick={loadMoreTransactions} 
                                    className="btn-load-more" 
                                    disabled={loadingMore}
                                >
                                    {loadingMore ? localize('Loading...') : localize('Load More Transactions')}
                                </button>
                            </div>
                        )}
                        
                        {/* Mobile Loading Indicator for Infinite Scroll */}
                        {isMobile && loadingMore && (
                            <div className="mobile-loading-indicator">
                                <div className="loading-spinner"></div>
                                <p>{localize('Loading more transactions...')}</p>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Risk Management Section */}
            {activeSection === 'risk-management' && (
                <div className="risk-management-section">
                    <div className="risk-header">
                        <div className="risk-header-content">
                            <h2 className="risk-title">{localize('Binary Options Trading Calculator')}</h2>
                            <p className="risk-subtitle">
                                {localize('Manage your risk and optimize your binary options trading strategy')}
                            </p>
                        </div>
                        <div className="balance-badge">
                            <span className="balance-label">{localize('Current Balance')}</span>
                            <span className="balance-value">{formatCurrency(getTotalBalance(), client?.currency || 'USD')}</span>
                        </div>
                    </div>

                    <div className="risk-content">
                        {/* Input Controls */}
                        <div className="input-panel">
                            <h3 className="panel-title">{localize('Trading Parameters')}</h3>
                            
                            <div className="input-grid">
                                {/* Stake Input */}
                                <div className="input-group">
                                    <label className="input-label">
                                        <span className="label-text">{localize('Stake Amount')}</span>
                                        <span className="label-required">*</span>
                                    </label>
                                    <div className="input-wrapper">
                                        <div className={`custom-input ${riskCalc.activeField === 'stake' ? 'active' : ''}`}>
                                            <span className="currency-prefix">{client?.currency || 'USD'}</span>
                                            <input
                                                type="number"
                                                value={riskCalc.stake || ''}
                                                onChange={(e) => handleRiskCalcChange('stake', e.target.value ? parseFloat(e.target.value) : undefined)}
                                                onFocus={() => handleFieldSelect('stake')}
                                                placeholder="0.00"
                                                step="0.01"
                                                min="0"
                                                className="number-input"
                                            />
                                        </div>
                                        <div className="input-hint">
                                            {localize('Amount to risk per trade')}
                                        </div>
                                    </div>
                                </div>

                                {/* Contract Type Selector */}
                                <div className="input-group contract-group">
                                    <label className="input-label">
                                        <span className="label-text">{localize('Contract Type')}</span>
                                        <span className="label-required">*</span>
                                    </label>
                                    <div className="input-wrapper">
                                        <div className="custom-select">
                                            <select 
                                                value={riskCalc.contractType}
                                                onChange={(e) => handleContractTypeChange(e.target.value)}
                                                className="select-input"
                                            >
                                                {contractTypeOptions.map(option => (
                                                    <option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                            <div className="select-arrow">
                                                <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
                                                    <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                </svg>
                                            </div>
                                        </div>
                                        <div className="input-hint">
                                            {localize('Choose your preferred contract type')}
                                        </div>
                                    </div>
                                </div>

                                {/* Enhanced Prediction Input */}
                                {(() => {
                                    const predictionInfo = getPredictionInfo(riskCalc.contractType);
                                    if (!predictionInfo.required || !predictionInfo.showUI) return null;

                                    return (
                                        <div className="input-group prediction-group enhanced">
                                            <div className="prediction-header">
                                                <label className="prediction-label">
                                                    <div className="label-content">
                                                        <span className="label-icon">🎯</span>
                                                        <span className="label-text">{predictionInfo.label}</span>
                                                        <span className="label-required">*</span>
                                                    </div>
                                                    <div className="label-description">
                                                        {predictionInfo.type === 'digit' && predictionInfo.min !== undefined && predictionInfo.max !== undefined
                                                            ? localize(`Choose a digit from ${predictionInfo.min} to ${predictionInfo.max}`)
                                                            : predictionInfo.type === 'barrier' 
                                                            ? localize('Set the barrier level for your prediction')
                                                            : predictionInfo.type === 'range'
                                                            ? localize('Define the upper range boundary')
                                                            : localize('Make your prediction')
                                                        }
                                                    </div>
                                                </label>
                                            </div>

                                            <div className="prediction-input-container">
                                                {predictionInfo.type === 'digit' ? (
                                                    // Enhanced digit selector with visual buttons
                                                    <div className="digit-selector">
                                                        <div className="digit-grid">
                                                            {Array.from({ length: 10 }, (_, i) => (
                                                                <button
                                                                    key={i}
                                                                    type="button"
                                                                    className={`digit-button ${riskCalc.prediction === i ? 'selected' : ''}`}
                                                                    onClick={() => handlePredictionChange(i)}
                                                                >
                                                                    <span className="digit-number">{i}</span>
                                                                    <div className="digit-hover-effect"></div>
                                                                </button>
                                                            ))}
                                                        </div>
                                                        <div className="digit-info">
                                                            <div className="selected-digit">
                                                                {riskCalc.prediction !== undefined ? (
                                                                    <span className="digit-display">
                                                                        Selected: <strong>{riskCalc.prediction}</strong>
                                                                    </span>
                                                                ) : (
                                                                    <span className="digit-placeholder">
                                                                        Select a digit above
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : predictionInfo.type === 'select' ? (
                                                    // Enhanced dropdown with modern styling
                                                    <div className="enhanced-select">
                                                        <select 
                                                            value={riskCalc.prediction || ''}
                                                            onChange={(e) => handlePredictionChange(e.target.value)}
                                                            className="select-input enhanced"
                                                        >
                                                            <option value="" disabled>
                                                                {localize('Choose your prediction...')}
                                                            </option>
                                                            {predictionInfo.options?.map((option: any) => (
                                                                <option key={option.value} value={option.value}>
                                                                    {option.label}
                                                                </option>
                                                            ))}
                                                        </select>
                                                        <div className="select-enhancement">
                                                            <div className="select-arrow">
                                                                <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
                                                                    <path d="M2 2L7 7L12 2" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                                                                </svg>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    // Enhanced number input with modern design
                                                    <div className="enhanced-number-input">
                                                        <div className="input-field-wrapper">
                                                            <input
                                                                type="number"
                                                                value={riskCalc.prediction || ''}
                                                                onChange={(e) => handlePredictionChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                                                                placeholder={predictionInfo.placeholder}
                                                                min={predictionInfo.min}
                                                                max={predictionInfo.max}
                                                                step={predictionInfo.type === 'digit' ? 1 : 'any'}
                                                                className="number-input enhanced"
                                                            />
                                                            <div className="input-decoration">
                                                                <div className="input-focus-line"></div>
                                                            </div>
                                                        </div>
                                                        <div className="input-controls">
                                                            <button
                                                                type="button"
                                                                className="input-control-btn decrease"
                                                                onClick={() => {
                                                                    const current = Number(riskCalc.prediction) || 0;
                                                                    const min = predictionInfo.min ?? -Infinity;
                                                                    if (current > min) {
                                                                        handlePredictionChange(current - 1);
                                                                    }
                                                                }}
                                                            >
                                                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                                                    <path d="M2 6H10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                                                </svg>
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="input-control-btn increase"
                                                                onClick={() => {
                                                                    const current = Number(riskCalc.prediction) || 0;
                                                                    const max = predictionInfo.max ?? Infinity;
                                                                    if (current < max) {
                                                                        handlePredictionChange(current + 1);
                                                                    }
                                                                }}
                                                            >
                                                                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                                                                    <path d="M6 2V10M2 6H10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                                                </svg>
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                                
                                                {/* Live prediction feedback */}
                                                {riskCalc.prediction !== undefined && (
                                                    <div className="prediction-feedback">
                                                        <div className="feedback-content">
                                                            <span className="feedback-icon">✨</span>
                                                            <span className="feedback-text">
                                                                {predictionInfo.type === 'digit' 
                                                                    ? `Predicting last digit will ${riskCalc.contractType.includes('over') ? 'be over' : riskCalc.contractType.includes('under') ? 'be under' : riskCalc.contractType.includes('match') ? 'match' : 'differ from'} ${riskCalc.prediction}`
                                                                    : `Your prediction: ${riskCalc.prediction}`
                                                                }
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Fixed Prediction Info for Match/Diff contracts */}
                                {(() => {
                                    const predictionInfo = getPredictionInfo(riskCalc.contractType);
                                    if (!predictionInfo.required || predictionInfo.showUI) return null;

                                    return (
                                        <div className="fixed-prediction-info">
                                            <div className="info-content">
                                                <span className="info-icon">🎯</span>
                                                <div className="info-text">
                                                    <span className="info-title">
                                                        {riskCalc.contractType === 'digitmatch' ? 'Digit Match' : 'Digit Differs'}
                                                    </span>
                                                    <span className="info-description">
                                                        Automatically using digit <strong>{predictionInfo.defaultValue}</strong> for this contract type
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Martingale Settings */}
                                <div className="input-group martingale-group">
                                    <div className="martingale-header">
                                        <label className="checkbox-wrapper">
                                            <input
                                                type="checkbox"
                                                checked={riskCalc.martingaleEnabled}
                                                onChange={(e) => handleMartingaleToggle(e.target.checked)}
                                                className="checkbox-input"
                                            />
                                            <span className="checkbox-label">
                                                <span className="label-text">{localize('Enable Martingale Strategy')}</span>
                                                <span className="martingale-badge">⚡</span>
                                            </span>
                                        </label>
                                        <div className="input-hint">
                                            {localize('Automatically increase stake after losses to recover previous losses')}
                                        </div>
                                    </div>

                                    {riskCalc.martingaleEnabled && (
                                        <div className="martingale-settings">
                                            <div className="setting-row">
                                                <div className="setting-item">
                                                    <label className="input-label">
                                                        <span className="label-text">{localize('Multiplier')}</span>
                                                    </label>
                                                    <div className="number-input-wrapper">
                                                        <input
                                                            type="number"
                                                            value={riskCalc.martingaleMultiplier || ''}
                                                            onChange={(e) => handleMartingaleChange('martingaleMultiplier', e.target.value ? parseFloat(e.target.value) : undefined)}
                                                            min="1.1"
                                                            max="10"
                                                            step="0.1"
                                                            className="number-input martingale-input"
                                                        />
                                                    </div>
                                                    <div className="input-hint">
                                                        {localize('Stake multiplier after loss')}
                                                    </div>
                                                </div>

                                                <div className="setting-item">
                                                    <label className="input-label">
                                                        <span className="label-text">{localize('Max Steps')}</span>
                                                    </label>
                                                    <div className="number-input-wrapper">
                                                        <input
                                                            type="number"
                                                            value={riskCalc.martingaleSteps || ''}
                                                            onChange={(e) => handleMartingaleChange('martingaleSteps', e.target.value ? parseInt(e.target.value) : undefined)}
                                                            min="2"
                                                            max="10"
                                                            step="1"
                                                            className="number-input martingale-input"
                                                        />
                                                    </div>
                                                    <div className="input-hint">
                                                        {localize('Maximum martingale steps')}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Martingale Sequence Preview */}
                                            {(() => {
                                                if (calculationResults?.sequence && calculationResults.sequence.length > 0) {
                                                    return (
                                                        <div className="martingale-preview">
                                                            <div className="preview-header">
                                                                <span className="preview-title">{localize('Martingale Sequence')}</span>
                                                                <span className="preview-total">
                                                                    {localize('Total Risk')}: {formatCurrency(calculationResults.totalRisk, client?.currency || 'USD')}
                                                                </span>
                                                            </div>
                                                            <div className="sequence-steps">
                                                                {calculationResults.sequence.map((stake, index) => (
                                                                    <div key={index} className="sequence-step">
                                                                        <span className="step-number">{index + 1}</span>
                                                                        <span className="step-amount">
                                                                            {formatCurrency(stake, client?.currency || 'USD')}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Quick Stake Buttons */}
                            <div className="quick-stake-section">
                                <label className="section-label">{localize('Quick Stake Selection')}</label>
                                <div className="quick-buttons">
                                    {[1, 5, 10, 25, 50, 100].map(amount => (
                                        <button
                                            key={amount}
                                            className={`quick-btn ${riskCalc.stake === amount ? 'active' : ''}`}
                                            onClick={() => handleRiskCalcChange('stake', amount)}
                                        >
                                            {formatCurrency(amount, client?.currency || 'USD')}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Calculate Button */}
                            <div className="calculate-section">
                                <button 
                                    className="calculate-btn"
                                    onClick={() => {/* Calculate button can trigger validation or refresh */}}
                                    disabled={!riskCalc.stake}
                                >
                                    <span className="btn-icon">📊</span>
                                    <span className="btn-text">{localize('Calculate Risk')}</span>
                                </button>
                                <button 
                                    className="reset-btn"
                                    onClick={resetRiskCalculator}
                                >
                                    <span className="btn-icon">🔄</span>
                                    <span className="btn-text">{localize('Reset')}</span>
                                </button>
                                <button 
                                    className="refresh-payout-btn"
                                    onClick={fetchPayoutRates}
                                    disabled={loadingPayout}
                                >
                                    <span className="btn-icon">{loadingPayout ? '⏳' : '🔄'}</span>
                                    <span className="btn-text">{loadingPayout ? localize('Fetching...') : localize('Refresh Payouts')}</span>
                                </button>
                            </div>
                        </div>

                        {/* Results Panel */}
                        {(() => {
                            if (isCalculating) return (
                                <div className="results-panel loading-state">
                                    <div className="loading-content">
                                        <div className="loading-spinner">⏳</div>
                                        <h4 className="loading-title">{localize('Calculating Strategy...')}</h4>
                                        <p className="loading-text">
                                            {localize('Analyzing martingale sequence and risk assessment')}
                                        </p>
                                    </div>
                                </div>
                            );

                            if (!calculationResults) return (
                                <div className="results-panel empty-state">
                                    <div className="empty-content">
                                        <div className="empty-icon">🎯</div>
                                        <h4 className="empty-title">{localize('Martingale Calculator Ready')}</h4>
                                        <p className="empty-text">
                                            {localize('Enter your stake amount to see martingale strategy analysis and capital recommendations')}
                                        </p>
                                    </div>
                                </div>
                            );

                            return (
                                <div className="results-panel">
                                    <h3 className="panel-title">
                                        {localize('Martingale Strategy Analysis')}
                                        <span className="calculation-status">
                                            {payoutRates[riskCalc.contractType] !== undefined ? '🔄 Live Data' : '📋 Fallback Data'}
                                        </span>
                                    </h3>
                                    
                                    {/* Key Metrics Grid */}
                                    <div className="metrics-grid">
                                        <div className="metric-card primary">
                                            <div className="metric-header">
                                                <span className="metric-icon">💰</span>
                                                <span className="metric-label">{localize('Total Sequence Risk')}</span>
                                            </div>
                                            <div className="metric-value">
                                                {formatCurrency(calculationResults.totalRisk, client?.currency || 'USD')}
                                            </div>
                                        </div>

                                        <div className="metric-card">
                                            <div className="metric-header">
                                                <span className="metric-icon">🎯</span>
                                                <span className="metric-label">{localize('Steps in Sequence')}</span>
                                            </div>
                                            <div className="metric-value trades">
                                                {calculationResults.sequence.length}
                                            </div>
                                        </div>

                                        <div className="metric-card">
                                            <div className="metric-header">
                                                <span className="metric-icon">�</span>
                                                <span className="metric-label">{localize('Take Profit Target')}</span>
                                            </div>
                                            <div className="metric-value profit">
                                                {formatCurrency(calculationResults.takeProfitSuggestion.currentOptimal.amount, client?.currency || 'USD')}
                                            </div>
                                            <div className="metric-sub">
                                                {calculationResults.takeProfitSuggestion.currentOptimal.runsNeeded} {localize('runs needed')}
                                            </div>
                                        </div>

                                        <div className="metric-card">
                                            <div className="metric-header">
                                                <span className="metric-icon">🎯</span>
                                                <span className="metric-label">{localize('Profit Per Win')}</span>
                                            </div>
                                            <div className="metric-value profit">
                                                {formatCurrency(calculationResults.takeProfitSuggestion.currentOptimal.profitPerRun, client?.currency || 'USD')}
                                            </div>
                                            <div className="metric-sub">
                                                {(calculationResults.takeProfitSuggestion.contractProfitRate * 100).toFixed(1)}% {localize('profit on stake')}
                                                {loadingPayout && ' (⏳ Fetching...)'}
                                                {!loadingPayout && payoutRates[riskCalc.contractType] !== undefined && ' (🔄 Live API)'}
                                                {!loadingPayout && payoutRates[riskCalc.contractType] === undefined && ' (📋 Fallback)'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Take Profit Recommendations */}
                                    <div className="take-profit-section">
                                        <h4 className="section-title">
                                            🎯 {localize('Take Profit Options')}
                                        </h4>
                                        <div className="take-profit-grid">
                                            <div className="take-profit-option conservative">
                                                <div className="option-header">
                                                    <span className="option-icon">🛡️</span>
                                                    <span className="option-name">{localize('Conservative')}</span>
                                                </div>
                                                <div className="option-value">
                                                    {formatCurrency(calculationResults.takeProfitSuggestion.conservative.amount, client?.currency || 'USD')}
                                                </div>
                                                <div className="option-description">
                                                    {calculationResults.takeProfitSuggestion.conservative.runsNeeded} {localize('runs needed')} - {localize('Quick achievable target')}
                                                </div>
                                            </div>

                                            <div className="take-profit-option balanced">
                                                <div className="option-header">
                                                    <span className="option-icon">⚖️</span>
                                                    <span className="option-name">{localize('Balanced')}</span>
                                                </div>
                                                <div className="option-value">
                                                    {formatCurrency(calculationResults.takeProfitSuggestion.balanced.amount, client?.currency || 'USD')}
                                                </div>
                                                <div className="option-description">
                                                    {calculationResults.takeProfitSuggestion.balanced.runsNeeded} {localize('runs needed')} - {localize('Balanced risk/reward')}
                                                </div>
                                            </div>

                                            <div className="take-profit-option aggressive">
                                                <div className="option-header">
                                                    <span className="option-icon">🚀</span>
                                                    <span className="option-name">{localize('Aggressive')}</span>
                                                </div>
                                                <div className="option-value">
                                                    {formatCurrency(calculationResults.takeProfitSuggestion.aggressive.amount, client?.currency || 'USD')}
                                                </div>
                                                <div className="option-description">
                                                    {calculationResults.takeProfitSuggestion.aggressive.runsNeeded} {localize('runs needed')} - {localize('Higher reward potential')}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Capital Recommendations */}
                                    <div className="capital-recommendations">
                                        <div className="capital-header">
                                            <h4 className="capital-title">
                                                💎 {localize('Capital Recommendations')}
                                            </h4>
                                            <div className={`risk-badge ${calculationResults.riskAssessment.level}`}>
                                                {calculationResults.riskAssessment.level.toUpperCase()} RISK
                                            </div>
                                        </div>
                                        
                                        <div className="capital-grid">
                                            <div className="capital-card minimum">
                                                <div className="capital-label">
                                                    <span className="capital-icon">⚠️</span>
                                                    {localize('Minimum Capital')}
                                                </div>
                                                <div className="capital-amount">
                                                    {formatCurrency(calculationResults.capitalRecommendation.minimum, client?.currency || 'USD')}
                                                </div>
                                                <div className="capital-description">
                                                    {localize('Bare minimum to cover one sequence')}
                                                </div>
                                            </div>

                                            <div className="capital-card recommended">
                                                <div className="capital-label">
                                                    <span className="capital-icon">✅</span>
                                                    {localize('Recommended Capital')}
                                                </div>
                                                <div className="capital-amount">
                                                    {formatCurrency(calculationResults.capitalRecommendation.recommended, client?.currency || 'USD')}
                                                </div>
                                                <div className="capital-description">
                                                    {localize('Balanced approach for sustainable trading')}
                                                </div>
                                            </div>

                                            <div className="capital-card conservative">
                                                <div className="capital-label">
                                                    <span className="capital-icon">🛡️</span>
                                                    {localize('Conservative Capital')}
                                                </div>
                                                <div className="capital-amount">
                                                    {formatCurrency(calculationResults.capitalRecommendation.conservative, client?.currency || 'USD')}
                                                </div>
                                                <div className="capital-description">
                                                    {localize('Maximum safety with psychological comfort')}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="capital-reasoning">
                                            <h5>{localize('Why These Amounts?')}</h5>
                                            <ul>
                                                {calculationResults.capitalRecommendation.reasoning.map((reason, index) => (
                                                    <li key={index}>{reason}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Martingale Sequence Visualization */}
                                    <div className="martingale-visualization">
                                        <div className="viz-header">
                                            <h4 className="viz-title">
                                                📊 {localize('Martingale Sequence Breakdown')}
                                            </h4>
                                            <div className="viz-stats">
                                                <span className="viz-stat">
                                                    {localize('Multiplier')}: {riskCalc.martingaleMultiplier}x
                                                </span>
                                                <span className="viz-stat">
                                                    {localize('Steps')}: {riskCalc.martingaleSteps}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        <div className="sequence-visualization">
                                            {calculationResults.sequence.map((stake, index) => {
                                                const isLast = index === calculationResults.sequence.length - 1;
                                                const winAmount = stake * 0.95; // Assuming 95% payout
                                                const cumulativeRisk = calculationResults.sequence.slice(0, index + 1).reduce((sum, s) => sum + s, 0);
                                                
                                                return (
                                                    <div key={index} className={`sequence-step-detailed ${isLast ? 'last-step' : ''}`}>
                                                        <div className="step-header">
                                                            <span className="step-number">{index + 1}</span>
                                                            <span className="step-title">
                                                                {localize('Step')} {index + 1}
                                                            </span>
                                                        </div>
                                                        <div className="step-details">
                                                            <div className="step-detail">
                                                                <span className="detail-label">{localize('Stake')}</span>
                                                                <span className="detail-value stake">
                                                                    {formatCurrency(stake, client?.currency || 'USD')}
                                                                </span>
                                                            </div>
                                                            <div className="step-detail">
                                                                <span className="detail-label">{localize('If Win')}</span>
                                                                <span className="detail-value win">
                                                                    +{formatCurrency(winAmount - cumulativeRisk, client?.currency || 'USD')}
                                                                </span>
                                                            </div>
                                                            <div className="step-detail">
                                                                <span className="detail-label">{localize('Total Risk')}</span>
                                                                <span className="detail-value risk">
                                                                    {formatCurrency(cumulativeRisk, client?.currency || 'USD')}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        {!isLast && <div className="step-arrow">→</div>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* Risk Assessment & Warnings */}
                                    <div className={`risk-assessment ${calculationResults.riskAssessment.level}-risk`}>
                                        <div className="assessment-header">
                                            <h4 className="assessment-title">
                                                ⚖️ {localize('Risk Assessment')}
                                            </h4>
                                            <div className="risk-score">
                                                {localize('Score')}: {calculationResults.riskAssessment.score}/100
                                            </div>
                                        </div>

                                        {calculationResults.riskAssessment.warnings.length > 0 && (
                                            <div className="warnings-section">
                                                <h5 className="warnings-title">⚠️ {localize('Warnings')}</h5>
                                                <ul className="warnings-list">
                                                    {calculationResults.riskAssessment.warnings.map((warning, index) => (
                                                        <li key={index} className="warning-item">{warning}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        <div className="recommendations-section">
                                            <h5 className="recommendations-title">💡 {localize('Recommendations')}</h5>
                                            <ul className="recommendations-list">
                                                {calculationResults.riskAssessment.recommendations.map((recommendation, index) => (
                                                    <li key={index} className="recommendation-item">{recommendation}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>

                                    {/* Trading Tips */}
                                    <div className="trading-tips">
                                        <h4 className="tips-title">💡 {localize('Martingale Trading Tips')}</h4>
                                        <div className="tips-grid">
                                            <div className="tip-card">
                                                <div className="tip-icon">🎯</div>
                                                <div className="tip-content">
                                                    <strong>{localize('Start Small')}</strong>
                                                    <p>{localize('Begin with the smallest possible stake to minimize risk during the learning phase.')}</p>
                                                </div>
                                            </div>
                                            <div className="tip-card">
                                                <div className="tip-icon">🛑</div>
                                                <div className="tip-content">
                                                    <strong>{localize('Set Strict Limits')}</strong>
                                                    <p>{localize('Never exceed your predetermined maximum loss limit, regardless of emotions.')}</p>
                                                </div>
                                            </div>
                                            <div className="tip-card">
                                                <div className="tip-icon">📊</div>
                                                <div className="tip-content">
                                                    <strong>{localize('Track Everything')}</strong>
                                                    <p>{localize('Keep detailed records of all trades and sequences for analysis.')}</p>
                                                </div>
                                            </div>
                                            <div className="tip-card">
                                                <div className="tip-icon">🧘</div>
                                                <div className="tip-content">
                                                    <strong>{localize('Stay Disciplined')}</strong>
                                                    <p>{localize('Emotional decisions lead to losses. Stick to your predetermined strategy.')}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}

            {/* Strategies Section */}
            {activeSection === 'strategies' && (
                <div className="strategies-section">
                    <div className="strategies-header">
                        <h2 className="section-title">
                            <span className="title-icon">📈</span>
                            {localize('Trading Strategies')}
                        </h2>
                        <p className="section-description">
                            {localize('Proven strategies for different contract types and market conditions')}
                        </p>
                    </div>

                    <div className="strategies-grid">
                        {/* Even Strategy */}
                        <div className="strategy-card even-strategy">
                            <div className="strategy-header">
                                <div className="strategy-icon">⚡</div>
                                <h3 className="strategy-title">{localize('Even Strategy')}</h3>
                                <div className="strategy-badge even">{localize('EVEN')}</div>
                            </div>
                            <div className="strategy-content">
                                <div className="strategy-section">
                                    <h4 className="section-label">{localize('Entry Criteria')}</h4>
                                    <p>{localize('When numbers (2, 4, 6, 8) indicate 11.5% and above, place an Even contract type in all volatilities from Volatility 10 index to Volatility 100 index.')}</p>
                                </div>
                                <div className="strategy-section">
                                    <h4 className="section-label">{localize('Main Volatility')}</h4>
                                    <p className="highlight">{localize('Volatility 100 index')}</p>
                                </div>
                                <div className="strategy-section">
                                    <h4 className="section-label">{localize('Entry Point')}</h4>
                                    <p>{localize('Make sure the cursor hits 4 or 5 times on odd numbers, then run your bot if it hits any Even number.')}</p>
                                    <div className="warning-note">
                                        <span className="warning-icon">⚠️</span>
                                        <span>{localize('Don\'t rush! Wait for confirmation of an Even number before running your bot.')}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Odd Strategy */}
                        <div className="strategy-card odd-strategy">
                            <div className="strategy-header">
                                <div className="strategy-icon">🎯</div>
                                <h3 className="strategy-title">{localize('Odd Strategy')}</h3>
                                <div className="strategy-badge odd">{localize('ODD')}</div>
                            </div>
                            <div className="strategy-content">
                                <div className="strategy-section">
                                    <h4 className="section-label">{localize('Entry Criteria')}</h4>
                                    <p>{localize('When numbers (1, 3, 5, 7, 9) indicate 11% and above, place an Odd contract type.')}</p>
                                </div>
                                <div className="strategy-section">
                                    <h4 className="section-label">{localize('Main Volatility')}</h4>
                                    <p className="highlight">{localize('Volatility 75 index')}</p>
                                </div>
                                <div className="strategy-section">
                                    <h4 className="section-label">{localize('Entry Point')}</h4>
                                    <p>{localize('Make sure the cursor hits 3 or 4 times on even numbers, then run your bot if it hits any Odd number.')}</p>
                                    <div className="warning-note">
                                        <span className="warning-icon">⚠️</span>
                                        <span>{localize('Don\'t rush! Wait for confirmation of an Odd number before running your bot.')}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Over/Under Strategies */}
                        <div className="strategy-card over-under-strategy">
                            <div className="strategy-header">
                                <div className="strategy-icon">📊</div>
                                <h3 className="strategy-title">{localize('Over/Under Strategies')}</h3>
                                <div className="strategy-badge over-under">{localize('OVER/UNDER')}</div>
                            </div>
                            <div className="strategy-content">
                                <div className="strategy-subsection">
                                    <h4 className="subsection-title">{localize('Over 0 & 1')}</h4>
                                    <div className="strategy-section">
                                        <h5 className="section-label">{localize('Criteria')}</h5>
                                        <p>{localize('Use 1 tick. Green bar should have 10.5% and above. Red bar should have 9% and below.')}</p>
                                    </div>
                                    <div className="strategy-section">
                                        <h5 className="section-label">{localize('Entry Point')}</h5>
                                        <p>{localize('Wait for the moving cursor to hit 0 or 1 once or twice before trading Over 0 or 1.')}</p>
                                    </div>
                                </div>
                                <div className="strategy-subsection">
                                    <h4 className="subsection-title">{localize('Over 2')}</h4>
                                    <div className="strategy-section">
                                        <h5 className="section-label">{localize('Criteria')}</h5>
                                        <p>{localize('Any digit among 3, 4, 5, 6, 7, 8, or 9 should be at least 10% and above.')}</p>
                                    </div>
                                    <div className="strategy-section">
                                        <h5 className="section-label">{localize('Entry Point')}</h5>
                                        <p>{localize('If the last trade ends in Under 2, trade Over when the cursor hits 0, 1, or 2.')}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Matches & Differs Strategy */}
                        <div className="strategy-card match-differ-strategy">
                            <div className="strategy-header">
                                <div className="strategy-icon">🔀</div>
                                <h3 className="strategy-title">{localize('Matches & Differs')}</h3>
                                <div className="strategy-badge match-differ">{localize('MATCH/DIFFER')}</div>
                            </div>
                            <div className="strategy-content">
                                <div className="strategy-subsection">
                                    <h4 className="subsection-title">{localize('Digit Differs Strategy')}</h4>
                                    <div className="strategy-section">
                                        <h5 className="section-label">{localize('Criteria')}</h5>
                                        <p>{localize('Use 1 Tick. Predict digit with less than 9%. Green bar should be below 12%.')}</p>
                                    </div>
                                    <div className="strategy-section">
                                        <h5 className="section-label">{localize('Entry Point')}</h5>
                                        <p>{localize('Ensure the predicted number has been hit once before entering the trade.')}</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Rise and Fall Strategies */}
                        <div className="strategy-card rise-fall-strategy">
                            <div className="strategy-header">
                                <div className="strategy-icon">📈</div>
                                <h3 className="strategy-title">{localize('Rise and Fall')}</h3>
                                <div className="strategy-badge rise-fall">{localize('RISE/FALL')}</div>
                            </div>
                            <div className="strategy-content">
                                <div className="strategy-subsection">
                                    <h4 className="subsection-title">{localize('Rise Strategy')}</h4>
                                    <div className="strategy-section">
                                        <h5 className="section-label">{localize('Criteria')}</h5>
                                        <p>{localize('Use moving averages, trend lines, and volume analysis to confirm an upward momentum.')}</p>
                                    </div>
                                    <div className="strategy-section">
                                        <h5 className="section-label">{localize('Entry Timing')}</h5>
                                        <p>{localize('Wait for a pullback or consolidation near support levels before entering a trade.')}</p>
                                    </div>
                                    <div className="strategy-section">
                                        <h5 className="section-label">{localize('Risk Management')}</h5>
                                        <p>{localize('Place stop-loss orders just below key support levels to minimize potential losses.')}</p>
                                    </div>
                                </div>
                                <div className="strategy-subsection">
                                    <h4 className="subsection-title">{localize('Fall Strategy')}</h4>
                                    <div className="strategy-section">
                                        <h5 className="section-label">{localize('Criteria')}</h5>
                                        <p>{localize('Use moving averages and trend lines to detect downward momentum.')}</p>
                                    </div>
                                    <div className="strategy-section">
                                        <h5 className="section-label">{localize('Entry Timing')}</h5>
                                        <p>{localize('Wait for a brief consolidation or bounce near resistance levels before initiating the trade.')}</p>
                                    </div>
                                    <div className="strategy-section">
                                        <h5 className="section-label">{localize('Risk Management')}</h5>
                                        <p>{localize('Place stop-loss orders above key resistance levels to protect capital.')}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Strategy Tips */}
                    <div className="strategy-tips">
                        <h3 className="tips-title">
                            <span className="tips-icon">💡</span>
                            {localize('General Strategy Tips')}
                        </h3>
                        <div className="tips-grid">
                            <div className="tip-item">
                                <div className="tip-icon">🎯</div>
                                <div className="tip-content">
                                    <strong>{localize('Patience is Key')}</strong>
                                    <p>{localize('Wait for clear confirmation signals before entering trades.')}</p>
                                </div>
                            </div>
                            <div className="tip-item">
                                <div className="tip-icon">📊</div>
                                <div className="tip-content">
                                    <strong>{localize('Monitor Percentages')}</strong>
                                    <p>{localize('Always check the percentage indicators before making decisions.')}</p>
                                </div>
                            </div>
                            <div className="tip-item">
                                <div className="tip-icon">⏰</div>
                                <div className="tip-content">
                                    <strong>{localize('Timing Matters')}</strong>
                                    <p>{localize('Entry timing can significantly impact your success rate.')}</p>
                                </div>
                            </div>
                            <div className="tip-item">
                                <div className="tip-icon">🛡️</div>
                                <div className="tip-content">
                                    <strong>{localize('Risk Management')}</strong>
                                    <p>{localize('Never risk more than you can afford to lose.')}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Markup Statistics Section */}
            {activeSection === 'markup' && (
                <div className="markup-section">
                    <div className="markup-header">
                        <h2 className="section-title">{localize('App Markup Statistics')}</h2>
                        <p className="section-description">
                            {localize('View detailed commission and trading data for each app')}
                        </p>
                    </div>

                    {/* Custom App Selector */}
                    <div className="app-selector">
                        <label className="selector-label">
                            <span className="label-icon">📱</span>
                            <span className="label-text">{localize('Select App')}</span>
                        </label>
                        <div className={`custom-dropdown ${isAppDropdownOpen ? 'open' : ''}`}>
                            <div 
                                className={`dropdown-trigger ${markupLoading || availableApps.length === 0 ? 'disabled' : ''}`}
                                onClick={() => {
                                    if (!markupLoading && availableApps.length > 0) {
                                        setIsAppDropdownOpen(!isAppDropdownOpen);
                                    }
                                }}
                            >
                                <span className="selected-value">
                                    {selectedAppId === 'all' 
                                        ? (availableApps.length === 0 
                                            ? localize('No apps available') 
                                            : localize('Choose an app...'))
                                        : availableApps.find(app => app.app_id.toString() === selectedAppId)?.name || `App ${selectedAppId}`
                                    }
                                </span>
                                <div className="dropdown-arrow">
                                    <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
                                        <path d="M1 1L6 6L11 1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                </div>
                            </div>
                            {isAppDropdownOpen && availableApps.length > 0 && (
                                <div className="dropdown-list">
                                    {availableApps.map(app => (
                                        <div
                                            key={app.app_id}
                                            className={`dropdown-item ${selectedAppId === app.app_id.toString() ? 'selected' : ''}`}
                                            onClick={() => {
                                                setSelectedAppId(app.app_id.toString());
                                                setIsAppDropdownOpen(false);
                                            }}
                                        >
                                            <span className="item-icon">📱</span>
                                            <div className="item-content">
                                                <span className="item-name">{app.name}</span>
                                                <span className="item-id">ID: {app.app_id}</span>
                                            </div>
                                            {selectedAppId === app.app_id.toString() && (
                                                <span className="check-icon">✓</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Error Display */}
                    {markupError && (
                        <div className="error-message">
                            <span className="error-icon">⚠️</span>
                            {markupError}
                        </div>
                    )}

                    {/* Loading State - Initial app list fetch */}
                    {markupLoading && !markupDataLoading && (
                        <div className="loading-state">
                            <div className="spinner"></div>
                            <p>{localize('Fetching app list...')}</p>
                        </div>
                    )}

                    {/* Loading State - Data fetch for selected app */}
                    {markupDataLoading && (
                        <div className="loading-state">
                            <div className="spinner"></div>
                            <p>{localize('Loading commission data...')}</p>
                        </div>
                    )}

                    {/* Empty State - No App Selected */}
                    {!markupLoading && !markupDataLoading && !markupError && selectedAppId === 'all' && (
                        <div className="empty-state">
                            <div className="empty-icon">📱</div>
                            <h3>{localize('Select an App')}</h3>
                            <p>{localize('Choose an app from the dropdown above to view its commission statistics.')}</p>
                        </div>
                    )}

                    {/* App Data Display */}
                    {!markupLoading && !markupDataLoading && !markupError && selectedAppId !== 'all' && (
                        <>
                            {/* Commission Cards Grid */}
                            <div className="commission-grid">
                                {/* Current Month Card */}
                                <div className="commission-card current-month">
                                    <div className="card-header">
                                        <div className="card-icon">📅</div>
                                        <div className="card-title">{localize('Current Month')}</div>
                                    </div>
                                    <div className="card-content">
                                        <div className="metric">
                                            <div className="metric-label">{localize('Commission')}</div>
                                            <div className="metric-value commission">
                                                {formatCurrency(getCurrentMonthData().commission, client?.currency || 'USD')}
                                            </div>
                                        </div>
                                        <div className="metric">
                                            <div className="metric-label">{localize('Traders')}</div>
                                            <div className="metric-value traders">
                                                {currentMonthUsers.toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="metric">
                                            <div className="metric-label">{localize('Trades')}</div>
                                            <div className="metric-value trades">
                                                {getCurrentMonthData().trades.toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Previous Month Card */}
                                <div className="commission-card previous-month">
                                    <div className="card-header">
                                        <div className="card-icon">📆</div>
                                        <div className="card-title">{localize('Previous Month')}</div>
                                    </div>
                                    <div className="card-content">
                                        <div className="metric">
                                            <div className="metric-label">{localize('Commission')}</div>
                                            <div className="metric-value commission">
                                                {formatCurrency(getPreviousMonthData().commission, client?.currency || 'USD')}
                                            </div>
                                        </div>
                                        <div className="metric-comparison">
                                            {(() => {
                                                const current = getCurrentMonthData().commission;
                                                const previous = getPreviousMonthData().commission;
                                                const change = previous > 0 ? ((current - previous) / previous * 100).toFixed(1) : 0;
                                                const isPositive = Number(change) >= 0;
                                                return (
                                                    <span className={`change ${isPositive ? 'positive' : 'negative'}`}>
                                                        {isPositive ? '↗' : '↘'} {Math.abs(Number(change))}% vs current
                                                    </span>
                                                );
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                {/* Today's Commission Card */}
                                <div className="commission-card today">
                                    <div className="card-header">
                                        <div className="card-icon">🌟</div>
                                        <div className="card-title">{localize('Today')}</div>
                                    </div>
                                    <div className="card-content">
                                        <div className="metric">
                                            <div className="metric-label">{localize('Commission')}</div>
                                            <div className="metric-value commission">
                                                {formatCurrency(getTodayData().commission, client?.currency || 'USD')}
                                            </div>
                                        </div>
                                        <div className="metric">
                                            <div className="metric-label">{localize('Traders')}</div>
                                            <div className="metric-value traders">
                                                {todayUsers.toLocaleString()}
                                            </div>
                                        </div>
                                        <div className="metric">
                                            <div className="metric-label">{localize('Trades')}</div>
                                            <div className="metric-value trades">
                                                {getTodayData().trades.toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 6 Months Chart Card */}
                            <div className="chart-card">
                                <h3 className="chart-title">{localize('Last 6 Months')}</h3>
                                <div className="bar-chart-simple">
                                    {getLast6MonthsData().map((monthData, index) => {
                                        const maxCommission = Math.max(...getLast6MonthsData().map(d => d.commission));
                                        const heightPercent = maxCommission > 0 ? (monthData.commission / maxCommission * 100) : 0;
                                        
                                        return (
                                            <div key={index} className="chart-bar">
                                                <div className="bar-wrapper">
                                                    <div 
                                                        className="bar" 
                                                        style={{ height: `${heightPercent}%` }}
                                                        title={formatCurrency(monthData.commission, client?.currency || 'USD')}
                                                    >
                                                        <span className="bar-tooltip">
                                                            {formatCurrency(monthData.commission, client?.currency || 'USD')}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="bar-label">{monthData.month}</div>
                                                <div className="bar-value">{formatCurrency(monthData.commission, client?.currency || 'USD')}</div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* App Info Summary */}
                            <div className="app-info-card">
                                <div className="info-header">
                                    <span className="app-badge-large">App {selectedAppId}</span>
                                    <button 
                                        className="refresh-data-btn"
                                        onClick={fetchMarkupStatistics}
                                    >
                                        🔄 {localize('Refresh Data')}
                                    </button>
                                </div>
                                <div className="info-stats">
                                    <div className="stat-item">
                                        <span className="stat-label">{localize('Total Commission')}:</span>
                                        <span className="stat-value">
                                            {formatCurrency(getSelectedAppData()?.app_markup_value || 0, client?.currency || 'USD')}
                                        </span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-label">{localize('Total Transactions')}:</span>
                                        <span className="stat-value">
                                            {(getSelectedAppData()?.transactions_count || 0).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-label">{localize('Average per Trade')}:</span>
                                        <span className="stat-value">
                                            {formatCurrency(
                                                (getSelectedAppData()?.app_markup_value || 0) / 
                                                (getSelectedAppData()?.transactions_count || 1),
                                                client?.currency || 'USD'
                                            )}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
});

export default PortfolioDisplay;
