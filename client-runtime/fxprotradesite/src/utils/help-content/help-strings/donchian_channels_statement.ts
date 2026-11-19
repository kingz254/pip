import { localize } from '@deriv-com/translations';

export default {
    text: () => [
        localize(
            'Donchian Channels are a technical analysis indicator used to identify potential support and resistance levels as well as breakout points. The indicator was developed by Richard Donchian in the 1950s.'
        ),
        localize('The Donchian Channels consist of three main components:'),
        '',
        localize('1. Upper Channel: The highest high over the specified period'),
        localize('2. Lower Channel: The lowest low over the specified period'),
        localize('3. Middle Channel: The average of the upper and lower channels (Upper + Lower) / 2'),
        '',
        localize('What Donchian Channels tell you'),
        localize(
            'Donchian Channels help identify potential breakout points when price moves above the upper channel or below the lower channel. These breakouts often signal the beginning of new trends.'
        ),
        localize(
            'The width of the channel indicates market volatility. Narrow channels suggest low volatility and potential consolidation, while wide channels indicate high volatility.'
        ),
        localize(
            'The middle channel acts as a dynamic support/resistance level and can be used to gauge trend direction and strength.'
        ),
        '',
        localize('Trading strategies with Donchian Channels'),
        localize('Breakout Strategy: Buy when price breaks above the upper channel, sell when price breaks below the lower channel.'),
        localize('Mean Reversion: Look for price to return to the middle channel after touching the upper or lower boundaries.'),
        localize('Trend Following: Use the channel direction to determine overall market trend.'),
        '',
        localize('How to use the Donchian Channels block'),
        localize('Input list accepts a list of ticks or candles, while the period defines the lookback window for calculating the highest high and lowest low.'),
        localize('Common Donchian Channels periods are 10, 20, or 55, with 20 being the most widely used.'),
        localize('Example:'),
        localize('This will calculate the specified Donchian Channel line using the provided input data and period.'),
        localize(
            'You can use different channel lines for various purposes: Upper/Lower for breakout signals, Middle for trend direction and support/resistance.'
        ),
        localize('Donchian Channels work well in trending markets and are particularly effective for breakout strategies.'),
    ],
};
