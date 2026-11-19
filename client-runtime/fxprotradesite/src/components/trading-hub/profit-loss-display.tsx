import React from 'react';
import { observer } from 'mobx-react-lite';
import classNames from 'classnames';
import { Money } from '@deriv-com/ui';
import { useStores } from '@/hooks';

const ProfitLossDisplay = observer(() => {
    const { transactions } = useStores();
    const profit = transactions?.statistics?.total_profit || 0;

    console.log('Current profit/loss:', profit); // Debug log

    return (
        <div className='trading-hub__profit-loss'>
            <span className='trading-hub__profit-loss-label'>Total Profit/Loss:</span>
            <div
                className={classNames('trading-hub__profit-loss-amount', {
                    'trading-hub__profit-loss-amount--profit': profit > 0,
                    'trading-hub__profit-loss-amount--loss': profit < 0,
                })}
            >
                <Money amount={Math.abs(profit)} currency='USD' show_currency should_format={true} />
            </div>
        </div>
    );
});

export default ProfitLossDisplay;
