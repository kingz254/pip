import { useEffect, useRef, useState } from 'react';
import { api_base } from '@/external/bot-skeleton';
import { getSelectedAccount, type TradingAccount } from '@/pipforge/session';
import './premium-copy.scss';

type CopyConfig = { enabled: boolean; stake_cap: number; daily_loss_cap: number };
type Signal = { id: number; parameters: { contract_type: string; currency: string; underlying_symbol: string; duration: number; duration_unit: 's' | 'm' | 'h' | 'd'; barrier?: string; barrier2?: string } };

async function saveCopy(accountId: string, payload: Record<string, unknown>) {
    const response = await fetch('/api/deriv/premium-copy', {
        method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account_id: accountId, ...payload }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Copy trading settings could not be saved.');
    return result;
}

export default function PremiumCopy() {
    const [account, setAccount] = useState<TradingAccount | null>(null);
    const [config, setConfig] = useState<CopyConfig | null>(null);
    const [leaderConnected, setLeaderConnected] = useState(false);
    const [stakeCap, setStakeCap] = useState('1');
    const [dailyLossCap, setDailyLossCap] = useState('5');
    const [consent, setConsent] = useState(false);
    const [running, setRunning] = useState(false);
    const [message, setMessage] = useState('Connect a Deriv account to set up copy trading.');
    const copiedContracts = useRef(new Set<number>());
    const processing = useRef(new Set<number>());
    const polling = useRef(false);

    async function refreshAccount() {
        const selected = getSelectedAccount();
        setAccount(selected);
        setConfig(null);
        setRunning(false);
        if (!selected) return;
        try {
            const response = await fetch('/api/deriv/premium-copy?account_id=' + encodeURIComponent(selected.account_id), { credentials: 'same-origin', cache: 'no-store' });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Copy trading settings are unavailable.');
            setConfig(result.config);
            setLeaderConnected(result.leader_connected);
            if (result.config) {
                setStakeCap(String(result.config.stake_cap));
                setDailyLossCap(String(result.config.daily_loss_cap));
            }
            setMessage(result.config?.enabled ? 'Saved limits found. Tick the consent box and select Start copying to resume this browser session.' : result.leader_connected ? 'Leader account is configured. The site owner must keep that account connected on the Copy Trading tab to publish signals. Tick the consent box and select Start copying to follow.' : 'The site owner has not selected a leader account yet.');
        } catch (error) { setMessage((error as Error).message); }
    }

    useEffect(() => {
        void refreshAccount();
        window.addEventListener('pf:account-changed', refreshAccount);
        return () => window.removeEventListener('pf:account-changed', refreshAccount);
    }, []);

    async function start() {
        if (!account || !leaderConnected || running) return;
        if (!consent) { setMessage('Tick the consent box before starting copy trading.'); return; }
        const stake = Number(stakeCap), daily = Number(dailyLossCap);
        if (!Number.isFinite(stake) || stake <= 0 || stake > 1000 || !Number.isFinite(daily) || daily <= 0 || daily > 10000) {
            setMessage('Enter a positive stake cap and daily loss limit.'); return;
        }
        try {
            await api_base.init();
            if (getSelectedAccount()?.account_id !== account.account_id) throw new Error('Your selected Deriv account changed. Refresh and opt in again.');
            await saveCopy(account.account_id, { enabled: true, stake_cap: stake, daily_loss_cap: daily, consent: true });
            setConfig({ enabled: true, stake_cap: stake, daily_loss_cap: daily });
            setRunning(true);
            setMessage(`Copying supported fixed-time trades into ${account.account_id}, up to ${stake} ${account.currency} each. Keep this tab open.`);
        } catch (error) { setMessage((error as Error).message); }
    }

    async function stop() {
        if (!account) return;
        setRunning(false);
        try {
            await saveCopy(account.account_id, { enabled: false });
            setConfig(current => current ? { ...current, enabled: false } : current);
            setMessage('Copying stopped for this Deriv account.');
        } catch (error) { setMessage((error as Error).message); }
    }

    useEffect(() => {
        if (!running || !account) return;
        const activeAccount = account;
        let active = true;
        const lossKey = `pf-copy-loss:${activeAccount.account_id}:${new Date().toISOString().slice(0, 10)}`;
        let realizedLoss = Number(localStorage.getItem(lossKey) || 0);
        const maxLoss = Number(dailyLossCap);
        const messageSubscription = api_base.api?.onMessage().subscribe(({ data: raw }: { data: unknown }) => {
            const message = raw as { proposal_open_contract?: Record<string, unknown> };
            const poc = message.proposal_open_contract;
            const contractId = Number(poc?.contract_id);
            if (!poc || !Number.isSafeInteger(contractId) || !copiedContracts.current.has(contractId) || !['won', 'lost', 'sold'].includes(String(poc.status))) return;
            const profit = Number(poc.profit);
            if (!Number.isFinite(profit)) return;
            if (profit < 0) realizedLoss += Math.abs(profit);
            localStorage.setItem(lossKey, String(realizedLoss));
            copiedContracts.current.delete(contractId);
            if (realizedLoss >= maxLoss) {
                setMessage(`Daily loss limit reached (${realizedLoss.toFixed(2)} ${activeAccount.currency}). Copying stopped.`);
                void stop();
            }
        });

        async function poll() {
            if (!active || polling.current || !api_base.api || api_base.api.connection.readyState !== 1) return;
            polling.current = true;
            try {
                const feed = await fetch('/api/deriv/premium-copy/events?account_id=' + encodeURIComponent(activeAccount.account_id), { credentials: 'same-origin', cache: 'no-store' });
                const result = await feed.json();
                if (!feed.ok) throw new Error(result.error || 'Copy signal feed is unavailable.');
                for (const signal of (result.data || []) as Signal[]) {
                    if (!active || getSelectedAccount()?.account_id !== activeAccount.account_id || processing.current.has(signal.id)) continue;
                    processing.current.add(signal.id);
                    try {
                        const claimResponse = await fetch('/api/deriv/premium-copy/claim', {
                            method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ account_id: activeAccount.account_id, signal_id: signal.id }),
                        });
                        const claim = await claimResponse.json();
                        if (!claimResponse.ok || !claim.claimed || !active) continue;
                        if (realizedLoss >= maxLoss) { setMessage('Daily loss limit reached. Copying stopped.'); void stop(); return; }
                        const params = signal.parameters;
                        const request: Record<string, unknown> = {
                            proposal: 1, amount: Number(stakeCap), basis: 'stake', contract_type: params.contract_type,
                            currency: activeAccount.currency, underlying_symbol: params.underlying_symbol,
                            duration: params.duration, duration_unit: params.duration_unit,
                        };
                        if (params.barrier) request.barrier = params.barrier;
                        if (params.barrier2) request.barrier2 = params.barrier2;
                        const quote = await api_base.api.send(request) as { error?: { message?: string }; proposal?: { id?: string; ask_price?: string | number } };
                        const price = Number(quote.proposal?.ask_price);
                        if (quote.error || !quote.proposal?.id || !Number.isFinite(price) || price <= 0 || price > Number(stakeCap)) {
                            setMessage(quote.error?.message || 'The copied contract quote exceeded your stake cap. Signal skipped.'); continue;
                        }
                        if (!active || getSelectedAccount()?.account_id !== activeAccount.account_id) return;
                        const bought = await api_base.api.send({ buy: quote.proposal.id, price }) as { error?: { message?: string }; buy?: { contract_id?: number } };
                        if (bought.error || !Number.isSafeInteger(bought.buy?.contract_id)) {
                            setMessage(bought.error?.message || 'Deriv did not confirm the copied trade. It will not be retried.'); continue;
                        }
                        copiedContracts.current.add(bought.buy!.contract_id!);
                        setMessage(`Copied ${params.contract_type} on ${params.underlying_symbol} into ${activeAccount.account_id}.`);
                    } catch (error) { if (active) setMessage((error as Error).message); }
                    finally { processing.current.delete(signal.id); }
                }
            } catch (error) { if (active) setMessage((error as Error).message); }
            finally { polling.current = false; }
        }
        void poll();
        const timer = window.setInterval(() => void poll(), 5000);
        return () => { active = false; window.clearInterval(timer); messageSubscription?.unsubscribe(); };
    }, [running, account?.account_id, stakeCap, dailyLossCap]);

    return <section className='pf-copy-follower' aria-labelledby='pf-copy-title'>
        <div className='pf-copy-follower__head'><div><h2 id='pf-copy-title'>Follow this site’s leader</h2></div><span className={`pf-copy-follower__state${running ? ' is-live' : ''}`}>{running ? 'Copying' : 'Stopped'}</span></div>
        <p>Use your own Deriv account. Supported fixed-time contracts are quoted again on your account and bought at your stake cap.</p>
        <div className='pf-copy-follower__limits'>
            <label>Maximum stake per trade ({account?.currency || 'USD'})<input type='number' min='0.35' max='1000' step='0.01' value={stakeCap} onChange={event => setStakeCap(event.target.value)} disabled={running} /></label>
            <label>Daily loss stop on this device ({account?.currency || 'USD'})<input type='number' min='0.35' max='10000' step='0.01' value={dailyLossCap} onChange={event => setDailyLossCap(event.target.value)} disabled={running} /></label>
        </div>
        {!running && <label className='pf-copy-follower__consent'><input type='checkbox' checked={consent} onChange={event => setConsent(event.target.checked)} /><span className='pf-copy-follower__check' aria-hidden='true' /><span>I understand trades can lose money, will stay in my control and will stop when I close this tab.</span></label>}
        <div className='pf-copy-follower__actions'>{running ? <button type='button' onClick={() => void stop()}>Stop copying</button> : <button type='button' onClick={() => void start()} disabled={!account || !leaderConnected}>Start copying</button>}{!running && <button type='button' className='is-secondary' onClick={() => void refreshAccount()}>Refresh</button>}</div>
        <p className='pf-copy-follower__message' role='status'>{!account ? 'Connect a Deriv account first.' : !leaderConnected ? 'The site owner has not selected a leader account yet.' : message}</p>
        {config?.enabled && !running && <p className='pf-copy-follower__note'>Saved limits found. Copying starts only after you opt in again in this browser session.</p>}
        <p className='pf-copy-follower__note'>The daily stop counts mirrored contracts settled while this device is connected. It is not a whole-account loss limit. Copying can lose money; use a demo account first.</p>
    </section>;
}
