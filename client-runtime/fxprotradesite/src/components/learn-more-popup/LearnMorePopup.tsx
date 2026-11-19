import React, { useEffect, useState } from 'react';
import { localize } from '@deriv-com/translations';
import { useApiBase } from '@/hooks/useApiBase';
import './LearnMorePopup.scss';

const LearnMorePopup: React.FC = () => {
    const { isAuthorized } = useApiBase();
    const [showPopup, setShowPopup] = useState(false);

    useEffect(() => {
        // Show popup on each page load if user is logged in
        if (isAuthorized) {
            setShowPopup(true);
        }
    }, [isAuthorized]);

    const handleClose = () => {
        setShowPopup(false);
    };

    const handleLearnMore = () => {
        window.open('https://learn.binaryfx.site', '_blank');
        handleClose();
    };

    if (!showPopup) {
        return null;
    }

    const currentTheme = localStorage.getItem('theme') ?? 'light';

    return (
        <div className={`learn-more-popup-overlay ${currentTheme === 'dark' ? 'theme--dark' : 'theme--light'}`}>
            <div className='learn-more-popup-content'>
                <button className='learn-more-popup-close' onClick={handleClose} aria-label='Close popup'>
                    ✕
                </button>
                
                <div className='learn-more-popup-icon'>
                    <svg viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2'>
                        <path d='M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z' />
                    </svg>
                </div>

                <h2 className='learn-more-popup-title'>
                    {localize('Unlock Your Trading Potential')}
                </h2>

                <p className='learn-more-popup-subtitle'>
                    {localize('Master trading strategies with expert-led resources')}
                </p>

                <div className='learn-more-popup-body'>
                    <div className='learn-more-popup-feature'>
                        <div className='feature-icon'>📚</div>
                        <div className='feature-content'>
                            <h4>{localize('Video Tutorials')}</h4>
                            <p>{localize('Learn proven trading strategies step by step')}</p>
                        </div>
                    </div>

                    <div className='learn-more-popup-feature'>
                        <div className='feature-icon'>🔴</div>
                        <div className='feature-content'>
                            <h4>{localize('Live Trading Sessions')}</h4>
                            <p>{localize('Watch and learn from experienced traders in real-time')}</p>
                        </div>
                    </div>

                    <div className='learn-more-popup-feature'>
                        <div className='feature-icon'>💡</div>
                        <div className='feature-content'>
                            <h4>{localize('Expert Tips')}</h4>
                            <p>{localize('Get insider knowledge and market insights')}</p>
                        </div>
                    </div>

                    <div className='learn-more-popup-feature'>
                        <div className='feature-icon'>🚀</div>
                        <div className='feature-content'>
                            <h4>{localize('Beginner Guides')}</h4>
                            <p>{localize('Start your trading journey with confidence')}</p>
                        </div>
                    </div>
                </div>

                <div className='learn-more-popup-actions'>
                    <button 
                        onClick={handleLearnMore} 
                        className='learn-more-popup-button primary'
                    >
                        {localize('Start Learning Now')}
                        <span className='button-arrow'>→</span>
                    </button>
                    <button 
                        onClick={handleClose} 
                        className='learn-more-popup-button secondary'
                    >
                        {localize('Maybe Later')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LearnMorePopup;
