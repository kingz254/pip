import React from 'react';
import BrandedLoader from './branded-loader';

export default function ChunkLoader({ message }: { message: string }) {
    return (
        <BrandedLoader 
            message={message || "Loading Components..."}
            subMessage="Please wait"
        />
    );
}
