/**
 * Analyzer Enhancer for Smart Trading Display
 * Extends the functionality of volatility-analyzer.js to provide data for:
 * - Even/Odd percentages and E/O pattern display
 * - Over/Under percentages with configurable barrier and O/U pattern display
 */

// Default barrier value for over/under analysis
let overUnderBarrier = 5;
let selectedSymbol = 'R_10';
let requestedTickCount = 120;
let enhancerConnected = false;

// Wait for the volatility analyzer to be loaded
(function () {
    let attemptCount = 0;
    const maxAttempts = 20; // Try for about 10 seconds

    console.log('🔍 Analyzer enhancer starting, looking for volatility analyzer...');

    const checkInterval = setInterval(() => {
        attemptCount++;

        // Check for both the new volatility analyzer and the older implementation
        if (window.volatilityAnalyzer) {
            console.log('✅ Analyzer enhancer connected to volatility-analyzer.js');
            clearInterval(checkInterval);
            enhancerConnected = true;
            initEnhancer();
            return;
        }

        // Check if we have access to functions from the older implementation
        if (window.getLastDigit && window.tickHistory) {
            console.log('✅ Analyzer enhancer connected to existing analyzer');
            clearInterval(checkInterval);
            enhancerConnected = true;
            initEnhancer();
            return;
        }

        // Give up after max attempts
        if (attemptCount >= maxAttempts) {
            console.error('❌ Analyzer enhancer could not connect - volatility analyzer not found');
            clearInterval(checkInterval);
        }
    }, 500);

    function initEnhancer() {
        // Listen for messages from the React app
        window.addEventListener('message', function (event) {
            if (!event.data || typeof event.data !== 'object') return;

            const { type } = event.data;

            switch (type) {
                // Handle barrier update for over/under
                case 'UPDATE_BARRIER':
                    overUnderBarrier = parseInt(event.data.barrier, 10);
                    console.log(`Barrier value updated to: ${overUnderBarrier}`);
                    sendAnalysisData();
                    break;

                // Handle symbol update - Forward to main analyzer if possible
                case 'UPDATE_SYMBOL':
                    selectedSymbol = event.data.symbol;
                    console.log(`Enhancer received symbol update: ${selectedSymbol}`);

                    // Try both direct window function and volatilityAnalyzer object
                    try {
                        if (window.volatilityAnalyzer && typeof window.volatilityAnalyzer.updateSymbol === 'function') {
                            window.volatilityAnalyzer.updateSymbol(selectedSymbol);
                        } else if (typeof window.updateSymbol === 'function') {
                            window.updateSymbol(selectedSymbol);
                        } else {
                            console.error('No updateSymbol function found on window or volatilityAnalyzer');
                        }
                    } catch (e) {
                        console.error('Error updating symbol:', e);
                    }
                    break;

                // Handle tick count update - Forward to main analyzer if possible
                case 'UPDATE_TICK_COUNT':
                    const newCount = event.data.tickCount || event.data.count;
                    if (newCount && !isNaN(newCount)) {
                        requestedTickCount = parseInt(newCount, 10);
                        console.log(`Enhancer received tick count update: ${requestedTickCount}`);

                        try {
                            if (
                                window.volatilityAnalyzer &&
                                typeof window.volatilityAnalyzer.updateTickCount === 'function'
                            ) {
                                window.volatilityAnalyzer.updateTickCount(requestedTickCount);
                            } else if (typeof window.updateTickCount === 'function') {
                                window.updateTickCount(requestedTickCount);
                            } else {
                                console.error('No updateTickCount function found on window or volatilityAnalyzer');
                            }
                        } catch (e) {
                            console.error('Error updating tick count:', e);
                        }
                    }
                    break;

                // Handle analysis data request
                case 'REQUEST_ANALYSIS':
                    sendAnalysisData(event.data.strategyId);
                    break;
            }
        });

        // Enhance the original updateUI function to also send data to the React app
        const originalUpdateUI = window.updateUI;
        if (originalUpdateUI) {
            window.updateUI = function () {
                originalUpdateUI.apply(this, arguments);

                // Send current price as well
                if (window.tickHistory && window.tickHistory.length > 0) {
                    const currentPrice = window.tickHistory[window.tickHistory.length - 1].quote.toFixed(
                        window.decimalPlaces
                    );
                    window.postMessage(
                        {
                            type: 'PRICE_UPDATE',
                            price: currentPrice,
                            symbol: window.currentSymbol,
                        },
                        '*'
                    );
                }

                // Send analysis data to React app
                sendAnalysisData();
            };
        }
    }

    function sendAnalysisData(specificStrategy = null) {
        if (!window.tickHistory || window.tickHistory.length === 0) return;

        // Calculate base statistics needed for all analyses
        const digitCounts = new Array(10).fill(0);
        window.tickHistory.forEach(tick => {
            const lastDigit = window.getLastDigit(tick.quote);
            digitCounts[lastDigit]++;
        });

        const totalTicks = window.tickHistory.length;
        // Update to use 2 decimal places
        const digitPercentages = digitCounts.map(count => ((count / totalTicks) * 100).toFixed(2));

        // Calculate even/odd statistics
        const evenCount = digitCounts.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0);
        const oddCount = digitCounts.filter((_, i) => i % 2 !== 0).reduce((a, b) => a + b, 0);
        // Format percentages with 2 decimal places
        const evenPercentage = ((evenCount / totalTicks) * 100).toFixed(2);
        const oddPercentage = ((oddCount / totalTicks) * 100).toFixed(2);

        // Calculate over/under statistics based on barrier
        let overCount = 0,
            underCount = 0;
        for (let i = 0; i < 10; i++) {
            if (i >= overUnderBarrier) {
                overCount += digitCounts[i];
            } else {
                underCount += digitCounts[i];
            }
        }
        // Format percentages with 2 decimal places
        const overPercentage = ((overCount / totalTicks) * 100).toFixed(2);
        const underPercentage = ((underCount / totalTicks) * 100).toFixed(2);

        // Extract recent digits for pattern analysis
        const recent10Ticks = window.tickHistory.slice(-10);
        const recentDigits = recent10Ticks.map(tick => window.getLastDigit(tick.quote));

        // Create E/O pattern
        const eoPattern = recentDigits.map(digit => (digit % 2 === 0 ? 'E' : 'O'));

        // Create O/U pattern based on barrier - make the comparison explicit
        const ouPattern = recentDigits.map(digit => {
            // Digit is "Over" if it's greater than or equal to the barrier value
            return digit >= overUnderBarrier ? 'O' : 'U';
        });

        // Check for streaks in even/odd
        let currentStreak = 1;
        let streakType = recentDigits.length > 0 && recentDigits[recentDigits.length - 1] % 2 === 0 ? 'even' : 'odd';

        // Count streak backwards from the end
        for (let i = recentDigits.length - 2; i >= 0; i--) {
            const isEven = recentDigits[i] % 2 === 0;
            const prevIsEven = recentDigits[i + 1] % 2 === 0;

            if (isEven === prevIsEven) {
                currentStreak++;
            } else {
                break;
            }
        }

        // Send data for rise/fall analysis
        if (!specificStrategy || specificStrategy === 'rise-fall') {
            let riseCount = 0,
                fallCount = 0;
            for (let i = 1; i < window.tickHistory.length; i++) {
                if (window.tickHistory[i].quote > window.tickHistory[i - 1].quote) riseCount++;
                else if (window.tickHistory[i].quote < window.tickHistory[i - 1].quote) fallCount++;
            }
            // Format rise/fall ratios with 2 decimal places
            const riseRatio = ((riseCount / (totalTicks - 1)) * 100).toFixed(2);
            const fallRatio = ((fallCount / (totalTicks - 1)) * 100).toFixed(2);

            window.postMessage(
                {
                    type: 'ANALYSIS_DATA',
                    strategyId: 'rise-fall',
                    data: {
                        recommendation:
                            parseFloat(riseRatio) > 55 ? 'Rise' : parseFloat(fallRatio) > 55 ? 'Fall' : null,
                        confidence: Math.max(parseFloat(riseRatio), parseFloat(fallRatio)).toFixed(2),
                        riseRatio,
                        fallRatio,
                    },
                },
                '*'
            );
        }

        // Send data for even/odd analysis - percentages display
        if (!specificStrategy || specificStrategy === 'even-odd') {
            window.postMessage(
                {
                    type: 'ANALYSIS_DATA',
                    strategyId: 'even-odd',
                    data: {
                        recommendation:
                            parseFloat(evenPercentage) > 55 ? 'Even' : parseFloat(oddPercentage) > 55 ? 'Odd' : null,
                        confidence: Math.max(parseFloat(evenPercentage), parseFloat(oddPercentage)).toFixed(2),
                        evenProbability: evenPercentage,
                        oddProbability: oddPercentage,
                    },
                },
                '*'
            );
        }

        // Send data for even/odd analysis - E/O pattern display
        if (!specificStrategy || specificStrategy === 'even-odd-2') {
            window.postMessage(
                {
                    type: 'ANALYSIS_DATA',
                    strategyId: 'even-odd-2',
                    data: {
                        evenProbability: evenPercentage,
                        oddProbability: oddPercentage,
                        actualDigits: recentDigits,
                        evenOddPattern: eoPattern,
                        streak: currentStreak,
                        streakType,
                    },
                },
                '*'
            );
        }

        // Send data for over/under analysis - percentages display
        if (!specificStrategy || specificStrategy === 'over-under') {
            window.postMessage(
                {
                    type: 'ANALYSIS_DATA',
                    strategyId: 'over-under',
                    data: {
                        recommendation: overPercentage > 55 ? 'Over' : underPercentage > 55 ? 'Under' : null,
                        confidence: Math.max(overPercentage, underPercentage),
                        overProbability: overPercentage,
                        underProbability: underPercentage,
                        barrier: overUnderBarrier,
                    },
                },
                '*'
            );
        }

        // Send data for over/under analysis - O/U pattern display
        if (!specificStrategy || specificStrategy === 'over-under-2') {
            window.postMessage(
                {
                    type: 'ANALYSIS_DATA',
                    strategyId: 'over-under-2',
                    data: {
                        overProbability: overPercentage,
                        underProbability: underPercentage,
                        actualDigits: recentDigits,
                        overUnderPattern: ouPattern,
                        barrier: overUnderBarrier,
                        digitPercentages: digitPercentages,
                        // Add explicit definition for clarity in tooltips and UI
                        overUnderDefinition: {
                            over: `≥${overUnderBarrier}`,
                            under: `<${overUnderBarrier}`,
                        },
                    },
                },
                '*'
            );
        }

        // Send data for matches/differs analysis
        if (!specificStrategy || specificStrategy === 'matches-differs') {
            // Find most frequent digit for recommendation
            let maxCount = 0;
            let maxDigit = 0;
            digitCounts.forEach((count, digit) => {
                if (count > maxCount) {
                    maxCount = count;
                    maxDigit = digit;
                }
            });

            const mostFrequentProbability = ((maxCount / totalTicks) * 100).toFixed(2);

            // Create digit frequencies map for easy lookup
            const digitFrequencies = digitCounts.map((count, digit) => ({
                digit,
                percentage: ((count / totalTicks) * 100).toFixed(2),
                count: count
            }));

            // Get the current last digit for real-time condition checking
            const currentLastDigit = window.tickHistory && window.tickHistory.length > 0 
                ? window.getLastDigit(window.tickHistory[window.tickHistory.length - 1].quote)
                : undefined;

            window.postMessage(
                {
                    type: 'ANALYSIS_DATA',
                    strategyId: 'matches-differs',
                    data: {
                        recommendation: parseFloat(mostFrequentProbability) > 15 ? 'Matches' : 'Differs',
                        confidence: (parseFloat(mostFrequentProbability) > 15
                            ? parseFloat(mostFrequentProbability)
                            : 100 - parseFloat(mostFrequentProbability)
                        ).toFixed(2),
                        target: maxDigit,
                        mostFrequentProbability: mostFrequentProbability,
                        digitFrequencies: digitFrequencies,
                        currentLastDigit: currentLastDigit,
                        totalTicks: totalTicks
                    },
                },
                '*'
            );
        }
    }
})();
