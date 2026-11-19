import React from 'react';
import './button-loading.scss';

type ButtonLoadingProps = {
    size?: 'small' | 'medium' | 'large';
    color?: 'primary' | 'secondary' | 'white';
};

const ButtonLoading: React.FC<ButtonLoadingProps> = ({ 
    size = 'medium',
    color = 'white'
}) => {
    return (
        <div className={`button-loading button-loading--${size} button-loading--${color}`}>
            <div className="spinner"></div>
        </div>
    );
};

export default ButtonLoading;
