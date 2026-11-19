import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../../utils';

window.Blockly.Blocks.senkou_span_b_period = {
    init() {
        this.jsonInit({
            message0: localize('Senkou Span B Period {{ input_period }}', { input_period: '%1' }),
            args0: [
                {
                    type: 'input_value',
                    name: 'SENKOU_SPAN_B_PERIOD',
                    check: null,
                },
            ],
            colour: window.Blockly.Colours.Base.colour,
            colourSecondary: window.Blockly.Colours.Base.colourSecondary,
            colourTertiary: window.Blockly.Colours.Base.colourTertiary,
            previousStatement: null,
            nextStatement: null,
        });

        this.setMovable(false);
        this.setDeletable(false);
    },
    onchange: window.Blockly.Blocks.input_list.onchange,
    customContextMenu(menu) {
        modifyContextMenu(menu);
    },
    allowed_parents: [
        'ichimoku_statement',
    ],
    getRequiredValueInputs() {
        return {
            SENKOU_SPAN_B_PERIOD: null,
        };
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.senkou_span_b_period = () => {};
