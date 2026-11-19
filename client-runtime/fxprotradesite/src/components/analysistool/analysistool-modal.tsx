import React from 'react';
import { observer } from 'mobx-react-lite';
import DraggableResizeWrapper from '@/components/draggable/draggable-resize-wrapper';
import AnalysistoolComponent from '@/components/analysistool/analysis';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';

const AnalysistoolModal = observer(() => {
    const { dashboard } = useStore();
    const { is_analysis_modal_visible, setAnalysisModalVisibility } = dashboard;

    return (
        <React.Fragment>
            {is_analysis_modal_visible && (
                <DraggableResizeWrapper
                    boundary='.main'
                    header={localize('Analysis Tool')}
                    onClose={setAnalysisModalVisibility}
                    modalWidth={526}
                    modalHeight={595}
                    minWidth={526}
                    minHeight={524}
                    enableResizing
                >
                    <div style={{ height: 'calc(100% - 6rem)', padding: '0.5rem' }}>
                        <AnalysistoolComponent />
                    </div>
                </DraggableResizeWrapper>
            )}
        </React.Fragment>
    );
});

export default AnalysistoolModal;
