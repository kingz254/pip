import { localize } from '@deriv-com/translations';
import { modifyContextMenu } from '../../../../utils';

window.Blockly.Blocks.donchian_period = {
    init() {
        this.jsonInit({
            message0: localize('Donchian Period {{ input_period }}', { input_period: '%1' }),
            args0: [
                {
                    type: 'input_value',
                    name: 'DONCHIAN_PERIOD',
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
        'donchian_channels_statement',
    ],
    getRequiredValueInputs() {
        return {
            DONCHIAN_PERIOD: null,
        };
    },
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.donchian_period = () => {};
