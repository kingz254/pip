import { useClientBranding } from '../../pipforge/site-branding';
import { loaderFamily, normalizeLoaderStyle } from '../../pipforge/loader-styles.ts';
import './workspace-loader.scss';

type BrandedLoaderProps = { message?: string; subMessage?: string };
export default function BrandedLoader({ message = 'Loading workspace…', subMessage }: BrandedLoaderProps) {
    const brand = useClientBranding();
    const style = normalizeLoaderStyle(brand?.loader_style);
    return <div className='pf-workspace-loader' data-style={style} role='status' aria-live='polite'>
        <div className='loader-overlay-inner'><span className='loader-visual loader-glyph' data-family={loaderFamily(style)} aria-hidden='true'><i /><i /><i /></span><span>{message}</span>{subMessage && <small>{subMessage}</small>}</div>
    </div>;
}
