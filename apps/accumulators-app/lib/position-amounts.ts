import type { OpenPosition } from '@/hooks/use-open-positions';
import { parseAmount } from '@/lib/locale-format';

/**
 * An open position's profit and its total (stake + profit) as numbers, parsed
 * once, the same way the formatters parse (`parseAmount`): every profit
 * display (position rows and cards, chart markers, Accumulators Current P&L and
 * its Close buttons) reads these, so a blank API string during a partial
 * proposal_open_contract update stays `NaN` (visibly invalid) everywhere rather
 * than reading `0.00` in one place and `NaN` in another.
 */
export function openPositionProfit(position: OpenPosition): number {
  return parseAmount(position.profit);
}

export function openPositionTotal(position: OpenPosition): number {
  return parseAmount(position.buy_price) + openPositionProfit(position);
}
