import { useEffect, useState } from 'react';
import { api_base } from '@/external/bot-skeleton';
import { getSelectedAccount } from '@/pipforge/session';
import PremiumCopy from './premium-copy';
import './copy-trading.scss';

type Leader = { account_id: string; enabled: boolean } | null;

export default function CopyTrading() {
    const [leader, setLeader] = useState<Leader>(null);
    const [canManageLeader, setCanManageLeader] = useState(false);
    const [leaderError, setLeaderError] = useState('');
    const [leaderNotice, setLeaderNotice] = useState('');
    const [generation, setGeneration] = useState(0);

    async function refresh() {
        try {
            const dateTo = new Date();
            const dateFrom = new Date(dateTo);
            dateFrom.setUTCDate(dateFrom.getUTCDate() - 6);
            const params = new URLSearchParams({ date_from: dateFrom.toISOString().slice(0, 10), date_to: dateTo.toISOString().slice(0, 10) });
            const response = await fetch('/api/deriv/premium-admin?' + params, { credentials: 'same-origin', cache: 'no-store' });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Leader settings are unavailable.');
            setLeader(result.copy_leader);
            setCanManageLeader(true);
            setLeaderError('');
        } catch (error) { setCanManageLeader(false); setLeaderError((error as Error).message); }
    }

    useEffect(() => { void refresh(); }, []);

    useEffect(() => {
        const leaderId = leader?.enabled ? leader.account_id : '';
        if (!leaderId || getSelectedAccount()?.account_id !== leaderId || !api_base.api?.onMessage) return;
        const pending = new Set<number>();
        const contracts = new Map<number, Record<string, unknown>>();
        const subscription = api_base.api.onMessage().subscribe(({ data: raw }: { data: unknown }) => {
            const message = raw as { transaction?: { action?: string; contract_id?: number }; proposal_open_contract?: Record<string, unknown> };
            const transactionId = Number(message.transaction?.contract_id);
            if (message.transaction?.action === 'buy' && Number.isSafeInteger(transactionId)) {
                pending.add(transactionId);
                if (pending.size > 1000) pending.delete(pending.values().next().value!);
            }
            const contract = message.proposal_open_contract;
            const contractId = Number(contract?.contract_id);
            if (contract && Number.isSafeInteger(contractId)) contracts.set(contractId, contract);
            for (const id of pending) {
                const source = contracts.get(id);
                if (!source) continue;
                pending.delete(id); contracts.delete(id);
                const match = String(source.longcode || '').match(/\b(\d+)\s+(seconds?|minutes?|hours?|days?)\s+after contract start time\.?$/i);
                if (!match) continue;
                const duration = Number(match[1]);
                const unit = match[2].toLowerCase().replace(/s$/, '');
                const durationUnit = ({ second: 's', minute: 'm', hour: 'h', day: 'd' } as const)[unit as 'second' | 'minute' | 'hour' | 'day'];
                if (!durationUnit || !Number.isInteger(duration) || duration < 1 || duration * ({ s: 1, m: 60, h: 3600, d: 86400 } as const)[durationUnit] > 86400) continue;
                const parameters = {
                    contract_type: source.contract_type, currency: source.currency, underlying_symbol: source.underlying_symbol,
                    duration, duration_unit: durationUnit,
                    ...(source.barrier ? { barrier: String(source.barrier) } : {}),
                    ...(source.high_barrier ? { barrier: String(source.high_barrier) } : {}),
                    ...(source.low_barrier ? { barrier2: String(source.low_barrier) } : {}),
                };
                void fetch('/api/deriv/premium-admin/copy-signals', {
                    method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ account_id: leaderId, source_contract_id: id, parameters }),
                }).then(async response => {
                    if (!response.ok) setLeaderNotice((await response.json()).error || 'A leader trade could not be shared.');
                }).catch(() => setLeaderNotice('A leader trade could not be shared. Check your connection.'));
            }
        });
        const accountChanged = () => {
            if (getSelectedAccount()?.account_id !== leaderId) setLeaderNotice(`Select leader account ${leaderId} again to resume publishing.`);
            setGeneration(value => value + 1);
        };
        window.addEventListener('pf:account-changed', accountChanged);
        setLeaderNotice('Leader stream is listening. Eligible fixed-time trades are shared for 30 seconds.');
        return () => { subscription.unsubscribe(); window.removeEventListener('pf:account-changed', accountChanged); };
    }, [leader?.account_id, leader?.enabled, generation]);

    return <main className='pf-copy-trading' aria-labelledby='pf-copy-trading-title'>
        <header className='pf-copy-trading__hero'><span className='pf-copy-trading__icon' aria-hidden='true'><svg viewBox='0 0 24 24' width='26' height='26' fill='none' stroke='currentColor' strokeWidth='1.8'><path d='M7 7h10l3 4-8 9-8-9 3-4Z'/><path d='M9 11h6M10 14h4M7 7l5 13 5-13'/></svg></span><div><p className='pf-copy-trading__eyebrow'>PIPFORGE PREMIUM</p><h1 id='pf-copy-trading-title'>Copy Trading</h1><p>Follow the site’s selected leader using your own Deriv account and risk limits.</p></div></header>
        {canManageLeader && <section className='pf-copy-trading__leader' aria-labelledby='pf-copy-trading-leader'>
            <div><p className='pf-copy-trading__eyebrow'>SITE LEADER</p><h2 id='pf-copy-trading-leader'>{leader?.enabled ? `Selected · ${leader.account_id}` : 'No leader selected yet'}</h2><p>{leaderError || 'Choose the leader in Pipforge Premium Admin. To publish eligible trades, connect this same Deriv account on this site and keep the Copy Trading tab open. Followers connect their own accounts and choose their own risk limits.'}</p></div>
            {leaderNotice && <p className='pf-copy-trading__notice' role='status'>{leaderNotice}</p>}
            <p className='pf-copy-trading__fineprint'>The selected account is only the trade signal source. Followers must opt in; trades use their own accounts. Fixed-time contracts of up to one day are supported. Tick contracts and unsupported types are skipped.</p>
        </section>}
        <PremiumCopy />
    </main>;
}
