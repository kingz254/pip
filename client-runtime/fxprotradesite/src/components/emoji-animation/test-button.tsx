import React, { useState } from 'react';
import EmojiAnimation from './emoji-animation';

const TestEmojiButton: React.FC = () => {
    const [showPositiveEmoji, setShowPositiveEmoji] = useState(false);
    const [showNegativeEmoji, setShowNegativeEmoji] = useState(false);
    
    const triggerPositiveEmoji = () => {
        console.log('Showing positive emoji animation');
        setShowPositiveEmoji(true);
        setShowNegativeEmoji(false);
        
        // Hide after 5 seconds
        setTimeout(() => {
            setShowPositiveEmoji(false);
        }, 5000);
    };
    
    const triggerNegativeEmoji = () => {
        console.log('Showing negative emoji animation');
        setShowNegativeEmoji(true);
        setShowPositiveEmoji(false);
        
        // Hide after 5 seconds
        setTimeout(() => {
            setShowNegativeEmoji(false);
        }, 5000);
    };
    
    const style = {
        position: 'fixed' as 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 100000,
        display: 'flex',
        flexDirection: 'column' as 'column',
        gap: '10px'
    };
    
    const buttonStyle = {
        padding: '10px',
        backgroundColor: '#2A3052',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer'
    };
    
    return (
        <>
            <div style={style}>
                <button 
                    style={buttonStyle} 
                    onClick={triggerPositiveEmoji}
                >
                    Test Positive Emoji 🎉
                </button>
                <button 
                    style={buttonStyle} 
                    onClick={triggerNegativeEmoji}
                >
                    Test Negative Emoji 😢
                </button>
            </div>
            
            {showPositiveEmoji && <EmojiAnimation isPositive={true} />}
            {showNegativeEmoji && <EmojiAnimation isPositive={false} />}
        </>
    );
};

export default TestEmojiButton;