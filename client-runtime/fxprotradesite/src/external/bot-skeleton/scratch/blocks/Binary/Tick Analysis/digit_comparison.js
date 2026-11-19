import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.digit_comparison = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('last {{ count }} digits are {{ operator }} {{ digit }}', {
                count: '%1',
                operator: '%2',
                digit: '%3'
            }),
            args0: [
                {
                    type: 'input_value',
                    name: 'COUNT',
                    check: 'Number'
                },
                {
                    type: 'field_dropdown',
                    name: 'OPERATOR',
                    options: [
                        [localize('equal to (=)'), 'equal'],
                        [localize('greater than (>)'), 'greater'],
                        [localize('less than (<)'), 'less'],
                        [localize('greater or equal (≥)'), 'greater_equal'],
                        [localize('less or equal (≤)'), 'less_equal']
                    ]
                },
                {
                    type: 'input_value',
                    name: 'DIGIT',
                    check: 'Number'
                }
            ],
            output: 'Boolean',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize('Returns true if all the last N digits satisfy the comparison condition against the specified digit, false otherwise'),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Digit Comparison'),
            description: localize(
                'This block checks if all the last N digits satisfy a comparison condition (equal, greater, less, etc.) against a specific digit. Returns true if all digits meet the condition, false otherwise. Useful for detecting specific digit value patterns in trading strategies.'
            ),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.digit_comparison = block => {
    const count = window.Blockly.JavaScript.javascriptGenerator.valueToCode(
        block,
        'COUNT',
        window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
    ) || '5';
    const operator = block.getFieldValue('OPERATOR') || 'equal';
    const digit = window.Blockly.JavaScript.javascriptGenerator.valueToCode(
        block,
        'DIGIT',
        window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
    ) || '0';

    const code = `Bot.checkDigitComparison(${count}, '${operator}', ${digit})`;
    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
