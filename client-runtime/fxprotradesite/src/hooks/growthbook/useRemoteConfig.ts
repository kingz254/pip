import { useEffect, useState } from 'react';
import { ObjectUtils } from '@deriv-com/utils';
import initData from './remote_config.json';

const remoteConfigQuery = async function () {
    const isProductionOrStaging = process.env.APP_ENV === 'production' || process.env.APP_ENV === 'staging';
    const REMOTE_CONFIG_URL = process.env.REMOTE_CONFIG_URL;
    
    // Skip remote config in development or if URL is not set
    if (!isProductionOrStaging || !REMOTE_CONFIG_URL) {
        return initData;
    }
    
    if (isProductionOrStaging && REMOTE_CONFIG_URL === '') {
        throw new Error('Remote Config URL is not set!');
    }
    
    const response = await fetch(REMOTE_CONFIG_URL);
    if (!response.ok) {
        throw new Error('Remote Config Server is out of reach!');
    }
    
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
        console.warn('Remote Config returned non-JSON response, using local config');
        return initData;
    }
    
    return response.json();
};

function useRemoteConfig(enabled = false) {
    const [data, setData] = useState(initData);

    useEffect(() => {
        enabled &&
            remoteConfigQuery()
                .then(async res => {
                    const resHash = await ObjectUtils.hashObject(res);
                    const dataHash = await ObjectUtils.hashObject(data);
                    if (resHash !== dataHash) {
                        setData(res);
                    }
                })
                .catch(error => {
                    // Only log errors in production/staging
                    const isProductionOrStaging = process.env.APP_ENV === 'production' || process.env.APP_ENV === 'staging';
                    if (isProductionOrStaging) {
                        console.error('Remote Config error: ', error);
                    }
                    // Fallback to local config
                    setData(initData);
                });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled]);

    return { data };
}

export default useRemoteConfig;
