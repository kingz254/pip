import React, { useEffect, useState } from 'react';
import './emoji-animation.scss';

type EmojiAnimationProps = {
    isPositive: boolean;
};

const EmojiAnimation: React.FC<EmojiAnimationProps> = ({ isPositive }) => {
    const [emojis, setEmojis] = useState<React.ReactNode[]>([]);
    
    useEffect(() => {
        // Create animated emojis
        const newEmojis = [];
        const emojiCount = 30; // Increased number of emojis to display
        
        // Emoji collections for different outcomes
        const positiveEmojis = ['🎉', '🥳', '🚀', '💰', '🤑', '✨', '🏆', '💎', '🔥', '👍'];
        const negativeEmojis = ['😢', '😭', '💔', '👎', '😔', '💸', '📉', '🫠', '🙁', '😓'];
        
        for (let i = 0; i < emojiCount; i++) {
            const left = Math.random() * 90; // Random horizontal position (0-90%)
            const animationDelay = Math.random() * 1.5; // Random delay (0-1.5s)
            const animationDuration = 3 + Math.random() * 2; // Random duration (3-5s)
            const size = 0.8 + Math.random() * 0.6; // Random size (0.8-1.4em)
            
            // Select a random emoji from the appropriate collection
            const emojiCollection = isPositive ? positiveEmojis : negativeEmojis;
            const emoji = emojiCollection[Math.floor(Math.random() * emojiCollection.length)];
            
            // Generate random movement classes
            const moveLeftClass = Math.random() > 0.5 ? 'move-left' : 'move-right';
            const rotateClass = Math.random() > 0.5 ? 'rotate-left' : 'rotate-right';
                
            newEmojis.push(
                <div 
                    key={i}
                    className={`emoji-animation__item ${moveLeftClass} ${rotateClass}`}
                    style={{
                        left: `${left}%`,
                        animationDelay: `${animationDelay}s`,
                        animationDuration: `${animationDuration}s`,
                        fontSize: `${size}em`,
                    }}
                >
                    {emoji}
                </div>
            );
        }
        
        setEmojis(newEmojis);
        
        // Auto cleanup
        const timeout = setTimeout(() => {
            setEmojis([]);
        }, 6500);
        
        return () => clearTimeout(timeout);
    }, [isPositive]);

    // Show only the animated emojis without text messages
    return (
        <div className="emoji-animation">
            {emojis}
        </div>
    );
};

export default EmojiAnimation;