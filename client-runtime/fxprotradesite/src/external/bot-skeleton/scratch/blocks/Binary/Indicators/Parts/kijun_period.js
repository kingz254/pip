import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../../utils';

window.Blockly.Blocks.kijun_period = {
    init() {
        this.jsonInit({
            message0: localize('Kijun Period {{ input_period }}', { input_period: '%1' }),
            args0: [
                {
                    type: 'input_value',
                    name: 'KIJUN_PERIOD',
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
            KIJUN_PERIOD: null,
        };
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.kijun_period = () => {};
