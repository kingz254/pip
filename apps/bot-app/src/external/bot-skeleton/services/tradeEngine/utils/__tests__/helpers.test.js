import { tradeOptionToBuy } from '../helpers';

describe('tradeOptionToBuy', () => {
    it('uses the live quote as the buy cap while retaining the configured stake parameters', () => {
        const request = tradeOptionToBuy(
            'DIGITMATCH',
            { amount: 10, basis: 'payout', currency: 'USD', duration: 1, duration_unit: 't', symbol: 'R_100', prediction: 7 },
            2.45
        );

        expect(request).toEqual({
            buy: '1',
            price: 2.45,
            parameters: {
                amount: 10,
                basis: 'payout',
                contract_type: 'DIGITMATCH',
                currency: 'USD',
                duration: 1,
                duration_unit: 't',
                underlying_symbol: 'R_100',
                barrier: '7',
            },
        });
    });
});
