/* eslint-disable no-promise-executor-return */
import debounce from 'lodash.debounce';
import { localize } from '@deriv-com/translations';
import { getLast } from '../../../utils/binary-utils';
import { observer as globalObserver } from '../../../utils/observer';
import { api_base } from '../../api/api-base';
import { getDirection, getLastDigit } from '../utils/helpers';
import { expectPositiveInteger } from '../utils/sanitize';
import * as constants from './state/constants';

let tickListenerKey;

export default Engine =>
    class Ticks extends Engine {
        async watchTicks(symbol) {
            if (symbol && this.symbol !== symbol) {
                this.symbol = symbol;
                const { ticksService } = this.$scope;

                await ticksService.stopMonitor({
                    symbol,
                    key: tickListenerKey,
                });
                const callback = ticks => {
                    if (this.is_proposal_subscription_required) {
                        this.checkProposalReady();
                    }
                    const lastTick = ticks.slice(-1)[0];
                    const { epoch } = lastTick;
                    this.store.dispatch({ type: constants.NEW_TICK, payload: epoch });
                };

                const key = await ticksService.monitor({ symbol, callback });
                tickListenerKey = key;
            }
        }

        checkTicksPromiseExists() {
            return this.$scope.ticksService.ticks_history_promise;
        }

        getTicks(toString = false) {
            return new Promise(resolve => {
                this.$scope.ticksService.request({ symbol: this.symbol }).then(ticks => {
                    const ticks_list = ticks.map(tick => {
                        if (toString) {
                            return tick.quote.toFixed(this.getPipSize());
                        }
                        return tick.quote;
                    });

                    resolve(ticks_list);
                });
            });
        }

        getLastTick(raw, toString = false) {
            return new Promise(resolve =>
                this.$scope.ticksService
                    .request({ symbol: this.symbol })
                    .then(ticks => {
                        let last_tick = raw ? getLast(ticks) : getLast(ticks).quote;
                        if (!raw && toString) {
                            last_tick = last_tick.toFixed(this.getPipSize());
                        }
                        resolve(last_tick);
                    })
                    .catch(e => {
                        if (e.code === 'MarketIsClosed') {
                            globalObserver.emit('Error', e);
                            resolve(e.code);
                        }
                    })
            );
        }

        getLastDigit() {
            return new Promise(resolve => this.getLastTick(false, true).then(tick => resolve(getLastDigit(tick))));
        }

        getLastDigitList() {
            return new Promise(resolve => this.getTicks().then(ticks => resolve(this.getLastDigitsFromList(ticks))));
        }
        getLastDigitsFromList(ticks) {
            const digits = ticks.map(tick => {
                return getLastDigit(tick.toFixed(this.getPipSize()));
            });
            return digits;
        }

        getEvenOddPercentage(pattern, count) {
            return new Promise(resolve => {
                this.getTicks().then(ticks => {
                    const recentTicks = ticks.slice(-count);
                    const digits = this.getLastDigitsFromList(recentTicks);
                    
                    let matchingCount = 0;
                    digits.forEach(digit => {
                        const isEven = digit % 2 === 0;
                        if ((pattern === 'even' && isEven) || (pattern === 'odd' && !isEven)) {
                            matchingCount++;
                        }
                    });
                    
                    const percentage = digits.length > 0 ? (matchingCount / digits.length) * 100 : 0;
                    resolve(percentage);
                });
            });
        }

        getOverUnderPercentage(condition, digit, count) {
            return new Promise(resolve => {
                this.getTicks().then(ticks => {
                    const recentTicks = ticks.slice(-count);
                    const digits = this.getLastDigitsFromList(recentTicks);
                    
                    let matchingCount = 0;
                    digits.forEach(tickDigit => {
                        if (condition === 'over' && tickDigit > digit) {
                            matchingCount++;
                        } else if (condition === 'under' && tickDigit < digit) {
                            matchingCount++;
                        }
                    });
                    
                    const percentage = digits.length > 0 ? (matchingCount / digits.length) * 100 : 0;
                    resolve(percentage);
                });
            });
        }

        getDigitFrequencyRank(rank, count) {
            return new Promise(resolve => {
                this.getTicks().then(ticks => {
                    const recentTicks = ticks.slice(-count);
                    const digits = this.getLastDigitsFromList(recentTicks);
                    
                    // Count frequency of each digit (0-9)
                    const digitCounts = new Array(10).fill(0);
                    digits.forEach(digit => {
                        digitCounts[digit]++;
                    });
                    
                    // Create array of {digit, count} pairs and sort by frequency
                    const digitFrequencies = digitCounts.map((count, digit) => ({
                        digit,
                        count
                    }));
                    
                    // Sort by count (descending), then by digit (ascending) for ties
                    digitFrequencies.sort((a, b) => {
                        if (b.count !== a.count) {
                            return b.count - a.count;
                        }
                        return a.digit - b.digit;
                    });
                    
                    // Get the digit based on ranking
                    let result = -1;
                    switch (rank) {
                        case 'most':
                            result = digitFrequencies[0].digit;
                            break;
                        case 'least':
                            // Find the last element (lowest frequency)
                            result = digitFrequencies[digitFrequencies.length - 1].digit;
                            break;
                        case 'second_most':
                            if (digitFrequencies.length > 1) {
                                result = digitFrequencies[1].digit;
                            }
                            break;
                        case 'second_least':
                            if (digitFrequencies.length > 1) {
                                result = digitFrequencies[digitFrequencies.length - 2].digit;
                            }
                            break;
                        default:
                            result = digitFrequencies[0].digit;
                    }
                    
                    resolve(result);
                });
            });
        }

        checkAllSamePattern(count, pattern) {
            return new Promise(resolve => {
                this.getTicks().then(ticks => {
                    const recentTicks = ticks.slice(-count);
                    const digits = this.getLastDigitsFromList(recentTicks);
                    
                    if (digits.length === 0) {
                        resolve(false);
                        return;
                    }
                    
                    let result = false;
                    
                    switch (pattern) {
                        case 'all_even':
                            // Check if all digits are even
                            result = digits.every(digit => digit % 2 === 0);
                            break;
                        case 'all_odd':
                            // Check if all digits are odd
                            result = digits.every(digit => digit % 2 !== 0);
                            break;
                        case 'all_same':
                            // Check if all digits are the same
                            const firstDigit = digits[0];
                            result = digits.every(digit => digit === firstDigit);
                            break;
                        default:
                            result = false;
                    }
                    
                    resolve(result);
                });
            });
        }

        checkDigitComparison(count, operator, targetDigit) {
            return new Promise(resolve => {
                this.getTicks().then(ticks => {
                    const recentTicks = ticks.slice(-count);
                    const digits = this.getLastDigitsFromList(recentTicks);
                    
                    if (digits.length === 0) {
                        resolve(false);
                        return;
                    }
                    
                    const target = parseInt(targetDigit, 10);
                    let result = false;
                    
                    switch (operator) {
                        case 'equal':
                            // Check if all digits are equal to target
                            result = digits.every(digit => digit === target);
                            break;
                        case 'greater':
                            // Check if all digits are greater than target
                            result = digits.every(digit => digit > target);
                            break;
                        case 'less':
                            // Check if all digits are less than target
                            result = digits.every(digit => digit < target);
                            break;
                        case 'greater_equal':
                            // Check if all digits are greater than or equal to target
                            result = digits.every(digit => digit >= target);
                            break;
                        case 'less_equal':
                            // Check if all digits are less than or equal to target
                            result = digits.every(digit => digit <= target);
                            break;
                        default:
                            result = false;
                    }
                    
                    resolve(result);
                });
            });
        }

        getRiseFallPercentage(pattern, count) {
            return new Promise(resolve => {
                this.getTicks().then(ticks => {
                    if (ticks.length < 2 || count < 2) {
                        resolve(0);
                        return;
                    }
                    
                    const recentTicks = ticks.slice(-count);
                    let matchingCount = 0;
                    
                    // Compare each tick with the previous tick to determine rise/fall
                    for (let i = 1; i < recentTicks.length; i++) {
                        const currentTick = recentTicks[i];
                        const previousTick = recentTicks[i - 1];
                        
                        if (pattern === 'rise' && currentTick > previousTick) {
                            matchingCount++;
                        } else if (pattern === 'fall' && currentTick < previousTick) {
                            matchingCount++;
                        }
                    }
                    
                    // Calculate percentage based on number of comparisons (count - 1)
                    const totalComparisons = recentTicks.length - 1;
                    const percentage = totalComparisons > 0 ? (matchingCount / totalComparisons) * 100 : 0;
                    resolve(percentage);
                });
            });
        }

        checkLastTicksDirection(count, direction) {
            return new Promise(resolve => {
                this.getTicks().then(ticks => {
                    if (ticks.length < 2 || count < 2) {
                        resolve(false);
                        return;
                    }
                    
                    const recentTicks = ticks.slice(-count);
                    
                    // Check if all consecutive ticks move in the specified direction
                    for (let i = 1; i < recentTicks.length; i++) {
                        const currentTick = recentTicks[i];
                        const previousTick = recentTicks[i - 1];
                        
                        if (direction === 'rise' && currentTick <= previousTick) {
                            resolve(false);
                            return;
                        } else if (direction === 'fall' && currentTick >= previousTick) {
                            resolve(false);
                            return;
                        }
                    }
                    
                    // If we get here, all ticks moved in the specified direction
                    resolve(true);
                });
            });
        }

        getDigitPercentage(digit, count) {
            return new Promise(resolve => {
                this.getTicks().then(ticks => {
                    const recentTicks = ticks.slice(-count);
                    const digits = this.getLastDigitsFromList(recentTicks);
                    
                    if (digits.length === 0) {
                        resolve(0);
                        return;
                    }
                    
                    const matchingCount = digits.filter(d => parseInt(d) === parseInt(digit)).length;
                    const percentage = (matchingCount / digits.length) * 100;
                    
                    resolve(percentage);
                });
            });
        }

        getDigitHighestLowestFrequency(frequencyType, count) {
            return new Promise(resolve => {
                this.getTicks().then(ticks => {
                    const recentTicks = ticks.slice(-count);
                    const digits = this.getLastDigitsFromList(recentTicks);
                    
                    if (digits.length === 0) {
                        resolve(0);
                        return;
                    }
                    
                    // Count frequency of each digit
                    const digitCounts = Array(10).fill(0);
                    digits.forEach(digit => {
                        digitCounts[parseInt(digit)]++;
                    });
                    
                    // Find highest or lowest frequency digit
                    let resultDigit = 0;
                    let currentValue = digitCounts[0];
                    
                    if (frequencyType === 'highest') {
                        // Find highest frequency
                        for (let i = 1; i < 10; i++) {
                            if (digitCounts[i] > currentValue) {
                                resultDigit = i;
                                currentValue = digitCounts[i];
                            }
                        }
                    } else {
                        // Find lowest frequency (only among digits that have appeared)
                        for (let i = 1; i < 10; i++) {
                            // Only consider digits that have appeared at least once
                            if ((digitCounts[i] < currentValue && digitCounts[i] > 0) || 
                                (currentValue === 0 && digitCounts[i] > 0)) {
                                resultDigit = i;
                                currentValue = digitCounts[i];
                            }
                        }
                    }
                    
                    resolve(resultDigit);
                });
            });
        }

        checkDirection(dir) {
            return new Promise(resolve =>
                this.$scope.ticksService
                    .request({ symbol: this.symbol })
                    .then(ticks => resolve(getDirection(ticks) === dir))
            );
        }

        getOhlc(args) {
            const { granularity = this.options.candleInterval || 60, field } = args || {};

            return new Promise(resolve =>
                this.$scope.ticksService
                    .request({ symbol: this.symbol, granularity })
                    .then(ohlc => resolve(field ? ohlc.map(o => o[field]) : ohlc))
            );
        }

        getOhlcFromEnd(args) {
            const { index: i = 1 } = args || {};

            const index = expectPositiveInteger(Number(i), localize('Index must be a positive integer'));

            return new Promise(resolve => this.getOhlc(args).then(ohlc => resolve(ohlc.slice(-index)[0])));
        }

        getPipSize() {
            return this.$scope.ticksService.pipSizes[this.symbol];
        }

        // Add new method to determine auto overunder trade based on last digit
        async getAutoOverUnderTrade() {
            const last_digit = await this.getLastDigit();
            const digit = parseInt(last_digit, 10);
            if (digit > 7) {
                return { contract: 'DIGITUNDER', barrier: 8 };
            } else if (digit < 2) {
                return { contract: 'DIGITOVER', barrier: 1 };
            } else {
                const contract = Math.random() < 0.5 ? 'DIGITOVER' : 'DIGITUNDER';
                const barrier = contract === 'DIGITOVER' ? 1 : 8;
                return { contract, barrier };
            }
        }

        async requestAccumulatorStats() {
            const subscription_id = this.subscription_id_for_accumulators;
            const is_proposal_requested = this.is_proposal_requested_for_accumulators;
            const proposal_request = {
                ...window.Blockly.accumulators_request,
                amount: this?.tradeOptions?.amount,
                basis: this?.tradeOptions?.basis,
                contract_type: 'ACCU',
                currency: this?.tradeOptions?.currency,
                growth_rate: this?.tradeOptions?.growth_rate,
                proposal: 1,
                subscribe: 1,
                symbol: this?.tradeOptions?.symbol,
            };
            if (!subscription_id && !is_proposal_requested) {
                this.is_proposal_requested_for_accumulators = true;
                if (proposal_request) {
                    await api_base?.api?.send(proposal_request);
                }
            }
        }

        async handleOnMessageForAccumulators() {
            let ticks_stayed_in_list = [];
            return new Promise(resolve => {
                const subscription = api_base.api.onMessage().subscribe(({ data }) => {
                    if (data.msg_type === 'proposal') {
                        try {
                            this.subscription_id_for_accumulators = data.subscription.id;
                            // this was done because we can multile arrays in the respone and the list comes in reverse order
                            const stat_list = (data.proposal.contract_details.ticks_stayed_in || []).flat().reverse();
                            ticks_stayed_in_list = [...stat_list, ...ticks_stayed_in_list];
                            if (ticks_stayed_in_list.length > 0) resolve(ticks_stayed_in_list);
                        } catch (error) {
                            globalObserver.emit('Unexpected message type or no proposal found:', error);
                        }
                    }
                });
                api_base.pushSubscription(subscription);
            });
        }

        async fetchStatsForAccumulators() {
            try {
                // request stats for accumulators
                const debouncedAccumulatorsRequest = debounce(() => this.requestAccumulatorStats(), 300);
                debouncedAccumulatorsRequest();
                // wait for proposal response
                const ticks_stayed_in_list = await this.handleOnMessageForAccumulators();
                return ticks_stayed_in_list;
            } catch (error) {
                globalObserver.emit('Error in subscription promise:', error);
                throw error;
            } finally {
                // forget all proposal subscriptions so we can fetch new stats data on new call
                await api_base?.api?.send({ forget_all: 'proposal' });
                this.is_proposal_requested_for_accumulators = false;
                this.subscription_id_for_accumulators = null;
            }
        }

        async getCurrentStat() {
            try {
                const ticks_stayed_in = await this.fetchStatsForAccumulators();
                return ticks_stayed_in?.[0];
            } catch (error) {
                globalObserver.emit('Error fetching current stat:', error);
            }
        }

        async getStatList() {
            try {
                const ticks_stayed_in = await this.fetchStatsForAccumulators();
                // we need to send only lastest 100 ticks
                return ticks_stayed_in?.slice(0, 100);
            } catch (error) {
                globalObserver.emit('Error fetching current stat:', error);
            }
        }

        async checkStatComparison(operator, targetValue) {
            return new Promise(async resolve => {
                try {
                    // Get historical stat list from accumulator API
                    // Each stat represents consecutive ticks that stayed within range before breaking out
                    const stats = await this.getStatList();
                    
                    if (!stats || stats.length === 0) {
                        // No stat data available
                        console.log('No stat data available for comparison');
                        resolve(false);
                        return;
                    }
                    
                    // Use the most recent stat (index 0) as the "previous" stat
                    // This represents the last recorded breakout sequence
                    const previousStat = stats[0];
                    const target = parseInt(targetValue, 10);
                    
                    console.log(`Stat Comparison: ${previousStat} ${operator} ${target}`);
                    
                    let result = false;
                    
                    switch (operator) {
                        case 'equal':
                            result = previousStat === target;
                            break;
                        case 'not_equal':
                            result = previousStat !== target;
                            break;
                        case 'greater':
                            result = previousStat > target;
                            break;
                        case 'less':
                            result = previousStat < target;
                            break;
                        case 'greater_equal':
                            result = previousStat >= target;
                            break;
                        case 'less_equal':
                            result = previousStat <= target;
                            break;
                        default:
                            result = false;
                    }
                    
                    resolve(result);
                } catch (error) {
                    globalObserver.emit('Error in checkStatComparison:', error);
                    resolve(false);
                }
            });
        }

        async getDelayTickValue(tick_value) {
            return new Promise((resolve, reject) => {
                try {
                    const ticks = [];
                    const symbol = this.symbol;

                    const resolveAndExit = () => {
                        this.$scope.ticksService.stopMonitor({
                            symbol,
                            key: '',
                        });
                        resolve(ticks);
                        ticks.length = 0;
                    };

                    const watchTicks = tick_list => {
                        ticks.push(tick_list);
                        const current_tick = ticks.length;
                        if (current_tick === tick_value) {
                            resolveAndExit();
                        }
                    };

                    const delayExecution = tick_list => watchTicks(tick_list);

                    if (Number(tick_value) <= 0) resolveAndExit();
                    this.$scope.ticksService.monitor({ symbol, callback: delayExecution });
                } catch (error) {
                    reject(new Error(`Failed to start tick monitoring: ${error.message}`));
                }
            });
        }
    };
