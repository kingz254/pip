import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.digit_percentage = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('{{ digit }} % of last {{ count }} digits', {
                digit: '%1',
                count: '%2'
            }),
            args0: [
                {
                    type: 'input_value',
                    name: 'DIGIT',
                    check: 'Number'
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
            tooltip: localize('Returns the percentage of ticks with the specified last digit in the last N ticks'),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Digit Percentage'),
            description: localize(
                'This block calculates what percentage of recent ticks have a specific last digit. For example, it can calculate what percentage of the last 50 ticks ended with the digit 7. Useful for analyzing digit distribution and potential biases in tick data.'
            ),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.digit_percentage = block => {
    const digit = window.Blockly.JavaScript.javascriptGenerator.valueToCode(
        block,
        'DIGIT',
        window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
    ) || '0';
    const count = window.Blockly.JavaScript.javascriptGenerator.valueToCode(
        block,
        'COUNT',
        window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
    ) || '10';
    
    const code = `Bot.getDigitPercentage(${digit}, ${count})`;
    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};