import { useEffect, useRef, useState } from 'react';
import { api_base } from '@/external/bot-skeleton';
import { useApiBase } from '@/hooks/useApiBase';
import { getSelectedAccount, getSessionGeneration } from '../pipforge/session';
import StandaloneChart from './chart/standalone-chart';

export default function DTrader() {
    const { connectionStatus, isAuthorized } = useApiBase();
    const [symbol, setSymbol] = useState('R_100');
    const [markets, setMarkets] = useState<any[]>([]);
    const [contracts, setContracts] = useState<any[]>([]);
    const [type, setType] = useState('CALL');
    const [amount, setAmount] = useState(1);
    const [duration, setDuration] = useState(5);
    const [unit, setUnit] = useState('t');
    const [barrier, setBarrier] = useState('5');
    const [status, setStatus] = useState('');
    const [busy, setBusy] = useState(false);
    const pending = useRef(false);
    useEffect(() => {
        let cancelled = false;
        void api_base.api?.send({ active_symbols: 'brief' }).then(data => { if (!cancelled) setMarkets(data.active_symbols || []); }).catch(() => setStatus('Markets unavailable.'));
        return () => { cancelled = true; };
    }, [connectionStatus]);
    useEffect(() => {
        let cancelled = false; setContracts([]);
        void api_base.api?.send({ contracts_for: symbol }).then(data => {
            if (cancelled) return;
            const list = data.contracts_for?.available || [];
            setContracts(list);
            if (!list.some(c => c.contract_type === type)) setType(list[0]?.contract_type || '');
        }).catch(() => setStatus('Contracts unavailable for this market.'));
        return () => { cancelled = true; };
    }, [symbol, connectionStatus]);
    const buy = async () => {
        if (pending.current || !isAuthorized) return;
        pending.current = true; setBusy(true); setStatus('Getting your quote…');
        const generation = getSessionGeneration();
        try {
            const account = getSelectedAccount();
            if (!account) throw new Error('Connect your account.');
            const result = await api_base.api!.send({ buy: '1', price: amount, parameters: {
                underlying_symbol: symbol, currency: account.currency, contract_type: type, amount, basis: 'stake',
                duration, duration_unit: unit, ...(['DIGITMATCH','DIGITDIFF','DIGITOVER','DIGITUNDER','HIGHER','LOWER','ONETOUCH','NOTOUCH'].includes(type) ? { barrier } : {}),
                ...(type === 'ACCU' ? { growth_rate: 0.01 } : {}),
            } });
            if (generation === getSessionGeneration()) setStatus(`Purchased contract ${result.buy.contract_id}. Check Portfolio for its status.`);
        } catch (error) { setStatus(error instanceof Error ? error.message : 'Purchase failed. Check Portfolio before retrying.'); }
        finally { pending.current = false; setBusy(false); }
    };
    return <section style={{ display: 'grid', gap: 16, padding: 16, minHeight: '100%', color: 'var(--text-general)' }}>
        <div style={{ minHeight: 360 }}><StandaloneChart /></div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end' }}>
            <label>Market <select value={symbol} onChange={e => setSymbol(e.target.value)}>{markets.map(m => <option key={m.symbol} value={m.symbol}>{m.display_name}</option>)}</select></label>
            <label>Contract <select value={type} onChange={e => setType(e.target.value)}>{[...new Set(contracts.map(c => c.contract_type))].map(c => <option key={c} value={c}>{c}</option>)}</select></label>
            <label>Stake <input type='number' min='0.01' step='0.01' value={amount} onChange={e => setAmount(Number(e.target.value))} /></label>
            <label>Duration <input type='number' min='1' value={duration} onChange={e => setDuration(Number(e.target.value))} /></label>
            <label>Unit <select value={unit} onChange={e => setUnit(e.target.value)}><option value='t'>Ticks</option><option value='s'>Seconds</option><option value='m'>Minutes</option><option value='h'>Hours</option><option value='d'>Days</option></select></label>
            <label>Barrier / digit <input value={barrier} onChange={e => setBarrier(e.target.value)} /></label>
            <button disabled={busy || !isAuthorized || !contracts.length} onClick={() => { void buy(); }}>{busy ? 'Purchasing…' : 'Buy'}</button>
            {!isAuthorized && <a href='/api/deriv/login'>Connect Deriv</a>}
        </div><p role='status'>{status}</p>
    </section>;
}
