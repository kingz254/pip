import { localize } from '@deriv-com/translations';
import { config } from '../../../../constants/config';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.donchian_channels_statement = {
    protected_statements: ['STATEMENT'],
    required_child_blocks: ['input_list', 'donchian_period'],
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('set {{ variable }} to Donchian Channels {{ channel_line }} {{ dummy }}', {
                variable: '%1',
                channel_line: '%2',
                dummy: '%3',
            }),
            message1: '%1',
            args0: [
                {
                    type: 'field_variable',
                    name: 'VARIABLE',
                    variable: 'dc',
                },
                {
                    type: 'field_dropdown',
                    name: 'DONCHIAN_CHANNEL_LINE',
                    options: config().donchianChannelsResult,
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
            tooltip: localize('Donchian Channels show the highest high and lowest low over a specified period. Upper channel is the highest high, lower channel is the lowest low, and middle channel is their average.'),
            previousStatement: null,
            nextStatement: null,
            category: window.Blockly.Categories.Tools,
        };
    },
    meta() {
        return {
            display_name: localize('Donchian Channels'),
            description: localize('Donchian Channels indicator showing price channels over a specified period'),
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

window.Blockly.JavaScript.javascriptGenerator.forBlock.donchian_channels_statement = block => {
    // eslint-disable-next-line no-underscore-dangle
    const var_name = window.Blockly.JavaScript.variableDB_.getName(
        block.getFieldValue('VARIABLE'),
        window.Blockly.Variables.CATEGORY_NAME
    );
    const channel_line_type = block.getFieldValue('DONCHIAN_CHANNEL_LINE');
    const input = block.childValueToCode('input_list', 'INPUT_LIST');
    const period = block.childValueToCode('donchian_period', 'DONCHIAN_PERIOD');
    
    const code = `${var_name} = Bot.getDonchianChannels(${input}, ${period}, ${channel_line_type});\n`;

    return code;
};
