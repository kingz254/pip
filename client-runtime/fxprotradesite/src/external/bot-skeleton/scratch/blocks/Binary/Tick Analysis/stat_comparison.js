import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.stat_comparison = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('previous stat {{ operator }} {{ value }}', {
                operator: '%1',
                value: '%2'
            }),
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'OPERATOR',
                    options: [
                        [localize('equal to (=)'), 'equal'],
                        [localize('not equal to (≠)'), 'not_equal'],
                        [localize('greater than (>)'), 'greater'],
                        [localize('less than (<)'), 'less'],
                        [localize('greater or equal (≥)'), 'greater_equal'],
                        [localize('less or equal (≤)'), 'less_equal']
                    ]
                },
                {
                    type: 'input_value',
                    name: 'VALUE',
                    check: 'Number'
                }
            ],
            output: 'Boolean',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize('Returns true if the previous accumulator stat satisfies the comparison condition against the specified value, false otherwise'),
            category: window.Blockly.Categories.FxProTrades,
        };
    },
    meta() {
        return {
            display_name: localize('Stat Comparison'),
            description: localize(
                'This block checks if the previous accumulator stat satisfies a comparison condition (equal, greater, less, etc.) against a specific value. The stat represents how many consecutive ticks stayed within the accumulator range before breaking out. Returns true if the condition is met, false otherwise. Useful for detecting breakout patterns and momentum in accumulator trading.'
            ),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.stat_comparison = block => {
    const operator = block.getFieldValue('OPERATOR') || 'equal';
    const value = window.Blockly.JavaScript.javascriptGenerator.valueToCode(
        block,
        'VALUE',
        window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
    ) || '0';

    const code = `Bot.checkStatComparison('${operator}', ${value})`;
    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
