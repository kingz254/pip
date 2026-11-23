export const LOADER_STYLES = [
    'dots-15','dots-14','bars-20','dots-bars-4','dots-bars-6','spinner-30','progress-5','progress-19',
    'wobbling-12','wobbling-20','wavy-12','wavy-15','squishy-1','squishy-9','rolling-8','pulsing-10',
    'pulsing-8','arcade-4','arcade-5','nature-4','nature-12','time-5','hungry-1','shuriken-9','shuriken-10',
    'eyes-6','eyes-7','cut-9','cut-8','arrow-8','arrow-7','blob-12','blob-14','blob-19','factory-7','factory-8',
] as const;

export function normalizeLoaderStyle(style?: string | null) {
    return LOADER_STYLES.includes(style as typeof LOADER_STYLES[number]) ? style! : 'spinner-30';
}

export function loaderFamily(style?: string | null) {
    return normalizeLoaderStyle(style).replace(/-\d+$/, '');
}
