import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.williams_r_statement = {
    protected_statements: ['STATEMENT'],
    required_child_blocks: ['input_list', 'williams_r_period'],
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('set {{ variable }} to Williams %R {{ dummy }}', {
                variable: '%1',
                dummy: '%2',
            }),
            message1: '%1',
            args0: [
                {
                    type: 'field_variable',
                    name: 'VARIABLE',
                    variable: 'williams_r',
                },
                {
                    type: 'input_dummy',
                },
            ],
            args1: [
                {
                    type: 'input_statement',
                    name: 'STATEMENT',
                    check: null,
                },
            ],
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            tooltip: localize('Williams %R is a momentum oscillator that measures overbought and oversold conditions. Values range from -100 to 0, where values above -20 indicate overbought conditions and values below -80 indicate oversold conditions.'),
            previousStatement: null,
            nextStatement: null,
            category: window.Blockly.Categories.Tools,
        };
    },
    meta() {
        return {
            display_name: localize('Williams %R'),
            description: localize('Williams %R momentum oscillator for identifying overbought and oversold conditions'),
        };
    },
    onchange(event) {
        if (!this.workspace || window.Blockly.derivWorkspace.isFlyoutVisible || this.workspace.isDragging()) {
            return;
        }

        if (event.type === window.Blockly.Events.BLOCK_DRAG && !event.isStart) {
            const blocksInStatement = this.getBlocksInStatement('STATEMENT');
            blocksInStatement.forEach(block => {
                if (!this.required_child_blocks.includes(block.type)) {
                    window.Blockly.Events.disable();
                    block.unplug(false);
                    window.Blockly.Events.enable();
                }
            });
        }
    },
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.williams_r_statement = block => {
    // eslint-disable-next-line no-underscore-dangle
    const var_name = window.Blockly.JavaScript.variableDB_.getName(
        block.getFieldValue('VARIABLE'),
        window.Blockly.Variables.CATEGORY_NAME
    );
    const input = block.childValueToCode('input_list', 'INPUT_LIST');
    const period = block.childValueToCode('williams_r_period', 'WILLIAMS_R_PERIOD');
    
    const code = `${var_name} = Bot.getWilliamsR(${input}, ${period});\n`;

    return code;
};
