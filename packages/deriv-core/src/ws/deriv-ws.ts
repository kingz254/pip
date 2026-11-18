import { getPublicWsUrl } from '../config/urls';

type MessageHandler = (data: Record<string, unknown>) => void;
type ConnectionStateHandler = (connected: boolean) => void;
type ReconnectExhaustedHandler = () => void;

interface PendingRequest {
  resolve: (data: Record<string, unknown>) => void;
  reject: (error: Error) => void;
}

interface ProposalQuote {
  id: string;
  askPrice: number;
  parameters: Record<string, unknown>;
  subscriptionId: string | null;
  createdAt: number;
}

/**
 * A Deriv API `error` payload, surfaced as a rejection.
 *
 * Extends Error so existing handlers that only read `.message` keep working,
 * while adding the machine-readable `code` callers need to branch on. The API
 * `message` is server-localized and interpolates values (e.g. the symbol name),
 * so it is never a safe branch key — use `code`.
 */
export class DerivApiError extends Error {
  /** API error code, e.g. `AlreadySubscribed`. Empty string when the frame carried none. */
  readonly code: string;
  /** `msg_type` of the response the error arrived on, when the frame carried one. */
  readonly msgType: string | undefined;
  readonly details: unknown;

  constructor(code: string, message: string, msgType?: string, details?: unknown) {
    super(message);
    this.name = 'DerivApiError';
    this.code = code;
    this.msgType = msgType;
    this.details = details;
  }
}

