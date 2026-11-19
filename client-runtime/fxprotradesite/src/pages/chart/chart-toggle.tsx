import { useState, useEffect, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { useStore } from '@/hooks/useStore';
import { observer as globalObserver } from '../../external/bot-skeleton/utils/observer';
import SmartTradingDisplay from './smart-trading-display';
import SpeedBotDisplay from './speed-bot-display';
import TradingHubDisplay from '@/components/trading-hub/trading-hub-display';
import './chart-toggle.scss';

type TDisplayOption = {
    id: string;
    label: string;
};

const DISPLAY_OPTIONS: TDisplayOption[] = [
    { id: 'trading-hub', label: 'Trading Hub' },
    { id: 'smart-trading', label: 'Smart Trading' },
    { id: 'speed-bot', label: 'Speed Bot' },
    { id: 'charts', label: 'Charts' },
];

const ChartToggle = observer(({ children }: { children: React.ReactNode }) => {
    const [activeDisplay, setActiveDisplay] = useState('trading-hub');
    const { run_panel } = useStore();
    const { is_drawer_open } = run_panel;
    const toggleContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        globalObserver.emit('chart_tab.display_changed', activeDisplay);
    }, [activeDisplay]);

    const handleDisplayChange = (display: string) => {
        setActiveDisplay(display);
    };

    const handleKeyDown = (e: React.KeyboardEvent, displayId: string) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleDisplayChange(displayId);
        } else if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
            e.preventDefault();
            const currentIndex = DISPLAY_OPTIONS.findIndex(opt => opt.id === activeDisplay);
            let nextIndex = e.key === 'ArrowRight' ? currentIndex + 1 : currentIndex - 1;
            
            if (nextIndex < 0) nextIndex = DISPLAY_OPTIONS.length - 1;
            if (nextIndex >= DISPLAY_OPTIONS.length) nextIndex = 0;
            
            handleDisplayChange(DISPLAY_OPTIONS[nextIndex].id);
        }
    };

    return (
        <div className={`chart-display-container ${is_drawer_open ? 'run-panel-active' : ''}`}>
            <div className='chart-display-toggle' ref={toggleContainerRef} role='tablist'>
                {DISPLAY_OPTIONS.map((option) => (
                    <button
                        key={option.id}
                        className={`chart-display-toggle__button ${activeDisplay === option.id ? 'active' : ''}`}
                        onClick={() => handleDisplayChange(option.id)}
                        onKeyDown={(e) => handleKeyDown(e, option.id)}
                        role='tab'
                        aria-selected={activeDisplay === option.id}
                        aria-controls={`chart-display-${option.id}`}
                    >
                        {option.label}
                    </button>
                ))}
            </div>
            <div className='chart-display-content' id={`chart-display-${activeDisplay}`} role='tabpanel'>
                {activeDisplay === 'charts' ? (
                    children
                ) : activeDisplay === 'speed-bot' ? (
                    <SpeedBotDisplay />
                ) : activeDisplay === 'trading-hub' ? (
                    <TradingHubDisplay />
                ) : (
                    <SmartTradingDisplay />
                )}
            </div>
        </div>
    );
});

export default ChartToggle;
