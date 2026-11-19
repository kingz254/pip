import React, { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { Button } from '@deriv-com/quill-ui';
import { LabelPairedCircleExclamationLgFillIcon } from '@deriv/quill-icons/LabelPaired';
import { useDevice } from '@deriv-com/ui';
import Draggable from '../draggable';
import './disclaimer.scss';

interface DisclaimerPopupProps {
    onClose: () => void;
    onDontShowAgain: () => void;
}

const DisclaimerPopup: React.FC<DisclaimerPopupProps> = observer(({ onClose, onDontShowAgain }) => {
    const { isMobile, isTablet } = useDevice();
    const [windowSize, setWindowSize] = useState({
        width: window.innerWidth,
        height: window.innerHeight
    });

    // Handle window resize
    useEffect(() => {
        const handleResize = () => {
            setWindowSize({
                width: window.innerWidth,
                height: window.innerHeight
            });
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Calculate dimensions based on device type
    const getPopupDimensions = () => {
        // Safety margin to ensure popup is within visible area
        const safetyMargin = 30; // Increased safety margin
        
        // Calculate max dimensions based on window size
        const maxWidth = windowSize.width - (isMobile ? 40 : isTablet ? 80 : 100);
        const maxHeight = windowSize.height - (isMobile ? 80 : 100);
        
        if (isMobile) {
            const width = Math.min(320, maxWidth);
            const height = Math.min(420, maxHeight);
            return {
                width: width,
                height: height,
                xAxis: Math.max(safetyMargin, (windowSize.width - width) / 2),
                yAxis: Math.max(safetyMargin, (windowSize.height - height) / 2)
            };
        } else if (isTablet) {
            const width = Math.min(450, maxWidth);
            const height = Math.min(420, maxHeight);
            return {
                width: width,
                height: height,
                xAxis: Math.max(safetyMargin, (windowSize.width - width) / 2),
                yAxis: Math.max(safetyMargin, (windowSize.height - height) / 2)
            };
        } else {
            const width = Math.min(520, maxWidth);
            const height = Math.min(440, maxHeight);
            return {
                width: width,
                height: height,
                xAxis: Math.max(safetyMargin, (windowSize.width - width) / 2),
                yAxis: Math.max(safetyMargin, (windowSize.height - height) / 2)
            };
        }
    };

    const dimensions = getPopupDimensions();

    return (
        <Draggable
            initialValues={dimensions}
            minWidth={isMobile ? 280 : 320}
            minHeight={isMobile ? 350 : 380}
            boundary="body" // Use body as boundary for maximum drag area
            enableResizing={false}
            enableDragging={true} // Explicitly enable dragging
            header="Risk Disclaimer" // This makes the header draggable
            onClose={onClose}
        >
            <div className="disclaimer-popup">
                <div className="disclaimer-popup__header">
                    <LabelPairedCircleExclamationLgFillIcon 
                        className="disclaimer-popup__icon"
                        width={isMobile ? "32" : "40"}
                        height={isMobile ? "32" : "40"}
                        fill="var(--brand-red-coral, #ff444f)" 
                    />
                    <h3>Important Risk Notice</h3>
                </div>
                <div className="disclaimer-popup__content">
                    <p>
                        Deriv offers complex derivatives, such as options and contracts for difference ("CFDs"). 
                        These products may not be suitable for all clients, and trading them puts you at risk.
                    </p>
                    
                    <p className="disclaimer-popup__emphasis">
                        Please make sure that you understand the following risks before trading Deriv products:
                    </p>
                    
                    <ul className="disclaimer-popup__risk-list">
                        <li>You may lose some or all of the money you invest in the trade.</li>
                        <li>If your trade involves currency conversion, exchange rates will affect your profit and loss.</li>
                        <li>You should never trade with borrowed money or with money that you cannot afford to lose.</li>
                    </ul>
                    
                    <p className="disclaimer-popup__note disclaimer-popup__unofficial">
                        <strong>Please note:</strong> This is not the official Deriv website. This platform is powered by Deriv's API and services.
                    </p>
                    
                    <p className="disclaimer-popup__note">
                        Trading derivatives carries significant risk and can result in more than just monetary loss. Please ensure you fully understand the risks and take appropriate measures to manage your risk exposure.
                    </p>
                    
                    <div className="disclaimer-popup__actions">
                        <Button onClick={onDontShowAgain} variant="secondary" size="md">
                            Don't show again
                        </Button>
                        <Button onClick={onClose} variant="primary" size="md">
                            I understand
                        </Button>
                    </div>
                </div>
            </div>
        </Draggable>
    );
});

export default DisclaimerPopup;