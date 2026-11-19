import { localize } from '@deriv-com/translations';
import { excludeOptionFromContextMenu, modifyContextMenu } from '../../../utils';

window.Blockly.Blocks.purchase = {
    init() {
        this.jsonInit(this.definition());

        // Allow this block to be used in conditional statements
        this.setNextStatement(true);
        this.setPreviousStatement(true);

        // Add shadow blocks with default values for inputs after a short delay
        // to ensure the block is fully rendered
        setTimeout(() => {
            this.addShadowBlocks();
            // Also sync with trade definition after initial setup
            this.syncWithTradeDefinition();
        }, 100);

        // Set up periodic sync as a backup (every 2 seconds)
        this.syncInterval = setInterval(() => {
            if (this.workspace && !this.workspace.isDragging() && !window.Blockly.derivWorkspace.isFlyoutVisible) {
                this.syncBarriersAndPrediction();
            }
        }, 2000);

        // Add workspace event listener for more reliable sync
        if (this.workspace) {
            this.workspaceListener = (event) => {
                this.handleWorkspaceEvent(event);
            };
            this.workspace.addChangeListener(this.workspaceListener);
        }
    },

    handleWorkspaceEvent(event) {
        // Only process if this block exists and workspace is ready
        if (!this.workspace || window.Blockly.derivWorkspace.isFlyoutVisible || this.workspace.isDragging()) {
            return;
        }

        // Check for events that might affect trade options values
        if (event.type === window.Blockly.Events.CHANGE && event.element === 'field' && event.name === 'NUM') {
            const changedBlock = this.workspace.getBlockById(event.blockId);
            if (changedBlock && this.isConnectedToTradeOptions(changedBlock)) {
                console.log('Purchase block: Detected number field change in trade options');
                setTimeout(() => {
                    this.syncBarriersAndPrediction();
                }, 150);
            }
        }
    },

    dispose() {
        // Remove the workspace listener when block is disposed
        if (this.workspace && this.workspaceListener) {
            this.workspace.removeChangeListener(this.workspaceListener);
            this.workspaceListener = null;
        }

        // Clear the sync interval
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        
        // Call parent dispose
        if (window.Blockly.Block.prototype.dispose) {
            window.Blockly.Block.prototype.dispose.call(this);
        }
    },
    definition() {
        return {
            message0: localize('Purchase {{ contract_type }} trade each tick {{ trade_each_tick }}', { 
                contract_type: '%1', 
                trade_each_tick: '%2' 
            }),
            message1: localize('Barrier: {{ barrier }}', { barrier: '%1' }),
            message2: localize('Second barrier: {{ second_barrier }}', { second_barrier: '%1' }),
            message3: localize('Prediction: {{ prediction }}', { prediction: '%1' }),
            args0: [
                {
                    type: 'field_dropdown',
                    name: 'PURCHASE_LIST',
                    options: [
                        [localize('Rise'), 'CALL'],
                        [localize('Fall'), 'PUT'],
                        [localize('Touch'), 'ONETOUCH'],
                        [localize('No Touch'), 'NOTOUCH'],
                        [localize('Ends Between'), 'EXPIRYRANGE'],
                        [localize('Ends Outside'), 'EXPIRYMISS'],
                        [localize('Stays Between'), 'RANGE'],
                        [localize('Goes Outside'), 'UPORDOWN'],
                        [localize('Asian Up'), 'ASIANU'],
                        [localize('Asian Down'), 'ASIAND'],
                        [localize('Matches'), 'DIGITMATCH'],
                        [localize('Differs'), 'DIGITDIFF'],
                        [localize('Even'), 'DIGITEVEN'],
                        
                        [localize('Odd'), 'DIGITODD'],
                        [localize('Over'), 'DIGITOVER'],
                        [localize('Under'), 'DIGITUNDER'],
                        [localize('High Tick'), 'TICKHIGH'],
                        [localize('Low Tick'), 'TICKLOW'],
                        [localize('Reset Call'), 'RESETCALL'],
                        [localize('Reset Put'), 'RESETPUT'],
                        [localize('Only Ups'), 'RUNHIGH'],
                        [localize('Only Downs'), 'RUNLOW'],
                        [localize('Call Spread'), 'CALLSPREAD'],
                        [localize('Put Spread'), 'PUTSPREAD'],
                        [localize('Up'), 'MULTUP'],
                        [localize('Down'), 'MULTDOWN'],
                        [localize('Buy'), 'ACCU'],
                        [localize('Rise Equals'), 'CALLE'],
                        [localize('Fall Equals'), 'PUTE']
                    ],
                },
                {
                    type: 'field_dropdown',
                    name: 'TRADE_EACH_TICK',
                    options: [
                        [localize('No'), 'false'],
                        [localize('Yes'), 'true']
                    ],
                },
            ],
            args1: [
                {
                    type: 'input_value',
                    name: 'BARRIER_OFFSET',
                    check: 'Number',
                },
            ],
            args2: [
                {
                    type: 'input_value',
                    name: 'SECONDBARRIER_OFFSET',
                    check: 'Number',
                },
            ],
            args3: [
                {
                    type: 'input_value',
                    name: 'PREDICTION',
                    check: 'Number',
                },
            ],
            previousStatement: true,
            nextStatement: true,
            colour: window.Blockly.Colours.Special1.colour,
            colourSecondary: window.Blockly.Colours.Special1.colourSecondary,
            colourTertiary: window.Blockly.Colours.Special1.colourTertiary,
            tooltip: localize('This block purchases contract of a specified type. All contract types are available regardless of trade definition settings. Use barrier and prediction inputs for contracts that require them. When "trade each tick" is enabled, a new contract will be purchased on every tick.'),
            category: window.Blockly.Categories.Before_Purchase,
        };
    },

    addShadowBlocks() {
        // Only add shadow blocks if workspace is available and block is rendered
        if (!this.workspace || !this.rendered) {
            return;
        }

        // Add shadow block for barrier offset
        const barrierInput = this.getInput('BARRIER_OFFSET');
        if (barrierInput && !barrierInput.connection.isConnected()) {
            const barrierShadow = this.workspace.newBlock('math_number');
            barrierShadow.setInputsInline(true);
            barrierShadow.setShadow(true);
            barrierShadow.setFieldValue('0.1', 'NUM'); // Default barrier offset
            barrierShadow.outputConnection.connect(barrierInput.connection);
            barrierShadow.initSvg();
            barrierShadow.renderEfficiently();
        }

        // Add shadow block for second barrier offset
        const secondBarrierInput = this.getInput('SECONDBARRIER_OFFSET');
        if (secondBarrierInput && !secondBarrierInput.connection.isConnected()) {
            const secondBarrierShadow = this.workspace.newBlock('math_number');
            secondBarrierShadow.setInputsInline(true);
            secondBarrierShadow.setShadow(true);
            secondBarrierShadow.setFieldValue('-0.1', 'NUM'); // Default second barrier offset
            secondBarrierShadow.outputConnection.connect(secondBarrierInput.connection);
            secondBarrierShadow.initSvg();
            secondBarrierShadow.renderEfficiently();
        }

        // Add shadow block for prediction
        const predictionInput = this.getInput('PREDICTION');
        if (predictionInput && !predictionInput.connection.isConnected()) {
            const predictionShadow = this.workspace.newBlock('math_number_positive');
            predictionShadow.setInputsInline(true);
            predictionShadow.setShadow(true);
            predictionShadow.setFieldValue('5', 'NUM'); // Default prediction digit (0-9)
            predictionShadow.outputConnection.connect(predictionInput.connection);
            predictionShadow.initSvg();
            predictionShadow.renderEfficiently();
        }
    },
    meta() {
        return {
            display_name: localize('Purchase'),
            description: localize(
                'Use this block to purchase the specific contract you want. All contract types are available in the dropdown regardless of your trade definition settings. You may add multiple Purchase blocks together with conditional blocks to define your purchase conditions. When "trade each tick" is enabled, a new contract will be purchased on every tick instead of just once. This block can only be used within the Purchase conditions block.'
            ),
            key_words: localize('buy'),
        };
    },
    onchange(event) {
        if (!this.workspace || window.Blockly.derivWorkspace.isFlyoutVisible || this.workspace.isDragging()) {
            return;
        }

        // Handle contract type changes to show/hide barrier inputs
        if (event.type === window.Blockly.Events.BLOCK_CHANGE && event.name === 'PURCHASE_LIST') {
            this.updateBarrierInputsVisibility();
            // Sync with trade options when contract type changes to ACCU
            const contractType = this.getFieldValue('PURCHASE_LIST');
            if (contractType === 'ACCU') {
                console.log('Contract type changed to ACCU, triggering sync');
                setTimeout(() => {
                    this.syncBarriersAndPrediction();
                }, 100);
            }
        } else if (event.type === window.Blockly.Events.BLOCK_CREATE && event.ids.includes(this.id)) {
            this.updateBarrierInputsVisibility();
            // Sync with trade definition contract type when block is created
            setTimeout(() => {
                this.syncWithTradeDefinition();
            }, 100);
        }

        // Listen for changes in trade definition contract type AND trade type
        if (event.type === window.Blockly.Events.BLOCK_CHANGE && 
           (event.name === 'TYPE_LIST' || event.name === 'TRADETYPE_LIST')) {
            console.log(`Purchase block: Detected ${event.name} change to ${event.newValue}`);
            this.syncWithTradeDefinition();
        }

        // Listen for ANY change event and check if it's related to trade options
        if (event.type === window.Blockly.Events.CHANGE || 
            event.type === window.Blockly.Events.BLOCK_CHANGE ||
            event.type === window.Blockly.Events.BLOCK_MOVE) {
            
            // Check if the event is from a trade options block or its children
            const eventBlock = event.blockId ? this.workspace.getBlockById(event.blockId) : null;
            if (eventBlock) {
                // Check if this is a trade options block or connected to one
                if (eventBlock.type === 'trade_definition_tradeoptions' || this.isConnectedToTradeOptions(eventBlock)) {
                    // Small delay to ensure changes are processed
                    setTimeout(() => {
                        this.syncBarriersAndPrediction();
                    }, 100);
                }
            }
        }
        
        // Validate that this block is used in the correct context
        this.validatePlacement();
    },

    isConnectedToTradeOptions(block) {
        // Check if this block is connected to trade options
        if (!block) return false;
        
        // Check parent chain
        let currentBlock = block;
        while (currentBlock) {
            if (currentBlock.type === 'trade_definition_tradeoptions') {
                return true;
            }
            currentBlock = currentBlock.getParent();
        }
        
        // Check if this is a number block connected to trade options inputs
        if ((block.type === 'math_number' || block.type === 'math_number_positive') && block.outputConnection) {
            const targetConnection = block.outputConnection.targetConnection;
            if (targetConnection && targetConnection.getSourceBlock().type === 'trade_definition_tradeoptions') {
                const inputName = this.findConnectedInput(block, targetConnection.getSourceBlock());
                return ['BARRIEROFFSET', 'SECONDBARRIEROFFSET', 'PREDICTION'].includes(inputName);
            }
        }
        
        return false;
    },

    findConnectedInput(numberBlock, parentBlock) {
        // Check all inputs of the parent block to find which one the number block is connected to
        for (const input of parentBlock.inputList) {
            if (input.connection && input.connection.targetBlock() === numberBlock) {
                return input.name;
            }
        }
        return null;
    },

    syncWithTradeDefinition() {
        // Find the trade definition block in the workspace
        const tradeDefinitionBlock = this.workspace
            .getAllBlocks(true)
            .find(block => block.type === 'trade_definition');
            
        if (!tradeDefinitionBlock) {
            return;
        }

        // Get the contract type block
        const contractTypeBlock = tradeDefinitionBlock.getChildByType('trade_definition_contracttype');
        if (!contractTypeBlock) {
            return;
        }

        const selectedContractType = contractTypeBlock.getFieldValue('TYPE_LIST');
        if (!selectedContractType || selectedContractType === 'both') {
            return; // Don't sync if no specific contract type is selected or "both" is selected
        }

        // Map trade definition contract types to purchase block contract types
        const contractTypeMapping = {
            'call': 'CALL',
            'put': 'PUT', 
            'both': 'CALL', // Default to CALL for "both"
            'calle': 'CALLE',
            'pute': 'PUTE',
            'onetouch': 'ONETOUCH', 
            'notouch': 'NOTOUCH',
            'expiryrange': 'EXPIRYRANGE',
            'expirymiss': 'EXPIRYMISS',
            'range': 'RANGE',
            'upordown': 'UPORDOWN',
            'asianu': 'ASIANU',
            'asiand': 'ASIAND',
            'digitmatch': 'DIGITMATCH',
            'digitdiff': 'DIGITDIFF',
            'digiteven': 'DIGITEVEN',
            'digitodd': 'DIGITODD',
            'digitover': 'DIGITOVER',
            'digitunder': 'DIGITUNDER',
            'tickhigh': 'TICKHIGH',
            'ticklow': 'TICKLOW',
            'runhigh': 'RUNHIGH',
            'runlow': 'RUNLOW',
            'resetcall': 'RESETCALL',
            'resetput': 'RESETPUT',
            'callspread': 'CALLSPREAD',
            'putspread': 'PUTSPREAD',
            'multup': 'MULTUP',
            'multdown': 'MULTDOWN',
            'accu': 'ACCU'
        };

        const mappedContractType = contractTypeMapping[selectedContractType.toLowerCase()];
        if (mappedContractType) {
            const purchaseField = this.getField('PURCHASE_LIST');
            if (purchaseField && purchaseField.getValue() !== mappedContractType) {
                // Use runIrreversibleEvents to prevent undo issues
                const runIrreversibleEvents = window.Blockly.Events.getGroup();
                window.Blockly.Events.setGroup('contract_type_sync');
                try {
                    purchaseField.setValue(mappedContractType);
                    // Update barrier inputs visibility after changing contract type
                    this.updateBarrierInputsVisibility();
                    // Also sync barrier and prediction values
                    this.syncBarriersAndPrediction();
                } finally {
                    window.Blockly.Events.setGroup(runIrreversibleEvents);
                }
            } else {
                // Even if contract type is the same, sync barriers and prediction
                this.syncBarriersAndPrediction();
            }
        }
    },

    syncBarriersAndPrediction() {
        // Find the trade options block in the workspace
        const tradeOptionsBlock = this.workspace
            .getAllBlocks(true)
            .find(block => block.type === 'trade_definition_tradeoptions');
            
        if (!tradeOptionsBlock) {
            console.log('Purchase block: No trade options block found for sync');
            return;
        }

        // Get current contract type to determine which values to sync
        const contractType = this.getFieldValue('PURCHASE_LIST');
        
        // Define which contracts need which inputs
        const contractsNeedingBarrier = ['CALL', 'PUT', 'ONETOUCH', 'NOTOUCH', 'RUNHIGH', 'RUNLOW', 'RESETCALL', 'RESETPUT'];
        const contractsNeedingTwoBarriers = ['EXPIRYRANGE', 'EXPIRYMISS', 'RANGE', 'UPORDOWN', 'CALLSPREAD', 'PUTSPREAD'];
        const contractsNeedingPrediction = ['DIGITOVER', 'DIGITUNDER', 'DIGITMATCH', 'DIGITDIFF'];
        const contractsNeedingGrowthRate = ['ACCU'];

        console.log(`Purchase block: Syncing for contract type ${contractType}`);

        // Use event grouping to prevent undo issues
        const currentGroup = window.Blockly.Events.getGroup();
        window.Blockly.Events.setGroup('barrier_prediction_sync');
        
        try {
            // Sync first barrier if needed
            if (contractsNeedingBarrier.includes(contractType) || contractsNeedingTwoBarriers.includes(contractType)) {
                console.log('Syncing first barrier...');
                this.syncInputValue(tradeOptionsBlock, 'BARRIEROFFSET', 'BARRIER_OFFSET');
            }

            // Sync second barrier if needed  
            if (contractsNeedingTwoBarriers.includes(contractType)) {
                console.log('Syncing second barrier...');
                this.syncInputValue(tradeOptionsBlock, 'SECONDBARRIEROFFSET', 'SECONDBARRIER_OFFSET');
            }

            // Sync prediction if needed
            if (contractsNeedingPrediction.includes(contractType)) {
                console.log('Syncing prediction...');
                this.syncInputValue(tradeOptionsBlock, 'PREDICTION', 'PREDICTION');
            }
        } finally {
            window.Blockly.Events.setGroup(currentGroup);
        }
    },

    syncInputValue(sourceBlock, sourceInputName, targetInputName) {
        // Get value from trade options block input
        const sourceInput = sourceBlock.getInput(sourceInputName);
        if (!sourceInput) {
            console.log(`Source input ${sourceInputName} not found`);
            return;
        }

        if (!sourceInput.connection || !sourceInput.connection.isConnected()) {
            console.log(`Source input ${sourceInputName} not connected`);
            return;
        }

        const sourceNumberBlock = sourceInput.connection.targetBlock();
        if (!sourceNumberBlock || (sourceNumberBlock.type !== 'math_number' && sourceNumberBlock.type !== 'math_number_positive')) {
            console.log(`Source number block not found or wrong type for ${sourceInputName}`);
            return;
        }

        const sourceValue = sourceNumberBlock.getFieldValue('NUM');
        if (sourceValue === null || sourceValue === undefined) {
            console.log(`Source value not found for ${sourceInputName}`);
            return;
        }

        console.log(`Syncing ${sourceInputName} -> ${targetInputName}: ${sourceValue}`);

        // Get target input in purchase block
        const targetInput = this.getInput(targetInputName);
        if (!targetInput) {
            console.log(`Target input ${targetInputName} not found`);
            return;
        }

        // Check if target input is visible
        if (!targetInput.isVisible()) {
            console.log(`Target input ${targetInputName} is not visible, skipping sync`);
            return;
        }

        // Update target value if different
        if (targetInput.connection.isConnected()) {
            const targetNumberBlock = targetInput.connection.targetBlock();
            if (targetNumberBlock && (targetNumberBlock.type === 'math_number' || targetNumberBlock.type === 'math_number_positive')) {
                const currentValue = targetNumberBlock.getFieldValue('NUM');
                if (currentValue !== sourceValue) {
                    console.log(`Updating ${targetInputName} from ${currentValue} to ${sourceValue}`);
                    targetNumberBlock.setFieldValue(sourceValue, 'NUM');
                } else {
                    console.log(`${targetInputName} already has correct value: ${sourceValue}`);
                }
            }
        } else {
            // Create a new shadow block with the synced value
            console.log(`Creating new shadow block for ${targetInputName} with value ${sourceValue}`);
            const shadowType = targetInputName === 'PREDICTION' ? 'math_number_positive' : 'math_number';
            const newShadow = this.workspace.newBlock(shadowType);
            newShadow.setInputsInline(true);
            newShadow.setShadow(true);
            newShadow.setFieldValue(sourceValue, 'NUM');
            newShadow.outputConnection.connect(targetInput.connection);
            newShadow.initSvg();
            newShadow.renderEfficiently();
        }
    },

    validatePlacement() {
        // Check if this block is properly placed within before_purchase or conditional blocks
        let parent = this.getParent();
        let isInValidContext = false;
        
        while (parent) {
            if (parent.type === 'before_purchase' || 
                parent.type === 'controls_if' || 
                parent.type === 'controls_ifelse' ||
                parent.type === 'logic_compare' ||
                parent.type === 'controls_whileUntil' ||
                parent.type === 'controls_repeat' ||
                parent.type === 'controls_forEach') {
                isInValidContext = true;
                break;
            }
            parent = parent.getParent();
        }
        
        // Set visual indicator if placement is invalid
        if (!isInValidContext) {
            this.setWarningText('This block should be placed within Purchase conditions or conditional blocks');
        } else {
            this.setWarningText(null);
        }
    },

    updateBarrierInputsVisibility() {
        const contractType = this.getFieldValue('PURCHASE_LIST');
        
        // Define which contracts need barriers
        const contractsNeedingBarrier = [
            'ONETOUCH', 'NOTOUCH', 'RUNHIGH', 'RUNLOW'
        ];
        
        const contractsNeedingTwoBarriers = [
            'EXPIRYRANGE', 'EXPIRYMISS', 'RANGE', 'UPORDOWN', 'CALLSPREAD', 'PUTSPREAD'
        ];
        
        // Contracts that need prediction input (digit-based contracts)
        const contractsNeedingPrediction = [
            'DIGITOVER', 'DIGITUNDER', 'DIGITMATCH', 'DIGITDIFF'
        ];

        // Contracts that don't need any barriers or predictions (work automatically)
        const contractsNoInputsNeeded = [
            'CALL', 'PUT',
            'DIGITEVEN', 'DIGITODD', 'ASIANU', 'ASIAND', 'TICKHIGH', 'TICKLOW', 
            'MULTUP', 'MULTDOWN', 'ACCU', 'CALLE', 'PUTE'
        ];

        // Show/hide barrier input
        const needsBarrier = contractsNeedingBarrier.includes(contractType) || contractsNeedingTwoBarriers.includes(contractType);
        this.setInputsInline(false);
        
        if (needsBarrier) {
            this.getInput('BARRIER_OFFSET').setVisible(true);
        } else {
            this.getInput('BARRIER_OFFSET').setVisible(false);
        }

        // Show/hide second barrier input
        if (contractsNeedingTwoBarriers.includes(contractType)) {
            this.getInput('SECONDBARRIER_OFFSET').setVisible(true);
        } else {
            this.getInput('SECONDBARRIER_OFFSET').setVisible(false);
        }

        // Show/hide prediction input
        if (contractsNeedingPrediction.includes(contractType)) {
            this.getInput('PREDICTION').setVisible(true);
        } else {
            this.getInput('PREDICTION').setVisible(false);
        }

        // Add shadow blocks for visible inputs that don't have connections
        setTimeout(() => {
            this.addShadowBlocksForVisibleInputs();
        }, 50);
    },

    addShadowBlocksForVisibleInputs() {
        // Only add shadow blocks if workspace is available and block is rendered
        if (!this.workspace || !this.rendered) {
            return;
        }

        // Add shadow block for barrier offset if visible and not connected
        const barrierInput = this.getInput('BARRIER_OFFSET');
        if (barrierInput && barrierInput.isVisible() && !barrierInput.connection.isConnected()) {
            const barrierShadow = this.workspace.newBlock('math_number');
            barrierShadow.setInputsInline(true);
            barrierShadow.setShadow(true);
            barrierShadow.setFieldValue('0.1', 'NUM'); // Default barrier offset
            barrierShadow.outputConnection.connect(barrierInput.connection);
            barrierShadow.initSvg();
            barrierShadow.renderEfficiently();
        }

        // Add shadow block for second barrier offset if visible and not connected
        const secondBarrierInput = this.getInput('SECONDBARRIER_OFFSET');
        if (secondBarrierInput && secondBarrierInput.isVisible() && !secondBarrierInput.connection.isConnected()) {
            const secondBarrierShadow = this.workspace.newBlock('math_number');
            secondBarrierShadow.setInputsInline(true);
            secondBarrierShadow.setShadow(true);
            secondBarrierShadow.setFieldValue('-0.1', 'NUM'); // Default second barrier offset
            secondBarrierShadow.outputConnection.connect(secondBarrierInput.connection);
            secondBarrierShadow.initSvg();
            secondBarrierShadow.renderEfficiently();
        }

        // Add shadow block for prediction if visible and not connected
        const predictionInput = this.getInput('PREDICTION');
        if (predictionInput && predictionInput.isVisible() && !predictionInput.connection.isConnected()) {
            const predictionShadow = this.workspace.newBlock('math_number_positive');
            predictionShadow.setInputsInline(true);
            predictionShadow.setShadow(true);
            predictionShadow.setFieldValue('5', 'NUM'); // Default prediction digit (0-9)
            predictionShadow.outputConnection.connect(predictionInput.connection);
            predictionShadow.initSvg();
            predictionShadow.renderEfficiently();
        }

        // Growth rate is a dropdown field, no shadow block needed
    },
    populatePurchaseList(event) {
        // Purchase list is now pre-populated with all contract types
        // No need to filter based on trade definition anymore
        return;
    },
    customContextMenu(menu) {
        const menu_items = [localize('Enable Block'), localize('Disable Block')];
        excludeOptionFromContextMenu(menu, menu_items);
        
        // Add manual sync option for testing
        const syncOption = {
            text: localize('Sync with Trade Options'),
            enabled: true,
            callback: () => {
                console.log('Manual sync triggered');
                this.syncWithTradeDefinition();
                this.syncBarriersAndPrediction();
            }
        };
        menu.push(syncOption);
        
        modifyContextMenu(menu);
    },
    // Remove restricted_parents to allow use in conditions
    // restricted_parents: ['before_purchase'],
};

