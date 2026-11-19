import React from 'react';
import { observer } from 'mobx-react-lite';
import DraggableResizeWrapper from '@/components/draggable/draggable-resize-wrapper';
import { useStore } from '@/hooks/useStore';
import { localize } from '@deriv-com/translations';
import StandaloneChart from './standalone-chart';
import './standalone-chart-modal.scss';

const StandaloneChartModal = observer(() => {
    const { dashboard } = useStore();
    const { is_standalone_chart_modal_visible, setStandaloneChartModalVisibility } = dashboard;

    return (
        <React.Fragment>
            {is_standalone_chart_modal_visible && (
                <DraggableResizeWrapper
                    boundary='.main'
                    header={localize('Chart')}
                    onClose={() => setStandaloneChartModalVisibility(false)}
                    modalWidth={1000}
                    modalHeight={700}
                    minWidth={800}
                    minHeight={500}
                    enableResizing
                >
                    <div className='standalone-chart-modal-dialog' data-testid='standalone-chart-modal-dialog'>
                        <StandaloneChart />
                    </div>
                </DraggableResizeWrapper>
            )}
        </React.Fragment>
    );
});

export default StandaloneChartModal;
