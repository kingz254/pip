class MarketAnalyzer {
    constructor() {
        this.markets = {
            R_10: { history: [], analysis: null },
            R_25: { history: [], analysis: null },
            R_50: { history: [], analysis: null },
            R_75: { history: [], analysis: null },
            R_100: { history: [], analysis: null },
        };
        this.ws = null;
        this.tickCount = 100;
        this.analysisInterval = null;
    }

    start() {
        if (this.ws) this.ws.close();
        this.ws = new WebSocket('wss://api.derivws.com/trading/v1/options/ws/public');

        this.ws.onopen = () => {
            // Subscribe to all markets
            Object.keys(this.markets).forEach(symbol => {
                this.requestHistory(symbol);
            });
        };

        this.ws.onmessage = event => {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
        };

        // Analyze markets every 5 seconds
        this.analysisInterval = setInterval(() => this.analyzeAllMarkets(), 5000);
    }

    requestHistory(symbol) {
        this.ws.send(
            JSON.stringify({
                ticks_history: symbol,
                count: this.tickCount,
                end: 'latest',
                style: 'ticks',
                subscribe: 1,
            })
        );
    }

    handleMessage(data) {
        if (data.tick) {
            const symbol = data.tick.symbol;
            if (this.markets[symbol]) {
                this.markets[symbol].history.push({
                    time: data.tick.epoch,
                    quote: parseFloat(data.tick.quote),
                });
                if (this.markets[symbol].history.length > this.tickCount) {
                    this.markets[symbol].history.shift();
                }
            }
        } else if (data.history) {
            const symbol = data.echo_req.ticks_history;
            if (this.markets[symbol]) {
                this.markets[symbol].history = data.history.prices.map((price, index) => ({
                    time: data.history.times[index],
                    quote: parseFloat(price),
                }));
            }
        }
    }

    analyzeAllMarkets() {
        const results = {};
        let bestMarketForOver = null;
        let bestMarketForUnder = null;
        let maxOverDiff = -Infinity;
        let maxUnderDiff = -Infinity;

        Object.entries(this.markets).forEach(([symbol, data]) => {
            if (data.history.length > 0) {
                const analysis = this.analyzeMarket(data.history);
                results[symbol] = analysis;
                this.markets[symbol].analysis = analysis;

                // Find best market for OVER 2
                const overDiff = analysis.overTwoPercentage - 50; // Compare to expected 50%
                if (overDiff > maxOverDiff) {
                    maxOverDiff = overDiff;
                    bestMarketForOver = symbol;
                }

                // Find best market for UNDER 7
                const underDiff = analysis.underSevenPercentage - 50; // Compare to expected 50%
                if (underDiff > maxUnderDiff) {
                    maxUnderDiff = underDiff;
                    bestMarketForUnder = symbol;
                }
            }
        });

        // Save analysis result with separate best markets for OVER/UNDER
        const analysisResult = {
            bestMarketForOver: bestMarketForOver || 'R_10',
            bestMarketForUnder: bestMarketForUnder || 'R_10',
            timestamp: Date.now(),
            results,
        };

        localStorage.setItem('market_analysis', JSON.stringify(analysisResult));
        console.log('Analysis updated - Over:', bestMarketForOver, 'Under:', bestMarketForUnder);
    }

    analyzeMarket(history) {
        const digitCounts = new Array(10).fill(0);
        history.forEach(tick => {
            const lastDigit = this.getLastDigit(tick.quote);
            digitCounts[lastDigit]++;
        });

        const digitPercentages = digitCounts.map(count => (count / history.length) * 100);

        // Calculate over/under percentages for barriers 2 and 7
        const overTwoPercentage = digitPercentages.slice(3).reduce((a, b) => a + b, 0);
        const underSevenPercentage = digitPercentages.slice(0, 7).reduce((a, b) => a + b, 0);

        const highestPercentage = Math.max(overTwoPercentage, underSevenPercentage);
        const lowestPercentage = Math.min(overTwoPercentage, underSevenPercentage);

        return {
            highestDigit: overTwoPercentage > underSevenPercentage ? 'over' : 'under',
            lowestDigit: overTwoPercentage < underSevenPercentage ? 'over' : 'under',
            highestPercentage,
            lowestPercentage,
            digitPercentages,
            overTwoPercentage,
            underSevenPercentage,
        };
    }

    getLastDigit(price) {
        const priceStr = price.toString();
        const decimalPart = priceStr.split('.')[1] || '';
        return parseInt(decimalPart.slice(-1)) || 0;
    }

    stop() {
        if (this.ws) this.ws.close();
        if (this.analysisInterval) clearInterval(this.analysisInterval);
    }
}

// Export for use in bot
export const marketAnalyzer = new MarketAnalyzer();
