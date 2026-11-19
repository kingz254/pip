import { useState, useRef, useEffect, lazy, Suspense } from 'react';
import './community-floating-icon.scss';

const Community = lazy(() => import('../../pages/community/community'));

const CommunityFloatingIcon = () => {
    const [showPopup, setShowPopup] = useState(false);
    const [showCommunityTab, setShowCommunityTab] = useState(true); // Directly show community tab
    const popupRef = useRef<HTMLDivElement>(null);

    // Close popup when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            // Don't close if clicking on the floating icon itself
            if (popupRef.current && !popupRef.current.contains(target)) {
                const floatingIcon = document.querySelector('.community-floating-icon');
                if (floatingIcon && !floatingIcon.contains(target)) {
                    setShowPopup(false);
                }
            }
        };

        if (showPopup) {
            // Add small delay to prevent immediate closing
            const timer = setTimeout(() => {
                document.addEventListener('mousedown', handleClickOutside);
            }, 100);

            return () => {
                clearTimeout(timer);
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [showPopup]);

    // Toggle popup function
    const togglePopup = () => {
        setShowPopup((prev) => !prev);
    };

    return (
        <>
            <div
                className='community-floating-icon'
                onClick={togglePopup}
                role='button'
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        togglePopup();
                    }
                }}
                title='Community'
                aria-label='Community toggle'
                aria-expanded={showPopup}
            >
                <div className='community-icon-content'>
                    <svg width='20px' height='20px' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'>
                        <path
                            d='M21 15C21 15.5304 20.7893 16.0391 20.4142 16.4142C20.0391 16.7893 19.5304 17 19 17H7L3 21V5C3 4.46957 3.21071 3.96086 3.58579 3.58579C3.96086 3.21071 4.46957 3 5 3H19C19.5304 3 20.0391 3.21071 20.4142 3.58579C20.7893 3.96086 21 4.46957 21 5V15Z'
                            stroke='var(--text-general)'
                            strokeWidth='2'
                            strokeLinecap='round'
                            strokeLinejoin='round'
                        />
                    </svg>
                </div>
            </div>

            {showPopup && (
                <div className='community-popup' ref={popupRef}>
                    <div className='popup-header'>
                        <h3>Community Chat</h3>
                        <button
                            className='popup-close'
                            onClick={() => setShowPopup(false)}
                            aria-label='Close popup'
                        >
                            ✕
                        </button>
                    </div>

                    <div className='community-tab-container'>
                        <Suspense
                            fallback={
                                <div className='community-loading'>
                                    <div className='spinner'></div>
                                    <p>Loading Community...</p>
                                </div>
                            }
                        >
                            <Community />
                        </Suspense>
                    </div>
                </div>
            )}
        </>
    );
};

export default CommunityFloatingIcon;
