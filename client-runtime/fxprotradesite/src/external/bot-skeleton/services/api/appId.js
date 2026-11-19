import { requestForOptions, responseForWorkspace, buyOnSelectedAccount } from '../../../../pipforge/new-options.mjs';
import { DerivWS } from '../../../../../../../packages/deriv-core/src/ws/deriv-ws';
import { getTradingSocketUrl, getSelectedAccount, getSessionGeneration } from '../../../../pipforge/session';

let derivApiInstance = null;
let derivApiPromise = null;

const asLegacyError = (error, request) => {
    const normalized = new Error(error?.message || 'Deriv request failed');
    normalized.error = {
        code: error?.code || 'RequestFailed',
        message: error?.message || 'Deriv request failed',
        details: error?.details,
    };
    normalized.msg_type = error?.msgType;
    normalized.echo_req = request;
    return normalized;
};

class DerivApiCompatibilityAdapter {
    constructor(socket) {
        this.socket = socket;
        this.generation = getSessionGeneration();
        this.pendingBuys = new Set();
        this.subscriptions = new Map();
        this.messageListeners = new Set();
        this.connectionListeners = new Map();
        this.connection = {
            get readyState() {
                if (socket.isConnected) return WebSocket.OPEN;
                return socket.isReconnecting ? WebSocket.CONNECTING : WebSocket.CLOSED;
            },
            addEventListener: (event, callback) => this.addConnectionListener(event, callback),
            removeEventListener: (event, callback) => this.removeConnectionListener(event, callback),
        };
        socket.onMessage(data => this.messageListeners.forEach(callback => callback({ data: responseForWorkspace(data) })));
    }

    addConnectionListener(event, callback) {
        if (event !== 'open' && event !== 'close') return;
        const unsubscribe = this.socket.onConnectionStateChange(connected => {
            if ((event === 'open') === connected) callback(new Event(event));
        });
        const listeners = this.connectionListeners.get(event) || new Map();
        listeners.set(callback, unsubscribe);
        this.connectionListeners.set(event, listeners);
        if ((event === 'open') === this.socket.isConnected) queueMicrotask(() => callback(new Event(event)));
    }

    removeConnectionListener(event, callback) {
        const listeners = this.connectionListeners.get(event);
        listeners?.get(callback)?.();
        listeners?.delete(callback);
    }

    onMessage() {
        return {
            subscribe: callback => {
                this.messageListeners.add(callback);
                return { unsubscribe: () => this.messageListeners.delete(callback) };
            },
        };
    }

    async send(request) {
        const original = request;
        const isWrite = ['buy', 'sell', 'contract_update', 'cancel'].some(key => key in request);
        try {
            request = requestForOptions(request, getSelectedAccount());
            if (isWrite && this.generation !== getSessionGeneration()) throw new Error('Account changed. Reconnect before trading.');
            if (request.buy) {
                const key = JSON.stringify(request.parameters || request.buy);
                if (this.pendingBuys.has(key)) throw new Error('Purchase already in progress.');
                this.pendingBuys.add(key);
                try { return await buyOnSelectedAccount(this.socket, request, getSelectedAccount(), () => this.generation === getSessionGeneration()); }
                finally { this.pendingBuys.delete(key); }
            }
            if (request?.subscribe) {
                let initial;
                const subscription = await this.socket.subscribe(request, data => { initial ||= responseForWorkspace(data); });
                if (subscription.subscriptionId) this.subscriptions.set(subscription.subscriptionId, subscription.unsubscribe);
                return {
                    ...(initial || {}),
                    subscription: subscription.subscriptionId ? { id: subscription.subscriptionId } : undefined,
                };
            }
            if (request?.forget) return await this.forget(request.forget);
            if (request?.ping === '1') request = { ...request, ping: 1 };
            return responseForWorkspace(await this.socket.send(request));
        } catch (error) {
            const failure = asLegacyError(error, original);
            failure.nonRetryable = isWrite;
            throw failure;
        }
    }

    async forget(id) {
        const unsubscribe = this.subscriptions.get(String(id));
        if (unsubscribe) {
            this.subscriptions.delete(String(id));
            await unsubscribe();
            return { forget: id };
        }
        return this.socket.send({ forget: id });
    }

    balance() {
        return this.send({ balance: 1 });
    }

    disconnect() {
        this.connectionListeners.forEach(listeners => listeners.forEach(unsubscribe => unsubscribe()));
        this.connectionListeners.clear();
        this.messageListeners.clear();
        this.subscriptions.clear();
        this.socket.disconnect();
    }
}

export const clearDerivApiInstance = () => {
    derivApiInstance?.disconnect();
    derivApiInstance = null;
    derivApiPromise = null;
};

export const generateDerivApiInstance = async (forceNew = false) => {
    if (forceNew) clearDerivApiInstance();
    if (derivApiInstance && derivApiInstance.connection.readyState < WebSocket.CLOSING) return derivApiInstance;
    if (derivApiPromise) return derivApiPromise;

    derivApiPromise = (async () => {
        const socket = new DerivWS(undefined, getTradingSocketUrl);
        const adapter = new DerivApiCompatibilityAdapter(socket);
        try {
            await socket.connect();
            derivApiInstance = adapter;
            return adapter;
        } catch (error) {
            adapter.disconnect();
            throw error;
        } finally {
            derivApiPromise = null;
        }
    })();

    return derivApiPromise;
};

export const getLoginId = () => {
    const login_id = localStorage.getItem('active_loginid');
    return login_id && login_id !== 'null' ? login_id : null;
};

export const V2GetActiveAccountId = getLoginId;

export const getToken = () => ({ account_id: getSelectedAccount()?.account_id });

export const V2GetActiveClientId = () => getSelectedAccount()?.account_id || null;
// Compatibility presence marker only; never a credential.
export const V2GetActiveToken = () => getSelectedAccount() ? 'server-session' : null;
