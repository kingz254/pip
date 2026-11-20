import { useState } from 'react';
import DisclaimerPopup from './disclaimer-popup';
import './disclaimer.scss';

const DisclaimerButton = () => {
    const [isOpen, setIsOpen] = useState(false);

    return <>
        <button className='pf-risk-button' type='button' aria-label='Open risk disclaimer' title='Risk disclaimer' onClick={() => setIsOpen(true)}>
            <svg viewBox='0 0 24 24' aria-hidden='true'><path d='M12 3 1.8 21h20.4L12 3Z' fill='none' stroke='currentColor' strokeWidth='2' strokeLinejoin='round'/><path d='M12 9v5m0 3h.01' fill='none' stroke='currentColor' strokeWidth='2.2' strokeLinecap='round'/></svg>
        </button>
        {isOpen && <DisclaimerPopup onClose={() => setIsOpen(false)} onDontShowAgain={() => setIsOpen(false)} />}
    </>;
};

export default DisclaimerButton;
