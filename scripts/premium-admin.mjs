const headersFor = serviceKey => ({
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  'Content-Type': 'application/json',
});

export function createPremiumAdmin({ url, serviceKey, upstream = fetch }) {
  const headers = headersFor(serviceKey);
  async function read(table, query) {
    const response = await upstream(`${url}/rest/v1/${table}?${new URLSearchParams(query)}`, {
      headers,
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error('Premium workspace is unavailable.');
    return response.json();
  }

  async function getSite(domain) {
    const sites = await read('sites', {
      domain: `eq.${domain}`,
      status: 'eq.live',
      select: 'id,name,domain',
      limit: '1',
    });
    return sites[0] || null;
  }

  async function hasPremium(siteId) {
    const [orders, events] = await Promise.all([
      read('orders', { site_id: `eq.${siteId}`, package: 'eq.premium', status: 'eq.paid', select: 'id', limit: '1' }),
      read('site_premium_access_events', { site_id: `eq.${siteId}`, select: 'enabled', order: 'id.desc', limit: '1' }),
    ]);
    return orders.length > 0 || events[0]?.enabled === true;
  }

  async function snapshot(domain) {
    const site = await getSite(domain);
    if (!site || !(await hasPremium(site.id))) return null;
    const [visits, catalog, grants, settings] = await Promise.all([
      read('site_visits', { site_id: `eq.${site.id}`, select: 'day,views', order: 'day.desc', limit: '31' }),
      read('premium_bot_catalog', { select: 'id,name,execution_ready', order: 'id.asc' }),
      read('premium_bot_grants', { site_id: `eq.${site.id}`, select: 'bot_id,account_id,granted_at,revoked_at', order: 'granted_at.desc', limit: '250' }),
      read('package_settings', { select: 'telegram_url,whatsapp_number', limit: '1' }),
    ]);
    const names = new Map(catalog.map(bot => [bot.id, bot.name]));
    return {
      site: { name: site.name, domain: site.domain },
      visits,
      bots: catalog,
      grants: grants.map(grant => ({ ...grant, bot_name: names.get(grant.bot_id) || grant.bot_id })),
      contacts: settings[0] || { telegram_url: '', whatsapp_number: '' },
    };
  }

  async function setBotAccess(domain, { botId, accountId, enabled }) {
    const site = await getSite(domain);
    if (!site || !(await hasPremium(site.id))) return false;
    const catalog = await read('premium_bot_catalog', {
      id: `eq.${botId}`,
      ...(enabled ? { execution_ready: 'eq.true' } : {}),
      select: 'id',
      limit: '1',
    });
    if (!catalog.length) throw new Error('This bot is not approved for buyer access yet.');
    const response = await upstream(`${url}/rest/v1/rpc/set_premium_bot_access`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_site: site.id, p_bot: botId, p_account: accountId, p_enabled: enabled }),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error('Bot access could not be updated.');
    return true;
  }

  return { snapshot, setBotAccess };
}
