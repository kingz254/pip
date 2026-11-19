import { useState, useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { Button, Text } from '@deriv-com/ui';
import './instances-analysis.scss';

// Symbol type for volatility analysis
type SymbolType = 'R_10' | 'R_25' | 'R_50' | 'R_75' | 'R_100' | '1HZ10V' | '1HZ15V' | '1HZ25V' | '1HZ30V' | '1HZ50V' | '1HZ75V' | '1HZ90V' | '1HZ100V';

interface AnalysisInstance {
    id: string;
    symbol: SymbolType;
    tickCount: number;
    tickHistory: number[];
    tickPrices: number[]; // Store actual prices for rise/fall calculation
    ws?: WebSocket;
    isActive: boolean;
    decimalPlaces: number;
    overUnderDigit: number; // Threshold digit for over/under comparison
}

interface DigitStats {
    digit: number;
    count: number;
    percentage: number;
}

const InstancesAnalysis = observer(() => {
    const [instances, setInstances] = useState<AnalysisInstance[]>([]);
    const [selectedSymbol, setSelectedSymbol] = useState<SymbolType>('R_10');
    const [tickCount, setTickCount] = useState<number>(100);
    const [overUnderDigit, setOverUnderDigit] = useState<number>(5);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const instanceIdCounter = useRef(0);
    const instanceDecimalPlacesRef = useRef<Map<string, number>>(new Map());

    const AVAILABLE_SYMBOLS: SymbolType[] = [
        'R_10', 'R_25', 'R_50', 'R_75', 'R_100',
        '1HZ10V', '1HZ15V', '1HZ25V', '1HZ30V', '1HZ50V',
        '1HZ75V', '1HZ90V', '1HZ100V'
    ];

    // Get symbol display name
    const getSymbolDisplayName = (symbol: SymbolType): string => {
        const nameMap: Record<SymbolType, string> = {
            'R_10': 'Volatility 10',
            'R_25': 'Volatility 25',
            'R_50': 'Volatility 50',
            'R_75': 'Volatility 75',
            'R_100': 'Volatility 100',
            '1HZ10V': 'V10 (1s)',
            '1HZ15V': 'V15 (1s)',
            '1HZ25V': 'V25 (1s)',
            '1HZ30V': 'V30 (1s)',
            '1HZ50V': 'V50 (1s)',
            '1HZ75V': 'V75 (1s)',
            '1HZ90V': 'V90 (1s)',
            '1HZ100V': 'V100 (1s)',
        };
        return nameMap[symbol] || symbol;
    };

    // Detect decimal places from an array of prices
    const detectDecimalPlaces = (prices: number[]): number => {
        if (prices.length === 0) return 2;
        
        const decimalCounts = prices.map(price => {
            const priceStr = price.toString();
            const decimalPart = priceStr.split('.')[1] || '';
            return decimalPart.length;
        });
        
        return Math.max(...decimalCounts, 2);
    };

    // Extract last digit from price using specified decimal places
    const getLastDigit = (price: number, decimalPlaces: number = 2): number => {
        const priceStr = price.toString();
        const parts = priceStr.split('.');
        let decimals = parts[1] || '';
        
        // Pad with zeros if needed to match decimal places
        while (decimals.length < decimalPlaces) {
            decimals += '0';
        }
        
        // Get the last digit at the specified decimal place
        return Number(decimals.charAt(decimalPlaces - 1));
    };

    // Calculate digit statistics
    const calculateDigitStats = (digits: number[]): DigitStats[] => {
        if (digits.length === 0) return [];

        const counts = Array(10).fill(0);
        digits.forEach(digit => counts[digit]++);

        return counts.map((count, digit) => ({
            digit,
            count,
            percentage: (count / digits.length) * 100
        }));
    };

    // Calculate parity percentages
    const calculateParity = (digits: number[]): { even: number; odd: number } => {
        if (digits.length === 0) return { even: 0, odd: 0 };

        const evenCount = digits.filter(d => d % 2 === 0).length;
        return {
            even: (evenCount / digits.length) * 100,
            odd: ((digits.length - evenCount) / digits.length) * 100
        };
    };

    // Calculate rise and fall percentages
    const calculateRiseFall = (prices: number[]): { rise: number; fall: number; equal: number } => {
        if (prices.length < 2) return { rise: 0, fall: 0, equal: 0 };

        let riseCount = 0;
        let fallCount = 0;
        let equalCount = 0;

        for (let i = 1; i < prices.length; i++) {
            if (prices[i] > prices[i - 1]) {
                riseCount++;
            } else if (prices[i] < prices[i - 1]) {
                fallCount++;
            } else {
                equalCount++;
            }
        }

        const total = prices.length - 1;
        return {
            rise: (riseCount / total) * 100,
            fall: (fallCount / total) * 100,
            equal: (equalCount / total) * 100
        };
    };

    // Calculate over and under percentages (compared to threshold digit)
    const calculateOverUnder = (digits: number[], thresholdDigit: number): { over: number; under: number; equal: number } => {
        if (digits.length === 0) return { over: 0, under: 0, equal: 0 };
        
        let overCount = 0;
        let underCount = 0;
        let equalCount = 0;

        digits.forEach(digit => {
            if (digit > thresholdDigit) {
                overCount++;
            } else if (digit < thresholdDigit) {
                underCount++;
            } else {
                equalCount++;
            }
        });

        return {
            over: (overCount / digits.length) * 100,
            under: (underCount / digits.length) * 100,
            equal: (equalCount / digits.length) * 100
        };
    };

    // Get over/under/equal indicator for a digit
    const getDigitIndicator = (digit: number, thresholdDigit: number): 'O' | 'U' | 'E' => {
        if (digit > thresholdDigit) return 'O';
        if (digit < thresholdDigit) return 'U';
        return 'E';
    };

    // Create WebSocket connection for an instance
    const createInstanceWebSocket = (instance: AnalysisInstance) => {
        const ws = new WebSocket('wss://api.derivws.com/trading/v1/options/ws/public');

        ws.onopen = () => {
            console.log(`WebSocket connected for ${instance.symbol}`);
            ws.send(JSON.stringify({
                ticks_history: instance.symbol,
                count: instance.tickCount,
                end: 'latest',
                style: 'ticks',
                subscribe: 1
            }));
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);

            if (data.history) {
                // Initial history received - detect decimal places
                const decimalPlaces = detectDecimalPlaces(data.history.prices);
                
                // Store decimal places in ref for real-time updates
                instanceDecimalPlacesRef.current.set(instance.id, decimalPlaces);
                
                // Update instance with detected decimal places
                setInstances(prev => prev.map(inst => 
                    inst.id === instance.id ? { ...inst, decimalPlaces } : inst
                ));
                
                // Extract digits using detected decimal places
                const digits = data.history.prices.map((price: number) => getLastDigit(price, decimalPlaces));
                updateInstanceTicks(instance.id, digits, data.history.prices);
                
                console.log(`${instance.symbol} detected decimal places: ${decimalPlaces}`);
            } else if (data.tick) {
                // Real-time tick update - use stored decimal places from ref
                const decimalPlaces = instanceDecimalPlacesRef.current.get(instance.id) || 2;
                const digit = getLastDigit(data.tick.quote, decimalPlaces);
                updateInstanceTicks(instance.id, [digit], [data.tick.quote], true);
            }

            if (data.error) {
                console.error('WebSocket error:', data.error);
            }
        };

        ws.onerror = (error) => {
            console.error(`WebSocket error for ${instance.symbol}:`, error);
        };

        ws.onclose = () => {
            console.log(`WebSocket closed for ${instance.symbol}`);
        };

        return ws;
    };

    // Update instance tick history
    const updateInstanceTicks = (instanceId: string, newDigits: number[], newPrices: number[], isRealTime = false) => {
        setInstances(prev => prev.map(inst => {
            if (inst.id !== instanceId) return inst;

            let updatedHistory = [...inst.tickHistory];
            let updatedPrices = [...inst.tickPrices];

            if (isRealTime) {
                updatedHistory = [...updatedHistory, ...newDigits];
                updatedPrices = [...updatedPrices, ...newPrices];
                // Keep only the last tickCount ticks
                if (updatedHistory.length > inst.tickCount) {
                    updatedHistory = updatedHistory.slice(-inst.tickCount);
                    updatedPrices = updatedPrices.slice(-inst.tickCount);
                }
            } else {
                updatedHistory = newDigits.slice(-inst.tickCount);
                updatedPrices = newPrices.slice(-inst.tickCount);
            }

            return {
                ...inst,
                tickHistory: updatedHistory,
                tickPrices: updatedPrices
            };
        }));
    };

    // Add new instance
    const addInstance = () => {
        // Ensure valid values before adding instance
        const validTickCount = typeof tickCount === 'number' && tickCount >= 10 && tickCount <= 5000 ? tickCount : 100;
        const validOverUnderDigit = typeof overUnderDigit === 'number' && overUnderDigit >= 0 && overUnderDigit <= 9 ? overUnderDigit : 5;
        
        // Update state with valid values if they were empty
        if (tickCount !== validTickCount) setTickCount(validTickCount);
        if (overUnderDigit !== validOverUnderDigit) setOverUnderDigit(validOverUnderDigit);
        
        const newInstance: AnalysisInstance = {
            id: `instance-${instanceIdCounter.current++}`,
            symbol: selectedSymbol,
            tickCount: validTickCount,
            tickHistory: [],
            tickPrices: [],
            isActive: true,
            decimalPlaces: 2, // Default, will be updated when data arrives
            overUnderDigit: validOverUnderDigit
        };

        const ws = createInstanceWebSocket(newInstance);
        newInstance.ws = ws;

        setInstances(prev => [...prev, newInstance]);
    };

    // Remove instance
    const removeInstance = (instanceId: string) => {
        setInstances(prev => {
            const instance = prev.find(inst => inst.id === instanceId);
            if (instance?.ws) {
                instance.ws.close();
            }
            // Clean up decimal places ref
            instanceDecimalPlacesRef.current.delete(instanceId);
            return prev.filter(inst => inst.id !== instanceId);
        });
    };

    // Toggle instance active state
    const toggleInstance = (instanceId: string) => {
        setInstances(prev => prev.map(inst => {
            if (inst.id !== instanceId) return inst;

            if (inst.isActive && inst.ws) {
                inst.ws.close();
            } else if (!inst.isActive) {
                const ws = createInstanceWebSocket(inst);
                return { ...inst, ws, isActive: true };
            }

            return { ...inst, isActive: !inst.isActive };
        }));
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            instances.forEach(instance => {
                if (instance.ws) {
                    instance.ws.close();
                }
            });
        };
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as HTMLElement;
            if (!target.closest('.custom-dropdown')) {
                setIsDropdownOpen(false);
            }
        };

        if (isDropdownOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [isDropdownOpen]);

    // Render instance card
    const renderInstanceCard = (instance: AnalysisInstance) => {
        const digitStats = calculateDigitStats(instance.tickHistory);
        const parity = calculateParity(instance.tickHistory);
        const riseFall = calculateRiseFall(instance.tickPrices);
        const overUnder = calculateOverUnder(instance.tickHistory, instance.overUnderDigit);
        const maxStat = digitStats.length > 0 ? Math.max(...digitStats.map(s => s.percentage)) : 0;
        const minStat = digitStats.length > 0 ? Math.min(...digitStats.map(s => s.percentage)) : 0;
        const currentDigit = instance.tickHistory.length > 0 ? instance.tickHistory[instance.tickHistory.length - 1] : null;

        return (
            <div key={instance.id} className={`instance-card ${!instance.isActive ? 'instance-card--paused' : ''}`}>
                <div className="instance-card__header">
                    <div className="instance-card__title">
                        <Text size="sm" weight="bold">
                            {getSymbolDisplayName(instance.symbol)}
                        </Text>
                        <span className="instance-card__tick-count">
                            {instance.tickHistory.length}/{instance.tickCount} ticks
                        </span>
                    </div>
                    <div className="instance-card__actions">
                        <button
                            className={`instance-card__toggle ${instance.isActive ? 'active' : ''}`}
                            onClick={() => toggleInstance(instance.id)}
                            title={instance.isActive ? 'Pause' : 'Resume'}
                        >
                            {instance.isActive ? '⏸' : '▶'}
                        </button>
                        <button
                            className="instance-card__remove"
                            onClick={() => removeInstance(instance.id)}
                            title="Remove"
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {instance.tickHistory.length > 0 ? (
                    <>
                        <div className="instance-card__digits">
                            {digitStats.map(stat => (
                                <div
                                    key={stat.digit}
                                    className={`digit-stat ${stat.percentage === maxStat ? 'highest' : ''} ${stat.percentage === minStat ? 'lowest' : ''} ${stat.digit === currentDigit ? 'current' : ''}`}
                                    title={`${stat.digit}: ${stat.count} times (${stat.percentage.toFixed(1)}%)`}
                                >
                                    <span className="digit-stat__number">{stat.digit}</span>
                                    <span className="digit-stat__percentage">{stat.percentage.toFixed(1)}%</span>
                                </div>
                            ))}
                        </div>

                        <div className="instance-card__parity">
                            <div className="parity-stat even">
                                <span className="parity-stat__label">Even</span>
                                <span className="parity-stat__value">{parity.even.toFixed(1)}%</span>
                            </div>
                            <div className="parity-stat odd">
                                <span className="parity-stat__label">Odd</span>
                                <span className="parity-stat__value">{parity.odd.toFixed(1)}%</span>
                            </div>
                        </div>

                        <div className="instance-card__rise-fall">
                            <div className="rise-fall-stat rise">
                                <span className="rise-fall-stat__label">Rise</span>
                                <span className="rise-fall-stat__value">{riseFall.rise.toFixed(1)}%</span>
                            </div>
                            <div className="rise-fall-stat fall">
                                <span className="rise-fall-stat__label">Fall</span>
                                <span className="rise-fall-stat__value">{riseFall.fall.toFixed(1)}%</span>
                            </div>
                        </div>

                        <div className="instance-card__over-under">
                            <div className="over-under-stat over">
                                <span className="over-under-stat__label">Over {instance.overUnderDigit}</span>
                                <span className="over-under-stat__value">{overUnder.over.toFixed(1)}%</span>
                            </div>
                            <div className="over-under-stat under">
                                <span className="over-under-stat__label">Under {instance.overUnderDigit}</span>
                                <span className="over-under-stat__value">{overUnder.under.toFixed(1)}%</span>
                            </div>
                        </div>

                        <div className="instance-card__recent">
                            <Text size="xs" className="recent-label">Recent:</Text>
                            <div className="recent-digits">
                                {instance.tickHistory.slice(-10).map((digit, idx) => {
                                    const indicator = getDigitIndicator(digit, instance.overUnderDigit);
                                    const indicatorClass = indicator === 'O' ? 'over' : indicator === 'U' ? 'under' : 'equal';
                                    return (
                                        <span key={idx} className={`recent-digit ${digit % 2 === 0 ? 'even' : 'odd'}`}>
                                            {digit}
                                            <span className={`digit-indicator digit-indicator--${indicatorClass}`}>{indicator}</span>
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="instance-card__loading">
                        <Text size="sm">Loading tick data...</Text>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="instances-analysis">
            <div className="instances-analysis__controls">
                <div className="control-group">
                    <label>Volatility:</label>
                    <div className="custom-dropdown">
                        <button
                            className="custom-dropdown__trigger"
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            type="button"
                        >
                            <span>{getSymbolDisplayName(selectedSymbol)}</span>
                            <svg
                                width="12"
                                height="12"
                                viewBox="0 0 12 12"
                                fill="currentColor"
                                style={{ transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
                            >
                                <path d="M6 8L2 4h8z" />
                            </svg>
                        </button>
                        {isDropdownOpen && (
                            <div className="custom-dropdown__menu">
                                {AVAILABLE_SYMBOLS.map(symbol => (
                                    <button
                                        key={symbol}
                                        className={`custom-dropdown__item ${selectedSymbol === symbol ? 'custom-dropdown__item--active' : ''}`}
                                        onClick={() => {
                                            setSelectedSymbol(symbol);
                                            setIsDropdownOpen(false);
                                        }}
                                        type="button"
                                    >
                                        {getSymbolDisplayName(symbol)}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="control-group">
                    <label htmlFor="tick-count-input">Ticks:</label>
                    <input
                        id="tick-count-input"
                        type="number"
                        min="10"
                        max="5000"
                        value={tickCount}
                        onChange={(e) => {
                            const value = e.target.value;
                            if (value === '') {
                                setTickCount('' as any);
                            } else {
                                const num = parseInt(value);
                                setTickCount(isNaN(num) ? '' as any : num);
                            }
                        }}
                        onBlur={(e) => {
                            if (e.target.value === '' || parseInt(e.target.value) < 10) {
                                setTickCount(100);
                            } else if (parseInt(e.target.value) > 5000) {
                                setTickCount(5000);
                            }
                        }}
                        className="control-input"
                        placeholder="10-5000"
                    />
                </div>

                <div className="control-group control-group--small">
                    <label htmlFor="over-under-digit-input">O/U:</label>
                    <input
                        id="over-under-digit-input"
                        type="number"
                        min="0"
                        max="9"
                        value={overUnderDigit}
                        onChange={(e) => {
                            const value = e.target.value;
                            if (value === '') {
                                setOverUnderDigit('' as any);
                            } else {
                                const num = parseInt(value);
                                setOverUnderDigit(isNaN(num) ? '' as any : num);
                            }
                        }}
                        onBlur={(e) => {
                            if (e.target.value === '' || parseInt(e.target.value) < 0) {
                                setOverUnderDigit(5);
                            } else if (parseInt(e.target.value) > 9) {
                                setOverUnderDigit(9);
                            }
                        }}
                        className="control-input"
                        placeholder="0-9"
                    />
                </div>

                <Button
                    onClick={addInstance}
                    className="add-instance-button"
                >
                    + Add
                </Button>
            </div>

            <div className="instances-analysis__stats">
                <div className="stat-item">
                    <span className="stat-label">Active Instances:</span>
                    <span className="stat-value">{instances.filter(i => i.isActive).length}</span>
                </div>
                <div className="stat-item">
                    <span className="stat-label">Total Instances:</span>
                    <span className="stat-value">{instances.length}</span>
                </div>
            </div>

            <div className="instances-analysis__grid">
                {instances.length === 0 ? (
                    <div className="instances-analysis__empty">
                        <Text size="sm">No instances yet. Add an instance to start analyzing!</Text>
                    </div>
                ) : (
                    instances.map(instance => renderInstanceCard(instance))
                )}
            </div>
        </div>
    );
});

export default InstancesAnalysis;
