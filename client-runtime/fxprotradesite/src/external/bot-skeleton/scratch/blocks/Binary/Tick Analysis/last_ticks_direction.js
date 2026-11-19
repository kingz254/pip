import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.last_ticks_direction = {
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('last {{ count }} ticks are {{ direction }}', {
                count: '%1',
                direction: '%2'
            }),
            args0: [
                {
                    type: 'input_value',
                    name: 'COUNT',
                    check: 'Number'
                },
                {
                    type: 'field_dropdown',
                    name: 'DIRECTION',
                    options: [
                        [localize('Rise'), 'rise'],
                        [localize('Fall'), 'fall']
                    ]
                }
            ],
            output: 'Boolean',
            outputShape: window.Blockly.OUTPUT_SHAPE_ROUND,
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize('Returns true if all the last N ticks moved in the specified direction (rise or fall), false otherwise'),
            category: window.Blockly.Categories.Tick_Analysis,
        };
    },
    meta() {
        return {
            display_name: localize('Last Ticks Direction'),
            description: localize(
                'This block checks if all the last N ticks moved in the same direction (all rising or all falling). Returns true if all ticks match the direction, false otherwise. Useful for detecting consistent momentum patterns in trading strategies.'
            ),
        };
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.last_ticks_direction = block => {
    const count = window.Blockly.JavaScript.javascriptGenerator.valueToCode(
        block,
        'COUNT',
        window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
    ) || '3';
    const direction = block.getFieldValue('DIRECTION');
    
    const code = `Bot.checkLastTicksDirection(${count}, '${direction}')`;
    return [code, window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC];
};
