import React from 'react';
import classNames from 'classnames';
import { isEnded } from '@/components/shared';
import { localize } from '@deriv-com/translations';
import Money from '../shared_ui/money';
import Text from '../shared_ui/text';
import './transaction-details.scss';

type TContractInfo = {
    barrier?: string;
    barrier_display_value?: string;
    contract_parameter?: string;
    parameter_type?: string;
    contract_type?: string;
    currency?: string;
    display_message?: string;
    display_name?: string;
    entry_tick?: string | number;
    exit_tick?: string | number;
    profit?: number;
    tick_count?: number;
    symbol?: string;
    underlying?: string;
};

type TTransactionDetails = {
    contract_info: TContractInfo;
    is_link_disabled?: boolean;
    // ...any other existing props
};

const TransactionDetails = ({ contract_info, is_link_disabled }: TTransactionDetails) => {
    const is_contract_completed = isEnded({ contract_info });
    const {
        barrier,
        barrier_display_value,
        contract_parameter,
        parameter_type,
        contract_type,
        currency,
        display_message,
        display_name,
        entry_tick,
        exit_tick,
        profit,
        symbol,
        underlying,
    } = contract_info;

    // Function to properly display contract information
    const getContractDisplayInfo = () => {
        if (display_message) {
            return display_message;
        }

        const symbol_display = symbol || underlying || '';

        if (parameter_type === 'differ_barrier') {
            return `Digit ${contract_parameter} differs from last digit on ${symbol_display}`;
        }

        if (parameter_type === 'over_barrier') {
            return `Digit over ${contract_parameter} on ${symbol_display}`;
        }

        if (contract_type?.startsWith('DIGIT')) {
            const barrier_value = barrier_display_value || barrier;
            return `${barrier_value ? `Barrier: ${barrier_value}` : ''} ${symbol_display ? `on ${symbol_display}` : ''}`;
        }

        if (entry_tick !== undefined) {
            return `Entry spot: ${entry_tick} ${symbol_display ? `on ${symbol_display}` : ''}`;
        }

        return '';
    };

    return (
        <div className='transaction-details'>
            <div className='transaction-details__header'>
                <Text size='xs' weight='bold'>
                    {display_name || contract_type}
                </Text>
                <div className='transaction-details__header-right'>
                    {is_contract_completed && (
                        <Text
                            size='xs'
                            weight='bold'
                            className={classNames('transaction-details__profit', {
                                'transaction-details__profit--negative': profit && +profit < 0,
                                'transaction-details__profit--positive': profit && +profit > 0,
                            })}
                        >
                            <Money amount={profit || 0} currency={currency} has_sign show_currency />
                        </Text>
                    )}
                </div>
            </div>
            <div className='transaction-details__body'>
                <Text className='transaction-details__info' size='xxs'>
                    {getContractDisplayInfo()}
                </Text>
                {is_contract_completed && exit_tick !== undefined && (
                    <Text size='xxs' className='transaction-details__info'>
                        {localize('Exit spot: {{exit_tick}}', { exit_tick })}
                    </Text>
                )}
            </div>
        </div>
    );
};

export default TransactionDetails;
