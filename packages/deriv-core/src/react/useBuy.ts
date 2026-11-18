'use client';

import { useState, useCallback, useRef } from 'react';
import type { DerivWS } from '../ws';
import type { ProposalInfo, BuyResponse, BuyResult } from '../types';

interface UseBuyReturn {
  buyContract: (proposal: ProposalInfo) => Promise<void>;
  isBuying: boolean;
  buyResult: BuyResult | null;
  buyError: string | null;
  clearBuyResult: () => void;
}

export function useBuy(
  ws: DerivWS | null,
  isConnected: boolean
): UseBuyReturn {
  const pending = useRef(false);
  const [isBuying, setIsBuying] = useState(false);
  const [buyResult, setBuyResult] = useState<BuyResult | null>(null);
  const [buyError, setBuyError] = useState<string | null>(null);

  const clearBuyResult = useCallback(() => {
    setBuyResult(null);
    setBuyError(null);
  }, []);

  const buyContract = useCallback(async (proposal: ProposalInfo) => {
    if (!ws || !isConnected || pending.current) return;
    const price = Number(proposal.askPrice);
    if (!Number.isFinite(price) || price <= 0) { setBuyError('Quote unavailable.'); return; }
    pending.current = true;

    setIsBuying(true);
    setBuyError(null);
    setBuyResult(null);

    try {
      const response = await ws.send<BuyResponse>({
        buy: proposal.id,
        price,
      });

      if (response.buy) {
        setBuyResult({
          contractId: response.buy.contract_id,
          buyPrice: response.buy.buy_price,
          payout: response.buy.payout,
          longcode: response.buy.longcode,
          balanceAfter: response.buy.balance_after,
        });
      }
    } catch (err) {
      setBuyError(err instanceof Error ? err.message : 'Purchase failed');
    } finally {
      pending.current = false;
      setIsBuying(false);
    }
  }, [ws, isConnected]);

  return { buyContract, isBuying, buyResult, buyError, clearBuyResult };
}
