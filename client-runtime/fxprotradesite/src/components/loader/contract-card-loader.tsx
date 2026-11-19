import React from 'react';
import './contract-card-loader.scss';

const ContractCardLoader: React.FC = () => {
    return (
        <div className='contract-card-loader'>
            <div className='loader-header'>
                <div className='loader-line loader-line--short'></div>
                <div className='loader-circle'></div>
            </div>
            
            <div className='loader-content'>
                <div className='loader-line loader-line--medium'></div>
                <div className='loader-line loader-line--long'></div>
                <div className='loader-line loader-line--short'></div>
            </div>
            
            <div className='loader-footer'>
                <div className='loader-line loader-line--medium'></div>
                <div className='loader-status'>
                    <div className='status-dot'></div>
                    <div className='loader-line loader-line--short'></div>
                </div>
            </div>
            
            <div className='loader-shimmer'></div>
        </div>
    );
};

export default ContractCardLoader;
