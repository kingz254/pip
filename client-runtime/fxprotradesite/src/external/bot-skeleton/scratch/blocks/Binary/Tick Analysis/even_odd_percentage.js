import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.even_odd_percentage = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('{{ pattern }} % of last {{ count }} digits', {
                pattern: '%1',
                count: '%2'
            }),
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'PATTERN',
                    options: [
                        [localize('Even'), 'even'],
                        [localize('Odd'), 'odd']
                    ]
                },
                {
                    type: 'input_value',
                    name: 'COUNT',
                    check: 'Number'
                }
            ],
            output: 'Number',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize('Returns the percentage of even or odd digits in the last N ticks'),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Even/Odd Percentage'),
            description: localize(
                'This block calculates the percentage of even or odd last digits from the specified number of recent ticks. Useful for analyzing digit patterns in trading strategies.'
            ),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.even_odd_percentage = block => {
    const pattern = block.getFieldValue('PATTERN');
    const count = window.Blockly.JavaScript.javascriptGenerator.valueToCode(
        block,
        'COUNT',
        window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
    ) || '10';
    
    const code = `Bot.getEvenOddPercentage('${pattern}', ${count})`;
    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
