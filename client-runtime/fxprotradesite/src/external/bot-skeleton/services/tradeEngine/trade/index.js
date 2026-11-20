import { initializeBotAccount } from '../../../../../pipforge/bot-account.mjs';
import { getSelectedAccount, getSessionGeneration } from '../../../../../pipforge/session';
import { applyMiddleware, createStore } from 'redux';
import { thunk } from 'redux-thunk';
import { localize } from '@deriv-com/translations';
import { createError } from '../../../utils/error';
import { observer as globalObserver } from '../../../utils/observer';
import { api_base } from '../../api/api-base';
import { checkBlocksForProposalRequest, doUntilDone } from '../utils/helpers';
import { expectInitArg } from '../utils/sanitize';
import { proposalsReady, start } from './state/actions';
import * as constants from './state/constants';
import rootReducer from './state/reducers';
import Balance from './Balance';
import OpenContract from './OpenContract';
import Proposal from './Proposal';
import Purchase from './Purchase';
import Sell from './Sell';
import Ticks from './Ticks';
import Total from './Total';

const watchBefore = store =>
    watchScope({
        store,
        stopScope: constants.DURING_PURCHASE,
        passScope: constants.BEFORE_PURCHASE,
        passFlag: 'proposalsReady',
    });

const watchDuring = store =>
    watchScope({
        store,
        stopScope: constants.STOP,
        passScope: constants.DURING_PURCHASE,
        passFlag: 'openContract',
    });

/* The watchScope function is called randomly and resets the prevTick
 * which leads to the same problem we try to solve. So prevTick is isolated
 */
let prevTick;
const watchScope = ({ store, stopScope, passScope, passFlag }) => {
    // in case watch is called after stop is fired
    if (store.getState().scope === stopScope) {
        return Promise.resolve(false);
    }
    return new Promise(resolve => {
        const unsubscribe = store.subscribe(() => {
            const newState = store.getState();

            if (newState.newTick === prevTick) return;
            prevTick = newState.newTick;

            if (newState.scope === passScope && newState[passFlag]) {
                unsubscribe();
                resolve(true);
            }

            if (newState.scope === stopScope) {
                unsubscribe();
                resolve(false);
            }
        });
    });
};

export default class TradeEngine extends Balance(Purchase(Sell(OpenContract(Proposal(Ticks(Total(class {}))))))) {
    constructor($scope) {
        super();
        this.observer = $scope.observer;
        this.$scope = $scope;
        this.observe();
        this.data = {
            contract: {},
            proposals: [],
        };
        this.subscription_id_for_accumulators = null;
        this.is_proposal_requested_for_accumulators = false;
        this.store = createStore(rootReducer, applyMiddleware(thunk));
        this.nextSymbol = null; // For SPECIFY mode symbol switching
        this.$scope.tradeAllMarketsRunCount = 0; // Initialize run counter for every X runs feature
        this.currentRandomSymbol = null; // Store current random symbol for sticky volatility
    }

    // Method to set the symbol for the next trade (used by Symbol Switcher blocks)
    setNextSymbol(symbol) {
        this.nextSymbol = symbol;
        console.log(`🔧 Bot.setNextSymbol: Next trade will use ${symbol}`);
    }

    // Method to get and consume the next symbol (used by Purchase class)
    getAndConsumeNextSymbol() {
        const symbol = this.nextSymbol;
        this.nextSymbol = null; // Clear after use
        return symbol;
    }

    init(...args) {
        const [accountId, options] = expectInitArg(args);
        const { symbol } = options;

        this.initArgs = args;
        this.options = options;
        this.startPromise = this.loginAndGetBalance(accountId);

        if (!this.checkTicksPromiseExists()) this.watchTicks(symbol);
    }

    start(tradeOptions) {
        if (!this.options) {
            throw createError('NotInitialized', localize('Bot.init is not called'));
        }

        globalObserver.emit('bot.running');

        const validated_trade_options = this.validateTradeOptions(tradeOptions);

        this.tradeOptions = { 
            ...validated_trade_options, 
            symbol: this.options.symbol,
            tradeAllMarkets: this.options.tradeAllMarkets,
            everyXRuns: this.options.everyXRuns || 1
        };
        
        // Initialize run counter for tracking when to use random symbols
        this.tradeAllMarketsRunCount = 0;
        
        this.store.dispatch(start());
        this.checkLimits(validated_trade_options);

        this.makeDirectPurchaseDecision();
    }

    async loginAndGetBalance(accountId) {
        this.accountInfo = await initializeBotAccount(api_base, accountId, getSelectedAccount, getSessionGeneration);
        if (this.recoveryApi === api_base.api && !this.recoverySubscription?.closed) return;
        this.recoverySubscription?.unsubscribe();
        this.recoveryApi = api_base.api;
        this.recoverySubscription = api_base.api.onMessage().subscribe(({data}) => {
            if (data.msg_type !== 'transaction' || data.transaction?.action !== 'sell') return;
            clearTimeout(this.transaction_recovery_timeout);
            this.transaction_recovery_timeout = setTimeout(() => {
                const contract=this.data.contract;
                if(contract?.contract_id===data.transaction.contract_id && contract.status==='open') {
                    api_base.api.send({proposal_open_contract:1,contract_id:contract.contract_id}).catch(error=>globalObserver.emit('Error',error));
                }
            },1500);
        });
        api_base.pushSubscription(this.recoverySubscription);
    }

    observe() {
        this.observeOpenContract();
        this.observeBalance();
        this.observeProposals();
    }

    watch(watchName) {
        if (watchName === 'before') {
            return watchBefore(this.store);
        }
        return watchDuring(this.store);
    }

    makeDirectPurchaseDecision() {
        const { has_payout_block, is_basis_payout } = checkBlocksForProposalRequest();
        this.is_proposal_subscription_required = has_payout_block || is_basis_payout;

        if (this.is_proposal_subscription_required) {
            this.makeProposals({ ...this.options, ...this.tradeOptions });
            this.checkProposalReady();
        } else {
            this.store.dispatch(proposalsReady());
        }
    }
}
