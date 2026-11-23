import { useEffect, useState } from 'react';
import BrandedLoader from './branded-loader';
export default function LoadingFrame(props: React.IframeHTMLAttributes<HTMLIFrameElement>) {
 const [loaded,setLoaded]=useState(false);
 useEffect(()=>setLoaded(false),[props.src]);
 return <div className='pf-loading-frame'>{!loaded && <BrandedLoader />}<iframe {...props} onLoad={event=>{setLoaded(true);props.onLoad?.(event)}} /></div>;
}
