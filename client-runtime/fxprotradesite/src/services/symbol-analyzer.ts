/**
 * Symbol Analyzer Service
 * Analyzes tick data for symbols to provide insights for trading strategies
 */

export interface TickData {
    time: number;
    quote: number;
    last_digit?: number;
}

export interface SymbolAnalysis {
    symbol: string;
    total_ticks: number;
    digit_frequencies: number[];
    digit_percentages: number[];
    even_percentage: number;
    odd_percentage: number;
    over_percentage: number;
    under_percentage: number;
    most_frequent_digit: number;
    least_frequent_digit: number;
    current_last_digit?: number;
    streaks: {
        even_streak: number;
        odd_streak: number;
        current_streak_type: 'even' | 'odd';
        current_streak_length: number;
    };
    patterns: {
        last_n_even_odd: Array<'E' | 'O'>;
        even_odd_ratio: number;
    };
    volatility: {
        price_range: number;
        average_change: number;
        direction_bias: 'rise' | 'fall' | 'neutral';
    };
}

export class SymbolAnalyzer {
    private tickHistory: { [symbol: string]: TickData[] } = {};
    private maxTickHistory = 1000; // Keep last 1000 ticks per symbol
    private decimalPlaces: { [symbol: string]: number } = {};

    /**
     * Add tick data for a symbol
     */
    addTick(symbol: string, tick: TickData): void {
        if (!this.tickHistory[symbol]) {
            this.tickHistory[symbol] = [];
        }

        // Add last digit if not present
        if (tick.last_digit === undefined) {
            tick.last_digit = this.getLastDigit(tick.quote, symbol);
        }

        this.tickHistory[symbol].push(tick);

        // Keep only the most recent ticks
        if (this.tickHistory[symbol].length > this.maxTickHistory) {
            this.tickHistory[symbol].shift();
        }

        // Update decimal places for this symbol
        this.updateDecimalPlaces(symbol, tick.quote);
    }

    /**
     * Get analysis for a symbol
     */
    getAnalysis(symbol: string): SymbolAnalysis | null {
        const ticks = this.tickHistory[symbol];
        if (!ticks || ticks.length === 0) {
            return null;
        }

        return this.analyzeSymbol(symbol, ticks);
    }

    /**
     * Get even/odd percentage for last N digits
     */
    getEvenOddPercentage(symbol: string, tickCount: number): { even: number; odd: number } | null {
        const ticks = this.tickHistory[symbol];
        if (!ticks || ticks.length === 0) {
            return null;
        }

        const recentTicks = ticks.slice(-tickCount);
        const evenCount = recentTicks.filter(tick => (tick.last_digit || 0) % 2 === 0).length;
        const oddCount = recentTicks.length - evenCount;

        return {
            even: (evenCount / recentTicks.length) * 100,
            odd: (oddCount / recentTicks.length) * 100
        };
    }

    /**
     * Check if last N digits match a pattern (all even or all odd)
     */
    checkEvenOddPattern(symbol: string, tickCount: number, pattern: 'even' | 'odd'): boolean {
        const ticks = this.tickHistory[symbol];
        if (!ticks || ticks.length < tickCount) {
            return false;
        }

        const recentTicks = ticks.slice(-tickCount);
        return recentTicks.every(tick => {
            const digit = tick.last_digit || 0;
            return pattern === 'even' ? digit % 2 === 0 : digit % 2 !== 0;
        });
    }

    /**
     * Get current streak information
     */
    getCurrentStreak(symbol: string): { type: 'even' | 'odd'; length: number } | null {
        const ticks = this.tickHistory[symbol];
        if (!ticks || ticks.length === 0) {
            return null;
        }

        const lastDigit = ticks[ticks.length - 1].last_digit || 0;
        const currentType: 'even' | 'odd' = lastDigit % 2 === 0 ? 'even' : 'odd';
        
        let streakLength = 1;
        for (let i = ticks.length - 2; i >= 0; i--) {
            const digit = ticks[i].last_digit || 0;
            const digitType: 'even' | 'odd' = digit % 2 === 0 ? 'even' : 'odd';
            
            if (digitType === currentType) {
                streakLength++;
            } else {
                break;
            }
        }

        return { type: currentType, length: streakLength };
    }

    /**
     * Clear history for a symbol
     */
    clearSymbol(symbol: string): void {
        delete this.tickHistory[symbol];
        delete this.decimalPlaces[symbol];
    }

    /**
     * Clear all data
     */
    clearAll(): void {
        this.tickHistory = {};
        this.decimalPlaces = {};
    }

    private analyzeSymbol(symbol: string, ticks: TickData[]): SymbolAnalysis {
        // Calculate digit frequencies
        const digitCounts = new Array(10).fill(0);
        ticks.forEach(tick => {
            const digit = tick.last_digit || 0;
            digitCounts[digit]++;
        });

        const digitPercentages = digitCounts.map(count => (count / ticks.length) * 100);

        // Find most and least frequent digits
        let mostFrequentDigit = 0;
        let leastFrequentDigit = 0;
        let maxCount = digitCounts[0];
        let minCount = digitCounts[0];

        for (let i = 1; i < 10; i++) {
            if (digitCounts[i] > maxCount) {
                maxCount = digitCounts[i];
                mostFrequentDigit = i;
            }
            if (digitCounts[i] < minCount) {
                minCount = digitCounts[i];
                leastFrequentDigit = i;
            }
        }

        // Calculate even/odd statistics
        const evenCount = digitCounts.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0);
        const oddCount = ticks.length - evenCount;
        const evenPercentage = (evenCount / ticks.length) * 100;
        const oddPercentage = (oddCount / ticks.length) * 100;

