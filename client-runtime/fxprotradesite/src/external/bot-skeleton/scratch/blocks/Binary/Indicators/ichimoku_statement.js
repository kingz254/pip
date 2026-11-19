import { localize } from '@deriv-com/translations';
import { config } from '../../../../constants/config';
import { modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.ichimoku_statement = {
    protected_statements: ['STATEMENT'],
    required_child_blocks: ['input_list', 'tenkan_period', 'kijun_period', 'senkou_span_b_period'],
    init() {
        this.jsonInit(this.definition());
    },
    definition() {
        return {
            message0: localize('set {{ variable }} to Ichimoku Cloud {{ line_type }} {{ dummy }}', {
                variable: '%1',
                line_type: '%2',
                dummy: '%3',
            }),
            message1: '%1',
            args0: [
                {
                    type: 'field_variable',
                    name: 'VARIABLE',
                    variable: 'ichimoku',
                },
                {
                    type: 'field_dropdown',
                    name: 'ICHIMOKU_LINE_TYPE',
                    options: config().ichimokuResult,
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
            tooltip: localize('Calculates Ichimoku Cloud lines from a list with specified periods'),
            previousStatement: null,
            nextStatement: null,
            category: window.Blockly.Categories.Tools,
        };
    },
    meta() {
        return {
            display_name: localize('Ichimoku Cloud'),
            description: localize(
                'Ichimoku Cloud is a comprehensive trend-following indicator that shows support/resistance levels, trend direction, and momentum. It consists of five lines: Tenkan-sen (conversion line), Kijun-sen (base line), Senkou Span A and B (leading spans), and Chikou Span (lagging span). The "cloud" is formed between Senkou Span A and B.'
            ),
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

window.Blockly.JavaScript.javascriptGenerator.forBlock.ichimoku_statement = block => {
    // eslint-disable-next-line no-underscore-dangle
    const var_name = window.Blockly.JavaScript.variableDB_.getName(
        block.getFieldValue('VARIABLE'),
        window.Blockly.Variables.CATEGORY_NAME
    );
    const line_type = block.getFieldValue('ICHIMOKU_LINE_TYPE');
    const input = block.childValueToCode('input_list', 'INPUT_LIST');
    const tenkan_period = block.childValueToCode('tenkan_period', 'TENKAN_PERIOD');
    const kijun_period = block.childValueToCode('kijun_period', 'KIJUN_PERIOD');
    const senkou_span_b_period = block.childValueToCode('senkou_span_b_period', 'SENKOU_SPAN_B_PERIOD');
    
    const code = `${var_name} = Bot.ichimoku(${input}, { 
        tenkanPeriod: ${tenkan_period}, 
        kijunPeriod: ${kijun_period}, 
        senkouSpanBPeriod: ${senkou_span_b_period} 
    }, ${line_type});\n`;

    return code;
};
