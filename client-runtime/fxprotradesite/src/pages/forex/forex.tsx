import { useState, useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { Localize } from '@deriv-com/translations';
import { api_base } from '@/external/bot-skeleton';
import './forex.scss';

interface TickData {
    ask: string;
    bid: string;
    quote: string;
    symbol: string;
}

interface CandleData {
    open: number;
    high: number;
    low: number;
    close: number;
    epoch: number;
}

interface TimeframeSignal {
    timeframe: string;
    direction: 'BUY' | 'SELL' | 'NEUTRAL';
    strength: number; // 0-100
    trend: string;
    price: number;
    sma20: number;
    sma50: number;
    sma200: number;
    ema20: number;
    ema50: number;
    ema200: number;
    rsi: number;
    macd: { macd: number; signal: number; histogram: number };
    ao: number;
    stoch: { k: number; d: number };
    adx: number;
    priceVsSma: 'ABOVE' | 'BELOW';
}

interface ForexSignal {
    pair: string;
    symbol: string;
    flag: string;
    overallSignal: 'STRONG BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG SELL';
    confidence: number; // 0-100
    currentPrice: number;
    change24h: number;
    timeframeSignals: TimeframeSignal[];
    lastUpdated: number;
}

const Forex = observer(() => {
    const [forexSignals, setForexSignals] = useState<ForexSignal[]>([]);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [lastAnalysis, setLastAnalysis] = useState<number>(0);
    const [currentPrices, setCurrentPrices] = useState<Record<string, number>>({});
    const [selectedSymbol, setSelectedSymbol] = useState<string>('frxEURUSD');
    const [showCards, setShowCards] = useState(false);
    const [marketType, setMarketType] = useState<'forex' | 'synthetic'>('forex');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const subscriptionRef = useRef<string | null>(null);
    const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const dropdownRef = useRef<HTMLDivElement | null>(null);

    const forexPairs = [
        { pair: 'EUR/USD', name: 'Euro / US Dollar', flag: '🇪🇺🇺🇸', symbol: 'frxEURUSD' },
        { pair: 'GBP/USD', name: 'British Pound / US Dollar', flag: '🇬🇧🇺🇸', symbol: 'frxGBPUSD' },
        { pair: 'USD/JPY', name: 'US Dollar / Japanese Yen', flag: '🇺🇸🇯🇵', symbol: 'frxUSDJPY' },
        { pair: 'USD/CHF', name: 'US Dollar / Swiss Franc', flag: '🇺🇸🇨🇭', symbol: 'frxUSDCHF' },
        { pair: 'AUD/USD', name: 'Australian Dollar / US Dollar', flag: '🇦🇺🇺🇸', symbol: 'frxAUDUSD' },
        { pair: 'USD/CAD', name: 'US Dollar / Canadian Dollar', flag: '🇺🇸🇨🇦', symbol: 'frxUSDCAD' },
        { pair: 'NZD/USD', name: 'New Zealand Dollar / US Dollar', flag: '🇳🇿🇺🇸', symbol: 'frxNZDUSD' },
        { pair: 'EUR/GBP', name: 'Euro / British Pound', flag: '🇪🇺🇬🇧', symbol: 'frxEURGBP' },
        { pair: 'EUR/JPY', name: 'Euro / Japanese Yen', flag: '🇪🇺🇯🇵', symbol: 'frxEURJPY' },
        { pair: 'GBP/JPY', name: 'British Pound / Japanese Yen', flag: '🇬🇧🇯🇵', symbol: 'frxGBPJPY' },
    ];

    const syntheticIndices = [
        { pair: 'Volatility 10 (1s) Index', name: 'Volatility 10 (1s) Index', flag: '📊', symbol: '1HZ10V' },
        { pair: 'Volatility 25 (1s) Index', name: 'Volatility 25 (1s) Index', flag: '📊', symbol: '1HZ25V' },
        { pair: 'Volatility 50 (1s) Index', name: 'Volatility 50 (1s) Index', flag: '📊', symbol: '1HZ50V' },
        { pair: 'Volatility 75 (1s) Index', name: 'Volatility 75 (1s) Index', flag: '📊', symbol: '1HZ75V' },
        { pair: 'Volatility 100 (1s) Index', name: 'Volatility 100 (1s) Index', flag: '📊', symbol: '1HZ100V' },
        { pair: 'Volatility 10 Index', name: 'Volatility 10 Index', flag: '📊', symbol: 'R_10' },
        { pair: 'Volatility 25 Index', name: 'Volatility 25 Index', flag: '📊', symbol: 'R_25' },
        { pair: 'Volatility 50 Index', name: 'Volatility 50 Index', flag: '📊', symbol: 'R_50' },
        { pair: 'Volatility 75 Index', name: 'Volatility 75 Index', flag: '📊', symbol: 'R_75' },
        { pair: 'Volatility 100 Index', name: 'Volatility 100 Index', flag: '📊', symbol: 'R_100' },
    ];

    const currentPairs = marketType === 'forex' ? forexPairs : syntheticIndices;

    const timeframes = [
        { label: '1M', granularity: 60, candles: 250 },
        { label: '5M', granularity: 300, candles: 250 },
        { label: '15M', granularity: 900, candles: 250 },
    ];

    // Subscribe to live prices
    useEffect(() => {
        const subscribeToTicks = async () => {
            try {
                if (!api_base.api) return;

                // Unsubscribe from previous subscription if exists
                if (subscriptionRef.current) {
                    await api_base.api.send({
                        forget: subscriptionRef.current,
                    });
                    subscriptionRef.current = null;
                }

                const symbols = currentPairs.map(p => p.symbol);
                
                const response = await api_base.api.send({
                    ticks: symbols,
                    subscribe: 1,
                });

                if (response.subscription) {
                    subscriptionRef.current = response.subscription.id;
                }
            } catch (error) {
                // Error subscribing to ticks
            }
        };

        subscribeToTicks();

        return () => {
            if (subscriptionRef.current && api_base.api) {
                api_base.api.send({
                    forget: subscriptionRef.current,
                });
            }
        };
    }, [marketType]);

    // Ping-pong mechanism to keep connection alive and trigger price updates
    useEffect(() => {
        const startPingPong = () => {
            if (!api_base.api) return;

            // Send ping every 3 seconds and update prices
            pingIntervalRef.current = setInterval(async () => {
                try {
                    // Send ping to keep connection alive
                    await api_base.api.send({ ping: 1 });
                    
                    // Fetch latest prices for all symbols
                    const symbols = currentPairs.map(p => p.symbol);
                    
                    for (const symbol of symbols) {
                        try {
                            // Get the most recent tick using ticks_history with count=1
                            const tickResponse = await api_base.api.send({
                                ticks_history: symbol,
                                adjust_start_time: 1,
                                count: 1,
                                end: 'latest',
                                start: 1,
                                style: 'ticks',
                            });
                            
                            if (tickResponse.history && tickResponse.history.prices && tickResponse.history.prices.length > 0) {
                                const price = parseFloat(tickResponse.history.prices[0]);
                                
                                if (!isNaN(price) && price > 0) {
                                    // Update current prices
                                    setCurrentPrices(prev => ({
                                        ...prev,
                                        [symbol]: price,
                                    }));

                                    // Update signals
                                    setForexSignals(prevSignals =>
                                        prevSignals.map(signal => {
                                            if (signal.symbol === symbol) {
                                                const firstPrice = signal.timeframeSignals[signal.timeframeSignals.length - 1]?.price || price;
                                                const change24h = firstPrice !== 0 ? ((price - firstPrice) / firstPrice) * 100 : 0;
                                                
                                                return {
                                                    ...signal,
                                                    currentPrice: price,
                                                    change24h,
                                                    lastUpdated: Date.now(),
                                                };
                                            }
                                            return signal;
                                        })
                                    );
                                }
                            }
                        } catch (error) {
                            // Error fetching price for symbol
                        }
                    }
                } catch (error) {
                    // Ping error
                }
            }, 500); // Update every 3 seconds
        };

        startPingPong();

        return () => {
            if (pingIntervalRef.current) {
                clearInterval(pingIntervalRef.current);
            }
        };
    }, [currentPairs]);

    // Listen for tick updates and update signal prices in real-time
    useEffect(() => {
        const handleTickUpdate = (response: any) => {
            // Handle tick updates
            if (response.tick) {
                const { symbol, quote } = response.tick;
                const price = typeof quote === 'number' ? quote : parseFloat(quote);
                
                // Only update if we have a valid price
                if (!isNaN(price) && price > 0) {
                    // Update current prices immediately on each tick
                    setCurrentPrices(prev => ({
                        ...prev,
                        [symbol]: price,
                    }));

                    // Update the signal with new price and recalculate 24h change on each tick
                    setForexSignals(prevSignals =>
                        prevSignals.map(signal => {
                            if (signal.symbol === symbol) {
                                const firstPrice = signal.timeframeSignals[signal.timeframeSignals.length - 1]?.price || price;
                                const change24h = firstPrice !== 0 ? ((price - firstPrice) / firstPrice) * 100 : 0;
                                
                                return {
                                    ...signal,
                                    currentPrice: price,
                                    change24h,
                                    lastUpdated: Date.now(),
                                };
                            }
                            return signal;
                        })
                    );
                }
            }
        };

        if (api_base.api) {
            const subscription = api_base.api.onMessage().subscribe(handleTickUpdate);
            
            return () => {
                subscription.unsubscribe();
            };
        }
    }, []);

    // Auto-analyze when market type changes
    useEffect(() => {
        if (marketType) {
            analyzeAllPairs();
        }
    }, [marketType]);

    // Analyze all timeframes for all pairs
    const analyzeAllPairs = async () => {
        setIsAnalyzing(true);
        const signals: ForexSignal[] = [];

        for (const pair of currentPairs) {
            try {
                const timeframeSignals: TimeframeSignal[] = [];

                for (const tf of timeframes) {
                    const signal = await analyzeTimeframe(pair.symbol, tf.granularity, tf.candles);
                    timeframeSignals.push({
                        timeframe: tf.label,
                        ...signal,
                    });
                }

                // Calculate overall signal
                const buyCount = timeframeSignals.filter(s => s.direction === 'BUY').length;
                const sellCount = timeframeSignals.filter(s => s.direction === 'SELL').length;
                const avgStrength = timeframeSignals.reduce((sum, s) => sum + s.strength, 0) / timeframeSignals.length;

                let overallSignal: 'STRONG BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG SELL';
                
                // Strong signals: all timeframes agree + high strength
                if (buyCount === 3 && avgStrength >= 70) {
                    overallSignal = 'STRONG BUY';
                } else if (sellCount === 3 && avgStrength >= 70) {
                    overallSignal = 'STRONG SELL';
                } 
                // Regular buy/sell: majority agreement
                else if (buyCount >= 2) {
                    overallSignal = 'BUY';
                } else if (sellCount >= 2) {
                    overallSignal = 'SELL';
                } 
                // Neutral: no clear consensus
                else {
                    overallSignal = 'NEUTRAL';
                }

                // Get the most recent price from the latest timeframe (1M is most recent)
                const latestPrice = timeframeSignals[0]?.price || 0;
                const currentPrice = currentPrices[pair.symbol] || latestPrice;
                const firstPrice = timeframeSignals[timeframeSignals.length - 1]?.price || currentPrice;
                const change24h = ((currentPrice - firstPrice) / firstPrice) * 100;

                signals.push({
                    pair: pair.pair,
                    symbol: pair.symbol,
                    flag: pair.flag,
                    overallSignal,
                    confidence: Math.round(avgStrength),
                    currentPrice,
                    change24h,
                    timeframeSignals,
                    lastUpdated: Date.now(),
                });
            } catch (error) {
                // Error analyzing pair
            }
        }

        setForexSignals(signals);
        setLastAnalysis(Date.now());
        setIsAnalyzing(false);
    };

    // Analyze a single timeframe
    const analyzeTimeframe = async (
        symbol: string,
        granularity: number,
        candleCount: number
    ): Promise<{ 
        direction: 'BUY' | 'SELL' | 'NEUTRAL'; 
        strength: number; 
        trend: string; 
        price: number;
        sma20: number;
        sma50: number;
        sma200: number;
        ema20: number;
        ema50: number;
        ema200: number;
        rsi: number;
        macd: { macd: number; signal: number; histogram: number };
        ao: number;
        stoch: { k: number; d: number };
        adx: number;
        priceVsSma: 'ABOVE' | 'BELOW';
    }> => {
        try {
            if (!api_base.api) {
                return { 
                    direction: 'NEUTRAL', 
                    strength: 0, 
                    trend: 'No data', 
                    price: 0,
                    sma20: 0,
                    sma50: 0,
                    sma200: 0,
                    ema20: 0,
                    ema50: 0,
                    ema200: 0,
                    rsi: 50,
                    macd: { macd: 0, signal: 0, histogram: 0 },
                    ao: 0,
                    stoch: { k: 50, d: 50 },
                    adx: 0,
                    priceVsSma: 'BELOW'
                };
            }

            const endTime = Math.floor(Date.now() / 1000);
            const startTime = endTime - (granularity * candleCount);

            const response = await api_base.api.send({
                ticks_history: symbol,
                start: startTime,
                end: endTime,
                style: 'candles',
                count: candleCount,
                granularity: granularity,
            });

            if (!response.candles || response.candles.length < 10) {
                return { 
                    direction: 'NEUTRAL', 
                    strength: 0, 
                    trend: 'Insufficient data', 
                    price: 0,
                    sma20: 0,
                    sma50: 0,
                    sma200: 0,
                    ema20: 0,
                    ema50: 0,
                    ema200: 0,
                    rsi: 50,
                    macd: { macd: 0, signal: 0, histogram: 0 },
                    ao: 0,
                    stoch: { k: 50, d: 50 },
                    adx: 0,
                    priceVsSma: 'BELOW'
                };
            }

            const candles: CandleData[] = response.candles.map((c: any) => ({
                open: parseFloat(c.open),
                high: parseFloat(c.high),
                low: parseFloat(c.low),
                close: parseFloat(c.close),
                epoch: c.epoch,
            }));

            // Technical analysis
            const lastCandle = candles[candles.length - 1];
            const sma20 = calculateSMA(candles, 20);
            const sma50 = calculateSMA(candles, 50);
            const sma200 = calculateSMA(candles, 200);
            const ema20 = calculateEMA(candles, 20);
            const ema50 = calculateEMA(candles, 50);
            const ema200 = calculateEMA(candles, 200);
            const rsi = calculateRSI(candles, 14);
            const macd = calculateMACD(candles);
            const ao = calculateAO(candles);
            const stoch = calculateStochastic(candles, 14, 3);
            const adx = calculateADX(candles, 14);
            const trend = identifyTrend(candles);
            const priceVsSma: 'ABOVE' | 'BELOW' = lastCandle.close > sma20 ? 'ABOVE' : 'BELOW';

            let direction: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
            let signals = 0;
            let strength = 0;

            // Enhanced SMA20 analysis (increased weight)
            if (lastCandle.close > sma20) {
                signals++;
                strength += 25; // Increased from 15
            } else if (lastCandle.close < sma20) {
                signals--;
                strength += 25; // Increased from 15
            }

            // SMA crossover
            if (sma20 > sma50) {
                signals++;
                strength += 20;
            } else if (sma20 < sma50) {
                signals--;
                strength += 20;
            }

            // Trend alignment with SMA20 (new combined indicator)
            if (trend === 'Uptrend' && lastCandle.close > sma20) {
                signals++;
                strength += 20; // Strong bullish confirmation
            } else if (trend === 'Downtrend' && lastCandle.close < sma20) {
                signals--;
                strength += 20; // Strong bearish confirmation
            }

            // RSI
            if (rsi < 30) {
                signals++;
                strength += 15; // Reduced from 25
            } else if (rsi > 70) {
                signals--;
                strength += 15; // Reduced from 25
            }

            // MACD
            if (macd.histogram > 0 && macd.macd > macd.signal) {
                signals++;
                strength += 20; // Reduced from 25
            } else if (macd.histogram < 0 && macd.macd < macd.signal) {
                signals--;
                strength += 20; // Reduced from 25
            }

            if (signals > 0) {
                direction = 'BUY';
            } else if (signals < 0) {
                direction = 'SELL';
            }

            return {
                direction,
                strength: Math.min(100, strength),
                trend,
                price: lastCandle.close,
                sma20,
                sma50,
                sma200,
                ema20,
                ema50,
                ema200,
                rsi,
                macd,
                ao,
                stoch,
                adx,
                priceVsSma,
            };
        } catch (error) {
            return { 
                direction: 'NEUTRAL', 
                strength: 0, 
                trend: 'Error', 
                price: 0,
                sma20: 0,
                sma50: 0,
                sma200: 0,
                ema20: 0,
                ema50: 0,
                ema200: 0,
                rsi: 50,
                macd: { macd: 0, signal: 0, histogram: 0 },
                ao: 0,
                stoch: { k: 50, d: 50 },
                adx: 0,
                priceVsSma: 'BELOW'
            };
        }
    };

    // Technical indicators
    const calculateSMA = (candles: CandleData[], period: number): number => {
        if (candles.length < period) return candles[candles.length - 1]?.close || 0;
        const relevantCandles = candles.slice(-period);
        const sum = relevantCandles.reduce((acc, c) => acc + c.close, 0);
        return sum / period;
    };

    const calculateRSI = (candles: CandleData[], period: number): number => {
        if (candles.length < period + 1) return 50;

        const changes = [];
        for (let i = candles.length - period; i < candles.length; i++) {
            changes.push(candles[i].close - candles[i - 1].close);
        }

        const gains = changes.filter(c => c > 0);
        const losses = changes.filter(c => c < 0).map(c => Math.abs(c));

        const avgGain = gains.length > 0 ? gains.reduce((a, b) => a + b, 0) / period : 0;
        const avgLoss = losses.length > 0 ? losses.reduce((a, b) => a + b, 0) / period : 0;

        if (avgLoss === 0) return 100;
        const rs = avgGain / avgLoss;
        return 100 - 100 / (1 + rs);
    };

    const calculateMACD = (candles: CandleData[]): { macd: number; signal: number; histogram: number } => {
        if (candles.length < 26) return { macd: 0, signal: 0, histogram: 0 };

        const ema12 = calculateEMA(candles, 12);
        const ema26 = calculateEMA(candles, 26);
        const macd = ema12 - ema26;

        // Simplified signal line (normally would use EMA of MACD)
        const signal = macd * 0.9;
        const histogram = macd - signal;

        return { macd, signal, histogram };
    };

    const calculateEMA = (candles: CandleData[], period: number): number => {
        if (candles.length < period) return candles[candles.length - 1]?.close || 0;

        const multiplier = 2 / (period + 1);
        let ema = calculateSMA(candles.slice(0, period), period);

        for (let i = period; i < candles.length; i++) {
            ema = (candles[i].close - ema) * multiplier + ema;
        }

        return ema;
    };

    const calculateAO = (candles: CandleData[]): number => {
        if (candles.length < 34) return 0;

        // AO = SMA(median price, 5) - SMA(median price, 34)
        const medianPrices = candles.map(c => (c.high + c.low) / 2);
        
        // Calculate SMA5 of median prices
        const sma5Values = medianPrices.slice(-5);
        const sma5 = sma5Values.reduce((sum, val) => sum + val, 0) / 5;
        
        // Calculate SMA34 of median prices
        const sma34Values = medianPrices.slice(-34);
        const sma34 = sma34Values.reduce((sum, val) => sum + val, 0) / 34;
        
        return sma5 - sma34;
    };

    const calculateStochastic = (candles: CandleData[], kPeriod: number, dPeriod: number): { k: number; d: number } => {
        if (candles.length < kPeriod) return { k: 50, d: 50 };

        // Calculate %K
        const recentCandles = candles.slice(-kPeriod);
        const currentClose = candles[candles.length - 1].close;
        const lowestLow = Math.min(...recentCandles.map(c => c.low));
        const highestHigh = Math.max(...recentCandles.map(c => c.high));
        
        const k = highestHigh !== lowestLow 
            ? ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100 
            : 50;

        // Calculate %D (SMA of %K over dPeriod)
        // For simplicity, we'll calculate K values for the last dPeriod periods
        const kValues: number[] = [];
        for (let i = candles.length - dPeriod; i < candles.length; i++) {
            if (i < kPeriod - 1) continue;
            const slice = candles.slice(i - kPeriod + 1, i + 1);
            const close = candles[i].close;
            const low = Math.min(...slice.map(c => c.low));
            const high = Math.max(...slice.map(c => c.high));
            const kVal = high !== low ? ((close - low) / (high - low)) * 100 : 50;
            kValues.push(kVal);
        }

        const d = kValues.length > 0 
            ? kValues.reduce((sum, val) => sum + val, 0) / kValues.length 
            : 50;

        return { k, d };
    };

    const calculateADX = (candles: CandleData[], period: number): number => {
        if (candles.length < period + 1) return 0;

        // Calculate True Range (TR), +DM, -DM
        const trValues: number[] = [];
        const plusDM: number[] = [];
        const minusDM: number[] = [];

        for (let i = 1; i < candles.length; i++) {
            const high = candles[i].high;
            const low = candles[i].low;
            const prevHigh = candles[i - 1].high;
            const prevLow = candles[i - 1].low;
            const prevClose = candles[i - 1].close;

            // True Range
            const tr = Math.max(
                high - low,
                Math.abs(high - prevClose),
                Math.abs(low - prevClose)
            );
            trValues.push(tr);

            // Directional Movement
            const upMove = high - prevHigh;
            const downMove = prevLow - low;

            plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
            minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
        }

        // Calculate smoothed TR, +DM, -DM
        const smoothTR = trValues.slice(-period).reduce((sum, val) => sum + val, 0);
        const smoothPlusDM = plusDM.slice(-period).reduce((sum, val) => sum + val, 0);
        const smoothMinusDM = minusDM.slice(-period).reduce((sum, val) => sum + val, 0);

        // Calculate +DI and -DI
        const plusDI = smoothTR !== 0 ? (smoothPlusDM / smoothTR) * 100 : 0;
        const minusDI = smoothTR !== 0 ? (smoothMinusDM / smoothTR) * 100 : 0;

        // Calculate DX
        const diSum = plusDI + minusDI;
        const dx = diSum !== 0 ? (Math.abs(plusDI - minusDI) / diSum) * 100 : 0;

        // ADX is the smoothed average of DX (simplified - using DX directly)
        return dx;
    };

    const identifyTrend = (candles: CandleData[]): string => {
        if (candles.length < 20) return 'Consolidating';

        const sma20 = calculateSMA(candles, 20);
        const sma50 = calculateSMA(candles, Math.min(50, candles.length));
        const lastClose = candles[candles.length - 1].close;

        if (lastClose > sma20 && sma20 > sma50) return 'Uptrend';
        if (lastClose < sma20 && sma20 < sma50) return 'Downtrend';
        return 'Consolidating';
    };

    // Auto-refresh signals every 2 minutes
    useEffect(() => {
        // Initial analysis
        analyzeAllPairs();

        // Set up periodic refresh
        analysisIntervalRef.current = setInterval(() => {
            analyzeAllPairs();
        }, 2 * 60 * 1000); // 2 minutes

        return () => {
            if (analysisIntervalRef.current) {
                clearInterval(analysisIntervalRef.current);
            }
        };
    }, []); // Empty dependency - only run once on mount

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleMarketTypeChange = (newMarketType: 'forex' | 'synthetic') => {
        const newPairs = newMarketType === 'forex' ? forexPairs : syntheticIndices;
        
        setMarketType(newMarketType);
        setSelectedSymbol(newPairs[0].symbol);
        setForexSignals([]);
        setShowCards(false);
        setIsDropdownOpen(false);
    };

    const formatLastUpdate = (timestamp: number) => {
        const seconds = Math.floor((Date.now() - timestamp) / 1000);
        if (seconds < 60) return `${seconds}s ago`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        return `${hours}h ago`;
    };

    return (
        <div className="forex-container">
            {isDropdownOpen && <div className="dropdown-backdrop" onClick={() => setIsDropdownOpen(false)} />}
            <div className="forex-signals-header">
                <h1 className="signals-title">
                    <Localize i18n_default_text="Forex Trading Signals" />
                </h1>
                <div className="header-actions">
                    <div className="custom-dropdown" ref={dropdownRef}>
                        <button 
                            className={`dropdown-toggle ${isDropdownOpen ? 'open' : ''}`}
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            disabled={isAnalyzing}
                        >
                            <span className="dropdown-label">
                                {marketType === 'forex' ? (
                                    <>
                                        <span className="dropdown-icon">💱</span>
                                        Forex Pairs
                                    </>
                                ) : (
                                    <>
                                        <span className="dropdown-icon">📊</span>
                                        Synthetic Indices
                                    </>
                                )}
                            </span>
                            <span className={`dropdown-arrow ${isDropdownOpen ? 'rotate' : ''}`}>▼</span>
                        </button>
                        {isDropdownOpen && (
                            <div className="dropdown-menu">
                                <div 
                                    className={`dropdown-item ${marketType === 'forex' ? 'active' : ''}`}
                                    onClick={() => handleMarketTypeChange('forex')}
                                >
                                    <span className="dropdown-icon">💱</span>
                                    <span className="dropdown-text">Forex Pairs</span>
                                    {marketType === 'forex' && <span className="checkmark">✓</span>}
                                </div>
                                <div 
                                    className={`dropdown-item ${marketType === 'synthetic' ? 'active' : ''}`}
                                    onClick={() => handleMarketTypeChange('synthetic')}
                                >
                                    <span className="dropdown-icon">📊</span>
                                    <span className="dropdown-text">Synthetic Indices</span>
                                    {marketType === 'synthetic' && <span className="checkmark">✓</span>}
                                </div>
                            </div>
                        )}
                    </div>
                    <button
                        className="toggle-cards-btn"
                        onClick={() => setShowCards(!showCards)}
                    >
                        <svg 
                            width="16" 
                            height="16" 
                            viewBox="0 0 16 16" 
                            fill="none" 
                            className={`toggle-icon ${showCards ? 'rotate-down' : 'rotate-up'}`}
                        >
                            <path 
                                d="M4 6L8 10L12 6" 
                                stroke="currentColor" 
                                strokeWidth="2" 
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                            />
                        </svg>
                        <span>{showCards ? 'Hide Pairs' : 'Show Pairs'}</span>
                    </button>
                    <button
                        className="analyze-btn"
                        onClick={analyzeAllPairs}
                        disabled={isAnalyzing}
                    >
                        {isAnalyzing ? 'Analyzing...' : 'Refresh Signals'}
                    </button>
                    {lastAnalysis > 0 && (
                        <span className="last-update">
                            Last updated: {formatLastUpdate(lastAnalysis)}
                        </span>
                    )}
                </div>
            </div>

            {!showCards && selectedSymbol && (
                <div className="selected-pair-header">
                    {isAnalyzing ? (
                        <>
                            <div className="analyzing-state">
                                <div className="loading-spinner-small"></div>
                                <span className="analyzing-text">Analyzing {marketType === 'forex' ? 'forex pairs' : 'synthetic indices'}...</span>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="selected-pair-info">
                                <span className="selected-pair-name">
                                    {forexSignals.find(s => s.symbol === selectedSymbol)?.pair || 
                                     currentPairs.find(p => p.symbol === selectedSymbol)?.pair}
                                </span>
                                {currentPrices[selectedSymbol] > 0 && (
                                    <div className="selected-pair-price">
                                        <span className="price-label">Price:</span>
                                        <span className="price-value">{currentPrices[selectedSymbol].toFixed(5)}</span>
                                    </div>
                                )}
                            </div>
                            {forexSignals.find(s => s.symbol === selectedSymbol)?.overallSignal && (
                                <span className={`selected-pair-signal ${forexSignals.find(s => s.symbol === selectedSymbol)?.overallSignal.toLowerCase()}`}>
                                    {forexSignals.find(s => s.symbol === selectedSymbol)?.overallSignal}
                                </span>
                            )}
                        </>
                    )}
                </div>
            )}

            {showCards && (
                <div className="signals-grid">
                    {forexSignals.length === 0 && !isAnalyzing && (
                        <div className="signals-placeholder">
                            <div className="placeholder-icon">📊</div>
                            <p>Click "Refresh Signals" to analyze all forex pairs</p>
                        </div>
                    )}

                    {isAnalyzing && forexSignals.length === 0 && (
                        <div className="signals-loading">
                        <div className="loading-spinner"></div>
                        <p>Analyzing all timeframes for all currency pairs...</p>
                    </div>
                )}

                {forexSignals.map(signal => (
                    <div 
                        key={signal.symbol} 
                        className={`signal-card ${selectedSymbol === signal.symbol ? 'selected' : ''}`}
                        onClick={() => {
                            setSelectedSymbol(signal.symbol);
                            setShowCards(false);
                        }}
                    >
                        <div className="signal-header">
                            <div className="pair-info">
                                <div>
                                    <h3 className="pair-name">{signal.pair}</h3>
                                    <div className="price-info">
                                        <span className="current-price">
                                            {(currentPrices[signal.symbol] || signal.currentPrice).toFixed(5)}
                                        </span>
                                        <span
                                            className={`change-24h ${signal.change24h >= 0 ? 'positive' : 'negative'}`}
                                        >
                                            {signal.change24h >= 0 ? '+' : ''}
                                            {signal.change24h.toFixed(2)}%
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="overall-signal">
                                <div className={`signal-badge ${signal.overallSignal.toLowerCase()}`}>
                                    {signal.overallSignal}
                                </div>
                                <div className="confidence">
                                    {signal.confidence}% confidence
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
                </div>
            )}

            {selectedSymbol && forexSignals.find(s => s.symbol === selectedSymbol) && (
                <div className="signal-details">
                    {(() => {
                        const selectedSignal = forexSignals.find(s => s.symbol === selectedSymbol)!;
                        return (
                            <>
                                <div className="details-header">
                                    <h2 className="details-title">
                                        {selectedSignal.flag} {selectedSignal.pair} - Detailed Analysis
                                    </h2>
                                    <button 
                                        className="close-details"
                                        onClick={() => setSelectedSymbol('')}
                                    >
                                        ✕
                                    </button>
                                </div>

                                <div className="details-table-container">
                                    <table className="details-table vertical">
                                        <thead>
                                            <tr>
                                                <th>Metric</th>
                                                {selectedSignal.timeframeSignals.map(tf => (
                                                    <th key={tf.timeframe}>{tf.timeframe}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td className="metric-label">Signal</td>
                                                {selectedSignal.timeframeSignals.map(tf => (
                                                    <td key={tf.timeframe} className={`signal-cell ${tf.direction.toLowerCase()}`}>
                                                        <span className="signal-icon">
                                                            {tf.direction === 'BUY' && '↗'}
                                                            {tf.direction === 'SELL' && '↘'}
                                                            {tf.direction === 'NEUTRAL' && '→'}
                                                        </span>
                                                        <span className="signal-text">{tf.direction}</span>
                                                    </td>
                                                ))}
                                            </tr>
                                            <tr>
                                                <td className="metric-label">SMA20</td>
                                                {selectedSignal.timeframeSignals.map(tf => {
                                                    const signal = tf.price > tf.sma20 ? 'BUY' : tf.price < tf.sma20 ? 'SELL' : 'NEUTRAL';
                                                    return (
                                                        <td key={tf.timeframe} className={`signal-cell ${signal.toLowerCase()}`}>
                                                            {signal}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                            <tr>
                                                <td className="metric-label">SMA50</td>
                                                {selectedSignal.timeframeSignals.map(tf => {
                                                    const signal = tf.price > tf.sma50 ? 'BUY' : tf.price < tf.sma50 ? 'SELL' : 'NEUTRAL';
                                                    return (
                                                        <td key={tf.timeframe} className={`signal-cell ${signal.toLowerCase()}`}>
                                                            {signal}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                            <tr>
                                                <td className="metric-label">SMA200</td>
                                                {selectedSignal.timeframeSignals.map(tf => {
                                                    const signal = tf.price > tf.sma200 ? 'BUY' : tf.price < tf.sma200 ? 'SELL' : 'NEUTRAL';
                                                    return (
                                                        <td key={tf.timeframe} className={`signal-cell ${signal.toLowerCase()}`}>
                                                            {signal}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                            <tr>
                                                <td className="metric-label">EMA20</td>
                                                {selectedSignal.timeframeSignals.map(tf => {
                                                    const signal = tf.price > tf.ema20 ? 'BUY' : tf.price < tf.ema20 ? 'SELL' : 'NEUTRAL';
                                                    return (
                                                        <td key={tf.timeframe} className={`signal-cell ${signal.toLowerCase()}`}>
                                                            {signal}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                            <tr>
                                                <td className="metric-label">EMA50</td>
                                                {selectedSignal.timeframeSignals.map(tf => {
                                                    const signal = tf.price > tf.ema50 ? 'BUY' : tf.price < tf.ema50 ? 'SELL' : 'NEUTRAL';
                                                    return (
                                                        <td key={tf.timeframe} className={`signal-cell ${signal.toLowerCase()}`}>
                                                            {signal}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                            <tr>
                                                <td className="metric-label">EMA200</td>
                                                {selectedSignal.timeframeSignals.map(tf => {
                                                    const signal = tf.price > tf.ema200 ? 'BUY' : tf.price < tf.ema200 ? 'SELL' : 'NEUTRAL';
                                                    return (
                                                        <td key={tf.timeframe} className={`signal-cell ${signal.toLowerCase()}`}>
                                                            {signal}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                            <tr>
                                                <td className="metric-label">RSI(14)</td>
                                                {selectedSignal.timeframeSignals.map(tf => {
                                                    const signal = tf.rsi < 30 ? 'BUY' : tf.rsi > 70 ? 'SELL' : 'NEUTRAL';
                                                    return (
                                                        <td key={tf.timeframe} className={`signal-cell ${signal.toLowerCase()}`}>
                                                            {signal}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                            <tr>
                                                <td className="metric-label">MACD</td>
                                                {selectedSignal.timeframeSignals.map(tf => {
                                                    const signal = tf.macd.histogram > 0 ? 'BUY' : tf.macd.histogram < 0 ? 'SELL' : 'NEUTRAL';
                                                    return (
                                                        <td key={tf.timeframe} className={`signal-cell ${signal.toLowerCase()}`}>
                                                            {signal}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                            <tr>
                                                <td className="metric-label">AO</td>
                                                {selectedSignal.timeframeSignals.map(tf => {
                                                    const signal = tf.ao > 0 ? 'BUY' : tf.ao < 0 ? 'SELL' : 'NEUTRAL';
                                                    return (
                                                        <td key={tf.timeframe} className={`signal-cell ${signal.toLowerCase()}`}>
                                                            {signal}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                            <tr>
                                                <td className="metric-label">STOCH</td>
                                                {selectedSignal.timeframeSignals.map(tf => {
                                                    const signal = tf.stoch.k < 20 ? 'BUY' : tf.stoch.k > 80 ? 'SELL' : 'NEUTRAL';
                                                    return (
                                                        <td key={tf.timeframe} className={`signal-cell ${signal.toLowerCase()}`}>
                                                            {signal}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                            <tr>
                                                <td className="metric-label">ADX(14)</td>
                                                {selectedSignal.timeframeSignals.map(tf => {
                                                    const signal = tf.adx > 25 ? (tf.direction === 'BUY' ? 'BUY' : tf.direction === 'SELL' ? 'SELL' : 'NEUTRAL') : 'NEUTRAL';
                                                    return (
                                                        <td key={tf.timeframe} className={`signal-cell ${signal.toLowerCase()}`}>
                                                            {signal}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                            <tr>
                                                <td className="metric-label">Trend</td>
                                                {selectedSignal.timeframeSignals.map(tf => {
                                                    const signal = tf.trend === 'Uptrend' ? 'BUY' : tf.trend === 'Downtrend' ? 'SELL' : 'NEUTRAL';
                                                    return (
                                                        <td key={tf.timeframe} className={`signal-cell ${signal.toLowerCase()}`}>
                                                            {signal}
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>

                                <div className="details-summary">
                                    <div className="summary-item">
                                        <span className="summary-label">Current Price:</span>
                                        <span className="summary-value">
                                            {(currentPrices[selectedSignal.symbol] || selectedSignal.currentPrice).toFixed(5)}
                                        </span>
                                    </div>
                                    <div className="summary-item">
                                        <span className="summary-label">24h Change:</span>
                                        <span className={`summary-value ${selectedSignal.change24h >= 0 ? 'positive' : 'negative'}`}>
                                            {selectedSignal.change24h >= 0 ? '+' : ''}{selectedSignal.change24h.toFixed(2)}%
                                        </span>
                                    </div>
                                    <div className="summary-item">
                                        <span className="summary-label">Overall Signal:</span>
                                        <span className={`summary-badge ${selectedSignal.overallSignal.toLowerCase()}`}>
                                            {selectedSignal.overallSignal}
                                        </span>
                                    </div>
                                    <div className="summary-item">
                                        <span className="summary-label">Confidence:</span>
                                        <span className="summary-value">{selectedSignal.confidence}%</span>
                                    </div>
                                </div>
                            </>
                        );
                    })()}
                </div>
            )}
        </div>
    );
});

export default Forex;
