'use client';

import { cn } from '@/lib/utils';
import { formatTickPrice, tickChangeSign } from '@/lib/locale-format';
import { useAppTranslations } from '@/components/custom/i18n-provider';
import type { Tick, ActiveSymbol } from '../lib/types';

interface CurrentPriceDisplayProps {
  tick: Tick | null;
  prices: number[];
  activeSymbol: ActiveSymbol | null;
  pipSize: number;
}

export function CurrentPriceDisplay({
  tick,
  prices,
  activeSymbol,
  pipSize,
}: CurrentPriceDisplayProps) {
  const { locale } = useAppTranslations();

  if (!tick || !activeSymbol) {
    return (
      <div className="text-center py-6">
        <div className="text-2xl font-mono text-muted-foreground">---</div>
      </div>
    );
  }

  const priceStr = formatTickPrice(tick.quote, pipSize, locale);
  const prev = prices.length >= 2 ? prices[prices.length - 2] : null;
  const curr = prices.length >= 1 ? prices[prices.length - 1] : null;
  // Direction from the two prices as printed: a move that changes the printed
  // price always shows an arrow, one that does not never does.
  const change = prev !== null && curr !== null ? tickChangeSign(curr, prev, pipSize) : '';
  const isUp = change === '+';
  const isDown = change === '-';

  return (
    <div className="text-center py-6">
      <p className="text-xs text-muted-foreground mb-2">{activeSymbol.underlying_symbol_name}</p>
      <div className="flex items-center justify-center gap-3">
        <span className="text-4xl font-mono font-bold tracking-wide text-foreground">
          {priceStr}
        </span>
        {(isUp || isDown) && (
          <span
            className={cn(
              'text-2xl font-bold leading-none',
              isUp ? 'text-green-500' : 'text-destructive'
            )}
          >
            {isUp ? '▲' : '▼'}
          </span>
        )}
      </div>
    </div>
  );
}
