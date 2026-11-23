import React, { useEffect, useState } from 'react';
import { localize } from '@deriv-com/translations';
import './PWAInstallModal.scss';

interface PWAInstallModalProps {
    onInstall: () => void;
    onClose: () => void;
    show: boolean;
    installed?: boolean;
}

const PWAInstallModal: React.FC<PWAInstallModalProps> = ({ onInstall, onClose, show, installed = false }) => {
    const [delayedShow, setDelayedShow] = useState(false);

    useEffect(() => {
        let timerId: ReturnType<typeof setTimeout> | undefined = undefined;

        if (show) {
            timerId = setTimeout(() => {
                setDelayedShow(true);
            }, installed ? 0 : 8000);
        } else {
            setDelayedShow(false); // If show becomes false, hide immediately
        }

        return () => {
            if (timerId) {
                clearTimeout(timerId); // Cleanup timer on unmount or if show changes
            }
        };
    }, [show, installed]);

    if (!show || !delayedShow) {
        return null;
    }

    const currentTheme = localStorage.getItem('theme') ?? 'light';

    return (
        <div className={`pwa-install-modal-overlay ${currentTheme === 'dark' ? 'theme--dark' : 'theme--light'}`} role='presentation'>
            <div className='pwa-install-modal-content'>
                <button className='pwa-install-modal-dismiss' type='button' aria-label={localize('Close')} onClick={onClose}>×</button>
                <h3>{installed ? localize('This site is installed') : localize(`Install ${window.__PF_SITE_BRANDING__?.name || 'this trading site'}`)}</h3>
                <p>{installed ? localize('Launch it from your home screen or app list for the full experience.') : localize(`Add ${window.__PF_SITE_BRANDING__?.name || 'this trading site'} to your home screen for quick access.`)}</p>
                <div className='pwa-install-modal-actions'>
                    <button onClick={installed ? onClose : onInstall} className='pwa-install-modal-button install'>
                        {installed ? localize('Got it') : localize('Install')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PWAInstallModal;
