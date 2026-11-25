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

  async function readOptional(table, query) {
    const response = await upstream(`${url}/rest/v1/${table}?${new URLSearchParams(query)}`, {
      headers,
      signal: AbortSignal.timeout(12000),
    });
    if (response.ok) return response.json();
    if (response.status === 404) {
      const error = await response.json().catch(() => null);
      if (error?.code === 'PGRST205' || error?.code === '42P01') return null;
    }
    throw new Error('Premium workspace is unavailable.');
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
    const [visits, catalog, grants, settings, leaders] = await Promise.all([
      read('site_visits', { site_id: `eq.${site.id}`, select: 'day,views', order: 'day.desc', limit: '31' }),
      read('premium_bot_catalog', { select: 'id,name,execution_ready', order: 'id.asc' }),
      read('premium_bot_grants', { site_id: `eq.${site.id}`, select: 'bot_id,account_id,granted_at,revoked_at', order: 'granted_at.desc', limit: '250' }),
      read('package_settings', { select: 'telegram_url,whatsapp_number', limit: '1' }),
      readOptional('premium_copy_leaders', { site_id: `eq.${site.id}`, select: 'account_id,enabled,updated_at', limit: '1' }),
    ]);
    const names = new Map(catalog.map(bot => [bot.id, bot.name]));
    return {
      site: { name: site.name, domain: site.domain },
      visits,
      bots: catalog,
      grants: grants.map(grant => ({ ...grant, bot_name: names.get(grant.bot_id) || grant.bot_id })),
      contacts: settings[0] || { telegram_url: '', whatsapp_number: '' },
      copy_ready: leaders !== null,
      copy_leader: leaders?.[0] || null,
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

  async function upsert(table, query, body) {
    const response = await upstream(`${url}/rest/v1/${table}?${new URLSearchParams(query)}`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error('Copy trading settings could not be saved.');
    return response.json();
  }

  async function insertOnce(table, query, body) {
    const response = await upstream(`${url}/rest/v1/${table}?${new URLSearchParams(query)}`, {
      method: 'POST',
      headers: { ...headers, Prefer: 'resolution=ignore-duplicates,return=representation' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error('Copy trade could not be claimed.');
    return response.json();
  }

  async function setLeader(domain, accountId, enabled) {
    const site = await getSite(domain);
    if (!site || !(await hasPremium(site.id))) return false;
    const cleared = await upstream(`${url}/rest/v1/premium_copy_signals?${new URLSearchParams({ site_id: `eq.${site.id}` })}`, {
      method: 'DELETE', headers, signal: AbortSignal.timeout(12000),
    });
    if (!cleared.ok) throw new Error('Pending copy signals could not be cleared.');
    if (enabled) {
      await upsert('premium_copy_leaders', { on_conflict: 'site_id' }, { site_id: site.id, account_id: accountId, enabled: true, updated_at: new Date().toISOString() });
    } else {
      const response = await upstream(`${url}/rest/v1/premium_copy_leaders?${new URLSearchParams({ site_id: `eq.${site.id}`, account_id: `eq.${accountId}` })}`, {
        method: 'DELETE', headers, signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw new Error('Copy trading leader could not be removed.');
    }
    return true;
  }

  async function publishSignal(domain, accountId, sourceContractId, parameters) {
    const site = await getSite(domain);
    if (!site || !(await hasPremium(site.id))) return false;
    const leaders = await read('premium_copy_leaders', { site_id: `eq.${site.id}`, account_id: `eq.${accountId}`, enabled: 'eq.true', select: 'account_id', limit: '1' });
    if (!leaders.length) return false;
    const expired = await upstream(`${url}/rest/v1/premium_copy_signals?${new URLSearchParams({ site_id: `eq.${site.id}`, expires_at: `lt.${new Date().toISOString()}` })}`, {
      method: 'DELETE', headers, signal: AbortSignal.timeout(12000),
    });
    if (!expired.ok) throw new Error('Expired copy signals could not be cleared.');
    await upsert('premium_copy_signals', { on_conflict: 'site_id,source_contract_id' }, {
      site_id: site.id, leader_account_id: accountId, source_contract_id: sourceContractId, parameters,
    });
    return true;
  }

  async function follower(domain, accountId) {
    const site = await getSite(domain);
    if (!site || !(await hasPremium(site.id))) return null;
    const [followers, leaders, grants] = await Promise.all([
      read('premium_copy_followers', { site_id: `eq.${site.id}`, account_id: `eq.${accountId}`, select: 'enabled,stake_cap,daily_loss_cap,consented_at', limit: '1' }),
      read('premium_copy_leaders', { site_id: `eq.${site.id}`, enabled: 'eq.true', select: 'account_id', limit: '1' }),
      read('premium_bot_grants', { site_id: `eq.${site.id}`, account_id: `eq.${accountId}`, revoked_at: 'is.null', select: 'bot_id', limit: '1' }),
    ]);
    if (!grants.length) return null;
    return { siteId: site.id, config: followers[0] || null, leader: leaders[0] || null };
  }

  async function setFollower(domain, { accountId, enabled, stakeCap, dailyLossCap }) {
    const current = await follower(domain, accountId);
    if (!current || (enabled && !current.leader)) return false;
    if (!enabled && !current.config) return true;
    const body = {
      site_id: current.siteId,
      account_id: accountId,
      enabled,
      stake_cap: stakeCap ?? current.config?.stake_cap,
      daily_loss_cap: dailyLossCap ?? current.config?.daily_loss_cap,
      consented_at: enabled ? new Date().toISOString() : current.config?.consented_at,
      updated_at: new Date().toISOString(),
    };
    const rows = await upsert('premium_copy_followers', { on_conflict: 'site_id,account_id' }, body);
    return rows[0] || true;
  }

  async function signals(domain, accountId) {
    const current = await follower(domain, accountId);
    if (!current?.config?.enabled || !current.leader) return [];
    return read('premium_copy_signals', {
      site_id: `eq.${current.siteId}`,
      leader_account_id: `eq.${current.leader.account_id}`,
      expires_at: `gt.${new Date().toISOString()}`,
      select: 'id,parameters,created_at',
      order: 'id.asc',
      limit: '20',
    });
  }

  async function claimSignal(domain, accountId, signalId) {
    const current = await follower(domain, accountId);
    if (!current?.config?.enabled || !current.leader) return false;
    const existing = await read('premium_copy_signals', { site_id: `eq.${current.siteId}`, leader_account_id: `eq.${current.leader.account_id}`, id: `eq.${signalId}`, expires_at: `gt.${new Date().toISOString()}`, select: 'id,expires_at', limit: '1' });
    if (!existing.length) return false;
    const rows = await insertOnce('premium_copy_deliveries', { on_conflict: 'signal_id,account_id' }, { signal_id: signalId, site_id: current.siteId, account_id: accountId });
    return Array.isArray(rows) && rows.length > 0 && new Date(existing[0].expires_at).getTime() > Date.now();
  }

  return { snapshot, setBotAccess, setLeader, publishSignal, follower, setFollower, signals, claimSignal };
}
