interface TickData {
    time: number;
    quote: number;
    last_digit?: number;
}

interface MarketStats {
    digitCounts: number[];
    digitPercentages: number[];
    overTwoPercentage: number;
    underSevenPercentage: number;
    sampleSize: number;
    recommendation: 'over' | 'under' | 'neutral';
    lastUpdated: number;
    mostFrequentDigit: number;
    currentLastDigit: number;
}

interface SymbolAnalysis {
    symbol: string;
    stats: MarketStats;
    tradingOpportunity: 'under7' | 'over2' | 'none';
    signalStrength: number;
}

export interface TradeRecommendation {
    symbol: string;
    strategy: 'over' | 'under';
    barrier: string;
    overPercentage: number;
    underPercentage: number;
    mostFrequentDigit: number;
    currentLastDigit: number;
    reason: string;
}

type AnalysisCallback = (recommendation: TradeRecommendation, allAnalyses: Record<string, MarketStats>) => void;

class MarketAnalyzer {
    private tickHistories: Record<string, TickData[]> = {};
    private websockets: Record<string, WebSocket> = {};
    private decimalPlaces: Record<string, number> = {};
    private symbols = ['R_10', 'R_25', 'R_50', 'R_75', 'R_100', 'RDBEAR', 'RDBULL', '1HZ10V', '1HZ15V', '1HZ25V', '1HZ30V', '1HZ50V', '1HZ75V', '1HZ90V', '1HZ100V'];
    private marketStats: Record<string, MarketStats> = {};
    private tickCount = 100; // Explicitly using 100 ticks for analysis
    private analysisCallbacks: AnalysisCallback[] = [];
    private isRunning = false;
    private analysisInterval: NodeJS.Timeout | null = null;
    private currentRecommendation: TradeRecommendation | null = null;
    private marketReadiness: Record<string, boolean> = {};
    private isAnalysisReady = false;
    private minSampleSize = 30;
    private analysisStartTime = 0;
    private minAnalysisPeriodMs = 5000; // Minimum 5 seconds of data collection before trading
    private historyLoadedCount = 0;
    private initialHistoryLoaded = false;
    private lastAnalysisTime = 0;
    private analysisCount = 0;

    constructor() {
        this.initializeAnalysis();
    }

    private initializeAnalysis() {
        this.symbols.forEach(symbol => {
            this.tickHistories[symbol] = [];
            this.decimalPlaces[symbol] = 2;
            this.marketStats[symbol] = this.createEmptyStats();
            this.marketReadiness[symbol] = false;
        });
        this.isAnalysisReady = false;
    }

    private createEmptyStats(): MarketStats {
        return {
            digitCounts: new Array(10).fill(0),
            digitPercentages: new Array(10).fill(0),
            overTwoPercentage: 0,
            underSevenPercentage: 0,
            sampleSize: 0,
            recommendation: 'neutral',
            lastUpdated: Date.now(),
            mostFrequentDigit: -1,
            currentLastDigit: -1,
        };
    }

    public start(): void {
        if (this.isRunning) return;

        console.log('Market analyzer starting...');
        this.isRunning = true;
        this.isAnalysisReady = false;
        this.analysisStartTime = Date.now();
        this.historyLoadedCount = 0;
        this.initialHistoryLoaded = false;

        // Reset market readiness
        this.symbols.forEach(symbol => {
            this.marketReadiness[symbol] = false;
        });

        // Start WebSockets for all symbols and immediately load history
        this.symbols.forEach(symbol => {
            this.startWebSocket(symbol);
        });

        console.log(`Starting analysis with ${this.tickCount} ticks of historical data per symbol`);

        // Run analysis every second after loading historical data
        this.analysisInterval = setInterval(() => {
            if (this.initialHistoryLoaded) {
                this.runAnalysis();
            }
            this.checkAnalysisReadiness();
        }, 1000);
    }

