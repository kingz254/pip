import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../../utils';

window.Blockly.Blocks.symbol_switcher = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        // Symbol names for dropdown
        const symbolOptions = [
            ['Volatility 10 Index', 'R_10'],
            ['Volatility 25 Index', 'R_25'],
            ['Volatility 50 Index', 'R_50'],
            ['Volatility 75 Index', 'R_75'],
            ['Volatility 100 Index', 'R_100'],
            ['Volatility 10 (1s) Index', '1HZ10V'],
            ['Volatility 15 (1s) Index', '1HZ15V'],
            ['Volatility 20 (1s) Index', '1HZ90V'],
            ['Volatility 25 (1s) Index', '1HZ25V'],
            ['Volatility 30 (1s) Index', '1HZ30V'],
            ['Volatility 50 (1s) Index', '1HZ50V'],
            ['Volatility 75 (1s) Index', '1HZ75V'],
            ['Volatility 100 (1s) Index', '1HZ100V']
        ];
        return {
            message0: localize('Symbol Switcher: %1'),
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'SYMBOL_LIST',
                    options: symbolOptions,
                },
            ],
            previousStatement: true,
            nextStatement: true,
            colour: window.Blockly.Colours.Special1.colour,
            colourSecondary: window.Blockly.Colours.Special1.colourSecondary,
            colourTertiary: window.Blockly.Colours.Special1.colourTertiary,
            tooltip: localize('Select a symbol for conditional trading. Use with SPECIFY option in trade definition.'),
            category: window.Blockly.Categories.Tools,
        };
    },
    meta() {
        return {
            display_name: localize('Symbol Switcher'),
            description: localize(
                'This block allows you to select a specific trading symbol. Use it with conditional blocks when the trade definition is set to "Specify".'
            ),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.symbol_switcher = block => {
    const symbol = block.getFieldValue('SYMBOL_LIST');
    // Set the symbol for the next trade in SPECIFY mode using the in-scope Bot variable
    const code = `
// Symbol Switcher: Set symbol for next trade in SPECIFY mode
if (Bot && Bot.setNextSymbol) {
    Bot.setNextSymbol('${symbol}');
    console.log('🔧 Symbol Switcher: Next trade will use ${symbol}');
} else {
    console.warn('Symbol Switcher: Bot.setNextSymbol not available');
}
`;
    return code;
};