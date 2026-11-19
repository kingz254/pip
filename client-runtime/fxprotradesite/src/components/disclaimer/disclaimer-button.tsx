import React, { useEffect, useState, useRef } from 'react';
import { observer } from 'mobx-react-lite';
import { LabelPairedCircleExclamationCaptionFillIcon } from '@deriv/quill-icons/LabelPaired';
import { useDevice } from '@deriv-com/ui';
import { DBOT_TABS } from '@/constants/bot-contents';
import { useStore } from '@/hooks/useStore';
import DisclaimerPopup from './disclaimer-popup';
import './disclaimer.scss';

const STORAGE_KEY = 'disclaimer_hidden';

const DisclaimerButton: React.FC = observer(() => {
    const { isMobile } = useDevice();
    
    // Initialize hooks BEFORE any conditional logic
    const [isPopupOpen, setIsPopupOpen] = useState(false);
    const [shouldShow, setShouldShow] = useState(true);
    const [position, setPosition] = useState({ 
        x: typeof window !== 'undefined' ? window.innerWidth - (isMobile ? 130 : 160) : 0, 
        y: typeof window !== 'undefined' ? window.innerHeight - (isMobile ? 60 : 80) : 0
    });
    const [isDragging, setIsDragging] = useState(false);
    const dragRef = useRef<HTMLDivElement>(null);
    // Reference for tracking starting points of drag
    const startPosRef = useRef({ x: 0, y: 0, left: 0, top: 0 });
    
    try {
        const store = useStore();
        
        // Check if store is initialized - but after hooks
        if (!store || !store.dashboard || typeof store.dashboard.active_tab === 'undefined') {
            return null;
        }
        
        const { dashboard } = store;
        const { active_tab } = dashboard;

    // Only show disclaimer when active tab is dashboard
    const shouldShowDisclaimer = typeof active_tab === 'number' && active_tab === DBOT_TABS.DASHBOARD;

    useEffect(() => {
        // Always show disclaimer button
        setShouldShow(true);
        
        // Auto-show popup on page load when on dashboard tab
        if (shouldShowDisclaimer) {
            setIsPopupOpen(true);
        }
        
        // Try to restore the position from local storage
        try {
            const savedPosition = localStorage.getItem('disclaimer_position');
            if (savedPosition) {
                const { x, y } = JSON.parse(savedPosition);
                setPosition({ x, y });
            }
        } catch (e) {
            console.error('Failed to restore disclaimer position', e);
        }
    }, [shouldShowDisclaimer]);

    const handleMouseDown = (e: React.MouseEvent) => {
        // We want the entire button to be draggable
        e.preventDefault();
        e.stopPropagation();
        
        // Reset drag tracking
        dragDistanceRef.current = 0;
        wasDraggingRef.current = false;
        setIsDragging(true);
        
        // Store starting points in ref for reuse with both mouse and touch events
        startPosRef.current = {
            x: e.clientX,
            y: e.clientY,
            left: position.x,
            top: position.y
        };
        
        const handleMouseMove = (e: MouseEvent) => {
            const dx = e.clientX - startPosRef.current.x;
            const dy = e.clientY - startPosRef.current.y;
            
            // Calculate drag distance for click detection
            dragDistanceRef.current = Math.sqrt(dx * dx + dy * dy);
            
            const newX = startPosRef.current.left + dx;
            const newY = startPosRef.current.top + dy;
            
            // Keep button within viewport bounds
            const buttonWidth = isMobile ? 110 : 130;
            const buttonHeight = isMobile ? 36 : 42;
            const maxX = window.innerWidth - buttonWidth - 10; // button width + safety margin
            const maxY = window.innerHeight - buttonHeight - 10; // button height + safety margin
            
            const boundedX = Math.max(0, Math.min(newX, maxX));
            const boundedY = Math.max(0, Math.min(newY, maxY));
            
            setPosition({ x: boundedX, y: boundedY });
        };
        
        const handleMouseUp = () => {
            // Mark if this was a drag or click
            wasDraggingRef.current = dragDistanceRef.current > 5;
            
            setIsDragging(false);
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            
            // Save position to local storage after a slight delay to ensure the state is updated
            setTimeout(() => {
                localStorage.setItem('disclaimer_position', JSON.stringify(position));
            }, 100);
        };
        
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    };
    
    // Handle touch events for mobile
    const handleTouchStart = (e: React.TouchEvent) => {
        e.stopPropagation();
        e.preventDefault(); // Prevent default touch behavior
        if (e.touches.length === 1) {
            // Reset drag tracking
            dragDistanceRef.current = 0;
            wasDraggingRef.current = false;
            setIsDragging(true);
            
            const touch = e.touches[0];
            startPosRef.current = {
                x: touch.clientX,
                y: touch.clientY,
                left: position.x,
                top: position.y
            };
            
            const handleTouchMove = (e: TouchEvent) => {
                e.preventDefault(); // Prevent scrolling while dragging
                if (e.touches.length === 1) {
                    const touch = e.touches[0];
                    const dx = touch.clientX - startPosRef.current.x;
                    const dy = touch.clientY - startPosRef.current.y;
                    
                    // Calculate drag distance for click detection
                    dragDistanceRef.current = Math.sqrt(dx * dx + dy * dy);
                    
                    const newX = startPosRef.current.left + dx;
                    const newY = startPosRef.current.top + dy;
                    
                    // Keep button within viewport bounds
                    const buttonWidth = isMobile ? 110 : 130;
                    const buttonHeight = isMobile ? 36 : 42;
                    const maxX = window.innerWidth - buttonWidth - 10; // button width + safety margin
                    const maxY = window.innerHeight - buttonHeight - 10; // button height + safety margin
                    
                    const boundedX = Math.max(0, Math.min(newX, maxX));
                    const boundedY = Math.max(0, Math.min(newY, maxY));
                    
                    setPosition({ x: boundedX, y: boundedY });
                }
            };
            
            const handleTouchEnd = () => {
                // Mark if this was a drag or tap
                wasDraggingRef.current = dragDistanceRef.current > 5;
                
                setIsDragging(false);
                document.removeEventListener('touchmove', handleTouchMove);
                document.removeEventListener('touchend', handleTouchEnd);
                
                // If this was a tap, show the popup
                if (dragDistanceRef.current < 5) {
                    setIsPopupOpen(true);
                }
                
                // Save position to local storage after a slight delay to ensure the state is updated
                setTimeout(() => {
                    localStorage.setItem('disclaimer_position', JSON.stringify(position));
                }, 100);
            };
            
            document.addEventListener('touchmove', handleTouchMove, { passive: false });
            document.addEventListener('touchend', handleTouchEnd);
        }
    };
    
    // Track drag distance to differentiate between clicks and drags
    const dragDistanceRef = useRef(0);
    const wasDraggingRef = useRef(false);
    
    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        
        console.log("Click handler triggered, drag distance:", dragDistanceRef.current);
        
        // Only show popup if we didn't drag significantly
        if (dragDistanceRef.current < 5 && !wasDraggingRef.current) {
            setIsPopupOpen(true);
        }
        
        // Reset tracking state
        wasDraggingRef.current = false;
        dragDistanceRef.current = 0;
    };

    const handleClose = () => {
        setIsPopupOpen(false);
    };

    const handleDontShowAgain = () => {
        // Just close the popup for this session, but keep the button visible
        // Remove the localStorage setting so disclaimer shows on next page load
        localStorage.removeItem(STORAGE_KEY);
        setIsPopupOpen(false);
    };

    if (!shouldShow || !shouldShowDisclaimer) return null;

    return (
        <>
            <div 
                ref={dragRef}
                className={`disclaimer-button-wrapper ${isDragging ? 'dragging' : ''}`}
                style={{
                    position: 'absolute',
                    left: `${position.x}px`,
                    top: `${position.y}px`,
                    zIndex: 9999,
                    cursor: isDragging ? 'grabbing' : 'grab',
                    touchAction: 'none' // Prevent touch scrolling while dragging
                }}
                onMouseDown={handleMouseDown}
                onTouchStart={handleTouchStart}
            >
                <div 
                    className="disclaimer-button" 
                    onClick={handleClick}
                    onMouseUp={() => {
                        // Additional explicit handler for click-like events
                        if (!wasDraggingRef.current && dragDistanceRef.current < 5) {
                            setIsPopupOpen(true);
                        }
                    }}
                >
                    <LabelPairedCircleExclamationCaptionFillIcon 
                        className="disclaimer-button__icon"
                        width={isMobile ? "14" : "16"}
                        height={isMobile ? "14" : "16"} 
                        fill="#ffffff" 
                    />
                    <span>Disclaimer</span>
                </div>
            </div>
            {isPopupOpen && (
                <DisclaimerPopup
                    onClose={handleClose}
                    onDontShowAgain={handleDontShowAgain}
                />
            )}
        </>
    );
    } catch (error) {
        console.warn('DisclaimerButton: Store not available yet', error);
        return null;
    }
});

export default DisclaimerButton;