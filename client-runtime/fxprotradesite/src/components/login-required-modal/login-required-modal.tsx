import React from 'react';
import { observer } from 'mobx-react-lite';
import { redirectToLogin } from '@/components/shared/utils/login/login';
import Button from '@/components/shared_ui/button';
import Modal from '@/components/shared_ui/modal';
import Text from '@/components/shared_ui/text';
import { useStore } from '@/hooks/useStore';
import './login-required-modal.scss';

const funnyMessages = [
    "🚀 Ready to make it rain? Log in first!",
    "💎 Diamonds are forever, but sessions expire. Login!",
    "🎯 Bull or bear? You gotta be logged in to care!",
    "💰 Money doesn't sleep, and neither should your login session!",
    "🎰 Fortune favors the logged-in!",
    "📈 Charts don't lie, but you need to login to spy!",
    "🌟 Star traders login first!",
    "⚡ Power up your trades - authenticate!",
];

const LoginRequiredModal = observer(() => {
    const { client } = useStore();
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [showRiskDisclaimer, setShowRiskDisclaimer] = React.useState(false);
    const [randomMessage] = React.useState(() => 
        funnyMessages[Math.floor(Math.random() * funnyMessages.length)]
    );

    React.useEffect(() => {
        const isCallbackPage = window.location.pathname === '/callback';
        const shouldShowModal = !client?.is_logged_in && !isCallbackPage && client !== undefined;
        setIsModalOpen(shouldShowModal);
    }, [client?.is_logged_in]);

    const handleLogin = redirectToLogin;

    const handleCreateAccount = () => {
        const url = `https://track.deriv.com/_qUdkKtoOWpVMjdsyM5hasGNd7ZgqdRLk/1/`;
        window.open(url, '_blank');
    };

    const handleRiskDisclaimer = () => {
        setShowRiskDisclaimer(true);
    };

    const closeRiskDisclaimer = () => {
        setShowRiskDisclaimer(false);
    };

    // Don't render anything if user is logged in or client not initialized
    if (client?.is_logged_in || client === undefined) {
        return null;
    }

    const showAnyModal = isModalOpen || showRiskDisclaimer;

    return (
        <>
            {/* Only show backdrop when modal is actually open */}
            {showAnyModal && <div className='modal-backdrop' />}
            
            <Modal
                is_open={isModalOpen && !showRiskDisclaimer}
                className='login-required-modal'
                width='auto'
                should_close_on_click_outside={false}
                has_close_icon={false}
                portalId='modal_root'
            >
                <Modal.Body>
                    <div className='login-card'>
                        <span className='login-card__emoji'>🚀</span>
                        
                        <h1 className='login-card__title'>
                            Welcome to {window.__PF_SITE_BRANDING__?.name || 'your trading site'}!
                        </h1>
                        
                        <div className='login-card__message'>
                            {randomMessage}
                        </div>
                        
                        <p className='login-card__description'>
                            Join thousands of traders making moves in the market. 
                            Your next big trade is just a click away!
                        </p>

                        <div className='login-card__actions'>
                            <button 
                                className='login-card__btn login-card__btn--primary'
                                onClick={handleLogin}
                            >
                                Login with Deriv
                            </button>
                            
                            <button 
                                className='login-card__btn login-card__btn--secondary'
                                onClick={handleCreateAccount}
                            >
                                Create Account
                            </button>
                        </div>

                        <button 
                            className='login-card__disclaimer'
                            onClick={handleRiskDisclaimer}
                        >
                            ⚠️ Risk Disclaimer
                        </button>
                    </div>
                </Modal.Body>
            </Modal>

            {/* Risk Disclaimer Modal */}
            <Modal
                is_open={showRiskDisclaimer}
                className='risk-modal'
                width='480px'
                should_close_on_click_outside={true}
                has_close_icon={true}
                onClickClose={closeRiskDisclaimer}
                portalId='modal_root'
            >
                <Modal.Body>
                    <div className='risk-modal__content'>
                        <h2 className='risk-modal__title'>Risk Disclaimer</h2>
                        
                        <p className='risk-modal__text'>
                            Deriv offers complex derivatives, such as options and contracts for difference ("CFDs"). 
                            These products may not be suitable for all clients, and trading them puts you at risk.
                        </p>

                        <ul className='risk-modal__list'>
                            <li>You may lose some or all of the money you invest in the trade.</li>
                            <li>If your trade involves currency conversion, exchange rates will affect your profit and loss.</li>
                            <li>You should never trade with borrowed money or with money that you cannot afford to lose.</li>
                        </ul>

                        <button
                            className='risk-modal__btn'
                            onClick={closeRiskDisclaimer}
                        >
                            I Understand
                        </button>
                    </div>
                </Modal.Body>
            </Modal>
        </>
    );
});

export default LoginRequiredModal;
