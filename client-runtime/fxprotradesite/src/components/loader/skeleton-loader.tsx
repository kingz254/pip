import React from 'react';
import './skeleton-loader.scss';

interface SkeletonLoaderProps {
    width?: string | number;
    height?: string | number;
    borderRadius?: string | number;
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular';
    animation?: 'pulse' | 'wave' | 'none';
}

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
    width = '100%',
    height = '1rem',
    borderRadius = '4px',
    className = '',
    variant = 'rectangular',
    animation = 'pulse'
}) => {
    const getVariantStyles = () => {
        switch (variant) {
            case 'circular':
                return {
                    width: typeof width === 'number' ? `${width}px` : width,
                    height: typeof width === 'number' ? `${width}px` : width,
                    borderRadius: '50%'
                };
            case 'text':
                return {
                    width: typeof width === 'number' ? `${width}px` : width,
                    height: typeof height === 'number' ? `${height}px` : height,
                    borderRadius: '4px'
                };
            default:
                return {
                    width: typeof width === 'number' ? `${width}px` : width,
                    height: typeof height === 'number' ? `${height}px` : height,
                    borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius
                };
        }
    };

    return (
        <div 
            className={`skeleton-loader skeleton-loader--${variant} skeleton-loader--${animation} ${className}`}
            style={getVariantStyles()}
        />
    );
};

export default SkeletonLoader;
