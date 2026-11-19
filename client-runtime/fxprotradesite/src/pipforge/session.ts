// Provider credentials stay in Pipforge's HttpOnly backend session.
export type TradingAccount = {
    account_id: string;
    account_type: 'demo' | 'real';
    currency: string;
    balance: string;
    status: string;
};

let accounts: TradingAccount[] = [];
let selected: TradingAccount | null = null;
let generation = 0;

async function request(path: string, method = 'GET') {
    const response = await fetch(`/api/deriv/${path}`, { method, cache: 'no-store', credentials: 'same-origin' });
    if (!response.ok) throw new Error(response.status === 401 ? 'Please sign in to Deriv again.' : 'Account service unavailable. Please try again.');
    return response.json();
}

export const getSelectedAccount = () => selected;
export const getTradingAccounts = () => accounts.slice();
export const getSessionGeneration = () => generation;

export async function restoreTradingSession() {
    const version = ++generation;
    const session = await request('session');
    const list = session.authenticated ? (await request('accounts')).data : [];
    if (version !== generation) return selected;
    if (!Array.isArray(list) || list.some(a => !a.account_id || !['demo', 'real'].includes(a.account_type))) {
        throw new Error('Invalid account response.');
    }
    accounts = list.filter(a => a.status === 'active');
    selected = accounts.find(a => a.account_id === localStorage.getItem('active_loginid'))
        || accounts.find(a => a.account_type === 'demo') || accounts[0] || null;
    if (selected) localStorage.setItem('active_loginid', selected.account_id);
    else localStorage.removeItem('active_loginid');
    return selected;
}

export function selectTradingAccount(id: string) {
    const account = accounts.find(a => a.account_id === id);
    if (!account) throw new Error('Account unavailable.');
    generation++;
    selected = account;
    localStorage.setItem('active_loginid', id);
    window.dispatchEvent(new Event('pf:account-changed'));
}

export async function getTradingSocketUrl() {
    const account = selected;
    const version = generation;
    if (!account) return 'wss://api.derivws.com/trading/v1/options/ws/public';
    const result = await request(`accounts/${encodeURIComponent(account.account_id)}/otp`, 'POST');
    if (version !== generation) throw new Error('Account changed while connecting.');
    const url = new URL(result.data?.url);
    if (url.protocol !== 'wss:' || url.hostname !== 'api.derivws.com'
        || url.pathname !== `/trading/v1/options/ws/${account.account_type}`) throw new Error('Invalid trading connection.');
    return url.href;
}

export async function logoutTradingSession() {
    generation++;
    selected = null;
    accounts = [];
    localStorage.removeItem('active_loginid');
    window.dispatchEvent(new Event('pf:account-changed'));
    await request('logout', 'POST');
}

export function removeLegacyCredentials() {
    for (const key of ['authToken', 'accountsList', 'clientAccounts', 'callback_token', 'tokens']) {
        localStorage.removeItem(key);
        sessionStorage.removeItem(key);
    }
    for (const storage of [localStorage, sessionStorage]) {
        for (const key of Object.keys(storage)) {
            if (/^(extratokens_|copytradeenabled_|copytoreal_)/.test(key)) storage.removeItem(key);
        }
    }
    const url = new URL(window.location.href);
    for (const key of [...url.searchParams.keys()]) {
        if (/^(token|acct|cur)\d+$/.test(key)) url.searchParams.delete(key);
    }
    window.history.replaceState(null, '', url.pathname + url.search + url.hash);
}
