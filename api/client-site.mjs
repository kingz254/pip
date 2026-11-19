import { resolveSiteAuth } from '../scripts/site-auth-config.mjs';

const publicFields = [
  'domain', 'name', 'logo_data', 'loader_style', 'template', 'background', 'blur', 'header',
  'font_theme', 'announcement', 'icon_shape', 'icon_place', 'social', 'menu', 'deriv_app_id', 'referral_url',
];

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Vary', 'Host');
  if (req.method !== 'GET') { res.statusCode = 405; res.end('Method not allowed'); return; }
  try {
    const config = await resolveSiteAuth(req.headers.host);
    if (!config?.site) { res.statusCode = 404; res.end('No live client site is connected to this domain.'); return; }
    const site = Object.fromEntries(publicFields.filter(key => key in config.site).map(key => [key, config.site[key]]));
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(site));
  } catch {
    res.statusCode = 503;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end('{"error":"Client site settings are temporarily unavailable."}');
  }
}
