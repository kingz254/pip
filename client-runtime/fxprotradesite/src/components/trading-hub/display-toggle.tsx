import { useState, useEffect } from 'react';
import TradingHubDisplay from './trading-hub-display';
import AdvancedDisplay from './advanced-display';
import { observer as globalObserver } from '../../external/bot-skeleton/utils/observer';
import './display-toggle.scss';

const DisplayToggle = () => {
    const [activeDisplay, setActiveDisplay] = useState('trading'); // 'trading' or 'advanced'

    useEffect(() => {
        // Emit event when display changes
        globalObserver.emit('auto_tab.display_changed', activeDisplay);
    }, [activeDisplay]);

    const handleDisplayChange = (display: string) => {
        setActiveDisplay(display);
    };

    return (
        <div className='display-container'>
            <div className='display-toggle'>
                <button
                    className={`display-toggle__button ${activeDisplay === 'trading' ? 'active' : ''}`}
                    onClick={() => handleDisplayChange('trading')}
                >
                    Trading Hub
                </button>
                <button
                    className={`display-toggle__button ${activeDisplay === 'advanced' ? 'active' : ''}`}
                    onClick={() => handleDisplayChange('advanced')}
                >
                    Advanced
                </button>
            </div>
            <div className='display-content'>
                {activeDisplay === 'trading' ? <TradingHubDisplay /> : <AdvancedDisplay />}
            </div>
        </div>
    );
};

export default DisplayToggle;
