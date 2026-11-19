import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../../utils';

window.Blockly.Blocks.williams_r_period = {
    init() {
        this.jsonInit({
            message0: localize('Williams %R Period {{ input_period }}', { input_period: '%1' }),
            args0: [
                {
                    type: 'input_value',
                    name: 'WILLIAMS_R_PERIOD',
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
        'williams_r_statement',
    ],
    getRequiredValueInputs() {
        return {
            WILLIAMS_R_PERIOD: null,
        };
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.williams_r_period = () => {};
