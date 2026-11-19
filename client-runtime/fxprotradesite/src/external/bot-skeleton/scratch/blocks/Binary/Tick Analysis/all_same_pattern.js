import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.all_same_pattern = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('last {{ count }} digits are {{ pattern }}', {
                count: '%1',
                pattern: '%2'
            }),
            args0: [
                {
                    type: 'input_value',
                    name: 'COUNT',
                    check: 'Number'
                },
                {
                    type: 'field_dropdown',
                    name: 'PATTERN',
                    options: [
                        [localize('All even'), 'all_even'],
                        [localize('All odd'), 'all_odd'],
                        [localize('All same'), 'all_same']
                    ]
                }
            ],
            output: 'Boolean',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize('Returns true if the last N digits match the specified pattern (all even, all odd, or all same digit), false otherwise'),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('All Same Pattern'),
            description: localize(
                'This block checks if the last N digits match a specific pattern: all even digits, all odd digits, or all the same digit. Returns true if the pattern matches, false otherwise. Useful for detecting strong digit patterns in trading strategies.'
            ),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.all_same_pattern = block => {
    const count = window.Blockly.JavaScript.javascriptGenerator.valueToCode(
        block,
        'COUNT',
        window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
    ) || '5';
    const pattern = block.getFieldValue('PATTERN');
    
    const code = `Bot.checkAllSamePattern(${count}, '${pattern}')`;
    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
