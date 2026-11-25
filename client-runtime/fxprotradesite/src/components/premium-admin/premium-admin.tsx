import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useStore } from '@/hooks/useStore';
import { DBOT_TABS } from '@/constants/bot-contents';
import { api_base } from '@/external/bot-skeleton';
import { getSelectedAccount } from '@/pipforge/session';
import './premium-admin.scss';

type Bot = { id: string; name: string; execution_ready: boolean };
type Grant = { bot_id: string; bot_name: string; account_id: string; granted_at: string; revoked_at: string | null };
type Workspace = {
    site: { name: string; domain: string };
    visits: { day: string; views: number }[];
    bots: Bot[];
    grants: Grant[];
    copy_ready: boolean;
    copy_leader: { account_id: string; enabled: boolean; updated_at: string } | null;
    contacts: { telegram_url: string; whatsapp_number: string };
    markup: { app_markup_usd?: number; volume_usd?: number; payout_usd?: number; contract_count?: number; client_count?: number } | null;
    markup_available: boolean;
};

const money = (value: unknown) => Number.isFinite(Number(value)) ? Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : 'Not reported';

export default function PremiumAdmin() {
    const { dashboard } = useStore();
    const [period, setPeriod] = useState(7);
    const [data, setData] = useState<Workspace | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [accountId, setAccountId] = useState('');
    const [botId, setBotId] = useState('');
    const [busy, setBusy] = useState(false);
    const [leaderBusy, setLeaderBusy] = useState(false);
    const [leaderNotice, setLeaderNotice] = useState('');
    const [relayGeneration, setRelayGeneration] = useState(0);
    const [notice, setNotice] = useState('');

    async function load() {
        setLoading(true);
        setError('');
        const dateTo = new Date();
        const dateFrom = new Date(dateTo);
        dateFrom.setUTCDate(dateFrom.getUTCDate() - (period - 1));
        const params = new URLSearchParams({ date_from: dateFrom.toISOString().slice(0, 10), date_to: dateTo.toISOString().slice(0, 10) });
        try {
            const response = await fetch('/api/deriv/premium-admin?' + params, { credentials: 'same-origin', cache: 'no-store' });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Premium workspace could not load.');
            setData(result);
            setBotId(current => current || result.bots.find((bot: Bot) => bot.execution_ready)?.id || '');
        } catch (cause) {
            setData(null);
            setError((cause as Error).message);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { void load(); }, [period]);

    async function setLeader(enabled: boolean) {
        const account = getSelectedAccount();
        const accountId = enabled ? account?.account_id : data?.copy_leader?.account_id || account?.account_id;
        if (!accountId || leaderBusy) { setLeaderNotice('Connect and select your Deriv leader account first.'); return; }
        if (enabled && !window.confirm(`Use ${accountId} as the one leader account for ${data?.site.domain}? Followers must opt in and set their own limits.`)) return;
        setLeaderBusy(true);
        setLeaderNotice('');
        try {
            await api_base.init();
            const response = await fetch('/api/deriv/premium-admin/copy-leader', {
                method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ account_id: accountId, enabled }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Leader account could not be saved.');
            setLeaderNotice(enabled ? `Leader stream ready for ${accountId}. Keep this workspace open while copying.` : 'Leader stream stopped.');
            setRelayGeneration(value => value + 1);
            await load();
        } catch (cause) { setLeaderNotice((cause as Error).message); }
        finally { setLeaderBusy(false); }
    }

    useEffect(() => {
        const leaderId = data?.copy_leader?.enabled ? data.copy_leader.account_id : '';
        if (!leaderId || getSelectedAccount()?.account_id !== leaderId || !api_base.api?.onMessage) return;
        const pendingBuys = new Set<number>();
        const openContracts = new Map<number, Record<string, unknown>>();
        const subscription = api_base.api.onMessage().subscribe(({ data: raw }: { data: unknown }) => {
            const message = raw as { transaction?: { action?: string; contract_id?: number }; proposal_open_contract?: Record<string, unknown> };
            const transactionId = Number(message.transaction?.contract_id);
            if (message.transaction?.action === 'buy' && Number.isSafeInteger(transactionId)) {
                pendingBuys.add(transactionId);
                if (pendingBuys.size > 1000) pendingBuys.delete(pendingBuys.values().next().value!);
            }
            const contract = message.proposal_open_contract;
            const contractId = Number(contract?.contract_id);
            if (contract && Number.isSafeInteger(contractId)) openContracts.set(contractId, contract);
            for (const id of pendingBuys) {
                const source = openContracts.get(id);
                if (!source) continue;
                pendingBuys.delete(id);
                openContracts.delete(id);
                const longcode = String(source.longcode || '');
                const durationMatch = longcode.match(/\b(\d+)\s+(seconds?|minutes?|hours?|days?)\s+after contract start time\.?$/i);
                if (!durationMatch) continue;
                const duration = Number(durationMatch[1]);
                const unitName = durationMatch[2].toLowerCase().replace(/s$/, '');
                const durationUnit = ({ second: 's', minute: 'm', hour: 'h', day: 'd' } as const)[unitName as 'second' | 'minute' | 'hour' | 'day'];
                if (!durationUnit || !Number.isInteger(duration) || duration < 1) continue;
                const seconds = duration * ({ s: 1, m: 60, h: 3600, d: 86400 } as const)[durationUnit];
                if (seconds > 86400) continue;
                const parameters = {
                    contract_type: source.contract_type,
                    currency: source.currency,
                    underlying_symbol: source.underlying_symbol,
                    duration,
                    duration_unit: durationUnit,
                    ...(source.barrier ? { barrier: String(source.barrier) } : {}),
                    ...(source.high_barrier ? { barrier: String(source.high_barrier) } : {}),
                    ...(source.low_barrier ? { barrier2: String(source.low_barrier) } : {}),
                };
                void fetch('/api/deriv/premium-admin/copy-signals', {
                    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ account_id: leaderId, source_contract_id: id, parameters }),
                }).then(async response => {
                    if (!response.ok) {
                        const result = await response.json();
                        setLeaderNotice(result.error || 'A leader trade could not be shared.');
                    }
                }).catch(() => setLeaderNotice('A leader trade could not be shared. Check your connection.'));
            }
        });
        setLeaderNotice('Leader stream is listening on this Deriv session. Eligible fixed-time trades are shared for 30 seconds.');
        const handleAccountChange = () => {
            if (getSelectedAccount()?.account_id !== leaderId) setLeaderNotice(`Select leader account ${leaderId} again to resume publishing.`);
            setRelayGeneration(value => value + 1);
        };
        window.addEventListener('pf:account-changed', handleAccountChange);
        return () => {
            subscription.unsubscribe();
            window.removeEventListener('pf:account-changed', handleAccountChange);
        };
    }, [data?.copy_leader?.account_id, data?.copy_leader?.enabled, relayGeneration]);

    const activeGrants = useMemo(() => data?.grants.filter(grant => !grant.revoked_at) || [], [data]);
    const visitCount = useMemo(() => (data?.visits || []).filter(row => {
        const age = (Date.now() - new Date(`${row.day}T00:00:00Z`).getTime()) / 86400000;
        return age < period;
    }).reduce((sum, row) => sum + Number(row.views || 0), 0), [data, period]);

    async function changeAccess(event: FormEvent, grant?: Grant) {
        event.preventDefault();
        const target = grant || { account_id: accountId.trim(), bot_id: botId };
        if (!target.account_id || !target.bot_id || busy) return;
        if (!grant && !window.confirm(`Grant ${data?.bots.find(bot => bot.id === target.bot_id)?.name || 'this bot'} to Deriv account ${target.account_id}?`)) return;
        setBusy(true);
        setNotice('');
        try {
            const response = await fetch('/api/deriv/premium-admin/grants', {
                method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bot_id: target.bot_id, account_id: target.account_id, enabled: !grant }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Bot access could not be updated.');
            setAccountId('');
            setNotice(grant ? 'Access revoked.' : 'Bot access granted.');
            await load();
        } catch (cause) { setNotice((cause as Error).message); }
        finally { setBusy(false); }
    }

    const whatsapp = data?.contacts.whatsapp_number ? `https://wa.me/${data.contacts.whatsapp_number}` : '';
    const availableBots = data?.bots.filter(bot => bot.execution_ready) || [];

    return <main className='pf-premium-admin' aria-labelledby='pfpa-title'>
        <header className='pfpa-header'>
            <div><h1 id='pfpa-title'>Premium Admin</h1><p className='pfpa-lede'>{data?.site.domain ? `${data.site.name} · ${data.site.domain}` : 'Your trading site, its access and its operating signals in one place.'}</p></div>
            <button className='pfpa-button pfpa-button--quiet' type='button' onClick={() => void load()} disabled={loading}>Refresh</button>
        </header>

        {error && <section className='pfpa-state' role='alert'><strong>{error}</strong><p>Connect the Deriv account that owns this site’s application, then refresh. Buyer accounts cannot open owner controls.</p><a className='pfpa-button pfpa-button--primary' href={`/api/deriv/login?return=${encodeURIComponent('/?tab=id-premium-admin')}`}>Connect owner account</a></section>}
        {loading && !data && <div className='pfpa-loading' role='status'><span />Loading Premium workspace…</div>}

        {data && <>
            <section className='pfpa-welcome'>
                <div><span className='pfpa-mark' aria-hidden='true'><svg viewBox='0 0 24 24' width='22' height='22' fill='none' stroke='currentColor' strokeWidth='1.6'><path d='m4 7 4 4 4-6 4 6 4-4-2 11H6L4 7Z'/><path d='M7 21h10'/></svg></span><div><h2>Welcome to your Premium workspace</h2><p>Premium tools are available for this site. Buyer access remains under your control.</p></div></div>
                <button type='button' className='pfpa-button pfpa-button--primary' onClick={() => dashboard.setActiveTab(DBOT_TABS.PREMIUM_BOTS)}>Explore Premium bots <span aria-hidden='true'>↗</span></button>
            </section>

            <section className='pfpa-readings' aria-label='Site readings'>
                <article className='pfpa-reading'><div><h2>Site visits</h2><span className='pfpa-unit'>views · {period} days</span></div><strong className='pfpa-number'>{visitCount.toLocaleString()}</strong><p>Daily totals from Pipforge’s site visit counter.</p></article>
                <article className='pfpa-reading'><div><h2>Markup earnings</h2><span className='pfpa-unit'>USD · {period} days</span></div><strong className='pfpa-number'>{data.markup_available ? `$${money(data.markup?.app_markup_usd)}` : 'Unavailable'}</strong><p>{data.markup_available ? 'Latest range summary from Deriv.' : 'Connect the Deriv app owner account with markup reporting enabled.'}</p></article>
                <div className='pfpa-period' role='group' aria-label='Reporting period'>{[7, 30].map(days => <button key={days} type='button' aria-pressed={period === days} onClick={() => setPeriod(days)}>{days} days</button>)}</div>
            </section>

            <div className='pfpa-columns'>
                <section className='pfpa-panel pfpa-access' aria-labelledby='pfpa-access-title'>
                    <div className='pfpa-panel-head'><h2 id='pfpa-access-title'>Buyer access</h2><span className='pfpa-count'>{activeGrants.length} active grants</span></div>
                    <p className='pfpa-copy'>Grant approved Premium bots using the buyer’s Deriv account ID. You can revoke access at any time.</p>
                    {availableBots.length ? <form className='pfpa-grant-form' onSubmit={event => void changeAccess(event)}>
                        <label>Approved bot<select value={botId} onChange={event => setBotId(event.target.value)} required>{availableBots.map(bot => <option value={bot.id} key={bot.id}>{bot.name}</option>)}</select></label>
                        <label>Buyer’s Deriv account ID<input value={accountId} onChange={event => setAccountId(event.target.value)} pattern='[A-Za-z0-9_-]{3,64}' placeholder='e.g. CR123456' required /></label>
                        <button className='pfpa-button pfpa-button--primary' type='submit' disabled={busy}>{busy ? 'Saving…' : 'Grant access'}</button>
                    </form> : <p className='pfpa-empty'>Premium bots are still in compatibility review. The library will appear here once a bot is approved for delivery.</p>}
                    {notice && <p role='status' className='pfpa-notice'>{notice}</p>}
                    <div className='pfpa-table-wrap'><table><thead><tr><th>Buyer account</th><th>Bot</th><th>Status</th><th><span className='pfpa-visually-hidden'>Action</span></th></tr></thead><tbody>
                        {data.grants.map(grant => <tr key={`${grant.bot_id}:${grant.account_id}`}><td className='pfpa-measured'>{grant.account_id}</td><td>{grant.bot_name}</td><td><span className={`pfpa-status${grant.revoked_at ? ' pfpa-status--off' : ''}`}>{grant.revoked_at ? 'Revoked' : 'Active'}</span></td><td>{!grant.revoked_at && <button className='pfpa-text-button' type='button' disabled={busy} onClick={event => void changeAccess(event, grant)}>Revoke</button>}</td></tr>)}
                        {!data.grants.length && <tr><td colSpan={4} className='pfpa-empty-cell'>No buyer grants yet.</td></tr>}
                    </tbody></table></div>
                </section>

                <aside className='pfpa-side'>
                    <section className='pfpa-panel pfpa-copytrade'>
                        <div className='pfpa-panel-head'><h2>One leader account</h2><span className={`pfpa-status${data.copy_leader?.enabled ? '' : ' pfpa-status--pending'}`}>{data.copy_leader?.enabled ? 'Leader selected' : 'Setup required'}</span></div>
                        <p className='pfpa-copy'>{!data.copy_ready ? 'Copy trading needs the latest Pipforge Supabase migration before setup can be enabled.' : data.copy_leader?.enabled ? `Leader account ${data.copy_leader.account_id} is assigned to this site.` : 'Choose one owner-controlled Deriv account as the source for this site.'} Followers connect their own accounts, opt in and set stake and daily-loss limits.</p>
                        <ol className='pfpa-steps'><li><span>01</span><div><strong>Leader</strong><p>One owner-controlled source account per site.</p></div></li><li><span>02</span><div><strong>Follower consent</strong><p>Each follower chooses their account and risk cap.</p></div></li><li><span>03</span><div><strong>Protected execution</strong><p>Stop controls, duplicate protection and trade limits.</p></div></li></ol>
                        <div className='pfpa-copy-actions'><button className='pfpa-button pfpa-button--primary' type='button' onClick={() => void setLeader(true)} disabled={leaderBusy || !data.copy_ready}>{leaderBusy ? 'Saving…' : data.copy_leader?.enabled ? 'Reconnect leader stream' : 'Use selected account as leader'}</button>{data.copy_leader?.enabled && <button className='pfpa-button pfpa-button--quiet' type='button' onClick={() => void setLeader(false)} disabled={leaderBusy || !data.copy_ready}>Stop leader</button>}</div>
                        {leaderNotice && <p className='pfpa-notice' role='status'>{leaderNotice}</p>}
                        <p className='pfpa-hold'><strong>Keep both tabs open.</strong> The leader workspace publishes supported fixed-time trades for 30 seconds. Followers only mirror while their opted-in Premium Bots tab is open. Tick contracts and unsupported contract types are skipped.</p>
                        <a href='https://developers.deriv.com/llms/transaction.md' target='_blank' rel='noreferrer'>Review Deriv transaction stream documentation <span aria-hidden='true'>↗</span></a>
                    </section>
                    <section className='pfpa-panel pfpa-support'><h2>Need a hand?</h2><p>Get help with buyer access, your domain or Premium setup.</p><div className='pfpa-support-actions'>{whatsapp && <a className='pfpa-button pfpa-button--quiet' href={whatsapp} target='_blank' rel='noreferrer'>WhatsApp</a>}{data.contacts.telegram_url && <a className='pfpa-button pfpa-button--quiet' href={data.contacts.telegram_url} target='_blank' rel='noreferrer'>Telegram</a>}{!whatsapp && !data.contacts.telegram_url && <span className='pfpa-empty'>Support contact details will appear here.</span>}</div></section>
                </aside>
            </div>

            <section className='pfpa-panel pfpa-benefits'><h2>More control for your trading site</h2><div className='pfpa-benefit-list'><article><strong>Premium bot library</strong><p>Use approved strategies on eligible buyer accounts. Each bot is reviewed before it can be delivered.</p></article><article><strong>Buyer access controls</strong><p>Grant and revoke bot access by Deriv account ID, with a clear record of each access state.</p></article><article><strong>Markup reporting</strong><p>View Deriv’s latest application markup summary for the selected reporting period.</p></article><article><strong>Site visit totals</strong><p>Review the daily page-view totals recorded for your live domain.</p></article></div></section>
            <footer className='pfpa-footer'>Pipforge Premium · Trading carries financial risk. Use demo accounts while configuring new strategies.</footer>
        </>}
    </main>;
}
