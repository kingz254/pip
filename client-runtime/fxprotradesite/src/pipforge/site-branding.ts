import { useSyncExternalStore } from 'react';
import templateThemes from './template-themes.json';

export type PipforgeSiteBranding = {
    domain?: string;
    palette?: { accent: string; secondary: string; page: string; ink: string; muted: string; glass: string; edge: string; font?: string; light: boolean };
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

export function applySiteBranding(site: PipforgeSiteBranding) {
    const root = document.documentElement;
    const theme = site.palette || templateThemes[site.template as keyof typeof templateThemes] || templateThemes.midnight;
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
    root.style.setProperty('--pf-client-font', site.palette?.font || `'${family}', sans-serif`);
    root.dataset.pfAccountStyle = String(site.menu?.account_style || 'compact');
    root.dataset.pfAccountDisplay = String(site.menu?.account_display || 'switch');
    root.style.colorScheme = light ? 'light' : 'dark';
    localStorage.setItem('theme',light ? 'light' : 'dark');
    document.body?.classList.toggle('theme--dark', !light);
    document.body?.classList.toggle('theme--light', light);
    document.title = site.name;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (description) description.content = `${site.name} trading workspace`;
    let icon = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    if (!icon) { icon = document.createElement('link'); icon.rel = 'icon'; document.head.append(icon); }
    const initial = site.name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 1) || 'T';
    icon.href = site.logo_data || `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="${theme.accent}"/><text x="50%" y="54%" dominant-baseline="middle" text-anchor="middle" fill="${theme.ink}" font-family="sans-serif" font-size="30" font-weight="700">${initial}</text></svg>`)}`;
    const fontLink = document.getElementById('pf-client-font') as HTMLLinkElement || document.createElement('link');
    fontLink.id = 'pf-client-font';
    fontLink.rel = 'stylesheet';
    fontLink.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}&display=swap`;
    document.head.append(fontLink);
    window.__PF_SITE_BRANDING__ = site;
    window.dispatchEvent(new Event('pf:branding'));
    const bg = (window as any).PipforgeBackground;
    if (bg) bg.update(site.background, theme.accent, theme.secondary);
}

export function useClientBranding() {
    return useSyncExternalStore(callback => { window.addEventListener('pf:branding', callback); return () => window.removeEventListener('pf:branding', callback); }, () => window.__PF_SITE_BRANDING__);
}

export async function loadClientBranding() {
    if (window.parent !== window) {
        document.documentElement.dataset.pfEmbedded = 'true';
        return new Promise(resolve => {
            window.addEventListener('message', event => {
                if (event.origin !== location.origin || event.source !== window.parent || event.data?.type !== 'PF_RUNTIME_PROFILE') return;
                const site = event.data.profile;
                if (!site || typeof site.name !== 'string' || typeof site.template !== 'string') return;
                applySiteBranding(site);
                resolve(site);
            });
            window.parent.postMessage({ type: 'PF_RUNTIME_READY' }, location.origin);
        });
    }
    const response = await fetch('/api/client-site', { cache: 'no-store', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('This domain is not connected to a live site.');
    const site = await response.json() as PipforgeSiteBranding;
    applySiteBranding(site);
    return site;
}

window.addEventListener('theme-changed', (event: Event) => {
    const site = window.__PF_SITE_BRANDING__;
    if (!site) return;
    const light = (event as CustomEvent).detail?.theme === 'light';
    if(window.parent!==window)window.parent.postMessage({type:'PF_RUNTIME_THEME',theme:light?'light':'dark'},location.origin);
    const base = site.palette || templateThemes[site.template as keyof typeof templateThemes] || templateThemes.midnight;
    applySiteBranding({ ...site, palette: { ...base, light, page: light ? '#f3f4f6' : '#10131b', ink: light ? '#151717' : '#f4f4f6', muted: light ? '#5a606b' : '#b9bdc9', glass: light ? 'rgba(255,255,255,.7)' : 'rgba(20,25,35,.65)', edge: light ? 'rgba(20,20,30,.15)' : 'rgba(255,255,255,.2)' } });
});
