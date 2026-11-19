import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import DraggableResizeWrapper from '@/components/draggable/draggable-resize-wrapper';
import AdvancedDisplay from '@/components/trading-hub/advanced-display';

const AdvancedDisplayModal = observer(() => {
    const { dashboard } = useStore();
    const { is_advanced_display_modal_visible, setAdvancedDisplayModalVisibility } = dashboard;

    if (!is_advanced_display_modal_visible) return null;

    return (
        <DraggableResizeWrapper
            boundary="#root"
            header="Advanced Display"
            modalHeight={700}
            modalWidth={900}
            minWidth={600}
            minHeight={500}
            enableResizing
            onClose={setAdvancedDisplayModalVisibility}
        >
            <div className="advanced-display-modal">
                <AdvancedDisplay />
            </div>
        </DraggableResizeWrapper>
    );
});

export default AdvancedDisplayModal;
