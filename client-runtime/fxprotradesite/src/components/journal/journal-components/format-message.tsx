import classnames from 'classnames';
import { formatMoney, getCurrencyDisplayCode } from '@/components/shared';
import Text from '@/components/shared_ui/text';
import { LogTypes } from '@/external/bot-skeleton';
import { Localize, localize } from '@deriv-com/translations';
import { TFormatMessageProps } from '../journal.types';

const FormatMessage = ({ logType, className, extra }: TFormatMessageProps) => {
    const getLogMessage = () => {
        switch (logType) {
            case LogTypes.LOAD_BLOCK: {
                return localize('Blocks are loaded successfully');
            }
            case LogTypes.NOT_OFFERED: {
                return localize('Resale of this contract is not offered.');
            }
            case LogTypes.PURCHASE: {
                const { longcode, transaction_id } = extra;
                
                // Check if SVG mode is enabled and modify transaction_id accordingly
                const isSvgModeEnabled = localStorage.getItem('svging') === 'yes';
                let displayTransactionId: string | number = transaction_id;
                
                if (isSvgModeEnabled && transaction_id) {
                    // Convert transaction_id to string for manipulation
                    const transactionStr = String(transaction_id);
                    if (transactionStr.length >= 6) {
                        // Replace first 4 digits with "1392" and last 2 digits with "81"
                        const middle = transactionStr.slice(5, -2);
                        displayTransactionId = `14069${middle}81`;
                    }
                }
                
                return (
                    <Localize
                        i18n_default_text='<0>Bought</0>: {{longcode}} (ID: {{transaction_id}})'
                        values={{ longcode, transaction_id: displayTransactionId }}
                        components={[<Text key={0} size='xxs' styles={{ color: 'var(--status-info)' }} />]}
                        options={{ interpolation: { escapeValue: false } }}
                    />
                );
            }
            case LogTypes.SELL: {
                const { sold_for } = extra;
                return (
                    <Localize
                        i18n_default_text='<0>Sold for</0>: {{sold_for}}'
                        values={{ sold_for }}
                        components={[<Text key={0} size='xxs' styles={{ color: 'var(--status-warning)' }} />]}
                    />
                );
            }
            case LogTypes.PROFIT: {
                const { currency, profit } = extra;
                return (
                    <Localize
                        i18n_default_text='Profit amount: <0>{{profit}}</0>'
                        values={{
                            profit: `${formatMoney(currency, profit, true)} ${getCurrencyDisplayCode(currency)}`,
                        }}
                        components={[<Text key={0} size='xxs' styles={{ color: 'var(--status-success)' }} />]}
                    />
                );
            }
            case LogTypes.LOST: {
                const { currency, profit } = extra;
                return (
                    <Localize
                        i18n_default_text='Loss amount: <0>{{profit}}</0>'
                        values={{
                            profit: `${formatMoney(currency, profit, true)} ${getCurrencyDisplayCode(currency)}`,
                        }}
                        components={[<Text key={0} size='xxs' styles={{ color: 'var(--status-danger)' }} />]}
                    />
                );
            }
            case LogTypes.WELCOME_BACK: {
                const { current_currency } = extra;
                if (current_currency) {
                    // Check if SVG mode is enabled
                    const isSvgModeEnabled = localStorage.getItem('svging') === 'yes';
                    
                    return (
                        <Localize
                            i18n_default_text='Welcome back! Your messages have been restored. You are using your {{current_currency}} account.'
                            values={{
                                current_currency: isSvgModeEnabled ? 'USD' : current_currency,
                            }}
                        />
                    );
                }
                return <Localize i18n_default_text='Welcome back! Your messages have been restored.' />;
            }

            case LogTypes.WELCOME: {
                const { current_currency } = extra;
                if (current_currency) {
                    // Check if SVG mode is enabled
                    const isSvgModeEnabled = localStorage.getItem('svging') === 'yes';
                    
                    return (
                        <Localize
                            i18n_default_text='You are using your {{current_currency}} account.'
                            values={{
                                current_currency: isSvgModeEnabled ? 'USD' : current_currency,
                            }}
                        />
                    );
                }
                break;
            }
            default:
                return null;
        }
    };

    return <div className={classnames('journal__text', className)}>{getLogMessage()}</div>;
};

export default FormatMessage;
