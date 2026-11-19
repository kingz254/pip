import templateThemes from './template-themes.json';

export type PipforgeSiteBranding = {
    domain: string;
    name: string;
    logo_data?: string | null;
    template: string;
    background: string;
    blur: number;
    header: string;
    font_theme: string;
    announcement?: string;
    icon_shape: string;
    icon_place: string;
    social: Record<string, string>;
    menu: Record<string, unknown>;
    loader_style: string;
};

declare global {
    interface Window { __PF_SITE_BRANDING__?: PipforgeSiteBranding }
}

const fonts: Record<string, string> = {
    inter: 'Inter', 'dm-sans': 'DM Sans', manrope: 'Manrope', 'space-grotesk': 'Space Grotesk', outfit: 'Outfit',
    'plus-jakarta': 'Plus Jakarta Sans', sora: 'Sora', urbanist: 'Urbanist', montserrat: 'Montserrat', lato: 'Lato',
    roboto: 'Roboto', 'open-sans': 'Open Sans', nunito: 'Nunito Sans', 'work-sans': 'Work Sans', rubik: 'Rubik',
    poppins: 'Poppins', raleway: 'Raleway', figtree: 'Figtree', onest: 'Onest', lexend: 'Lexend',
    'ibm-plex': 'IBM Plex Sans', 'ibm-mono': 'IBM Plex Mono', 'space-mono': 'Space Mono', jetbrains: 'JetBrains Mono',
    'roboto-mono': 'Roboto Mono', 'source-sans': 'Source Sans 3', merriweather: 'Merriweather', lora: 'Lora',
    playfair: 'Playfair Display', 'dm-serif': 'DM Serif Display', cormorant: 'Cormorant Garamond', fraunces: 'Fraunces',
    'libre-baskerville': 'Libre Baskerville', 'pt-serif': 'PT Serif', barlow: 'Barlow',
};

function applySiteBranding(site: PipforgeSiteBranding) {
    const root = document.documentElement;
    const theme = templateThemes[site.template as keyof typeof templateThemes] || templateThemes.midnight;
    const light = theme.light;
    const family = fonts[site.font_theme] || fonts.inter;
    const rgb = (hex: string) => hex.match(/[\da-f]{2}/gi)?.map(part => parseInt(part, 16)).join(' ') || '55 124 252';
    root.dataset.pfTenant = 'true';
    root.dataset.pfTemplate = site.template;
    root.dataset.pfTheme = light ? 'light' : 'dark';
    root.dataset.pfBackground = site.background;
    root.dataset.pfHeader = site.header;
    root.dataset.pfIconShape = site.icon_shape;
    root.dataset.pfIconPlace = site.icon_place;
    root.dataset.pfLoader = site.loader_style;
    root.style.setProperty('--pf-client-accent', theme.accent);
    root.style.setProperty('--pf-client-accent-rgb', rgb(theme.accent));
    root.style.setProperty('--pf-client-secondary', theme.secondary);
    root.style.setProperty('--pf-client-page', theme.page || '#10131b');
    root.style.setProperty('--pf-client-ink', theme.ink);
    root.style.setProperty('--pf-client-muted', theme.muted);
    root.style.setProperty('--pf-client-glass', theme.glass);
    root.style.setProperty('--pf-client-edge', theme.edge);
    root.style.setProperty('--pf-client-blur', `${Math.round(Math.max(0, Math.min(100, site.blur)) * 0.24)}px`);
    root.style.setProperty('--pf-client-font', `'${family}', sans-serif`);
    document.title = site.name;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (description) description.content = `${site.name} trading workspace`;
    let icon = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    if (!icon) { icon = document.createElement('link'); icon.rel = 'icon'; document.head.append(icon); }
    const initial = site.name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 1) || 'T';
    icon.href = site.logo_data || `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${theme.accent}"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="${theme.ink}" font-family="sans-serif" font-size="30" font-weight="700">${initial}</text></svg>`)}`;
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}&display=swap`;
    document.head.append(fontLink);
    window.__PF_SITE_BRANDING__ = site;
}

export async function loadClientBranding() {
    try {
        const response = await fetch('/api/client-site', { cache: 'no-store', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) });
        if (!response.ok) return null;
        const site = await response.json() as PipforgeSiteBranding;
        if (!site.domain || !site.name || !site.template || !site.font_theme) return null;
        applySiteBranding(site);
        return site;
    } catch {
        return null;
    }
}

