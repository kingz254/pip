import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.digit_frequency_rank = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('{{ rank }} frequent digit in last {{ count }} digits', {
                rank: '%1',
                count: '%2'
            }),
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'RANK',
                    options: [
                        [localize('Most'), 'most'],
                        [localize('Least'), 'least'],
                        [localize('Second most'), 'second_most'],
                        [localize('Second least'), 'second_least']
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
            tooltip: localize('Returns the digit with the specified frequency ranking in the last N ticks'),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Digit Frequency Rank'),
            description: localize(
                'This block returns the digit with the specified frequency ranking (most/least/second most/second least frequent) from the last N ticks. Useful for identifying dominant or rare digits in trading patterns.'
            ),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.digit_frequency_rank = block => {
    const rank = block.getFieldValue('RANK');
    const count = window.Blockly.JavaScript.javascriptGenerator.valueToCode(
        block,
        'COUNT',
        window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
    ) || '10';
    
    const code = `Bot.getDigitFrequencyRank('${rank}', ${count})`;
    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
