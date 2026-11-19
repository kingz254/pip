import React, { useEffect, useState } from 'react';
import { localize } from '@deriv-com/translations';
import './PWAInstallModal.scss';

interface PWAInstallModalProps {
    onInstall: () => void;
    onClose: () => void;
    show: boolean;
}

const PWAInstallModal: React.FC<PWAInstallModalProps> = ({ onInstall, onClose, show }) => {
    const [delayedShow, setDelayedShow] = useState(false);

    useEffect(() => {
        let timerId: ReturnType<typeof setTimeout> | undefined = undefined;

        if (show) {
            timerId = setTimeout(() => {
                setDelayedShow(true);
            }, 8000); // 10 seconds delay
        } else {
            setDelayedShow(false); // If show becomes false, hide immediately
        }

        return () => {
            if (timerId) {
                clearTimeout(timerId); // Cleanup timer on unmount or if show changes
            }
        };
    }, [show]); // Re-run effect if show prop changes

    if (!show || !delayedShow) {
        return null;
    }

    const currentTheme = localStorage.getItem('theme') ?? 'light';

    return (
        <div className={`pwa-install-modal-overlay ${currentTheme === 'dark' ? 'theme--dark' : 'theme--light'}`}>
            <div className='pwa-install-modal-content'>
                <h3>{localize('Install App?')}</h3>
                <p>{localize(`Add ${window.__PF_SITE_BRANDING__?.name || 'this trading site'} to your home screen for quick access.`)}</p>
                <div className='pwa-install-modal-actions'>
                    <button onClick={onInstall} className='pwa-install-modal-button install'>
                        {localize('Install')}
                    </button>
                    <button onClick={onClose} className='pwa-install-modal-button close'>
                        {localize('Not Now')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PWAInstallModal;
