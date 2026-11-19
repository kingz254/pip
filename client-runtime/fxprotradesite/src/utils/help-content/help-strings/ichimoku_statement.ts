import { localize } from '@deriv-com/translations';

export default {
    text: () => [
        localize(
            'Ichimoku Cloud (Ichimoku Kinko Hyo) is a comprehensive trend-following indicator that provides multiple data points for trading decisions. It was developed by Japanese journalist Goichi Hosoda in the 1960s.'
        ),
        localize('The Ichimoku Cloud consists of five main components:'),
        '',
        localize('1. Tenkan-sen (Conversion Line): (Highest High + Lowest Low) / 2 for the last 9 periods'),
        localize('2. Kijun-sen (Base Line): (Highest High + Lowest Low) / 2 for the last 26 periods'),
        localize('3. Senkou Span A (Leading Span A): (Tenkan-sen + Kijun-sen) / 2, plotted 26 periods ahead'),
        localize('4. Senkou Span B (Leading Span B): (Highest High + Lowest Low) / 2 for the last 52 periods, plotted 26 periods ahead'),
        localize('5. Chikou Span (Lagging Span): Current closing price plotted 26 periods behind'),
        '',
        localize('What Ichimoku Cloud tells you'),
        localize(
            'The cloud (Kumo) formed between Senkou Span A and B shows support and resistance levels. When price is above the cloud, the trend is bullish. When price is below the cloud, the trend is bearish.'
        ),
        localize(
            'The thickness of the cloud indicates the strength of support/resistance. A thick cloud provides stronger support/resistance than a thin cloud.'
        ),
        localize(
            'Tenkan-sen and Kijun-sen crossovers can signal trend changes. When Tenkan-sen crosses above Kijun-sen, it may indicate a bullish signal.'
        ),
        '',
        localize('How to use the Ichimoku Cloud block'),
        localize('Input list accepts a list of ticks or candles, while the periods define the calculation windows for each component.'),
        localize('Standard Ichimoku settings are: Tenkan (9), Kijun (26), Senkou Span B (52).'),
        localize('Example:'),
        localize('This will calculate the specified Ichimoku line using the provided input data and periods.'),
        localize(
            'You can use different Ichimoku lines for various trading strategies: Tenkan/Kijun for momentum, Cloud for trend direction, and Chikou for confirmation.'
        ),
        localize('The Ichimoku system works best in trending markets and provides a complete picture of market dynamics.'),
    ],
};
