import React from 'react';
import './futuristic-loader.scss';

interface FuturisticLoaderProps {
  message?: string;
}

const FuturisticLoader: React.FC<FuturisticLoaderProps> = ({ message }) => {
  return (
    <div className="futuristic-loader-container">
      <div className="loader-content">
        <div className="loader">
          <i></i><i></i><i></i><i></i><i></i>
        </div>

        {message && <p className="loader-message">{message}</p>}
      </div>
    </div>
  );
};

export default FuturisticLoader;
