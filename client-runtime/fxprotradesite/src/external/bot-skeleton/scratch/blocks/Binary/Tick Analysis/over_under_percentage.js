import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.over_under_percentage = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('{{ condition }} {{ digit }} % of last {{ count }} digits', {
                condition: '%1',
                digit: '%2',
                count: '%3'
            }),
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'CONDITION',
                    options: [
                        [localize('Over'), 'over'],
                        [localize('Under'), 'under']
                    ]
                },
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
            tooltip: localize('Returns the percentage of digits over or under a threshold in the last N ticks'),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Over/Under Percentage'),
            description: localize(
                'This block calculates the percentage of last digits that are over or under a specified digit from the recent ticks. Useful for analyzing digit distribution patterns in trading strategies.'
            ),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.over_under_percentage = block => {
    const condition = block.getFieldValue('CONDITION');
    const digit = window.Blockly.JavaScript.javascriptGenerator.valueToCode(
        block,
        'DIGIT',
        window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
    ) || '5';
    const count = window.Blockly.JavaScript.javascriptGenerator.valueToCode(
        block,
        'COUNT',
        window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
    ) || '10';
    
    const code = `Bot.getOverUnderPercentage('${condition}', ${digit}, ${count})`;
    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