window.Blockly.JavaScript.javascriptGenerator.forBlock.purchase = block => {
    const purchaseList = block.getFieldValue('PURCHASE_LIST');
    const tradeEachTick = block.getFieldValue('TRADE_EACH_TICK');
    
    // Get barrier values and handle null/undefined properly
    const barrier = window.Blockly.JavaScript.javascriptGenerator.valueToCode(
        block, 
        'BARRIER_OFFSET', 
        window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
    );
    
    const secondBarrier = window.Blockly.JavaScript.javascriptGenerator.valueToCode(
        block, 
        'SECONDBARRIER_OFFSET', 
        window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
    );
    
    const prediction = window.Blockly.JavaScript.javascriptGenerator.valueToCode(
        block, 
        'PREDICTION', 
        window.Blockly.JavaScript.javascriptGenerator.ORDER_ATOMIC
    );

    // Contract types that need specific inputs
    const contractsNeedingBarrier = ['ONETOUCH', 'NOTOUCH', 'RUNHIGH', 'RUNLOW', 'RESETCALL', 'RESETPUT'];
    const contractsNeedingTwoBarriers = ['EXPIRYRANGE', 'EXPIRYMISS', 'RANGE', 'UPORDOWN', 'CALLSPREAD', 'PUTSPREAD'];
    const contractsNeedingPrediction = ['DIGITOVER', 'DIGITUNDER', 'DIGITMATCH', 'DIGITDIFF'];

    // Determine which values to pass based on contract type
    let barrierValue = 'null';
    let secondBarrierValue = 'null';
    let predictionValue = 'null';

    if (contractsNeedingBarrier.includes(purchaseList) || contractsNeedingTwoBarriers.includes(purchaseList)) {
        barrierValue = barrier && barrier !== '' ? barrier : 'null';
    }
    
    if (contractsNeedingTwoBarriers.includes(purchaseList)) {
        secondBarrierValue = secondBarrier && secondBarrier !== '' ? secondBarrier : 'null';
    }
    
    if (contractsNeedingPrediction.includes(purchaseList)) {
        predictionValue = prediction && prediction !== '' ? prediction : 'null';
    }

    // Growth rate and take profit are read from trade options block, pass null here
    const growthRateValue = 'null';
    const takeProfitValue = 'null';

    // Generate unique identifier for debugging conditional execution
    const uniqueId = Math.random().toString(36).substr(2, 9);
    
    // Add try-catch wrapper for better error handling in conditional blocks
    const code = `try {
    console.log('Executing purchase ${uniqueId}: ${purchaseList}', 
        'barriers:', ${barrierValue}, ${secondBarrierValue}, 
        'prediction:', ${predictionValue},
        'growthRate:', ${growthRateValue},
        'takeProfit:', ${takeProfitValue},
        'eachTick:', ${tradeEachTick});
    Bot.purchase('${purchaseList}', ${tradeEachTick}, ${barrierValue}, ${secondBarrierValue}, ${predictionValue}, ${growthRateValue}, ${takeProfitValue});
} catch (e) {
    console.warn('Purchase block ${uniqueId} execution failed:', e.message);
}
`;
    return code;
};
