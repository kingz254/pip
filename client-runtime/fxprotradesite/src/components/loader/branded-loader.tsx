import { useClientBranding } from '../../pipforge/site-branding';
import './workspace-loader.scss';

type BrandedLoaderProps = { message?: string; subMessage?: string };
export default function BrandedLoader({ message = 'Loading workspace…', subMessage }: BrandedLoaderProps) {
    const brand = useClientBranding();
    return <div className='pf-workspace-loader' data-style={brand?.loader_style || 'ring'} role='status' aria-live='polite'>
        <div className='loader-overlay-inner'><span className='loader-visual' aria-hidden='true'><i /></span><span>{message}</span>{subMessage && <small>{subMessage}</small>}</div>
    </div>;
}
