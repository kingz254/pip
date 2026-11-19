import React from 'react';
import { observer } from 'mobx-react-lite';
import DraggableResizeWrapper from '@/components/draggable/draggable-resize-wrapper';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';

const SignalsModal = observer(() => {
    const { dashboard } = useStore();
    const { is_signals_modal_visible, setSignalsModalVisibility } = dashboard;

    return (
        <React.Fragment>
            {is_signals_modal_visible && (
                <DraggableResizeWrapper
                    boundary='.main'
                    header={localize('Trading Signals')}
                    onClose={setSignalsModalVisibility}
                    modalWidth={800}
                    modalHeight={600}
                    minWidth={600}
                    minHeight={500}
                    enableResizing
                >
                    <div style={{ height: 'calc(100% - 6rem)', padding: '1rem' }}>
                        <iframe
                            src="/signals"
                            style={{
                                width: '100%',
                                height: '100%',
                                border: 'none',
                                borderRadius: '8px'
                            }}
                            title="Trading Signals"
                        />
                    </div>
                </DraggableResizeWrapper>
            )}
        </React.Fragment>
    );
});

export default SignalsModal;
