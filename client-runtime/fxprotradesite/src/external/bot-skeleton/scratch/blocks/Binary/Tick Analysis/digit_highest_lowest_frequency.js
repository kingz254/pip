import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.digit_highest_lowest_frequency = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('{{ frequency_type }} frequency digit in last {{ count }} ticks', {
                frequency_type: '%1',
                count: '%2'
            }),
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'FREQUENCY_TYPE',
                    options: [
                        [localize('Highest'), 'highest'],
                        [localize('Lowest'), 'lowest']
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
            tooltip: localize('Returns the digit (0-9) that appears most or least frequently in recent ticks'),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Highest/Lowest Frequency Digit'),
            description: localize(
                'This block identifies which digit (0-9) appears most frequently or least frequently in the last digits of recent ticks. For example, it can tell you which digit appeared most often in the last 50 ticks. Useful for identifying digit biases and patterns in market data.'
            ),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.digit_highest_lowest_frequency = block => {
    const frequency_type = block.getFieldValue('FREQUENCY_TYPE');
    const count = window.Blockly.JavaScript.javascriptGenerator.valueToCode(
        block,
        'COUNT',
        window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
    ) || '10';
    
    const code = `Bot.getDigitHighestLowestFrequency('${frequency_type}', ${count})`;
    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};