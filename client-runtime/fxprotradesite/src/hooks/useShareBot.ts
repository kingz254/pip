import { useCallback } from 'react';

interface Bot {
    title: string;
    file?: string;
    filePath?: string;
}

export const useShareBot = () => {
    const shareBot = useCallback((bot: Bot, event?: React.MouseEvent) => {
        if (event) {
            event.stopPropagation();
        }

        const currentUrl = new URL(window.location.href);
        
        // Use the bot title for the parameter
        currentUrl.searchParams.set('bot', encodeURIComponent(bot.title));
        currentUrl.searchParams.set('tab', 'id-bot-builder');
        
        const shareUrl = currentUrl.toString();
        
        navigator.clipboard.writeText(shareUrl).then(() => {
            console.log('✅ Bot link copied to clipboard:', shareUrl);
            
            // Create a temporary notification element
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: var(--brand-red-coral, #ff6444);
                color: white;
                padding: 12px 20px;
                border-radius: 8px;
                font-size: 14px;
                z-index: 10000;
                animation: slideIn 0.3s ease-out;
                box-shadow: 0 4px 12px rgba(0,0,0,0.2);
            `;
            notification.textContent = 'Bot link copied to clipboard!';
            document.body.appendChild(notification);
            
            // Add CSS animation if not already present
            if (!document.getElementById('share-notification-styles')) {
                const style = document.createElement('style');
                style.id = 'share-notification-styles';
                style.textContent = `
                    @keyframes slideIn {
                        from { transform: translateX(100%); opacity: 0; }
                        to { transform: translateX(0); opacity: 1; }
                    }
                `;
                document.head.appendChild(style);
            }
            
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 3000);
        }).catch(err => {
            console.error('❌ Failed to copy bot link:', err);
            // Fallback: show the URL in an alert
            alert(`Copy this link to share the bot:\n${shareUrl}`);
        });

        return shareUrl;
    }, []);

    return { shareBot };
};
