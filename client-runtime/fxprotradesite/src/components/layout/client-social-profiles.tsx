import { useClientBranding } from '../../pipforge/site-branding';
import './client-social-profiles.scss';

const glyphs: Record<string, string> = {
    wa: '<path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3z"/><path d="M9 8.5c.5 3 2.5 5 5.5 5.5"/>',
    tg: '<path d="M21 4 3 11l6 2 2 6 3-4 5 3z"/><path d="m9 13 12-9"/>',
    ig: '<rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.6"/><circle cx="17" cy="7" r=".8"/>',
    tt: '<path d="M14 4v10.5a3.5 3.5 0 1 1-3.5-3.5M14 4c.5 2.5 2 4 4.5 4.2"/>',
    yt: '<rect x="3" y="6" width="18" height="12" rx="4"/><path d="M10 9.5v5l4.5-2.5z"/>',
    x: '<path d="M5 5l14 14M19 5 5 19"/>',
    fb: '<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8.5c0-.3.2-.5.5-.5z"/>',
    in: '<rect x="4" y="9" width="3.5" height="11"/><circle cx="5.7" cy="5.3" r="1.8"/><path d="M10.5 9h3.3v1.6c.6-1 1.8-1.8 3.4-1.8 3 0 3.8 2 3.8 4.6V20h-3.5v-5.4c0-1.3-.3-2.3-1.7-2.3s-1.8 1-1.8 2.3V20h-3.5z"/>',
    dc: '<path d="M6 7c2-1.3 3.8-1.8 6-1.8s4 .5 6 1.8c1.6 3 2.4 6 2.2 10-1.6 1.2-3.2 1.8-4.8 2l-1-2c-1.5.4-3.4.4-5 0l-1 2c-1.6-.2-3.2-.8-4.8-2-.2-4 .6-7 2.4-10z"/><circle cx="9.3" cy="12" r="1.3"/><circle cx="14.7" cy="12" r="1.3"/>',
    ml: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/>',
};

const labels: Record<string, string> = { wa: 'WhatsApp', tg: 'Telegram', ig: 'Instagram', tt: 'TikTok', yt: 'YouTube', x: 'X', fb: 'Facebook', in: 'LinkedIn', dc: 'Discord', ml: 'Email' };

function profileUrl(key: string, value: string) {
    const input = value.trim();
    if (/^https:\/\//i.test(input)) return input;
    if (key === 'ml') return `mailto:${input}`;
    const user = input.replace(/^@/, '');
    const urls: Record<string, string> = {
        wa: `https://wa.me/${user.replace(/\D/g, '')}`, tg: `https://t.me/${user}`,
        ig: `https://instagram.com/${user}`, tt: `https://tiktok.com/@${user}`,
        yt: `https://youtube.com/@${user}`, x: `https://x.com/${user}`, fb: `https://facebook.com/${user}`,
        in: `https://linkedin.com/in/${user}`, dc: `https://discord.gg/${user}`,
    };
    return urls[key];
}

const ClientSocialProfiles = ({ place }: { place: 'header' | 'footer' }) => {
    const site = useClientBranding();
    if (!site || !['both', place].includes(site.icon_place)) return null;
    const profiles = Object.entries(site.social || {}).filter(([key, value]) => key in glyphs && !!value?.trim());
    if (!profiles.length) return null;

    return <nav className={`pf-social-profiles pf-social-profiles--${place} pf-social-profiles--${site.icon_shape}`} aria-label={`${site.name} social profiles`}>
        {profiles.map(([key, value]) => {
            const href = profileUrl(key, value);
            if (!href || !/^(https:\/\/|mailto:)/i.test(href)) return null;
            return <a key={key} href={href} aria-label={labels[key]} title={labels[key]} target={href.startsWith('https://') ? '_blank' : undefined} rel={href.startsWith('https://') ? 'noopener noreferrer' : undefined}>
                <svg viewBox='0 0 24 24' aria-hidden='true' fill='none' stroke='currentColor' strokeWidth='1.7' strokeLinecap='round' strokeLinejoin='round' dangerouslySetInnerHTML={{ __html: glyphs[key] }} />
            </a>;
        })}
    </nav>;
};

export default ClientSocialProfiles;
