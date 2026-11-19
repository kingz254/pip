import { LogTypes } from '../../../constants/messages';
import { api_base } from '../../api/api-base';
import { contractStatus, info, log } from '../utils/broadcast';
import { doUntilDone, getUUID, tradeOptionToBuy } from '../utils/helpers';
import { purchaseSuccessful } from './state/actions';
import { BEFORE_PURCHASE } from './state/constants';

let purchase_reference;

export default Engine =>
    class Purchase extends Engine {
        constructor(...args) {
            super(...args);
            this.tradeListeners = [];
            this.tickTradeEnabled = false;
            this.tickTradeContract = null;
            this.tickTradeListenerKey = null;
            this.currentTickTrade = false;
            this.initialStake = null;
            this.currentBarrier = null;
            this.currentSecondBarrier = null;
            this.currentPrediction = null;
            this.currentGrowthRate = null;
            this.currentTakeProfit = null;
            this.pendingPurchase = false;
        }

        validateTokens(tokens) {
            if (!Array.isArray(tokens)) return false;
            const tokenPattern = /^[\w\s-]+$/;
            return tokens.every(token => typeof token === 'string' && tokenPattern.test(token));
        }

        // This is the main purchase method that will be called from TradingHubDisplay
        async purchase(contract_type, trade_each_tick = false, barrier = null, second_barrier = null, prediction = null, growth_rate = null, take_profit = null) {
            console.log('Purchase called with:', {
                contract_type, 
                trade_each_tick, 
                barrier, 
                second_barrier, 
                prediction,
                types: {
                    trade_each_tick: typeof trade_each_tick,
                    barrier: typeof barrier,
                    second_barrier: typeof second_barrier,
                    prediction: typeof prediction
                }
            });
            
            const currentScope = this.store.getState().scope;
            console.log('Current bot scope:', currentScope, 'Required scope:', BEFORE_PURCHASE);
            
            if (currentScope !== BEFORE_PURCHASE) {
                console.log('Purchase skipped - not in BEFORE_PURCHASE scope, current scope:', currentScope);
                // Instead of rejecting, just resolve silently for conditional blocks
                if (!currentScope) {
                    console.warn('Bot scope is not set - bot may not be running');
                }
                return Promise.resolve({ skipped: true, reason: 'Invalid scope' });
            }

            // Check if a purchase has already been made in this execution cycle
            const botState = this.store.getState();
            // Allow purchases to proceed during tick trading mode (for conditional logic re-evaluation)
            if (!this.tickTradeEnabled && (botState.purchaseInProgress || this.pendingPurchase)) {
                console.log('Purchase skipped - another purchase is already in progress');
                return Promise.resolve({ skipped: true, reason: 'Purchase already in progress' });
            }

            // Validate trade options exist and bot is properly started
            if (!this.tradeOptions) {
                console.error('Trade options not initialized - bot may not be started properly');
                console.log('Available properties:', Object.keys(this));
                console.log('Bot state:', this.store.getState());
                
                // For conditional blocks, return resolved promise instead of rejecting
                console.warn('Skipping purchase due to uninitialized trade options');
                return Promise.resolve({ skipped: true, reason: 'Trade options not initialized' });
            }

            console.log('Current trade options:', this.tradeOptions);

            // Store barrier values for use in trade execution
            this.currentBarrier = barrier;
            this.currentSecondBarrier = second_barrier;
            this.currentPrediction = prediction;
            
            // Read growth rate and take profit from tradeOptions
            this.currentGrowthRate = this.tradeOptions.growth_rate || null;
            this.currentTakeProfit = this.tradeOptions.take_profit || null;
            
            console.log('Reading from tradeOptions:', {
                growth_rate: this.currentGrowthRate,
                take_profit: this.currentTakeProfit
            });

            // Handle tick trading mode
            if (trade_each_tick === true || trade_each_tick === 'true') {
                // If tick trading is already enabled, just execute the trade (called from conditional logic)
                if (this.tickTradeEnabled) {
                    console.log('🔄 Tick trading already enabled - executing trade from condition evaluation');
                    console.log('   Contract type from condition:', contract_type);
                    console.log('   Previous contract:', this.tickTradeContract);
                    console.log('   Barriers:', { barrier, second_barrier, prediction });
                    return await this.executeSingleTrade(contract_type);
                } else {
                    // First time enabling tick trading - set up the listener
                    console.log('🚀 Enabling tick trading mode for the first time');
                    console.log('   Initial contract type:', contract_type);
                    return await this.enableTickTrading(contract_type);
                }
            } else {
                console.log('Using normal trading mode with barriers');
                // Set pending purchase flag to prevent multiple simultaneous purchases
                this.pendingPurchase = true;
                
                try {
                    // Disable tick trading if it was previously enabled
                    await this.disableTickTrading();
                    // Execute normal single trade
                    const result = await this.executeSingleTrade(contract_type);
                    this.pendingPurchase = false;
                    return result;
                } catch (error) {
                    this.pendingPurchase = false;
                    throw error;
                }
            }
        }

        // Enable tick trading mode
        async enableTickTrading(contract_type) {
            this.tickTradeEnabled = true;
            this.tickTradeContract = contract_type;
            
            // Set up tick listener for trade execution
            if (!this.tickTradeListenerKey) {
                const { ticksService } = this.$scope;
                
                const tickCallback = () => {
                    console.log('📊 Tick received for tick trading');
                    console.log('   Tick trading enabled:', this.tickTradeEnabled);
                    console.log('   Stored contract:', this.tickTradeContract);
                    
                    if (this.tickTradeEnabled && this.tickTradeContract) {
                        console.log('🔍 Re-evaluating purchase conditions on new tick...');
                        // Re-evaluate conditional logic on each tick by calling BinaryBotPrivateBeforePurchase
                        // This ensures IF/ELSE conditions are checked every tick
                        if (window.BinaryBotPrivateBeforePurchase) {
                            try {
                                console.log('✅ Calling BinaryBotPrivateBeforePurchase() to re-check conditions');
                                window.BinaryBotPrivateBeforePurchase();
                                
                                // After purchase executes, wait for contract completion and run after-purchase logic
                                // This ensures "Trade Again" blocks and restart conditions work correctly
                                this.waitForContractCompletion().then(() => {
                                    console.log('✅ Contract completed - executing after-purchase logic');
                                    if (window.BinaryBotPrivateAfterPurchase) {
                                        try {
                                            const shouldContinue = window.BinaryBotPrivateAfterPurchase();
                                            if (shouldContinue === false) {
                                                console.log('⛔ After-purchase returned false - stopping tick trading');
                                                this.disableTickTrading();
                                            }
                                        } catch (error) {
                                            console.error('❌ Error in after-purchase logic:', error);
                                        }
                                    }
                                }).catch(error => {
                                    console.error('❌ Error waiting for contract completion:', error);
                                });
                            } catch (error) {
                                console.error('❌ Error re-evaluating purchase conditions:', error);
                            }
                        } else {
                            // Fallback: if no conditional logic, execute directly
                            console.log('⚠️ No conditional logic found, executing tick trade directly for contract:', this.tickTradeContract);
                            this.executeSingleTrade(this.tickTradeContract);
                        }
                    }
                };
                
                // Determine symbol for tick monitoring
                let symbolForTicks = this.tradeOptions.symbol;
                if (this.tradeOptions.tradeAllMarkets) {
                    symbolForTicks = this.getRandomAvailableSymbol();
                    console.log('Using symbol for tick monitoring:', symbolForTicks);
                }
                
                // Monitor ticks and get the listener key
                this.tickTradeListenerKey = await ticksService.monitor({ 
                    symbol: symbolForTicks, 
                    callback: tickCallback 
                });
            }
            
            // Execute first trade immediately
            return this.executeSingleTrade(contract_type);
        }

        // Disable tick trading mode
        async disableTickTrading() {
            if (this.tickTradeListenerKey) {
                const { ticksService } = this.$scope;
                
                // Determine symbol for tick stopping
                let symbolForTicks = this.tradeOptions.symbol;
                if (this.tradeOptions.tradeAllMarkets) {
                    // For stopping, we can use any symbol since we're just stopping the monitor
                    symbolForTicks = 'R_100';
                }
                
                await ticksService.stopMonitor({
                    symbol: symbolForTicks,
                    key: this.tickTradeListenerKey,
                });
                this.tickTradeListenerKey = null;
            }
            this.tickTradeEnabled = false;
            this.tickTradeContract = null;
        }
        
        // Wait for the current contract to complete before continuing
        async waitForContractCompletion() {
            return new Promise((resolve) => {
                if (!this.contractId) {
                    console.log('⚠️ No active contract to wait for');
                    resolve();
                    return;
                }
                
                // Set up a listener for contract completion
                const checkInterval = setInterval(() => {
                    const botState = this.store.getState();
                    // Check if contract is no longer in progress
                    if (!botState.purchaseInProgress) {
                        console.log('✅ Contract completed, clearing interval');
                        clearInterval(checkInterval);
                        resolve();
                    }
                }, 100); // Check every 100ms
                
                // Timeout after 30 seconds to prevent infinite waiting
                setTimeout(() => {
                    clearInterval(checkInterval);
                    console.log('⏱️ Contract wait timeout - continuing anyway');
                    resolve();
                }, 30000);
            });
        }
        
        // Execute a single trade (extracted from original purchase method)
        executeSingleTrade(contract_type) {
            console.log('Executing single trade for contract:', contract_type);
            console.log('Trade options available:', !!this.tradeOptions);
            
            if (!this.tradeOptions) {
                console.error('Cannot execute trade - tradeOptions not available');
                return Promise.reject(new Error('Trade options not available'));
            }

            const trades = [];

            // Create enhanced trade options with barrier values
            const enhancedTradeOptions = { ...this.tradeOptions };
            console.log('Base trade options:', enhancedTradeOptions);
            console.log('🔍 Trade All Markets Check:');
            console.log(`   tradeAllMarkets flag: "${this.tradeOptions.tradeAllMarkets}"`);
            console.log(`   everyXRuns value: "${this.tradeOptions.everyXRuns}"`);
            console.log(`   current run count: ${this.$scope?.tradeAllMarketsRunCount || 0}`);
            console.log(`   current symbol: "${enhancedTradeOptions.symbol}"`);
            
            // Handle symbol selection based on checkbox and every X runs interval
            if (this.tradeOptions.tradeAllMarkets) {
                const everyXRuns = this.tradeOptions.everyXRuns || 1;
                const runCount = this.$scope?.tradeAllMarketsRunCount || 0;
                
                // Check if we need to pick a new random symbol (at start or after interval completes)
                if (runCount % everyXRuns === 0) {
                    // Pick a new random symbol and stick with it for the next X runs
                    const randomSymbol = this.getRandomAvailableSymbol();
                    this.currentRandomSymbol = randomSymbol;
                    const previousSymbol = enhancedTradeOptions.symbol;
                    console.log(`🎲 Trade All Markets: Switching to new volatility ${randomSymbol} for next ${everyXRuns} run(s) (previous: ${previousSymbol})`);
                }
                
                // Use the current random symbol
                enhancedTradeOptions.symbol = this.currentRandomSymbol || this.getRandomAvailableSymbol();
                console.log(`📊 Trading on volatility "${enhancedTradeOptions.symbol}" (Run ${(runCount % everyXRuns) + 1}/${everyXRuns})`);
                
                // Increment the run counter
                if (this.$scope) {
                    this.$scope.tradeAllMarketsRunCount = (runCount + 1) % (everyXRuns * 100); // Reset after a large number
                }
            } else {
                console.log(`📌 Regular trading: Using symbol ${enhancedTradeOptions.symbol} (no randomization)`);
            }
            
            // For DIGITEVEN and DIGITODD, immediately clear any barrier inheritance from trading parameters
            if (['DIGITEVEN', 'DIGITODD'].includes(contract_type)) {
                delete enhancedTradeOptions.barrierOffset;
                delete enhancedTradeOptions.barrier;
                delete enhancedTradeOptions.prediction;
                console.log(`Cleared all barriers for ${contract_type} - this contract type works automatically`);
            }
            
            // Apply barrier values if provided - BUT NEVER for DIGITEVEN/DIGITODD
            if (this.currentBarrier !== null && this.currentBarrier !== 'null' && this.currentBarrier !== undefined) {
                const barrierValue = Number(this.currentBarrier);
                if (!isNaN(barrierValue)) {
                    // DIGITEVEN and DIGITODD NEVER use barriers - completely skip barrier logic
                    if (['DIGITEVEN', 'DIGITODD'].includes(contract_type)) {
                        console.log(`Barrier completely ignored for ${contract_type} - contract type does not support barriers`);
                        // Clear any barrier data that might have been inherited from trading parameters
                        delete enhancedTradeOptions.barrierOffset;
                        delete enhancedTradeOptions.barrier;
                    } else {
                        // For certain contract types, barriers must be integers 0-9
                        const digitBarrierContracts = ['CALL', 'PUT', 'DIGITOVER', 'DIGITUNDER', 'DIGITMATCH', 'DIGITDIFF'];
                        if (digitBarrierContracts.includes(contract_type)) {
                            const intBarrier = Math.round(barrierValue);
                            if (intBarrier >= 0 && intBarrier <= 9) {
                                enhancedTradeOptions.barrierOffset = intBarrier;
                                console.log('Applied digit barrier:', enhancedTradeOptions.barrierOffset);
                            } else {
                                console.warn(`Invalid barrier for ${contract_type}: ${barrierValue}. Must be integer 0-9`);
                                enhancedTradeOptions.barrierOffset = Math.max(0, Math.min(9, intBarrier));
                                console.log('Corrected barrier to:', enhancedTradeOptions.barrierOffset);
                            }
                        } else {
                            enhancedTradeOptions.barrierOffset = barrierValue;
                            console.log('Applied barrier:', enhancedTradeOptions.barrierOffset);
                        }
                    }
                } else {
                    console.warn('Invalid barrier value:', this.currentBarrier);
                }
            }
            
            if (this.currentSecondBarrier !== null && this.currentSecondBarrier !== 'null' && this.currentSecondBarrier !== undefined) {
                const secondBarrierValue = Number(this.currentSecondBarrier);
                if (!isNaN(secondBarrierValue)) {
                    enhancedTradeOptions.secondBarrierOffset = secondBarrierValue;
                    console.log('Applied second barrier:', enhancedTradeOptions.secondBarrierOffset);
                } else {
                    console.warn('Invalid second barrier value:', this.currentSecondBarrier);
                }
            }
            
            if (this.currentPrediction !== null && this.currentPrediction !== 'null' && this.currentPrediction !== undefined) {
                const predictionValue = Number(this.currentPrediction);
                if (!isNaN(predictionValue)) {
                    // DIGITEVEN and DIGITODD don't use predictions either
                    if (['DIGITEVEN', 'DIGITODD'].includes(contract_type)) {
                        console.log(`Skipping prediction for ${contract_type} - not required`);
                    } else {
                        // For digit contracts, prediction must be integer 0-9
                        const digitContracts = ['DIGITOVER', 'DIGITUNDER', 'DIGITMATCH', 'DIGITDIFF'];
                        if (digitContracts.includes(contract_type)) {
                            const intPrediction = Math.round(predictionValue);
                            if (intPrediction >= 0 && intPrediction <= 9) {
                                enhancedTradeOptions.prediction = intPrediction;
                                console.log('Applied digit prediction:', enhancedTradeOptions.prediction);
                            } else {
                                console.warn(`Invalid prediction for ${contract_type}: ${predictionValue}. Must be integer 0-9`);
                                enhancedTradeOptions.prediction = Math.max(0, Math.min(9, intPrediction));
                                console.log('Corrected prediction to:', enhancedTradeOptions.prediction);
                            }
                        } else {
                            enhancedTradeOptions.prediction = predictionValue;
                            console.log('Applied prediction:', enhancedTradeOptions.prediction);
                        }
                    }
                } else {
                    console.warn('Invalid prediction value:', this.currentPrediction);
                }
            }

            // Apply growth rate for accumulator contracts
            if (this.currentGrowthRate !== null && this.currentGrowthRate !== 'null' && this.currentGrowthRate !== undefined) {
                const growthRateValue = Number(this.currentGrowthRate);
                if (!isNaN(growthRateValue)) {
                    if (contract_type === 'ACCU') {
                        enhancedTradeOptions.growth_rate = growthRateValue;
                        console.log('Applied accumulator growth rate:', enhancedTradeOptions.growth_rate);
                    } else {
                        console.log(`Growth rate ignored for ${contract_type} - only used for ACCU contracts`);
                    }
                } else {
                    console.warn('Invalid growth rate value:', this.currentGrowthRate);
                }
            }

            // Apply take profit for accumulator contracts
            if (this.currentTakeProfit !== null && this.currentTakeProfit !== 'null' && this.currentTakeProfit !== undefined) {
                const takeProfitValue = Number(this.currentTakeProfit);
                if (!isNaN(takeProfitValue) && takeProfitValue > 0) {
                    if (contract_type === 'ACCU') {
                        enhancedTradeOptions.limit_order = {
                            take_profit: takeProfitValue
                        };
                        console.log('Applied accumulator take profit:', takeProfitValue);
                    } else {
                        console.log(`Take profit ignored for ${contract_type} - only used for ACCU contracts`);
                    }
                } else {
                    console.warn('Invalid take profit value:', this.currentTakeProfit);
                }
            }

            // Standard option for current account
            const standard_option = tradeOptionToBuy(contract_type, enhancedTradeOptions);
            console.log('Generated standard option:', standard_option);
            
            trades.push(
                doUntilDone(() => {
                    if (['MULTUP', 'MULTDOWN'].includes(contract_type)) {
                        console.warn(`Trade type ${contract_type} is not supported.`);
                        return Promise.resolve();
                    }
                    console.log('Sending trade request to API');
                    return api_base.api.send(standard_option);
                }).catch(e => {
                    console.error('Trade execution error:', e);
                    return Promise.reject(e);
                })
            );

            if (trades.length === 0) {
                console.warn('No trades were created - this might indicate an issue');
                return Promise.resolve();
            }

            console.log(`Created ${trades.length} trade requests`);

            return Promise.all(trades).then(responses => {
                console.log('Trade responses received:', responses);
                const successfulTrades = responses.filter(response => response && response.buy);
                console.log(`${successfulTrades.length} successful trades out of ${responses.length} total`);
                
                if (successfulTrades.length > 0) {
                    return Promise.all(
                        successfulTrades.map(response =>
                            this.handlePurchaseSuccess(response, contract_type, enhancedTradeOptions.amount)
                        )
                    );
                } else {
                    console.error('No successful trades - all failed');
                    // Log detailed error information
                    responses.forEach((response, index) => {
                        if (!response || !response.buy) {
                            console.error(`Trade ${index} failed:`, response);
                        }
                    });
                }
                return responses;
            }).catch(error => {
                console.error('Promise.all failed:', error);
                throw error;
            });
        }

        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        handlePurchaseSuccess(response, contract_type, _stake) {
            if (!response || !response.buy) return;

            const buy = response.buy;

            contractStatus({
                id: 'contract.purchase_received',
                data: buy.transaction_id,
                buy,
            });

            this.contractId = buy.contract_id;
            this.store.dispatch(purchaseSuccessful());

            if (this.is_proposal_subscription_required) {
                this.renewProposalsOnPurchase();
            }

            log(LogTypes.PURCHASE, { longcode: buy.longcode, transaction_id: buy.transaction_id });
            info({
                accountID: this.accountInfo.loginid,
                totalRuns: this.updateAndReturnTotalRuns(),
                transaction_ids: { buy: buy.transaction_id },
                contract_type,
                buy_price: buy.buy_price,
            });

            // Notify all trade listeners
            this.notifyTradeListeners({
                type: 'purchase',
                contract_id: buy.contract_id,
                transaction_id: buy.transaction_id,
                contract_type,
                buy_price: buy.buy_price,
                timestamp: new Date(),
            });

            return response;
        }

        // Helper method to get a random available symbol when ALL_MARKETS is selected
        getRandomAvailableSymbol() {
            try {
                // Use the specific symbols from signals.js ticksStorage
                const availableSymbols = [
                    'R_10',
                    'R_25', 
                    'R_50',
                    'R_75',
                    'R_100',
                    '1HZ10V',
                    '1HZ15V',
                    '1HZ90V',
                    '1HZ25V',
                    '1HZ30V',
                    '1HZ50V',
                    '1HZ75V',
                    '1HZ100V'
                ];
                
                // Select random symbol from the available list
                const randomIndex = Math.floor(Math.random() * availableSymbols.length);
                const selectedSymbol = availableSymbols[randomIndex];
                
                console.log(`🎯 Random symbol selected: ${selectedSymbol} (${randomIndex + 1}/${availableSymbols.length})`);
                return selectedSymbol;
                
            } catch (error) {
                console.error('Error getting random symbol:', error);
                // Ultimate fallback to R_100 if something goes wrong
                console.log('🛡️ Fallback: Using R_100');
                return 'R_100';
            }
        }

        getPurchaseReference = () => purchase_reference;
        regeneratePurchaseReference = () => {
            purchase_reference = getUUID();
        };

        // New methods for trade listening
        listenToTrades(callback) {
            if (typeof callback !== 'function') {
                throw new Error('Trade listener callback must be a function');
            }
            const listenerId = getUUID();
            this.tradeListeners.push({ id: listenerId, callback });
            return listenerId;
        }

        stopListeningToTrades(listenerId) {
            this.tradeListeners = this.tradeListeners.filter(listener => listener.id !== listenerId);
            return true;
        }

        notifyTradeListeners(tradeData) {
            this.tradeListeners.forEach(listener => {
                try {
                    listener.callback(tradeData);
                } catch (error) {
                    console.error('Error in trade listener callback:', error);
                }
            });
        }
    };
