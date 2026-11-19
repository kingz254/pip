import React from 'react';
import ReactDomServer from 'react-dom/server';
import { localize } from '@deriv-com/translations';

const Arg = ({ ...props }) => {
    return React.createElement('arg', props);
};

const Block = ({ ...props }) => {
    return React.createElement('block', props);
};

const Category = ({ ...props }) => {
    return React.createElement('category', props);
};

const Example = ({ ...props }) => {
    return React.createElement('example', props);
};

const Examples = ({ ...props }) => {
    return React.createElement('examples', props);
};

const Field = ({ ...props }) => {
    return React.createElement('field', props);
};

const Mutation = ({ ...props }) => {
    return React.createElement('mutation', props);
};

const Next = ({ ...props }) => {
    return React.createElement('next', props);
};

const Shadow = ({ ...props }) => {
    return React.createElement('shadow', props);
};

const Statement = ({ ...props }) => {
    return React.createElement('statement', props);
};

const Value = ({ ...props }) => {
    return React.createElement('value', props);
};

const Xml = ({ ...props }) => {
    return React.createElement('xml', props);
};

export const ToolboxItems = () =>
    ReactDomServer.renderToStaticMarkup(
        <Xml xmlns='http://www.w3.org/1999/xhtml' id='toolbox'>
            <Category id='trade_parameters' name={localize('Trade parameters')}>
                <Block type='trade_definition'>
                    <Statement name='TRADE_OPTIONS'>
                        <Block type='trade_definition_market' deletable='false' movable='false'>
                            <Field name='MARKET_LIST' />
                            <Field name='SUBMARKET_LIST' />
                            <Field name='SYMBOL_LIST' />
                            <Next>
                                <Block type='trade_definition_tradetype' deletable='false' movable='false'>
                                    <Field name='TRADETYPECAT_LIST' />
                                    <Field name='TRADETYPE_LIST' />
                                    <Next>
                                        <Block type='trade_definition_contracttype' deletable='false' movable='false'>
                                            <Field name='TYPE_LIST' />
                                            <Next>
                                                <Block
                                                    type='trade_definition_candleinterval'
                                                    deletable='false'
                                                    movable='false'
                                                >
                                                    <Field name='CANDLEINTERVAL_LIST'>60</Field>
                                                    <Next>
                                                        <Block
                                                            type='trade_definition_restartbuysell'
                                                            deletable='false'
                                                            movable='false'
                                                        >
                                                            <Field name='TIME_MACHINE_ENABLED'>FALSE</Field>
                                                            <Next>
                                                                <Block
                                                                    type='trade_definition_restartonerror'
                                                                    deletable='false'
                                                                    movable='false'
                                                                >
                                                                    <Field name='RESTARTONERROR'>TRUE</Field>
                                                                </Block>
                                                            </Next>
                                                        </Block>
                                                    </Next>
                                                </Block>
                                            </Next>
                                        </Block>
                                    </Next>
                                </Block>
                            </Next>
                        </Block>
                    </Statement>
                </Block>
                <Block type='trade_definition_tradeoptions'>
                    <Mutation has_first_barrier='false' has_second_barrier='false' has_prediction='false' />
                    <Field name='DURATIONTYPE_LIST' />
                    <Field name='CURRENCY_LIST'>USD</Field>
                    <Value name='DURATION'>
                        <Shadow type='math_number'>
                            <Field name='NUM'>1</Field>
                        </Shadow>
                    </Value>
                    <Value name='AMOUNT'>
                        <Shadow type='math_number'>
                            <Field name='NUM'>1</Field>
                        </Shadow>
                    </Value>
                    <Field name='AMOUNT_LIMITS' />
                </Block>
                <Block type='trade_definition_multiplier'>
                    <Field name='MULTIPLIERTYPE_LIST' />
                    <Field name='CURRENCY_LIST'>USD</Field>
                    <Value name='AMOUNT'>
                        <Shadow type='math_number'>
                            <Field name='NUM'>1</Field>
                        </Shadow>
                    </Value>
                    <Field name='AMOUNT_LIMITS' />
                </Block>
                <Block type='multiplier_take_profit'>
                    <Value name='AMOUNT'>
                        <Shadow type='math_number'>
                            <Field name='NUM'>0</Field>
                        </Shadow>
                    </Value>
                </Block>
                <Block type='multiplier_stop_loss'>
                    <Value name='AMOUNT'>
                        <Shadow type='math_number'>
                            <Field name='NUM'>0</Field>
                        </Shadow>
                    </Value>
                </Block>
                <Block type='trade_definition_accumulator'>
                    <Field name='GROWTHRATE_LIST' />
                    <Field name='CURRENCY_LIST'>USD</Field>
                    <Value name='AMOUNT'>
                        <Shadow type='math_number'>
                            <Field name='NUM'>1</Field>
                        </Shadow>
                    </Value>
                </Block>
                <Block type='accumulator_take_profit'>
                    <Value name='AMOUNT'>
                        <Shadow type='math_number'>
                            <Field name='NUM'>0</Field>
                        </Shadow>
                    </Value>
                </Block>
            </Category>
            <Category id='purchase_conditions' name={localize('Purchase conditions')}>
                <Block type='before_purchase' />
                <Block type='purchase' />
            </Category>
            <Category id='sell_conditions' name={localize('Sell conditions (optional)')}>
                <Block type='during_purchase' />
                <Block type='sell_at_market' />
            </Category>
            <Category id='trade_results' name={localize('Restart trading conditions')}>
                <Block type='after_purchase' />
                <Block type='trade_again' />
            </Category>

            <Category id='templates' name={localize('Templates')}>
                <Category id='beginner_templates' name={localize('Beginner Templates')}>
                    {/* Simple Even/Odd Strategy */}
                    <Block type='before_purchase' name='📚 Simple Even/Odd Strategy'>
                        <Statement name='BEFOREPURCHASE_STACK'>
                            <Block type='controls_if'>
                                <Value name='IF0'>
                                    <Block type='logic_compare'>
                                        <Field name='OP'>GT</Field>
                                        <Value name='A'>
                                            <Block type='even_odd_percentage'>
                                                <Field name='PATTERN'>even</Field>
                                                <Value name='COUNT'>
                                                    <Shadow type='math_number'>
                                                        <Field name='NUM'>5</Field>
                                                    </Shadow>
                                                </Value>
                                            </Block>
                                        </Value>
                                        <Value name='B'>
                                            <Shadow type='math_number'>
                                                <Field name='NUM'>70</Field>
                                            </Shadow>
                                        </Value>
                                    </Block>
                                </Value>
                                <Statement name='DO0'>
                                    <Block type='purchase'>
                                        <Field name='PURCHASE_LIST'>CALL</Field>
                                    </Block>
                                </Statement>
                                <Statement name='ELSE'>
                                    <Block type='purchase'>
                                        <Field name='PURCHASE_LIST'>PUT</Field>
                                    </Block>
                                </Statement>
                            </Block>
                        </Statement>
                    </Block>
                    
                    {/* Basic Trend Following */}
                    <Block type='before_purchase' name='📈 Basic Trend Following'>
                        <Statement name='BEFOREPURCHASE_STACK'>
                            <Block type='controls_if'>
                                <Value name='IF0'>
                                    <Block type='last_ticks_direction'>
                                        <Value name='COUNT'>
                                            <Shadow type='math_number'>
                                                <Field name='NUM'>3</Field>
                                            </Shadow>
                                        </Value>
                                        <Field name='DIRECTION'>rise</Field>
                                    </Block>
                                </Value>
                                <Statement name='DO0'>
                                    <Block type='purchase'>
                                        <Field name='PURCHASE_LIST'>CALL</Field>
                                    </Block>
                                </Statement>
                                <Next>
                                    <Block type='controls_if'>
                                        <Value name='IF0'>
                                            <Block type='last_ticks_direction'>
                                                <Value name='COUNT'>
                                                    <Shadow type='math_number'>
                                                        <Field name='NUM'>3</Field>
                                                    </Shadow>
                                                </Value>
                                                <Field name='DIRECTION'>fall</Field>
                                            </Block>
                                        </Value>
                                        <Statement name='DO0'>
                                            <Block type='purchase'>
                                                <Field name='PURCHASE_LIST'>PUT</Field>
                                            </Block>
                                        </Statement>
                                    </Block>
                                </Next>
                            </Block>
                        </Statement>
                    </Block>
                </Category>
                
                <Category id='advanced_templates' name={localize('Advanced Templates')}>
                    {/* Multi-Condition Analysis */}
                    <Block type='logic_operation' name='🔬 Multi-Condition Analyzer'>
                        <Field name='OP'>AND</Field>
                        <Value name='A'>
                            <Block type='logic_compare'>
                                <Field name='OP'>GT</Field>
                                <Value name='A'>
                                    <Block type='digit_comparison'>
                                        <Field name='DIGIT_TYPE'>last</Field>
                                        <Field name='COMPARISON_TYPE'>matches</Field>
                                        <Field name='DIGIT_VALUE'>8</Field>
                                        <Value name='COUNT'>
                                            <Shadow type='math_number'>
                                                <Field name='NUM'>10</Field>
                                            </Shadow>
                                        </Value>
                                    </Block>
                                </Value>
                                <Value name='B'>
                                    <Shadow type='math_number'>
                                        <Field name='NUM'>3</Field>
                                    </Shadow>
                                </Value>
                            </Block>
                        </Value>
                        <Value name='B'>
                            <Block type='logic_compare'>
                                <Field name='OP'>LT</Field>
                                <Value name='A'>
                                    <Block type='digit_frequency_rank'>
                                        <Field name='DIGIT_TYPE'>last</Field>
                                        <Field name='DIGIT_VALUE'>8</Field>
                                        <Value name='COUNT'>
                                            <Shadow type='math_number'>
                                                <Field name='NUM'>20</Field>
                                            </Shadow>
                                        </Value>
                                    </Block>
                                </Value>
                                <Value name='B'>
                                    <Shadow type='math_number'>
                                        <Field name='NUM'>5</Field>
                                    </Shadow>
                                </Value>
                            </Block>
                        </Value>
                    </Block>
                    
                    {/* Pattern Breakout Detection */}
                    <Block type='logic_operation' name='⚡ Pattern Breakout Detector'>
                        <Field name='OP'>OR</Field>
                        <Value name='A'>
                            <Block type='logic_operation'>
                                <Field name='OP'>AND</Field>
                                <Value name='A'>
                                    <Block type='logic_compare'>
                                        <Field name='OP'>GT</Field>
                                        <Value name='A'>
                                            <Block type='even_odd_percentage'>
                                                <Field name='PATTERN'>odd</Field>
                                                <Value name='COUNT'>
                                                    <Shadow type='math_number'>
                                                        <Field name='NUM'>15</Field>
                                                    </Shadow>
                                                </Value>
                                            </Block>
                                        </Value>
                                        <Value name='B'>
                                            <Shadow type='math_number'>
                                                <Field name='NUM'>75</Field>
                                            </Shadow>
                                        </Value>
                                    </Block>
                                </Value>
                                <Value name='B'>
                                    <Block type='last_ticks_direction'>
                                        <Value name='COUNT'>
                                            <Shadow type='math_number'>
                                                <Field name='NUM'>2</Field>
                                            </Shadow>
                                        </Value>
                                        <Field name='DIRECTION'>fall</Field>
                                    </Block>
                                </Value>
                            </Block>
                        </Value>
                        <Value name='B'>
                            <Block type='logic_operation'>
                                <Field name='OP'>AND</Field>
                                <Value name='A'>
                                    <Block type='logic_compare'>
                                        <Field name='OP'>GT</Field>
                                        <Value name='A'>
                                            <Block type='even_odd_percentage'>
                                                <Field name='PATTERN'>even</Field>
                                                <Value name='COUNT'>
                                                    <Shadow type='math_number'>
                                                        <Field name='NUM'>15</Field>
                                                    </Shadow>
                                                </Value>
                                            </Block>
                                        </Value>
                                        <Value name='B'>
                                            <Shadow type='math_number'>
                                                <Field name='NUM'>75</Field>
                                            </Shadow>
                                        </Value>
                                    </Block>
                                </Value>
                                <Value name='B'>
                                    <Block type='last_ticks_direction'>
                                        <Value name='COUNT'>
                                            <Shadow type='math_number'>
                                                <Field name='NUM'>2</Field>
                                            </Shadow>
                                        </Value>
                                        <Field name='DIRECTION'>rise</Field>
                                    </Block>
                                </Value>
                            </Block>
                        </Value>
                    </Block>
                </Category>
                
                <Category id='professional_templates' name={localize('Professional Strategies')}>
                    {/* Complete Trading Strategy */}
                    <Block type='before_purchase' name='💼 Professional Trading System'>
                        <Statement name='BEFOREPURCHASE_STACK'>
                            <Block type='variables_set'>
                                <Field name='VAR' variabletype='Number'>confidence_score</Field>
                                <Value name='VALUE'>
                                    <Shadow type='math_number'>
                                        <Field name='NUM'>0</Field>
                                    </Shadow>
                                </Value>
                                <Next>
                                    <Block type='controls_if'>
                                        <Value name='IF0'>
                                            <Block type='logic_compare'>
                                                <Field name='OP'>GT</Field>
                                                <Value name='A'>
                                                    <Block type='even_odd_percentage'>
                                                        <Field name='PATTERN'>odd</Field>
                                                        <Value name='COUNT'>
                                                            <Shadow type='math_number'>
                                                                <Field name='NUM'>10</Field>
                                                            </Shadow>
                                                        </Value>
                                                    </Block>
                                                </Value>
                                                <Value name='B'>
                                                    <Shadow type='math_number'>
                                                        <Field name='NUM'>65</Field>
                                                    </Shadow>
                                                </Value>
                                            </Block>
                                        </Value>
                                        <Statement name='DO0'>
                                            <Block type='variables_set'>
                                                <Field name='VAR' variabletype='Number'>confidence_score</Field>
                                                <Value name='VALUE'>
                                                    <Block type='math_arithmetic'>
                                                        <Field name='OP'>ADD</Field>
                                                        <Value name='A'>
                                                            <Block type='variables_get'>
                                                                <Field name='VAR' variabletype='Number'>confidence_score</Field>
                                                            </Block>
                                                        </Value>
                                                        <Value name='B'>
                                                            <Shadow type='math_number'>
                                                                <Field name='NUM'>1</Field>
                                                            </Shadow>
                                                        </Value>
                                                    </Block>
                                                </Value>
                                            </Block>
                                        </Statement>
                                        <Next>
                                            <Block type='controls_if'>
                                                <Value name='IF0'>
                                                    <Block type='last_ticks_direction'>
                                                        <Value name='COUNT'>
                                                            <Shadow type='math_number'>
                                                                <Field name='NUM'>3</Field>
                                                            </Shadow>
                                                        </Value>
                                                        <Field name='DIRECTION'>fall</Field>
                                                    </Block>
                                                </Value>
                                                <Statement name='DO0'>
                                                    <Block type='variables_set'>
                                                        <Field name='VAR' variabletype='Number'>confidence_score</Field>
                                                        <Value name='VALUE'>
                                                            <Block type='math_arithmetic'>
                                                                <Field name='OP'>ADD</Field>
                                                                <Value name='A'>
                                                                    <Block type='variables_get'>
                                                                        <Field name='VAR' variabletype='Number'>confidence_score</Field>
                                                                    </Block>
                                                                </Value>
                                                                <Value name='B'>
                                                                    <Shadow type='math_number'>
                                                                        <Field name='NUM'>1</Field>
                                                                    </Shadow>
                                                                </Value>
                                                            </Block>
                                                        </Value>
                                                    </Block>
                                                </Statement>
                                                <Next>
                                                    <Block type='controls_if'>
                                                        <Value name='IF0'>
                                                            <Block type='logic_compare'>
                                                                <Field name='OP'>GTE</Field>
                                                                <Value name='A'>
                                                                    <Block type='variables_get'>
                                                                        <Field name='VAR' variabletype='Number'>confidence_score</Field>
                                                                    </Block>
                                                                </Value>
                                                                <Value name='B'>
                                                                    <Shadow type='math_number'>
                                                                        <Field name='NUM'>2</Field>
                                                                    </Shadow>
                                                                </Value>
                                                            </Block>
                                                        </Value>
                                                        <Statement name='DO0'>
                                                            <Block type='purchase'>
                                                                <Field name='PURCHASE_LIST'>PUT</Field>
                                                            </Block>
                                                        </Statement>
                                                    </Block>
                                                </Next>
                                            </Block>
                                        </Next>
                                    </Block>
                                </Next>
                            </Block>
                        </Statement>
                    </Block>
                    
                    {/* Advanced Risk Management */}
                    <Block type='after_purchase' name='🛡️ Advanced Risk Controller'>
                        <Statement name='AFTERPURCHASE_STACK'>
                            <Block type='controls_if'>
                                <Value name='IF0'>
                                    <Block type='contract_check_result'>
                                        <Field name='CHECK_RESULT'>win</Field>
                                    </Block>
                                </Value>
                                <Statement name='DO0'>
                                    <Block type='notify'>
                                        <Field name='NOTIFICATION_TYPE'>success</Field>
                                        <Field name='NOTIFICATION_SOUND'>earned-money</Field>
                                        <Value name='MESSAGE'>
                                            <Shadow type='text'>
                                                <Field name='TEXT'>Trade successful! Continuing with base stake.</Field>
                                            </Shadow>
                                        </Value>
                                        <Next>
                                            <Block type='trade_again' />
                                        </Next>
                                    </Block>
                                </Statement>
                                <Statement name='ELSE'>
                                    <Block type='controls_if'>
                                        <Value name='IF0'>
                                            <Block type='logic_compare'>
                                                <Field name='OP'>LTE</Field>
                                                <Value name='A'>
                                                    <Block type='total_profit' />
                                                </Value>
                                                <Value name='B'>
                                                    <Shadow type='math_number'>
                                                        <Field name='NUM'>-20</Field>
                                                    </Shadow>
                                                </Value>
                                            </Block>
                                        </Value>
                                        <Statement name='DO0'>
                                            <Block type='notify'>
                                                <Field name='NOTIFICATION_TYPE'>warn</Field>
                                                <Field name='NOTIFICATION_SOUND'>job-done</Field>
                                                <Value name='MESSAGE'>
                                                    <Shadow type='text'>
                                                        <Field name='TEXT'>Daily loss limit reached. Stopping trades.</Field>
                                                    </Shadow>
                                                </Value>
                                            </Block>
                                        </Statement>
                                        <Statement name='ELSE'>
                                            <Block type='trade_again' />
                                        </Statement>
                                    </Block>
                                </Statement>
                            </Block>
                        </Statement>
                    </Block>
                </Category>
                
                <Category id='quick_setup_templates' name={localize('Quick Setup Templates')}>
                    {/* 5-Minute Scalping Setup */}
                    <Block type='before_purchase' name='⏰ 5-Minute Scalping Setup'>
                        <Statement name='BEFOREPURCHASE_STACK'>
                            <Block type='controls_if'>
                                <Value name='IF0'>
                                    <Block type='logic_operation'>
                                        <Field name='OP'>AND</Field>
                                        <Value name='A'>
                                            <Block type='logic_compare'>
                                                <Field name='OP'>GT</Field>
                                                <Value name='A'>
                                                    <Block type='digit_comparison'>
                                                        <Field name='DIGIT_TYPE'>last</Field>
                                                        <Field name='COMPARISON_TYPE'>matches</Field>
                                                        <Field name='DIGIT_VALUE'>3</Field>
                                                        <Value name='COUNT'>
                                                            <Shadow type='math_number'>
                                                                <Field name='NUM'>5</Field>
                                                            </Shadow>
                                                        </Value>
                                                    </Block>
                                                </Value>
                                                <Value name='B'>
                                                    <Shadow type='math_number'>
                                                        <Field name='NUM'>1</Field>
                                                    </Shadow>
                                                </Value>
                                            </Block>
                                        </Value>
                                        <Value name='B'>
                                            <Block type='logic_compare'>
                                                <Field name='OP'>GT</Field>
                                                <Value name='A'>
                                                    <Block type='even_odd_percentage'>
                                                        <Field name='PATTERN'>odd</Field>
                                                        <Value name='COUNT'>
                                                            <Shadow type='math_number'>
                                                                <Field name='NUM'>5</Field>
                                                            </Shadow>
                                                        </Value>
                                                    </Block>
                                                </Value>
                                                <Value name='B'>
                                                    <Shadow type='math_number'>
                                                        <Field name='NUM'>60</Field>
                                                    </Shadow>
                                                </Value>
                                            </Block>
                                        </Value>
                                    </Block>
                                </Value>
                                <Statement name='DO0'>
                                    <Block type='purchase'>
                                        <Field name='PURCHASE_LIST'>PUT</Field>
                                    </Block>
                                </Statement>
                                <Statement name='ELSE'>
                                    <Block type='purchase'>
                                        <Field name='PURCHASE_LIST'>CALL</Field>
                                    </Block>
                                </Statement>
                            </Block>
                        </Statement>
                    </Block>
                    
                    {/* Conservative Profit Target */}
                    <Block type='after_purchase' name='💰 Conservative Profit Target'>
                        <Statement name='AFTERPURCHASE_STACK'>
                            <Block type='controls_if'>
                                <Value name='IF0'>
                                    <Block type='logic_compare'>
                                        <Field name='OP'>GTE</Field>
                                        <Value name='A'>
                                            <Block type='total_profit' />
                                        </Value>
                                        <Value name='B'>
                                            <Shadow type='math_number'>
                                                <Field name='NUM'>10</Field>
                                            </Shadow>
                                        </Value>
                                    </Block>
                                </Value>
                                <Statement name='DO0'>
                                    <Block type='notify'>
                                        <Field name='NOTIFICATION_TYPE'>success</Field>
                                        <Field name='NOTIFICATION_SOUND'>earned-money</Field>
                                        <Value name='MESSAGE'>
                                            <Shadow type='text'>
                                                <Field name='TEXT'>Profit target reached! Well done.</Field>
                                            </Shadow>
                                        </Value>
                                    </Block>
                                </Statement>
                                <Statement name='ELSE'>
                                    <Block type='trade_again' />
                                </Statement>
                            </Block>
                        </Statement>
                    </Block>
                </Category>
            </Category>

            <Category id='analysis' name={localize('Analysis')}>
                <Category id='indicators' name={localize('Indicators')}>
                    <Block type='sma_statement'>
                        <Statement name='STATEMENT'>
                            <Block type='input_list' deletable='false' movable='false'>
                                <Value name='INPUT_LIST' />
                                <Next>
                                    <Block type='period' deletable='false' movable='false'>
                                        <Value name='PERIOD'>
                                            <Shadow type='math_number'>
                                                <Field name='NUM'>10</Field>
                                            </Shadow>
                                        </Value>
                                    </Block>
                                </Next>
                            </Block>
                        </Statement>
                    </Block>
                    <Block type='smaa_statement'>
                        <Statement name='STATEMENT'>
                            <Block type='input_list' deletable='false' movable='false'>
                                <Value name='INPUT_LIST' />
                                <Next>
                                    <Block type='period' deletable='false' movable='false'>
                                        <Value name='PERIOD'>
                                            <Shadow type='math_number'>
                                                <Field name='NUM'>10</Field>
                                            </Shadow>
                                        </Value>
                                    </Block>
                                </Next>
                            </Block>
                        </Statement>
                    </Block>
                    <Block type='bb_statement'>
                        <Field name='BBRESULT_LIST'>0</Field>
                        <Statement name='STATEMENT'>
                            <Block type='input_list' deletable='false' movable='false'>
                                <Value name='INPUT_LIST' />
                                <Next>
                                    <Block type='period' deletable='false' movable='false'>
                                        <Value name='PERIOD'>
                                            <Shadow type='math_number'>
                                                <Field name='NUM'>10</Field>
                                            </Shadow>
                                        </Value>
                                        <Next>
                                            <Block type='std_dev_multiplier_up' deletable='false' movable='false'>
                                                <Value name='UPMULTIPLIER'>
                                                    <Shadow type='math_number'>
                                                        <Field name='NUM'>5</Field>
                                                    </Shadow>
                                                </Value>
                                                <Next>
                                                    <Block type='std_dev_multiplier_down'>
                                                        <Value name='DOWNMULTIPLIER'>
                                                            <Shadow type='math_number'>
                                                                <Field name='NUM'>5</Field>
                                                            </Shadow>
                                                        </Value>
                                                    </Block>
                                                </Next>
                                            </Block>
                                        </Next>
                                    </Block>
                                </Next>
                            </Block>
                        </Statement>
                    </Block>
                    <Block type='bba_statement'>
                        <Field name='BBRESULT_LIST'>0</Field>
                        <Statement name='STATEMENT'>
                            <Block type='input_list' deletable='false' movable='false'>
                                <Value name='INPUT_LIST' />
                                <Next>
                                    <Block type='period' deletable='false' movable='false'>
                                        <Value name='PERIOD'>
                                            <Shadow type='math_number'>
                                                <Field name='NUM'>10</Field>
                                            </Shadow>
                                        </Value>
                                        <Next>
                                            <Block type='std_dev_multiplier_up' deletable='false' movable='false'>
                                                <Value name='UPMULTIPLIER'>
                                                    <Shadow type='math_number'>
                                                        <Field name='NUM'>5</Field>
                                                    </Shadow>
                                                </Value>
                                                <Next>
                                                    <Block type='std_dev_multiplier_down'>
                                                        <Value name='DOWNMULTIPLIER'>
                                                            <Shadow type='math_number'>
                                                                <Field name='NUM'>5</Field>
                                                            </Shadow>
                                                        </Value>
                                                    </Block>
                                                </Next>
                                            </Block>
                                        </Next>
                                    </Block>
                                </Next>
                            </Block>
                        </Statement>
                    </Block>
                    <Block type='ema_statement'>
                        <Statement name='STATEMENT'>
                            <Block type='input_list' deletable='false' movable='false'>
                                <Value name='INPUT_LIST' />
                                <Next>
                                    <Block type='period' deletable='false' movable='false'>
                                        <Value name='PERIOD'>
                                            <Shadow type='math_number'>
                                                <Field name='NUM'>10</Field>
                                            </Shadow>
                                        </Value>
                                    </Block>
                                </Next>
                            </Block>
                        </Statement>
                    </Block>
                    <Block type='emaa_statement'>
                        <Statement name='STATEMENT'>
                            <Block type='input_list' deletable='false' movable='false'>
                                <Value name='INPUT_LIST' />
                                <Next>
                                    <Block type='period' deletable='false' movable='false'>
                                        <Value name='PERIOD'>
                                            <Shadow type='math_number'>
                                                <Field name='NUM'>10</Field>
                                            </Shadow>
                                        </Value>
                                    </Block>
                                </Next>
                            </Block>
                        </Statement>
                    </Block>
                    <Block type='rsi_statement'>
                        <Statement name='STATEMENT'>
                            <Block type='input_list' deletable='false' movable='false'>
                                <Next>
                                    <Block type='period' deletable='false' movable='false'>
                                        <Value name='PERIOD'>
                                            <Shadow type='math_number'>
                                                <Field name='NUM'>10</Field>
                                            </Shadow>
                                        </Value>
                                    </Block>
                                </Next>
                            </Block>
                        </Statement>
                    </Block>
                    <Block type='rsia_statement'>
                        <Statement name='STATEMENT'>
                            <Block type='input_list' deletable='false' movable='false'>
                                <Value name='INPUT_LIST' />
                                <Next>
                                    <Block type='period' deletable='false' movable='false'>
                                        <Value name='PERIOD'>
                                            <Shadow type='math_number'>
                                                <Field name='NUM'>10</Field>
                                            </Shadow>
                                        </Value>
                                    </Block>
                                </Next>
                            </Block>
                        </Statement>
                    </Block>
                    <Block type='macda_statement'>
                        <Field name='MACDFIELDS_LIST'>1</Field>
                        <Statement name='STATEMENT'>
                            <Block type='input_list' deletable='false' movable='false'>
                                <Value name='INPUT_LIST' />
                                <Next>
                                    <Block type='fast_ema_period' deletable='false' movable='false'>
                                        <Value name='FAST_EMA_PERIOD'>
                                            <Shadow type='math_number'>
                                                <Field name='NUM'>12</Field>
                                            </Shadow>
                                        </Value>
                                        <Next>
                                            <Block type='slow_ema_period' deletable='false' movable='false'>
                                                <Value name='SLOW_EMA_PERIOD'>
                                                    <Shadow type='math_number'>
                                                        <Field name='NUM'>26</Field>
                                                    </Shadow>
                                                </Value>
                                                <Next>
                                                    <Block type='signal_ema_period' deletable='false' movable='false'>
                                                        <Value name='SIGNAL_EMA_PERIOD'>
                                                            <Shadow type='math_number'>
                                                                <Field name='NUM'>9</Field>
                                                            </Shadow>
                                                        </Value>
                                                    </Block>
                                                </Next>
                                            </Block>
                                        </Next>
                                    </Block>
                                </Next>
                            </Block>
                        </Statement>
                    </Block>
                </Category>

                <Category name={localize('Tick and candle analysis')} id='tick_analysis'>
                    <Block type='tick_analysis' />
                    <Block type='tick' />
                    <Block type='last_digit' />
                    <Block type='stat' />
                    <Block type='stat_list' />
                    <Block type='ticks' />
                    <Block type='lastDigitList' />
                    <Block type='check_direction' />
                    <Block type='even_odd_percentage'>
                        <Field name='PATTERN'>even</Field>
                        <Value name='COUNT'>
                            <Shadow type='math_number'>
                                <Field name='NUM'>10</Field>
                            </Shadow>
                        </Value>
                    </Block>
                    <Block type='over_under_percentage'>
                        <Field name='CONDITION'>over</Field>
                        <Value name='DIGIT'>
                            <Shadow type='math_number'>
                                <Field name='NUM'>5</Field>
                            </Shadow>
                        </Value>
                        <Value name='COUNT'>
                            <Shadow type='math_number'>
                                <Field name='NUM'>10</Field>
                            </Shadow>
                        </Value>
                    </Block>
                    <Block type='digit_frequency_rank'>
                        <Field name='DIGIT_TYPE'>last</Field>
                        <Field name='DIGIT_VALUE'>7</Field>
                        <Value name='COUNT'>
                            <Shadow type='math_number'>
                                <Field name='NUM'>15</Field>
                            </Shadow>
                        </Value>
                    </Block>
                    <Block type='all_same_pattern'>
                        <Value name='COUNT'>
                            <Shadow type='math_number'>
                                <Field name='NUM'>5</Field>
                            </Shadow>
                        </Value>
                        <Field name='PATTERN'>all_even</Field>
                    </Block>
                    <Block type='digit_comparison'>
                        <Field name='DIGIT_TYPE'>last</Field>
                        <Field name='COMPARISON_TYPE'>matches</Field>
                        <Field name='DIGIT_VALUE'>7</Field>
                        <Value name='COUNT'>
                            <Shadow type='math_number'>
                                <Field name='NUM'>5</Field>
                            </Shadow>
                        </Value>
                    </Block>
                    <Block type='rise_fall_percentage'>
                        <Field name='PATTERN'>rise</Field>
                        <Value name='COUNT'>
                            <Shadow type='math_number'>
                                <Field name='NUM'>10</Field>
                            </Shadow>
                        </Value>
                    </Block>
                    <Block type='last_ticks_direction'>
                        <Value name='COUNT'>
                            <Shadow type='math_number'>
                                <Field name='NUM'>3</Field>
                            </Shadow>
                        </Value>
                        <Field name='DIRECTION'>rise</Field>
                    </Block>
                    <Block type='is_candle_black' />
                    <Block type='read_ohlc'>
                        <Field name='OHLCFIELD_LIST'>open</Field>
                        <Field name='CANDLEINTERVAL_LIST'>default</Field>
                        <Value name='CANDLEINDEX'>
                            <Shadow type='math_number'>
                                <Field name='NUM'>1</Field>
                            </Shadow>
                        </Value>
                    </Block>
                    <Block type='read_ohlc_obj' />
                    <Block type='ohlc_values' />
                    <Block type='ohlc_values_in_list' />
                    <Block type='get_ohlc'>
                        <Field name='CANDLEINTERVAL_LIST'>default</Field>
                        <Value name='CANDLEINDEX'>
                            <Shadow type='math_number'>
                                <Field name='NUM'>1</Field>
                            </Shadow>
                        </Value>
                    </Block>
                    <Block type='ohlc' />
                </Category>

                <Category name={localize('Contract')} id='contract_details'>
                    <Block type='contract_check_result' />
                    <Block type='read_details' />
                    <Block type='sell_price' />
                    <Block type='check_sell' />
                    <Block type='payout' />
                    <Block type='ask_price' />
                </Category>

                <Category name={localize('Stats')} id='stats'>
                    <Block type='balance' />
                    <Block type='total_profit' />
                    <Block type='total_runs' />
                </Category>
            </Category>

            <Category id='utility' name={localize('Utility')}>
                <Category name={localize('Custom functions')} id='custom_functions' dynamic='PROCEDURE' />

                <Category name={localize('Variables')} id='variables' dynamic='VARIABLE' />

                <Category name={localize('Notifications')} id='notifications'>
                    <Block type='text_print'>
                        <Value name='TEXT'>
                            <Shadow type='text'>
                                <Field name='TEXT'>abc</Field>
                            </Shadow>
                        </Value>
                    </Block>
                    <Block type='text_prompt_ext'>
                        <Field name='TYPE'>TEXT</Field>
                        <Value name='TEXT'>
                            <Shadow type='text'>
                                <Field name='TEXT'>abc</Field>
                            </Shadow>
                        </Value>
                    </Block>
                    <Block type='notify'>
                        <Field name='NOTIFICATION_TYPE'>success</Field>
                        <Field name='NOTIFICATION_SOUND'>announcement</Field>
                        <Value name='MESSAGE'>
                            <Shadow type='text'>
                                <Field name='TEXT'>Notification message</Field>
                            </Shadow>
                        </Value>
                    </Block>
                    <Block type='notify_telegram'>
                        <Value name='TELEGRAM_ACCESS_TOKEN'>
                            <Shadow type='text'>
                                <Field name='TEXT' />
                            </Shadow>
                        </Value>
                        <Value name='TELEGRAM_CHAT_ID'>
                            <Shadow type='text'>
                                <Field name='TEXT' />
                            </Shadow>
                        </Value>
                        <Value name='TELEGRAM_MESSAGE'>
                            <Shadow type='text'>
                                <Field name='TEXT'>abc</Field>
                            </Shadow>
                        </Value>
                    </Block>
                </Category>

                <Category name={localize('Time')} id='time'>
                    <Block type='epoch' />
                    <Block type='timeout' />
                    <Block type='tick_delay' />
                    <Block type='totimestamp'>
                        <Value name='DATETIME'>
                            <Shadow type='text'>
                                <Field name='TEXT'>yyyy-mm-dd hh:mm:ss</Field>
                            </Shadow>
                        </Value>
                    </Block>
                    <Block type='todatetime'>
                        <Value name='TIMESTAMP'>
                            <Shadow type='math_number'>
                                <Field name='NUM'>0</Field>
                            </Shadow>
                        </Value>
                    </Block>
                </Category>

                <Category name={localize('Math')} id='math'>
                    <Block type='math_number' />
                    <Block type='math_arithmetic'>
                        <Field name='OP'>ADD</Field>
                        <Value name='A'>
                            <Shadow type='math_number'>
                                <Field name='NUM'>1</Field>
                            </Shadow>
                        </Value>
                        <Value name='B'>
                            <Shadow type='math_number'>
                                <Field name='NUM'>1</Field>
                            </Shadow>
                        </Value>
                    </Block>
                    <Block type='math_single'>
                        <Field name='OP'>ROOT</Field>
                        <Value name='NUM'>
                            <Shadow type='math_number'>
                                <Field name='NUM'>9</Field>
                            </Shadow>
                        </Value>
                    </Block>
                    <Block type='math_trig'>
                        <Field name='OP'>SIN</Field>
                        <Value name='NUM'>
                            <Shadow type='math_number'>
                                <Field name='NUM'>45</Field>
                            </Shadow>
                        </Value>
                    </Block>
                    <Block type='math_constant' />
                    <Block type='math_number_property'>
                        <Mutation divisor_input='false' />
                        <Field name='PROPERTY'>EVEN</Field>
                        <Value name='NUMBER_TO_CHECK'>
                            <Shadow type='math_number'>
                                <Field name='NUM'>0</Field>
                            </Shadow>
                        </Value>
                    </Block>
                    <Block type='math_change'>
                        <Field name='VAR' variabletype=''>
                            item
                        </Field>
                        <Value name='DELTA'>
                            <Shadow type='math_number'>
                                <Field name='NUM'>1</Field>
                            </Shadow>
                        </Value>
                    </Block>
                    <Block type='math_on_list' />
                    <Block type='math_round'>
                        <Field name='OP'>ROUND</Field>
                        <Value name='NUM'>
                            <Shadow type='math_number'>
                                <Field name='NUM'>3.1</Field>
                            </Shadow>
                        </Value>
                    </Block>
                    <Block type='math_modulo'>
                        <Value name='DIVIDEND'>
                            <Shadow type='math_number'>
                                <Field name='NUM'>64</Field>
                            </Shadow>
                        </Value>
                        <Value name='DIVISOR'>
                            <Shadow type='math_number'>
                                <Field name='NUM'>10</Field>
                            </Shadow>
                        </Value>
                    </Block>
                    <Block type='math_constrain'>
                        <Value name='Value'>
                            <Shadow type='math_number'>
                                <Field name='NUM'>50</Field>
                            </Shadow>
                        </Value>
                        <Value name='LOW'>
                            <Shadow type='math_number'>
                                <Field name='NUM'>1</Field>
                            </Shadow>
                        </Value>
                        <Value name='HIGH'>
                            <Shadow type='math_number'>
                                <Field name='NUM'>100</Field>
                            </Shadow>
                        </Value>
                    </Block>
                    <Block type='math_random_int'>
                        <Value name='FROM'>
                            <Shadow type='math_number'>
                                <Field name='NUM'>1</Field>
                            </Shadow>
                        </Value>
                        <Value name='TO'>
                            <Shadow type='math_number'>
                                <Field name='NUM'>100</Field>
                            </Shadow>
                        </Value>
                    </Block>
                    <Block type='math_random_float' />
                </Category>

                <Category name={localize('Text')} id='text'>
                    <Block type='text'>
                        <Field name='TEXT'>abc</Field>
                    </Block>
                    <Block type='text_join'>
                        <Field name='VARIABLE' variabletype=''>
                            text
                        </Field>
                        <Statement name='STACK'>
                            <Block type='text_statement' movable='false'>
                                <Value name='TEXT'>
                                    <Shadow type='text'>
                                        <Field name='TEXT'>abc</Field>
                                    </Shadow>
                                </Value>
                            </Block>
                        </Statement>
                    </Block>
                    <Block type='text_append'>
                        <Field name='VAR' variabletype=''>
                            text
                        </Field>
                        <Value name='TEXT'>
                            <Shadow type='text'>
                                <Field name='TEXT'>abc</Field>
                            </Shadow>
                        </Value>
                    </Block>
                    <Block type='text_length'>
                        <Value name='Value'>
                            <Shadow type='text'>
                                <Field name='TEXT'>abc</Field>
                            </Shadow>
                        </Value>
                    </Block>
                    <Block type='text_isEmpty'>
                        <Value name='Value'>
                            <Shadow type='text'>
                                <Field name='TEXT' />
                            </Shadow>
                        </Value>
                    </Block>
                    <Block type='text_indexOf'>
                        <Field name='END'>FIRST</Field>
                        <Value name='Value'>
                            <Block type='variables_get'>
                                <Field name='VAR' variabletype=''>
                                    text
                                </Field>
                            </Block>
                        </Value>
                        <Value name='FIND'>
                            <Shadow type='text'>
                                <Field name='TEXT'>abc</Field>
                            </Shadow>
                        </Value>
                    </Block>
                    <Block type='text_charAt'>
                        <Mutation at='true' />
                        <Field name='WHERE'>FROM_START</Field>
                        <Value name='Value'>
                            <Block type='variables_get'>
                                <Field name='VAR' variabletype=''>
                                    item
                                </Field>
                            </Block>
                        </Value>
                        <Value name='AT'>
                            <Shadow type='math_number_positive'>
                                <Field name='NUM'>1</Field>
                            </Shadow>
                        </Value>
                    </Block>
                    <Block type='text_getSubstring'>
                        <Mutation at1='true' at2='true' />
                        <Field name='WHERE1'>FROM_START</Field>
                        <Field name='WHERE2'>FROM_START</Field>
                        <Value name='STRING'>
                            <Block type='variables_get'>
                                <Field name='VAR' variabletype=''>
                                    text
                                </Field>
                            </Block>
                        </Value>
                        <Value name='AT1'>
                            <Shadow type='math_number_positive'>
                                <Field name='NUM'>0</Field>
                            </Shadow>
                        </Value>
                        <Value name='AT2'>
                            <Shadow type='math_number_positive'>
                                <Field name='NUM'>2</Field>
                            </Shadow>
                        </Value>
                    </Block>
                    <Block type='text_changeCase'>
                        <Field name='CASE'>UPPERCASE</Field>
                        <Value name='TEXT'>
                            <Shadow type='text'>
                                <Field name='TEXT'>abc</Field>
                            </Shadow>
                        </Value>
                    </Block>
                    <Block type='text_trim'>
                        <Field name='MODE'>BOTH</Field>
                        <Value name='TEXT'>
                            <Shadow type='text'>
                                <Field name='TEXT'>abc</Field>
                            </Shadow>
                        </Value>
                    </Block>
                </Category>

                <Category name={localize('Logic')} id='logic'>
                    <Block type='controls_if' />
                    <Block type='logic_compare' />
                    <Block type='logic_operation' />
                    <Block type='logic_negate' />
                    <Block type='logic_boolean' />
                    <Block type='logic_null' />
                    <Block type='logic_ternary' />
                </Category>

                <Category name={localize('Lists')} id='lists'>
                    <Block type='lists_create_with'>
                        <Field name='VARIABLE' variabletype=''>
                            list
                        </Field>
                        <Statement name='STACK'>
                            <Block type='lists_statement' movable='false'>
                                <Next>
                                    <Block type='lists_statement' movable='false' />
                                </Next>
                            </Block>
                        </Statement>
                    </Block>
                    <Block type='lists_repeat'>
                        <Value name='NUM'>
                            <Shadow type='math_number'>
                                <Field name='NUM'>5</Field>
                            </Shadow>
                        </Value>
                    </Block>
                    <Block type='lists_length' />
                    <Block type='lists_isEmpty' />
                    <Block type='lists_indexOf' />
                    <Block type='lists_getIndex' />
                    <Block type='lists_setIndex' />
                    <Block type='lists_getSublist' />
                    <Block type='lists_split'>
                        <Mutation mode='SPLIT' />
                        <Field name='MODE'>SPLIT</Field>
                        <Value name='DELIM'>
                            <Shadow type='text'>
                                <Field name='TEXT'>,</Field>
                            </Shadow>
                        </Value>
                    </Block>
                    <Block type='lists_sort' />
                </Category>

                <Category name={localize('Loops')} id='loops'>
                    <Block type='controls_repeat' />
                    <Block type='controls_repeat_ext' />
                    <Block type='controls_whileUntil' />
                    <Block type='controls_for' />
                    <Block type='controls_forEach' />
                    <Block type='controls_flow_statements' />
                </Category>

                <Category name={localize('Miscellaneous')} id='misc'>
                    <Block type='loader' />
                    <Block type='block_holder' />
                    <Block type='console'>
                        <Value name='MESSAGE'>
                            <Shadow type='text'>
                                <Field name='TEXT'>abc</Field>
                            </Shadow>
                        </Value>
                    </Block>
                </Category>
            </Category>
            <Category id='fxpro' name={localize('fxpro')}>
                <Block type='stat_comparison'>
                    <Field name='OPERATOR'>greater</Field>
                    <Value name='VALUE'>
                        <Shadow type='math_number'>
                            <Field name='NUM'>10</Field>
                        </Shadow>
                    </Value>
                </Block>
                <Block type='even_odd_percentage'>
                    <Field name='PATTERN'>even</Field>
                    <Value name='COUNT'>
                        <Shadow type='math_number'>
                            <Field name='NUM'>10</Field>
                        </Shadow>
                    </Value>
                </Block>
                <Block type='over_under_percentage'>
                    <Field name='CONDITION'>over</Field>
                    <Value name='DIGIT'>
                        <Shadow type='math_number'>
                            <Field name='NUM'>5</Field>
                        </Shadow>
                    </Value>
                    <Value name='COUNT'>
                        <Shadow type='math_number'>
                            <Field name='NUM'>10</Field>
                        </Shadow>
                    </Value>
                </Block>
                <Block type='digit_frequency_rank'>
                    <Field name='DIGIT_TYPE'>last</Field>
                    <Field name='DIGIT_VALUE'>7</Field>
                    <Value name='COUNT'>
                        <Shadow type='math_number'>
                            <Field name='NUM'>15</Field>
                        </Shadow>
                    </Value>
                </Block>
                <Block type='all_same_pattern'>
                    <Value name='COUNT'>
                        <Shadow type='math_number'>
                            <Field name='NUM'>5</Field>
                        </Shadow>
                    </Value>
                    <Field name='PATTERN'>all_even</Field>
                </Block>
                <Block type='digit_comparison'>
                    <Field name='DIGIT_TYPE'>last</Field>
                    <Field name='COMPARISON_TYPE'>matches</Field>
                    <Field name='DIGIT_VALUE'>7</Field>
                    <Value name='COUNT'>
                        <Shadow type='math_number'>
                            <Field name='NUM'>5</Field>
                        </Shadow>
                    </Value>
                </Block>
                <Block type='rise_fall_percentage'>
                    <Field name='PATTERN'>rise</Field>
                    <Value name='COUNT'>
                        <Shadow type='math_number'>
                            <Field name='NUM'>10</Field>
                        </Shadow>
                    </Value>
                </Block>
                <Block type='last_ticks_direction'>
                    <Value name='COUNT'>
                        <Shadow type='math_number'>
                            <Field name='NUM'>3</Field>
                        </Shadow>
                    </Value>
                    <Field name='DIRECTION'>rise</Field>
                </Block>
                <Block type='digit_percentage'>
                    <Value name='DIGIT'>
                        <Shadow type='math_number'>
                            <Field name='NUM'>7</Field>
                        </Shadow>
                    </Value>
                    <Value name='COUNT'>
                        <Shadow type='math_number'>
                            <Field name='NUM'>20</Field>
                        </Shadow>
                    </Value>
                </Block>
                <Block type='digit_highest_lowest_frequency'>
                    <Field name='FREQUENCY_TYPE'>highest</Field>
                    <Value name='COUNT'>
                        <Shadow type='math_number'>
                            <Field name='NUM'>50</Field>
                        </Shadow>
                    </Value>
                </Block>
                <Block type='notify'>
                    <Field name='NOTIFICATION_TYPE'>success</Field>
                    <Field name='NOTIFICATION_SOUND'>announcement</Field>
                    <Value name='MESSAGE'>
                        <Shadow type='text'>
                            <Field name='TEXT'>Notification message</Field>
                        </Shadow>
                    </Value>
                </Block>
            </Category>

            <Category id='tools' name={localize('Tools🔥')}>
                <Block type='ichimoku_statement'>
                    <Field name='ICHIMOKU_LINE_TYPE'>0</Field>
                    <Statement name='STATEMENT'>
                        <Block type='input_list' deletable='false' movable='false'>
                            <Value name='INPUT_LIST' />
                            <Next>
                                <Block type='tenkan_period' deletable='false' movable='false'>
                                    <Value name='TENKAN_PERIOD'>
                                        <Shadow type='math_number'>
                                            <Field name='NUM'>9</Field>
                                        </Shadow>
                                    </Value>
                                    <Next>
                                        <Block type='kijun_period' deletable='false' movable='false'>
                                            <Value name='KIJUN_PERIOD'>
                                                <Shadow type='math_number'>
                                                    <Field name='NUM'>26</Field>
                                                </Shadow>
                                            </Value>
                                            <Next>
                                                <Block type='senkou_span_b_period'>
                                                    <Value name='SENKOU_SPAN_B_PERIOD'>
                                                        <Shadow type='math_number'>
                                                            <Field name='NUM'>52</Field>
                                                        </Shadow>
                                                    </Value>
                                                </Block>
                                            </Next>
                                        </Block>
                                    </Next>
                                </Block>
                            </Next>
                        </Block>
                    </Statement>
                </Block>
                <Block type='donchian_channels_statement'>
                    <Field name='DONCHIAN_CHANNEL_LINE'>0</Field>
                    <Statement name='STATEMENT'>
                        <Block type='input_list' deletable='false' movable='false'>
                            <Value name='INPUT_LIST' />
                            <Next>
                                <Block type='donchian_period' deletable='false' movable='false'>
                                    <Value name='DONCHIAN_PERIOD'>
                                        <Shadow type='math_number'>
                                            <Field name='NUM'>20</Field>
                                        </Shadow>
                                    </Value>
                                </Block>
                            </Next>
                        </Block>
                    </Statement>
                </Block>
                <Block type='williams_r_statement'>
                    <Statement name='STATEMENT'>
                        <Block type='input_list' deletable='false' movable='false'>
                            <Value name='INPUT_LIST' />
                            <Next>
                                <Block type='williams_r_period' deletable='false' movable='false'>
                                    <Value name='WILLIAMS_R_PERIOD'>
                                        <Shadow type='math_number'>
                                            <Field name='NUM'>14</Field>
                                        </Shadow>
                                    </Value>
                                </Block>
                            </Next>
                        </Block>
                    </Statement>
                </Block>
                <Block type='symbol_switcher'>
                    <Field name='SYMBOL_LIST'>R_100</Field>
                </Block>
            </Category>

            <Examples id='examples'>
                <Example id='sell_available'>
                    <Block type='during_purchase'>
                        <Statement name='DURING_PURCHASE_STACK'>
                            <Block type='controls_if'>
                                <Value name='IF0'>
                                    <Block type='check_sell' />
                                </Value>
                                <Statement name='DO0'>
                                    <Block type='sell_at_market' />
                                </Statement>
                            </Block>
                        </Statement>
                    </Block>
                </Example>
                <Example id='trade_again'>
                    <Block type='after_purchase'>
                        <Statement name='AFTERPURCHASE_STACK'>
                            <Block type='controls_if'>
                                <Value name='IF0'>
                                    <Block type='logic_compare'>
                                        <Field name='OP'>EQ</Field>
                                        <Value name='A'>
                                            <Block type='total_profit' />
                                        </Value>
                                        <Value name='B'>
                                            <Block type='variables_get'>
                                                <Field name='VAR' variabletype=''>
                                                    target_profit
                                                </Field>
                                            </Block>
                                        </Value>
                                    </Block>
                                </Value>
                            </Block>
                        </Statement>
                    </Block>
                </Example>
                <Example id='sma_block_example'>
                    <Block type='sma_statement'>
                        <Field name='VARIABLE' variabletype=''>
                            sma
                        </Field>
                        <Statement name='STATEMENT'>
                            <Block type='input_list' deletable='false' movable='false'>
                                <Value name='INPUT_LIST'>
                                    <Block type='ohlc_values'>
                                        <Field name='OHLCFIELD_LIST'>open</Field>
                                        <Field name='CANDLEINTERVAL_LIST'>default</Field>
                                    </Block>
                                </Value>
                                <Next>
                                    <Block type='period' deletable='false' movable='false'>
                                        <Value name='PERIOD'>
                                            <Shadow type='math_number'>
                                                <Field name='NUM'>10</Field>
                                            </Shadow>
                                        </Value>
                                    </Block>
                                </Next>
                            </Block>
                        </Statement>
                    </Block>
                </Example>
                <Example id='sma_array'>
                    <Block type='smaa_statement'>
                        <Field name='VARIABLE' variabletype=''>
                            smaa
                        </Field>
                        <Statement name='STATEMENT'>
                            <Block type='input_list' deletable='false' movable='false'>
                                <Next>
                                    <Block type='period' deletable='false' movable='false'>
                                        <Value name='PERIOD'>
                                            <Shadow type='math_number'>
                                                <Field name='NUM'>10</Field>
                                            </Shadow>
                                        </Value>
                                    </Block>
                                </Next>
                            </Block>
                        </Statement>
                    </Block>
                </Example>
                <Example id='sma_block_example_1'>
                    <Block type='sma_statement'>
                        <Field name='VARIABLE' variabletype=''>
                            sma
                        </Field>
                        <Statement name='STATEMENT'>
                            <Block type='input_list' deletable='false' movable='false'>
                                <Value name='INPUT_LIST'>
                                    <Block type='ticks' />
                                </Value>
                                <Next>
                                    <Block type='period' deletable='false' movable='false'>
                                        <Value name='PERIOD'>
                                            <Shadow type='math_number'>
                                                <Field name='NUM'>10</Field>
                                            </Shadow>
                                        </Value>
                                    </Block>
                                </Next>
                            </Block>
                        </Statement>
                    </Block>
                </Example>
                <Example id='in_candle_list_read'>
                    <Block type='variables_set'>
                        <Field name='VAR' variabletype=''>
                            op
                        </Field>
                        <Value name='VALUE'>
                            <Block type='read_ohlc'>
                                <Field name='OHLCFIELD_LIST'>open</Field>
                                <Field name='CANDLEINTERVAL_LIST'>default</Field>
                                <Value name='CANDLEINDEX'>
                                    <Shadow type='math_number'>
                                        <Field name='NUM'>1</Field>
                                    </Shadow>
                                </Value>
                            </Block>
                        </Value>
                    </Block>
                </Example>
                <Example id='read_candle_value'>
                    <Block type='variables_set'>
                        <Field name='VAR' variabletype=''>
                            op
                        </Field>
                        <Value name='VALUE'>
                            <Block type='read_ohlc_obj'>
                                <Field name='OHLCFIELD_LIST'>open</Field>
                                <Value name='OHLCOBJ'>
                                    <Block type='read_ohlc'>
                                        <Field name='OHLCFIELD_LIST'>open</Field>
                                        <Field name='CANDLEINTERVAL_LIST'>default</Field>
                                        <Value name='CANDLEINDEX'>
                                            <Shadow type='math_number'>
                                                <Field name='NUM'>1</Field>
                                            </Shadow>
                                        </Value>
                                    </Block>
                                </Value>
                            </Block>
                        </Value>
                    </Block>
                </Example>
                <Example id='candle_list'>
                    <Block type='variables_set'>
                        <Field name='VAR' variabletype=''>
                            candle_list
                        </Field>
                        <Value name='VALUE'>
                            <Block type='ohlc_values'>
                                <Field name='OHLCFIELD_LIST'>open</Field>
                                <Field name='CANDLEINTERVAL_LIST'>default</Field>
                            </Block>
                        </Value>
                    </Block>
                </Example>
                <Example id='candle_list_1'>
                    <Block type='variables_set'>
                        <Field name='VAR' variabletype=''>
                            cl
                        </Field>
                        <Value name='VALUE'>
                            <Block type='ohlc_values_in_list'>
                                <Field name='OHLCFIELD_LIST'>open</Field>
                                <Value name='OHLCLIST'>
                                    <Block type='ohlc'>
                                        <Field name='CANDLEINTERVAL_LIST'>default</Field>
                                    </Block>
                                </Value>
                            </Block>
                        </Value>
                    </Block>
                </Example>
                <Example id='get_candle'>
                    <Block type='variables_set'>
                        <Field name='VAR' variabletype=''>
                            candle_open_price
                        </Field>
                        <Value name='VALUE'>
                            <Block type='read_ohlc_obj'>
                                <Field name='OHLCFIELD_LIST'>epoch</Field>
                                <Value name='OHLCOBJ'>
                                    <Block type='get_ohlc'>
                                        <Field name='CANDLEINTERVAL_LIST'>default</Field>
                                        <Value name='CANDLEINDEX'>
                                            <Shadow type='math_number'>
                                                <Field name='NUM'>2</Field>
                                            </Shadow>
                                        </Value>
                                    </Block>
                                </Value>
                            </Block>
                        </Value>
                    </Block>
                </Example>
                <Example id='check_result'>
                    <Block type='after_purchase'>
                        <Statement name='AFTERPURCHASE_STACK'>
                            <Block type='controls_if'>
                                <Value name='IF0'>
                                    <Block type='contract_check_result'>
                                        <Field name='CHECK_RESULT'>win</Field>
                                    </Block>
                                </Value>
                                <Statement name='DO0'>
                                    <Block type='trade_again' />
                                </Statement>
                            </Block>
                        </Statement>
                    </Block>
                </Example>
                <Example id='sell_pl'>
                    <Block type='during_purchase'>
                        <Statement name='DURING_PURCHASE_STACK'>
                            <Block type='controls_if'>
                                <Value name='IF0'>
                                    <Block type='check_sell' />
                                </Value>
                                <Statement name='DO0'>
                                    <Block type='controls_if'>
                                        <Value name='IF0'>
                                            <Block type='logic_compare'>
                                                <Field name='OP'>EQ</Field>
                                                <Value name='A'>
                                                    <Block type='sell_price' />
                                                </Value>
                                                <Value name='B'>
                                                    <Block type='variables_get'>
                                                        <Field name='VAR' variabletype=''>
                                                            stake
                                                        </Field>
                                                    </Block>
                                                </Value>
                                            </Block>
                                        </Value>
                                        <Statement name='DO0'>
                                            <Block type='sell_at_market' />
                                        </Statement>
                                    </Block>
                                </Statement>
                            </Block>
                        </Statement>
                    </Block>
                </Example>
                <Example id='if-return'>
                    <Block type='procedures_defreturn'>
                        <Mutation>
                            <Arg name='x' />
                        </Mutation>
                        <Field name='NAME'>do something</Field>
                        <Statement name='STACK'>
                            <Block type='procedures_ifreturn'>
                                <Mutation value='1' />
                                <Value name='CONDITION'>
                                    <Block type='logic_compare'>
                                        <Field name='OP'>EQ</Field>
                                        <Value name='A'>
                                            <Block type='variables_get'>
                                                <Field name='VAR' variabletype=''>
                                                    x
                                                </Field>
                                            </Block>
                                        </Value>
                                        <Value name='B'>
                                            <Block type='variables_get'>
                                                <Field name='VAR' variabletype=''>
                                                    x
                                                </Field>
                                            </Block>
                                        </Value>
                                    </Block>
                                </Value>
                                <Value name='VALUE'>
                                    <Block type='text'>
                                        <Field name='TEXT'>x must be positive or zero</Field>
                                    </Block>
                                </Value>
                            </Block>
                        </Statement>
                        <Value name='RETURN'>
                            <Block type='math_single'>
                                <Field name='OP'>ROOT</Field>
                                <Value name='NUM'>
                                    <Shadow type='math_number'>
                                        <Field name='NUM'>9</Field>
                                    </Shadow>
                                    <Block type='variables_get'>
                                        <Field name='VAR' variabletype=''>
                                            x
                                        </Field>
                                    </Block>
                                </Value>
                            </Block>
                        </Value>
                    </Block>
                </Example>
                <Example id='notify_telegram'>
                    <Block type='notify_telegram'>
                        <Value name='TELEGRAM_ACCESS_TOKEN'>
                            <Shadow type='text'>
                                <Field name='TEXT' />
                            </Shadow>
                            <Block type='variables_get'>
                                <Field name='VAR' variabletype=''>
                                    access_token
                                </Field>
                            </Block>
                        </Value>
                        <Value name='TELEGRAM_CHAT_ID'>
                            <Shadow type='text'>
                                <Field name='TEXT' />
                            </Shadow>
                            <Block type='variables_get'>
                                <Field name='VAR' variabletype=''>
                                    chat_id
                                </Field>
                            </Block>
                        </Value>
                        <Value name='TELEGRAM_MESSAGE'>
                            <Shadow type='text'>
                                <Field name='TEXT'>Enjoy!</Field>
                            </Shadow>
                        </Value>
                    </Block>
                </Example>
                <Example id='epoch'>
                    <Block type='variables_set'>
                        <Field name='VAR' variabletype=''>
                            candle
                        </Field>
                        <Value name='VALUE'>
                            <Block type='read_ohlc'>
                                <Field name='OHLCFIELD_LIST'>open</Field>
                                <Field name='CANDLEINTERVAL_LIST'>default</Field>
                                <Value name='CANDLEINDEX'>
                                    <Shadow type='math_number'>
                                        <Field name='NUM'>1</Field>
                                    </Shadow>
                                </Value>
                            </Block>
                        </Value>
                        <Next>
                            <Block type='variables_set'>
                                <Field name='VAR' variabletype=''>
                                    Open Time
                                </Field>
                                <Value name='VALUE'>
                                    <Block type='read_ohlc_obj'>
                                        <Field name='OHLCFIELD_LIST'>epoch</Field>
                                        <Value name='OHLCOBJ'>
                                            <Block type='variables_get'>
                                                <Field name='VAR' variabletype=''>
                                                    candle
                                                </Field>
                                            </Block>
                                        </Value>
                                    </Block>
                                </Value>
                                <Next>
                                    <Block type='variables_set'>
                                        <Field name='VAR' variabletype=''>
                                            Open Time
                                        </Field>
                                        <Value name='VALUE'>
                                            <Block type='math_arithmetic'>
                                                <Field name='OP'>MINUS</Field>
                                                <Value name='A'>
                                                    <Shadow type='math_number'>
                                                        <Field name='NUM'>1</Field>
                                                    </Shadow>
                                                    <Block type='epoch' />
                                                </Value>
                                                <Value name='B'>
                                                    <Shadow type='math_number'>
                                                        <Field name='NUM'>1</Field>
                                                    </Shadow>
                                                    <Block type='variables_get'>
                                                        <Field name='VAR' variabletype=''>
                                                            Open Time
                                                        </Field>
                                                    </Block>
                                                </Value>
                                            </Block>
                                        </Value>
                                        <Next>
                                            <Block type='controls_if'>
                                                <Value name='IF0'>
                                                    <Block type='logic_compare'>
                                                        <Field name='OP'>GTE</Field>
                                                        <Value name='A'>
                                                            <Block type='variables_get'>
                                                                <Field name='VAR' variabletype=''>
                                                                    Time Since Candle Opened
                                                                </Field>
                                                            </Block>
                                                        </Value>
                                                        <Value name='B'>
                                                            <Block type='math_number'>
                                                                <Field name='NUM'>30</Field>
                                                            </Block>
                                                        </Value>
                                                    </Block>
                                                </Value>
                                            </Block>
                                        </Next>
                                    </Block>
                                </Next>
                            </Block>
                        </Next>
                    </Block>
                </Example>
                <Example id='totimestamp'>
                    <Block type='before_purchase'>
                        <Statement name='BEFOREPURCHASE_STACK'>
                            <Block type='controls_if'>
                                <Value name='IF0'>
                                    <Block type='logic_compare'>
                                        <Field name='OP'>EQ</Field>
                                        <Value name='A'>
                                            <Block type='epoch' />
                                        </Value>
                                        <Value name='B'>
                                            <Block type='totimestamp'>
                                                <Value name='DATETIME'>
                                                    <Shadow type='text'>
                                                        <Field name='TEXT'>1957-08-31 00:00:00</Field>
                                                    </Shadow>
                                                </Value>
                                            </Block>
                                        </Value>
                                    </Block>
                                </Value>
                                <Statement name='DO0'>
                                    <Block type='purchase'>
                                        <Field name='PURCHASE_LIST'>CALL</Field>
                                    </Block>
                                </Statement>
                            </Block>
                        </Statement>
                    </Block>
                </Example>
                <Example id='todatetime'>
                    <Block type='notify'>
                        <Field name='NOTIFICATION_TYPE'>success</Field>
                        <Field name='NOTIFICATION_SOUND'>silent</Field>
                        <Value name='MESSAGE'>
                            <Shadow type='text'>
                                <Field name='TEXT'>abc</Field>
                            </Shadow>
                            <Block type='todatetime'>
                                <Value name='TIMESTAMP'>
                                    <Shadow type='math_number'>
                                        <Field name='NUM'>0</Field>
                                    </Shadow>
                                    <Block type='epoch' />
                                </Value>
                            </Block>
                        </Value>
                    </Block>
                </Example>
                <Example id='constrain'>
                    <Block type='math_constrain'>
                        <Value name='VALUE'>
                            <Block type='math_number'>
                                <Field name='NUM'>5</Field>
                            </Block>
                        </Value>
                        <Value name='LOW'>
                            <Shadow type='math_number'>
                                <Field name='NUM'>10</Field>
                            </Shadow>
                        </Value>
                        <Value name='HIGH'>
                            <Shadow type='math_number'>
                                <Field name='NUM'>20</Field>
                            </Shadow>
                        </Value>
                    </Block>
                </Example>
                <Example id='controls_if'>
                    <Block type='controls_if'>
                        <Mutation elseif='1' else='1' />
                        <Value name='IF0'>
                            <Block type='logic_compare'>
                                <Field name='OP'>EQ</Field>
                                <Value name='A'>
                                    <Block type='variables_get'>
                                        <Field name='VAR' variabletype=''>
                                            var1
                                        </Field>
                                    </Block>
                                </Value>
                                <Value name='B'>
                                    <Block type='variables_get'>
                                        <Field name='VAR' variabletype=''>
                                            var2
                                        </Field>
                                    </Block>
                                </Value>
                            </Block>
                        </Value>
                        <Value name='IF1'>
                            <Block type='logic_compare'>
                                <Field name='OP'>EQ</Field>
                                <Value name='A'>
                                    <Block type='variables_get'>
                                        <Field name='VAR' variabletype=''>
                                            var3
                                        </Field>
                                    </Block>
                                </Value>
                                <Value name='B'>
                                    <Block type='variables_get'>
                                        <Field name='VAR' variabletype=''>
                                            var4
                                        </Field>
                                    </Block>
                                </Value>
                            </Block>
                        </Value>
                    </Block>
                </Example>
                <Example id='compare_logic'>
                    <Block type='logic_compare'>
                        <Field name='OP'>EQ</Field>
                    </Block>
                </Example>
                <Example id='compare_logic_1'>
                    <Block type='logic_operation'>
                        <Field name='OP'>AND</Field>
                    </Block>
                </Example>
                <Example id='repeat_while'>
                    <Block type='variables_set'>
                        <Field name='VAR' variabletype=''>
                            x
                        </Field>
                        <Value name='VALUE'>
                            <Block type='math_number'>
                                <Field name='NUM'>0</Field>
                            </Block>
                        </Value>
                        <Next>
                            <Block type='controls_whileUntil'>
                                <Field name='MODE'>WHILE</Field>
                                <Value name='BOOL'>
                                    <Block type='logic_compare'>
                                        <Field name='OP'>LTE</Field>
                                        <Value name='A'>
                                            <Block type='variables_get'>
                                                <Field name='VAR' variabletype=''>
                                                    x
                                                </Field>
                                            </Block>
                                        </Value>
                                        <Value name='B'>
                                            <Block type='math_number'>
                                                <Field name='NUM'>10</Field>
                                            </Block>
                                        </Value>
                                    </Block>
                                </Value>
                                <Statement name='DO'>
                                    <Block type='math_change'>
                                        <Field name='VAR' variabletype=''>
                                            x
                                        </Field>
                                        <Value name='DELTA'>
                                            <Shadow type='math_number'>
                                                <Field name='NUM'>1</Field>
                                            </Shadow>
                                        </Value>
                                        <Next>
                                            <Block type='notify'>
                                                <Field name='NOTIFICATION_TYPE'>success</Field>
                                                <Field name='NOTIFICATION_SOUND'>silent</Field>
                                                <Value name='MESSAGE'>
                                                    <Shadow type='text'>
                                                        <Field name='TEXT'>abc</Field>
                                                    </Shadow>
                                                    <Block type='variables_get'>
                                                        <Field name='VAR' variabletype=''>
                                                            x
                                                        </Field>
                                                    </Block>
                                                </Value>
                                            </Block>
                                        </Next>
                                    </Block>
                                </Statement>
                            </Block>
                        </Next>
                    </Block>
                </Example>
                <Example id='repeat_until'>
                    <Block type='variables_set'>
                        <Field name='VAR' variabletype=''>
                            x
                        </Field>
                        <Value name='VALUE'>
                            <Block type='math_number'>
                                <Field name='NUM'>20</Field>
                            </Block>
                        </Value>
                        <Next>
                            <Block type='controls_whileUntil'>
                                <Field name='MODE'>UNTIL</Field>
                                <Value name='BOOL'>
                                    <Block type='logic_compare'>
                                        <Field name='OP'>EQ</Field>
                                        <Value name='A'>
                                            <Block type='variables_get'>
                                                <Field name='VAR' variabletype=''>
                                                    x
                                                </Field>
                                            </Block>
                                        </Value>
                                        <Value name='B'>
                                            <Block type='math_number'>
                                                <Field name='NUM'>10</Field>
                                            </Block>
                                        </Value>
                                    </Block>
                                </Value>
                                <Statement name='DO'>
                                    <Block type='math_change'>
                                        <Field name='VAR' variabletype=''>
                                            x
                                        </Field>
                                        <Value name='DELTA'>
                                            <Shadow type='math_number'>
                                                <Field name='NUM'>-1</Field>
                                            </Shadow>
                                        </Value>
                                        <Next>
                                            <Block type='notify'>
                                                <Field name='NOTIFICATION_TYPE'>success</Field>
                                                <Field name='NOTIFICATION_SOUND'>silent</Field>
                                                <Value name='MESSAGE'>
                                                    <Shadow type='text'>
                                                        <Field name='TEXT'>abc</Field>
                                                    </Shadow>
                                                    <Block type='variables_get'>
                                                        <Field name='VAR' variabletype=''>
                                                            x
                                                        </Field>
                                                    </Block>
                                                </Value>
                                            </Block>
                                        </Next>
                                    </Block>
                                </Statement>
                            </Block>
                        </Next>
                    </Block>
                </Example>
                <Example id='controls_for'>
                    <Block type='controls_for'>
                        <Field name='VAR' variabletype=''>
                            i
                        </Field>
                        <Value name='FROM'>
                            <Block type='math_number'>
                                <Field name='NUM'>0</Field>
                            </Block>
                        </Value>
                        <Value name='TO'>
                            <Block type='math_number'>
                                <Field name='NUM'>10</Field>
                            </Block>
                        </Value>
                        <Value name='BY'>
                            <Block type='math_number'>
                                <Field name='NUM'>2</Field>
                            </Block>
                        </Value>
                        <Statement name='DO'>
                            <Block type='notify'>
                                <Field name='NOTIFICATION_TYPE'>success</Field>
                                <Field name='NOTIFICATION_SOUND'>silent</Field>
                                <Value name='MESSAGE'>
                                    <Shadow type='text'>
                                        <Field name='TEXT'>abc</Field>
                                    </Shadow>
                                    <Block type='variables_get'>
                                        <Field name='VAR' variabletype=''>
                                            i
                                        </Field>
                                    </Block>
                                </Value>
                            </Block>
                        </Statement>
                    </Block>
                </Example>
                <Example id='controls_forEach'>
                    <Block type='lists_create_with'>
                        <Field name='VARIABLE'>list</Field>
                        <Statement name='STACK'>
                            <Block type='lists_statement'>
                                <Value name='VALUE'>
                                    <Block type='variables_get'>
                                        <Field name='VAR' variabletype=''>
                                            item1
                                        </Field>
                                    </Block>
                                </Value>
                                <Next>
                                    <Block type='lists_statement'>
                                        <Value name='VALUE'>
                                            <Block type='variables_get'>
                                                <Field name='VAR' variabletype=''>
                                                    item2
                                                </Field>
                                            </Block>
                                        </Value>
                                        <Next>
                                            <Block type='lists_statement'>
                                                <Value name='VALUE'>
                                                    <Block type='variables_get'>
                                                        <Field name='VAR' variabletype=''>
                                                            item3
                                                        </Field>
                                                    </Block>
                                                </Value>
                                            </Block>
                                        </Next>
                                    </Block>
                                </Next>
                            </Block>
                        </Statement>
                        <Next>
                            <Block type='controls_forEach'>
                                <Field name='VAR' variabletype=''>
                                    i
                                </Field>
                                <Value name='LIST'>
                                    <Block type='variables_get'>
                                        <Field name='VAR' variabletype=''>
                                            list
                                        </Field>
                                    </Block>
                                </Value>
                                <Statement name='DO'>
                                    <Block type='notify'>
                                        <Field name='NOTIFICATION_TYPE'>success</Field>
                                        <Field name='NOTIFICATION_SOUND'>silent</Field>
                                        <Value name='MESSAGE'>
                                            <Shadow type='text'>
                                                <Field name='TEXT'>abc</Field>
                                            </Shadow>
                                            <Block type='variables_get'>
                                                <Field name='VAR' variabletype=''>
                                                    i
                                                </Field>
                                            </Block>
                                        </Value>
                                    </Block>
                                </Statement>
                            </Block>
                        </Next>
                    </Block>
                </Example>
                <Example id='break_out'>
                    <Block type='variables_set'>
                        <Field name='VAR' variabletype=''>
                            x
                        </Field>
                        <Value name='VALUE'>
                            <Block type='logic_boolean'>
                                <Field name='BOOL'>TRUE</Field>
                            </Block>
                        </Value>
                        <Next>
                            <Block type='controls_repeat'>
                                <Field name='TIMES'>10</Field>
                                <Statement name='DO'>
                                    <Block type='controls_if'>
                                        <Value name='IF0'>
                                            <Block type='logic_negate'>
                                                <Value name='BOOL'>
                                                    <Block type='variables_get'>
                                                        <Field name='VAR' variabletype=''>
                                                            x
                                                        </Field>
                                                    </Block>
                                                </Value>
                                            </Block>
                                        </Value>
                                        <Statement name='DO0'>
                                            <Block type='controls_flow_statements'>
                                                <Field name='FLOW'>BREAK</Field>
                                            </Block>
                                        </Statement>
                                        <Next>
                                            <Block type='notify'>
                                                <Field name='NOTIFICATION_TYPE'>success</Field>
                                                <Field name='NOTIFICATION_SOUND'>silent</Field>
                                                <Value name='MESSAGE'>
                                                    <Shadow type='text'>
                                                        <Field name='TEXT'>abc</Field>
                                                    </Shadow>
                                                </Value>
                                            </Block>
                                        </Next>
                                    </Block>
                                </Statement>
                            </Block>
                        </Next>
                    </Block>
                </Example>
                <Example id='continue'>
                    <Block type='variables_set'>
                        <Field name='VAR' variabletype=''>
                            x
                        </Field>
                        <Value name='VALUE'>
                            <Block type='logic_boolean'>
                                <Field name='BOOL'>FALSE</Field>
                            </Block>
                        </Value>
                        <Next>
                            <Block type='controls_repeat'>
                                <Field name='TIMES'>10</Field>
                                <Statement name='DO'>
                                    <Block type='controls_if'>
                                        <Value name='IF0'>
                                            <Block type='logic_negate'>
                                                <Value name='BOOL'>
                                                    <Block type='variables_get'>
                                                        <Field name='VAR' variabletype=''>
                                                            x
                                                        </Field>
                                                    </Block>
                                                </Value>
                                            </Block>
                                        </Value>
                                        <Statement name='DO0'>
                                            <Block type='variables_set'>
                                                <Field name='VAR' variabletype=''>
                                                    x
                                                </Field>
                                                <Value name='VALUE'>
                                                    <Block type='logic_boolean'>
                                                        <Field name='BOOL'>TRUE</Field>
                                                    </Block>
                                                </Value>
                                                <Next>
                                                    <Block type='controls_flow_statements'>
                                                        <Field name='FLOW'>CONTINUE</Field>
                                                    </Block>
                                                </Next>
                                            </Block>
                                        </Statement>
                                        <Next>
                                            <Block type='notify'>
                                                <Field name='NOTIFICATION_TYPE'>success</Field>
                                                <Field name='NOTIFICATION_SOUND'>silent</Field>
                                                <Value name='MESSAGE'>
                                                    <Shadow type='text'>
                                                        <Field name='TEXT'>abc</Field>
                                                    </Shadow>
                                                </Value>
                                            </Block>
                                        </Next>
                                    </Block>
                                </Statement>
                            </Block>
                        </Next>
                    </Block>
                </Example>
            </Examples>
        </Xml>
    );
