import React, { useEffect, useState } from 'react';
import { useStore } from '@/hooks/useStore';

export function useOwnerMarkup() {
    const { client } = useStore();
    const [allowed, setAllowed] = useState(false);
    useEffect(() => {
        let current = true;
        setAllowed(false);
        const day = new Date().toISOString().slice(0, 10);
        fetch(`/api/deriv/markup?date_from=${day}&date_to=${day}`, { credentials: 'same-origin' })
            .then(response => { if (current) setAllowed(response.ok); }).catch(() => {});
        return () => { current = false; };
    }, [client.loginid]);
    return allowed;
}

export default function OwnerMarkup() {
    const [period, setPeriod] = useState(1);
    const [data, setData] = useState<Record<string, number> | null>(null);
    const [error, setError] = useState('');
    useEffect(() => {
        const controller = new AbortController();
        setData(null); setError('');
        const to = new Date(), from = new Date(to);
        if (period === 7) from.setUTCDate(from.getUTCDate() - (from.getUTCDay() + 6) % 7);
        if (period === 30) from.setUTCDate(1);
        fetch('/api/deriv/markup?' + new URLSearchParams({ date_from: from.toISOString().slice(0,10), date_to: to.toISOString().slice(0,10) }), { signal: controller.signal })
            .then(async response => { if (!response.ok) throw new Error('Owner earnings are unavailable.'); return response.json(); })
            .then(result => setData(result.data)).catch(error => { if (!controller.signal.aborted) setError(error.message); });
        return () => controller.abort();
    }, [period]);
    return <section className='pf-owner-markup'><h2>Markup earnings</h2>
        <div className='pf-markup-periods'>{[[1,'Today'],[7,'This week'],[30,'This month']].map(([days,label]) => <button type='button' key={days} aria-pressed={period === days} onClick={() => setPeriod(Number(days))}>{label}</button>)}</div>
        {error && <p role='alert'>{error}</p>}
        {!data && !error && <p role='status'>Loading earnings…</p>}
        {data && <div className='pf-markup-cards'>{[['app_markup_usd','Total markup'],['volume_usd','Total volume'],['payout_usd','Total payout'],['contract_count','Contracts'],['client_count','Clients']].map(([key,label]) => <article key={key}><h3>{label}</h3><strong>{Number(data[key]).toFixed(key.endsWith('_usd') ? 2 : 0)}{key.endsWith('_usd') ? ' USD' : ''}</strong></article>)}</div>}
    </section>;
}
