import { LogTypes } from '../../../constants/messages';
import { api_base } from '../../api/api-base';
import { contractStatus, info, log } from '../utils/broadcast';
import { getUUID, tradeOptionToProposal } from '../utils/helpers';
import { purchaseSuccessful } from './state/actions';
import { BEFORE_PURCHASE } from './state/constants';

let purchase_reference;

export default Engine =>
    class Purchase extends Engine {
        async purchase(contract_type) {
            // Prevent calling purchase twice
            if (this.store.getState().scope !== BEFORE_PURCHASE) {
                return Promise.resolve();
            }

            const onSuccess = response => {
                // Don't unnecessarily send a forget request for a purchased contract.
                const { buy } = response;

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

                log(LogTypes.PURCHASE, { transaction_id: buy.transaction_id });
                info({
                    accountID: this.accountInfo.loginid,
                    totalRuns: this.updateAndReturnTotalRuns(),
                    transaction_ids: { buy: buy.transaction_id },
                    contract_type,
                    buy_price: buy.buy_price,
                });
            };

            const proposal = this.proposal_templates?.find(item => item.contract_type === contract_type)
                ?? tradeOptionToProposal(this.tradeOptions, this.getPurchaseReference()).find(
                    item => item.contract_type === contract_type
                );
            if (!proposal) {
                throw new Error('Could not prepare a quote for this contract.');
            }

            if (this.proposal_templates?.some(item => item.contract_type === contract_type)) {
                this.selectProposal(contract_type);
            }

            const quote = await api_base.api.send(proposal);
            if (quote?.error) {
                throw Object.assign(new Error(quote.error.message || 'Deriv could not price this contract.'), quote.error);
            }
            const proposalId = quote?.proposal?.id;
            const askPrice = Number(quote?.proposal?.ask_price);
            if (!proposalId || !Number.isFinite(askPrice) || askPrice <= 0) {
                throw new Error('Deriv did not return a current purchase quote.');
            }

            this.isSold = false;

            contractStatus({
                id: 'contract.purchase_sent',
                data: askPrice,
            });

            // Buy the exact quote. Never retry a purchase whose outcome may be unknown.
            const response = await api_base.api.send({ buy: proposalId, price: askPrice });
            if (response?.error) {
                throw Object.assign(new Error(response.error.message || 'Deriv could not purchase this contract.'), response.error);
            }
            if (!response?.buy) {
                throw new Error('Deriv did not confirm the contract purchase.');
            }
            return onSuccess(response);
        }
        getPurchaseReference = () => purchase_reference;
        regeneratePurchaseReference = () => {
            purchase_reference = getUUID();
        };
    };
