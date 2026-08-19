// History-length selection (MD §6). The percentage slider is a UX abstraction;
// the engine uses the resulting candle count. Given the full derived series and
// a fraction in [0, 1], we keep the most recent `count` candles, where
// count = round(fraction * total). 0% → 0 candles, 100% → all.

import type { Candle } from '../core/types';

export function clampPercent(percent: number): number {
  if (Number.isNaN(percent)) return 0;
  return Math.max(0, Math.min(1, percent));
}

/** Number of derived candles selected for a given fraction of `total`. */
export function historyCandleCount(total: number, percent: number): number {
  return Math.round(clampPercent(percent) * total);
}

/**
 * Select the most recent `historyCandleCount(total, percent)` derived candles.
 * Returns a new array; does not mutate the input.
 */
export function selectHistory(derived: Candle[], percent: number): Candle[] {
  const count = historyCandleCount(derived.length, percent);
  if (count <= 0) return [];
  return derived.slice(derived.length - count);
}