export function isDerivApiError(value: unknown): value is DerivApiError {
  return value instanceof DerivApiError;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(source: Record<string, unknown>, key: string): string | undefined {
  const value = source[key];
  return typeof value === 'string' ? value : undefined;
}

/**
 * Build a DerivApiError from a raw error frame. The message is left empty when
 * the API omits it — callers that render it already supply their own localized
 * fallback, so no English copy is invented here.
 */
function toDerivApiError(data: Record<string, unknown>): DerivApiError {
  const detail = isRecord(data.error) ? data.error : {};
  return new DerivApiError(
    readString(detail, 'code') ?? '',
    readString(detail, 'message') ?? '',
    readString(data, 'msg_type'),
    detail.details
  );
}

/**
 * Lightweight WebSocket manager for the Deriv public WS API.
 * Handles connection, reconnection, request/response matching via req_id,
 * and subscription streaming.
 */
export class DerivWS {
  private ws: WebSocket | null = null;
  private reqIdCounter = 0;
  private pendingRequests = new Map<number, PendingRequest>();
  private subscriptionHandlers = new Map<string, MessageHandler>();
  private globalHandlers: MessageHandler[] = [];
  private connectionStateHandlers: ConnectionStateHandler[] = [];
  private reconnectExhaustedHandlers: ReconnectExhaustedHandler[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private url: string;
  private connecting = false;
  private disposed = false;
  private proposalIds = new Map<string, ProposalQuote>();

  constructor(url?: string, private freshUrl?: () => Promise<string>) {
    this.url = url ?? getPublicWsUrl();
  }

  /**
   * Register a listener for connection state changes.
   * Called with `true` on connect and `false` on disconnect.
   * Returns an unsubscribe function.
   */
  onConnectionStateChange(handler: ConnectionStateHandler): () => void {
    this.connectionStateHandlers.push(handler);
    return () => {
      this.connectionStateHandlers = this.connectionStateHandlers.filter((h) => h !== handler);
    };
  }

  onReconnectExhausted(handler: ReconnectExhaustedHandler): () => void {
    this.reconnectExhaustedHandlers.push(handler);
    return () => {
      this.reconnectExhaustedHandlers = this.reconnectExhaustedHandlers.filter((h) => h !== handler);
    };
  }

  private notifyConnectionState(connected: boolean): void {
    for (const handler of this.connectionStateHandlers) {
      handler(connected);
    }
  }

  /**
   * Update the URL used for future reconnections without disrupting the current connection.
   * Call this when an OTP URL is refreshed but the live socket is still healthy.
   */
  updateUrl(url: string): void {
    this.url = url;
  }

  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      return Promise.resolve();
    }
    if (this.connecting) {
      return new Promise((resolve) => {
        const check = setInterval(() => {
          if (this.ws?.readyState === WebSocket.OPEN) {
            clearInterval(check);
            resolve();
          }
        }, 100);
      });
    }

    this.connecting = true;
    try { if (this.freshUrl) this.url = await this.freshUrl(); }
    catch (error) { this.connecting = false; throw error; }
    if (this.disposed) { this.connecting = false; throw new Error('Connection closed'); }
    this.proposalIds.clear();

    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.connecting = false;
        this.reconnectAttempts = 0;
        this.startPing();
        this.notifyConnectionState(true);
        resolve();
      };

      this.ws.onmessage = (event) => {
        try { const data = JSON.parse(event.data); if (isRecord(data)) this.handleMessage(data); } catch { /* Ignore malformed upstream frames. */ }
      };

      this.ws.onerror = () => {
        this.connecting = false;
        reject(new Error('WebSocket connection error'));
      };

      this.ws.onclose = () => {
        this.connecting = false;
        this.stopPing();
        this.subscriptionHandlers.clear();
        this.proposalIds.clear();
        for (const pending of this.pendingRequests.values()) pending.reject(new Error('Connection closed; verify your positions before retrying a trade.'));
        this.pendingRequests.clear();
        this.notifyConnectionState(false);
        this.attemptReconnect();
      };
    });
  }

  /**
   * Send a one-shot request and wait for the response matched by req_id.
   */
  send<T = Record<string, unknown>>(payload: Record<string, unknown>): Promise<T> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket is not connected'));
        return;
      }

      if (payload.buy) {
        const price = Number(payload.price);
        const buyId = String(payload.buy);
        const quote = buyId === '1'
          ? [...this.proposalIds.values()].find((candidate) => this.matchesParameters(candidate.parameters, payload.parameters))
          : this.proposalIds.get(buyId);
        if (!this.freshUrl || !quote || Date.now() - quote.createdAt > 15_000 || typeof payload.price !== 'number' || !Number.isFinite(price) || price <= 0 || price > quote.askPrice || (buyId !== '1' && !quote.subscriptionId)) {
          reject(new Error('Get a fresh quote on your connected account before buying.')); return;
        }
        this.proposalIds.delete(quote.id);
      }
      const reqId = ++this.reqIdCounter;
      const message = { ...payload, req_id: reqId };

      this.pendingRequests.set(reqId, {
        resolve: resolve as (data: Record<string, unknown>) => void,
        reject,
      });

      this.ws.send(JSON.stringify(message));
    });
  }

  /**
   * Send a subscription request. The handler is called for every streamed message.
   * Returns a function to unsubscribe, which resolves once the server has
   * acknowledged the `forget` — await it before re-subscribing to the same
   * stream so the two requests cannot collide with `AlreadySubscribed`.
   */
  subscribe(
    payload: Record<string, unknown>,
    handler: MessageHandler
  ): Promise<{ subscriptionId: string | null; unsubscribe: () => Promise<void> }> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket is not connected'));
        return;
      }

      const reqId = ++this.reqIdCounter;
      const message = { ...payload, subscribe: 1, req_id: reqId };

      this.pendingRequests.set(reqId, {
        resolve: (data) => {
          const subscriptionId = this.extractSubscriptionId(data);
          if (subscriptionId) {
            this.subscriptionHandlers.set(subscriptionId, handler);
          }
          // Also call handler with the initial response
          handler(data);
          resolve({
            subscriptionId,
            unsubscribe: () => {
              if (!subscriptionId) return Promise.resolve();
              this.subscriptionHandlers.delete(subscriptionId);
              // Always resolves: most callers fire this from a React cleanup
              // without awaiting, so a rejection here would surface as an
              // unhandled rejection. Callers await it purely for ordering.
              return this.send({ forget: subscriptionId }).then(
                () => undefined,
                () => undefined
              );
            },
          });
        },
        reject,
      });

      this.ws.send(JSON.stringify(message));
    });
  }

  onMessage(handler: MessageHandler): () => void {
    this.globalHandlers.push(handler);
    return () => {
      this.globalHandlers = this.globalHandlers.filter((h) => h !== handler);
    };
  }

  disconnect(): void {
    this.disposed = true;
    this.proposalIds.clear();
    this.stopPing();
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.reconnectAttempts = this.maxReconnectAttempts; // prevent reconnect
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.pendingRequests.clear();
    this.subscriptionHandlers.clear();
  }

  get isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  get isReconnecting(): boolean {
    return this.connecting || (this.reconnectAttempts > 0 && this.reconnectAttempts < this.maxReconnectAttempts);
  }

  private handleMessage(data: Record<string, unknown>): void {
    const quoted = data.proposal as { id?: string; ask_price?: number } | undefined;
    const echo = data.echo_req as Record<string, unknown> | undefined;
    if (quoted?.id && echo?.proposal === 1 && Number.isFinite(Number(quoted.ask_price))) {
      if (this.proposalIds.size > 100) this.proposalIds.clear();
      const previous = this.proposalIds.get(quoted.id);
      const parameters = previous?.parameters ?? this.getProposalParameters(echo);
      this.proposalIds.set(quoted.id, {
        id: quoted.id,
        askPrice: Number(quoted.ask_price),
        parameters,
        subscriptionId: (data.subscription as { id?: string } | undefined)?.id ?? previous?.subscriptionId ?? null,
        createdAt: Date.now(),
      });
    }
    // Notify global handlers
    for (const handler of this.globalHandlers) {
      handler(data);
    }

    const reqId = data.req_id as number | undefined;

    // Check for error
    if (data.error) {
      if (reqId && this.pendingRequests.has(reqId)) {
        const pending = this.pendingRequests.get(reqId)!;
        this.pendingRequests.delete(reqId);
        pending.reject(toDerivApiError(data));
      }
      return;
    }

    // Check if this is a subscription stream
    const subId = this.extractSubscriptionId(data);
    if (subId && this.subscriptionHandlers.has(subId)) {
      this.subscriptionHandlers.get(subId)!(data);
    }

    // Resolve pending one-shot request
    if (reqId && this.pendingRequests.has(reqId)) {
      const pending = this.pendingRequests.get(reqId)!;
      this.pendingRequests.delete(reqId);
      pending.resolve(data);
    }
  }

  private extractSubscriptionId(data: Record<string, unknown>): string | null {
    // Subscription ID can be in tick.id, subscription.id, or proposal.id
    if (data.subscription && typeof data.subscription === 'object') {
      return (data.subscription as Record<string, string>).id ?? null;
    }
    if (data.tick && typeof data.tick === 'object') {
      return (data.tick as Record<string, string>).id ?? null;
    }
    return null;
  }

  private getProposalParameters(request: Record<string, unknown>): Record<string, unknown> {
    return Object.fromEntries(Object.entries(request).filter(([key, value]) => !['proposal', 'subscribe', 'req_id', 'passthrough'].includes(key) && value !== undefined));
  }

  private matchesParameters(expected: Record<string, unknown>, actual: unknown): boolean {
    if (!isRecord(actual)) return false;
    const sort = (value: unknown): unknown => {
      if (Array.isArray(value)) return value.map(sort);
      if (!isRecord(value)) return value;
      return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sort(value[key])]));
    };
    return JSON.stringify(sort(expected)) === JSON.stringify(sort(actual));
  }

  private startPing(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ ping: 1 }));
      }
    }, 30000);
  }

  private stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      for (const handler of this.reconnectExhaustedHandlers) handler();
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

    this.reconnectTimeout = setTimeout(() => {
      this.connect().catch(() => {});
    }, delay);
  }
}
