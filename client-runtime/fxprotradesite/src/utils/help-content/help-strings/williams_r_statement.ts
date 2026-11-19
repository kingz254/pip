import { localize } from '@deriv-com/translations';

export default {
    text: () => [
        localize(
            'Williams %R is a momentum oscillator developed by Larry Williams that measures overbought and oversold conditions in the market. It compares the current closing price to the highest high over a specified period.'
        ),
        localize('The Williams %R calculation:'),
        '',
        localize('%R = (Highest High - Current Close) / (Highest High - Lowest Low) × -100'),
        '',
        localize('Where:'),
        localize('- Highest High: The highest price over the specified period'),
        localize('- Current Close: The current closing price'),
        localize('- Lowest Low: The lowest price over the specified period'),
        '',
        localize('What Williams %R tells you'),
        localize(
            'Williams %R oscillates between -100 and 0. Unlike other oscillators, Williams %R is inverted, with readings closer to -100 indicating oversold conditions and readings closer to 0 indicating overbought conditions.'
        ),
        localize(
            'Key levels: Values above -20 suggest overbought conditions (potential sell signal), while values below -80 suggest oversold conditions (potential buy signal).'
        ),
        localize(
            'The indicator is particularly useful for identifying potential reversal points and confirming trend strength.'
        ),
        '',
        localize('Trading strategies with Williams %R'),
        localize('Overbought/Oversold Strategy: Buy when Williams %R falls below -80 and sell when it rises above -20.'),
        localize('Momentum Divergence: Look for divergences between price action and Williams %R to identify potential trend reversals.'),
        localize('Trend Confirmation: Use Williams %R in conjunction with trend indicators to confirm entry and exit points.'),
        '',
        localize('How to use the Williams %R block'),
        localize('Input list accepts a list of ticks or candles, while the period defines the lookback window for calculating the highest high and lowest low.'),
        localize('Common Williams %R periods are 14, 21, or 28, with 14 being the most widely used default.'),
        localize('Example:'),
        localize('This will calculate the Williams %R oscillator using the provided input data and period.'),
        localize(
            'Williams %R is most effective when used in conjunction with other technical indicators to confirm signals and reduce false positives.'
        ),
        localize('The indicator works well in both trending and ranging markets, making it a versatile tool for various trading strategies.'),
    ],
};