    public stop(): void {
        console.log('Market analyzer stopping...');
        this.isRunning = false;

        if (this.analysisInterval) {
            clearInterval(this.analysisInterval);
            this.analysisInterval = null;
        }

        // Close all WebSockets
        Object.values(this.websockets).forEach(ws => {
            try {
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.close();
                }
            } catch (error) {
                console.error('Error closing WebSocket:', error);
            }
        });

        this.websockets = {};
    }

    public onAnalysis(callback: AnalysisCallback): () => void {
        this.analysisCallbacks.push(callback);

        // If we already have a recommendation, send it immediately
        if (this.currentRecommendation) {
            callback(this.currentRecommendation, { ...this.marketStats });
        }

        // Return an unsubscribe function
        return () => {
            this.analysisCallbacks = this.analysisCallbacks.filter(cb => cb !== callback);
        };
    }

    public getCurrentRecommendation(): TradeRecommendation | null {
        return this.currentRecommendation;
    }

    public isReadyForTrading(): boolean {
        return this.isAnalysisReady;
    }

    public waitForAnalysisReady(): Promise<void> {
        return new Promise(resolve => {
            if (this.isAnalysisReady) {
                resolve();
                return;
            }

            const checkReadiness = setInterval(() => {
                if (this.isAnalysisReady) {
                    clearInterval(checkReadiness);
                    resolve();
                }
            }, 500);
        });
    }

    private checkAnalysisReadiness(): void {
        if (this.isAnalysisReady) return;

        // Check if we've collected enough historical data from all symbols
        let allMarketsReady = true;
        let readyCount = 0;

        for (const symbol of this.symbols) {
            // A market is ready when it has at least minSampleSize ticks
            const hasMinimumData = this.tickHistories[symbol].length >= this.minSampleSize;
            this.marketReadiness[symbol] = hasMinimumData;

            if (hasMinimumData) {
                readyCount++;
            } else {
                allMarketsReady = false;
            }
        }

        // Ensure we've collected data for minimum time period
        const hasMinAnalysisTime = Date.now() - this.analysisStartTime >= this.minAnalysisPeriodMs;

        // More detailed logging on readiness status
        if (!this.isAnalysisReady && this.isRunning) {
            console.log(
                `Analysis readiness check - Markets ready: ${readyCount}/${this.symbols.length}, Time condition: ${hasMinAnalysisTime}`
            );
        }

        if (allMarketsReady && hasMinAnalysisTime) {
            console.log('Market analysis ready - all markets have sufficient data');
            this.isAnalysisReady = true;

            // Force a full analysis now that we're ready
            this.runAnalysis();
        }
    }

    private startWebSocket(symbol: string): void {
        if (this.websockets[symbol]) {
            try {
                this.websockets[symbol].close();
            } catch (e) {
                console.error(`Error closing WebSocket for ${symbol}:`, e);
            }
        }

        const ws = new WebSocket('wss://api.derivws.com/trading/v1/options/ws/public');
        this.websockets[symbol] = ws;

        ws.onopen = () => {
            // Request historical ticks immediately when socket opens
            console.log(`WebSocket connected for ${symbol}, requesting ${this.tickCount} historical ticks...`);
            this.requestTickHistory(symbol, ws);
        };

        ws.onmessage = event => {
            const data = JSON.parse(event.data);

            if (data.history) {
                // Process historical data
                this.historyLoadedCount++;
                const tickCount = data.history.prices.length;
                console.log(
                    `Received ${tickCount} historical ticks for ${symbol} (${this.historyLoadedCount}/${this.symbols.length})`
                );

                this.tickHistories[symbol] = data.history.prices.map((price: string, index: number) => ({
                    time: data.history.times[index],
                    quote: parseFloat(price),
                }));

                this.detectDecimalPlaces(symbol);
                this.processLastDigits(symbol);

                // Check if we've loaded history for all symbols
                if (this.historyLoadedCount === this.symbols.length && !this.initialHistoryLoaded) {
                    this.initialHistoryLoaded = true;
                    console.log('Historical data loaded for all symbols, starting full analysis');
                    // Force an analysis run right away
                    this.runAnalysis();
                    this.checkAnalysisReadiness();
                }
            } else if (data.tick) {
                const tickQuote = parseFloat(data.tick.quote);
                this.tickHistories[symbol].push({
                    time: data.tick.epoch,
                    quote: tickQuote,
                });

                if (this.tickHistories[symbol].length > this.tickCount) {
                    this.tickHistories[symbol].shift();
                }

                this.detectDecimalPlaces(symbol);
                this.processLastDigits(symbol);
            }
        };

        ws.onerror = error => {
            console.error(`WebSocket error for ${symbol}:`, error);
        };

        ws.onclose = () => {
            if (this.isRunning) {
                // Attempt to reconnect after 5 seconds if we're still running
                setTimeout(() => {
                    if (this.isRunning) {
                        this.startWebSocket(symbol);
                    }
                }, 5000);
            }
        };
    }

    private requestTickHistory(symbol: string, ws: WebSocket): void {
        const request = {
            ticks_history: symbol,
            count: this.tickCount, // Request exactly 100 ticks
            end: 'latest',
            style: 'ticks',
            subscribe: 1,
        };
        console.log(`Requesting ${this.tickCount} ticks of history for ${symbol}`);
        ws.send(JSON.stringify(request));
    }

    private detectDecimalPlaces(symbol: string): void {
        const tickHistory = this.tickHistories[symbol];
        if (tickHistory.length === 0) return;

        const decimalCounts = tickHistory.map(tick => {
            const decimalPart = tick.quote.toString().split('.')[1] || '';
            return decimalPart.length;
        });

        this.decimalPlaces[symbol] = Math.max(...decimalCounts, 2);
    }

    private processLastDigits(symbol: string): void {
        const tickHistory = this.tickHistories[symbol];

        tickHistory.forEach(tick => {
            if (tick.last_digit === undefined) {
                tick.last_digit = this.getLastDigit(tick.quote, symbol);
            }
        });
    }

    private getLastDigit(price: number, symbol: string): number {
        const priceStr = price.toString();
        const priceParts = priceStr.split('.');
        let decimals = priceParts[1] || '';

        while (decimals.length < this.decimalPlaces[symbol]) {
            decimals += '0';
        }

        return Number(decimals.slice(-1));
    }

    private runAnalysis(): void {
        if (!this.isRunning) return;

        // Skip analysis if historical data hasn't loaded for all symbols yet
        if (!this.initialHistoryLoaded) {
            console.log('Waiting for historical data to load for all symbols...');
            return;
        }

        // Track how often analysis is running
        this.analysisCount++;
        this.lastAnalysisTime = Date.now();
        if (this.analysisCount % 10 === 0) {
            console.log(`Market analysis running (count: ${this.analysisCount})`);
        }

        // Track which symbols were successfully analyzed
        const analyzedSymbols: string[] = [];

        this.symbols.forEach(symbol => {
            const tickHistory = this.tickHistories[symbol];
            if (tickHistory.length < this.minSampleSize) {
                console.log(`Waiting for more data on ${symbol}: ${tickHistory.length}/${this.minSampleSize}`);
                return; // Skip analysis if we don't have enough data
            }

            // Count occurrences of each last digit
            const digitCounts = new Array(10).fill(0);

            tickHistory.forEach(tick => {
                const lastDigit =
                    tick.last_digit !== undefined ? tick.last_digit : this.getLastDigit(tick.quote, symbol);
                digitCounts[lastDigit]++;
            });

            // Calculate percentages for each digit
            const digitPercentages = digitCounts.map(count => (count / tickHistory.length) * 100);

            // Find the most frequent digit
            let mostFrequentDigit = 0;
            let maxCount = digitCounts[0];

            for (let i = 1; i < 10; i++) {
                if (digitCounts[i] > maxCount) {
                    maxCount = digitCounts[i];
                    mostFrequentDigit = i;
                }
            }

            // Get the current last digit from the most recent tick
            const currentLastDigit =
                tickHistory.length > 0
                    ? (tickHistory[tickHistory.length - 1].last_digit ??
                      this.getLastDigit(tickHistory[tickHistory.length - 1].quote, symbol))
                    : -1;

            // Calculate over 2 and under 7 percentages (keep for backward compatibility)
            const overTwoDigits = [3, 4, 5, 6, 7, 8, 9];
            const underSevenDigits = [0, 1, 2, 3, 4, 5, 6];

            const overTwoCount = overTwoDigits.reduce((sum, digit) => sum + digitCounts[digit], 0);
            const overTwoPercentage = (overTwoCount / tickHistory.length) * 100;

            const underSevenCount = underSevenDigits.reduce((sum, digit) => sum + digitCounts[digit], 0);
            const underSevenPercentage = (underSevenCount / tickHistory.length) * 100;

            // Determine recommendation based on the new pattern logic
            let recommendation: 'over' | 'under' | 'neutral' = 'neutral';

            // New logic for recommendation (flipped logic)
            const lowDigits = [0, 1, 2];
            const highDigits = [7, 8, 9];

            if (lowDigits.includes(mostFrequentDigit) && highDigits.includes(currentLastDigit)) {
                recommendation = 'under'; // recommend under 7
            } else if (highDigits.includes(mostFrequentDigit) && lowDigits.includes(currentLastDigit)) {
                recommendation = 'over'; // recommend over 2
            }

            // Update market stats with new pattern analysis data
            this.marketStats[symbol] = {
                digitCounts,
                digitPercentages,
                overTwoPercentage,
                underSevenPercentage,
                sampleSize: tickHistory.length,
                recommendation,
                lastUpdated: Date.now(),
                mostFrequentDigit,
                currentLastDigit,
            };

            analyzedSymbols.push(symbol);
        });

        // Only update recommendations if all symbols have been analyzed
        if (analyzedSymbols.length === this.symbols.length) {
            this.updateBestRecommendation();
        } else {
            console.log(`Analysis incomplete: ${analyzedSymbols.length}/${this.symbols.length} markets analyzed`);
        }
    }

    private updateBestRecommendation(): void {
        const analyses: SymbolAnalysis[] = this.symbols.map(symbol => {
            const stats = this.marketStats[symbol];
            let tradingOpportunity: 'under7' | 'over2' | 'none' = 'none';
            let signalStrength = 0;

            // Check for specific patterns based on the new rules
            const lowDigits = [0, 1, 2];
            const highDigits = [7, 8, 9];

            if (lowDigits.includes(stats.mostFrequentDigit) && highDigits.includes(stats.currentLastDigit)) {
                tradingOpportunity = 'under7';
                // Signal strength is based on how frequent the most frequent digit is
                signalStrength = stats.digitPercentages[stats.mostFrequentDigit];
            } else if (highDigits.includes(stats.mostFrequentDigit) && lowDigits.includes(stats.currentLastDigit)) {
                tradingOpportunity = 'over2';
                signalStrength = stats.digitPercentages[stats.mostFrequentDigit];
            }

            return {
                symbol,
                stats,
                tradingOpportunity,
                signalStrength,
            };
        });

        // Log all market analysis results with new pattern information
        console.log('Pattern-Based Market Analysis Results:');
        analyses.forEach(analysis => {
            const { symbol, stats, tradingOpportunity, signalStrength } = analysis;
            console.log(
                `${symbol}: Most frequent digit: ${stats.mostFrequentDigit} (${stats.digitPercentages[stats.mostFrequentDigit].toFixed(1)}%), ` +
                    `Current last digit: ${stats.currentLastDigit}, ` +
                    `Opportunity: ${tradingOpportunity}, Strength: ${signalStrength.toFixed(1)}`
            );
        });

        // Filter opportunities and sort by signal strength
        const under7Opportunities = analyses
            .filter(a => a.tradingOpportunity === 'under7')
            .sort((a, b) => b.signalStrength - a.signalStrength);

        const over2Opportunities = analyses
            .filter(a => a.tradingOpportunity === 'over2')
            .sort((a, b) => b.signalStrength - a.signalStrength);

        // Select the best opportunity
        let recommendation: TradeRecommendation | null = null;

        // First check if there are any opportunities at all
        if (under7Opportunities.length > 0 || over2Opportunities.length > 0) {
            // Decide which is stronger
            if (
                under7Opportunities.length > 0 &&
                (over2Opportunities.length === 0 ||
                    under7Opportunities[0].signalStrength > over2Opportunities[0].signalStrength)
            ) {
                const best = under7Opportunities[0];
                recommendation = {
                    symbol: best.symbol,
                    strategy: 'under',
                    barrier: '7',
                    overPercentage: best.stats.overTwoPercentage,
                    underPercentage: best.stats.underSevenPercentage,
                    mostFrequentDigit: best.stats.mostFrequentDigit,
                    currentLastDigit: best.stats.currentLastDigit,
                    reason: `Most frequent digit ${best.stats.mostFrequentDigit} (low) with last digit ${best.stats.currentLastDigit} (high)`,
                };
            } else if (over2Opportunities.length > 0) {
                const best = over2Opportunities[0];
                recommendation = {
                    symbol: best.symbol,
                    strategy: 'over',
                    barrier: '2',
                    overPercentage: best.stats.overTwoPercentage,
                    underPercentage: best.stats.underSevenPercentage,
                    mostFrequentDigit: best.stats.mostFrequentDigit,
                    currentLastDigit: best.stats.currentLastDigit,
                    reason: `Most frequent digit ${best.stats.mostFrequentDigit} (high) with last digit ${best.stats.currentLastDigit} (low)`,
                };
            }
        }

        // IMPORTANT: Update the current recommendation
        const oldRec = this.currentRecommendation;
        this.currentRecommendation = recommendation;

        // Log when recommendation changes
        if (
            recommendation &&
            (!oldRec || oldRec.symbol !== recommendation.symbol || oldRec.strategy !== recommendation.strategy)
        ) {
            console.log(
                `New pattern recommendation: ${recommendation.strategy.toUpperCase()} ${recommendation.barrier} on ${recommendation.symbol} - ` +
                    `${recommendation.reason} (Strength: ${analyses.find(a => a.symbol === recommendation.symbol)?.signalStrength.toFixed(1)}%)`
            );
        } else if (!recommendation) {
            console.log('No valid pattern-based trading opportunities found');
        }

        // Always notify subscribers - even if the recommendation hasn't changed
        // This ensures the UI knows an analysis has occurred
        this.analysisCallbacks.forEach(callback => {
            // Always send a recommendation (may be null) and market stats
            callback(this.currentRecommendation, { ...this.marketStats });
        });

        // Log analysis completion
        console.log(`Analysis #${this.analysisCount} complete at ${new Date().toLocaleTimeString()}`);
    }

    /**
     * Forces an immediate analysis and returns the latest recommendation
     * This ensures we have fresh data before each trade
     */
    public getLatestRecommendation(): Promise<TradeRecommendation | null> {
        return new Promise(resolve => {
            if (!this.isAnalysisReady) {
                this.waitForAnalysisReady().then(() => {
                    console.log('Running fresh analysis after becoming ready');
                    this.runAnalysis();
                    resolve(this.currentRecommendation);
                });
            } else {
                console.log('Running fresh analysis for trade decision');
                this.runAnalysis();
                resolve(this.currentRecommendation);
            }
        });
    }

    /**
     * Returns analytics about the analyzer's performance
     */
    public getAnalyticsInfo(): {
        analysisCount: number;
        lastAnalysisTime: number;
        ticksPerSymbol: Record<string, number>;
    } {
        const ticksPerSymbol: Record<string, number> = {};
        this.symbols.forEach(symbol => {
            ticksPerSymbol[symbol] = this.tickHistories[symbol]?.length || 0;
        });

        return {
            analysisCount: this.analysisCount,
            lastAnalysisTime: this.lastAnalysisTime,
            ticksPerSymbol,
        };
    }
}

// Create a singleton instance
const marketAnalyzer = new MarketAnalyzer();
export default marketAnalyzer;