        // Calculate over/under statistics (using barrier of 5)
        const overCount = digitCounts.slice(5).reduce((a, b) => a + b, 0);
        const underCount = digitCounts.slice(0, 5).reduce((a, b) => a + b, 0);
        const overPercentage = (overCount / ticks.length) * 100;
        const underPercentage = (underCount / ticks.length) * 100;

        // Calculate streaks
        const streakInfo = this.calculateStreaks(ticks);

        // Calculate patterns
        const lastNDigits = ticks.slice(-20).map(tick => {
            const digit = tick.last_digit || 0;
            return digit % 2 === 0 ? 'E' : 'O';
        });

        // Calculate volatility
        const volatilityInfo = this.calculateVolatility(ticks);

        return {
            symbol,
            total_ticks: ticks.length,
            digit_frequencies: digitCounts,
            digit_percentages: digitPercentages,
            even_percentage: evenPercentage,
            odd_percentage: oddPercentage,
            over_percentage: overPercentage,
            under_percentage: underPercentage,
            most_frequent_digit: mostFrequentDigit,
            least_frequent_digit: leastFrequentDigit,
            current_last_digit: ticks[ticks.length - 1]?.last_digit,
            streaks: streakInfo,
            patterns: {
                last_n_even_odd: lastNDigits,
                even_odd_ratio: evenPercentage / oddPercentage
            },
            volatility: volatilityInfo
        };
    }

    private calculateStreaks(ticks: TickData[]) {
        let evenStreak = 0;
        let oddStreak = 0;
        let currentStreakLength = 1;
        let currentStreakType: 'even' | 'odd' = 'even';

        if (ticks.length === 0) {
            return {
                even_streak: 0,
                odd_streak: 0,
                current_streak_type: 'even' as const,
                current_streak_length: 0
            };
        }

        // Determine current streak
        const lastDigit = ticks[ticks.length - 1].last_digit || 0;
        currentStreakType = lastDigit % 2 === 0 ? 'even' : 'odd';

        for (let i = ticks.length - 2; i >= 0; i--) {
            const digit = ticks[i].last_digit || 0;
            const digitType: 'even' | 'odd' = digit % 2 === 0 ? 'even' : 'odd';
            
            if (digitType === currentStreakType) {
                currentStreakLength++;
            } else {
                break;
            }
        }

        // Find longest streaks
        let tempEvenStreak = 0;
        let tempOddStreak = 0;
        let currentTempStreak = 1;
        let lastType: 'even' | 'odd' | null = null;

        for (const tick of ticks) {
            const digit = tick.last_digit || 0;
            const digitType: 'even' | 'odd' = digit % 2 === 0 ? 'even' : 'odd';

            if (lastType === digitType) {
                currentTempStreak++;
            } else {
                if (lastType === 'even') {
                    tempEvenStreak = Math.max(tempEvenStreak, currentTempStreak);
                } else if (lastType === 'odd') {
                    tempOddStreak = Math.max(tempOddStreak, currentTempStreak);
                }
                currentTempStreak = 1;
            }
            lastType = digitType;
        }

        // Handle last streak
        if (lastType === 'even') {
            tempEvenStreak = Math.max(tempEvenStreak, currentTempStreak);
        } else if (lastType === 'odd') {
            tempOddStreak = Math.max(tempOddStreak, currentTempStreak);
        }

        return {
            even_streak: tempEvenStreak,
            odd_streak: tempOddStreak,
            current_streak_type: currentStreakType,
            current_streak_length: currentStreakLength
        };
    }

    private calculateVolatility(ticks: TickData[]) {
        if (ticks.length < 2) {
            return {
                price_range: 0,
                average_change: 0,
                direction_bias: 'neutral' as const
            };
        }

        const prices = ticks.map(tick => tick.quote);
        const priceRange = Math.max(...prices) - Math.min(...prices);

        let totalChange = 0;
        let riseCount = 0;
        let fallCount = 0;

        for (let i = 1; i < ticks.length; i++) {
            const change = ticks[i].quote - ticks[i - 1].quote;
            totalChange += Math.abs(change);

            if (change > 0) riseCount++;
            else if (change < 0) fallCount++;
        }

        const averageChange = totalChange / (ticks.length - 1);
        
        let directionBias: 'rise' | 'fall' | 'neutral' = 'neutral';
        if (riseCount > fallCount * 1.1) {
            directionBias = 'rise';
        } else if (fallCount > riseCount * 1.1) {
            directionBias = 'fall';
        }

        return {
            price_range: priceRange,
            average_change: averageChange,
            direction_bias: directionBias
        };
    }

    private updateDecimalPlaces(symbol: string, price: number): void {
        const priceStr = price.toString();
        const decimalPart = priceStr.split('.')[1] || '';
        const currentDecimalPlaces = decimalPart.length;
        
        this.decimalPlaces[symbol] = Math.max(
            this.decimalPlaces[symbol] || 0,
            currentDecimalPlaces,
            2
        );
    }

    private getLastDigit(price: number, symbol: string): number {
        const priceStr = price.toString();
        const priceParts = priceStr.split('.');
        let decimals = priceParts[1] || '';
        
        const requiredDecimals = this.decimalPlaces[symbol] || 2;
        while (decimals.length < requiredDecimals) {
            decimals += '0';
        }
        
        return Number(decimals.slice(-1));
    }
}

// Global instance
export const symbolAnalyzer = new SymbolAnalyzer();
