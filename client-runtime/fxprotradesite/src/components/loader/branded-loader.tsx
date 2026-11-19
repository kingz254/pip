import React from 'react';
import './simple-loader.scss';

type BrandedLoaderProps = {
    message?: string;
    subMessage?: string;
};

const BrandedLoader: React.FC<BrandedLoaderProps> = ({ 
    message = "Loading...", 
    subMessage
}) => {
    return (
        <div className="simple-loader light-theme">
            <div className="simple-loader__content">
                <div className="simple-loader__spinner"></div>
                <div className="simple-loader__message">{message}</div>
                {subMessage && (
                    <div className="simple-loader__sub-message">{subMessage}</div>
                )}
            </div>
        </div>
    );
};

export default BrandedLoader;
