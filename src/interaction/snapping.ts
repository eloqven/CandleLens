// Five snap points per candle (MD §23): open, high, low, close, and the
// midpoint. Hovering snaps to the nearest of these in screen space. Pure.

import type { Candle } from '../core/types';

export type SnapKind = 'open' | 'high' | 'low' | 'close' | 'mid';

export const SNAP_KINDS: SnapKind[] = ['open', 'high', 'low', 'close', 'mid'];

export function snapPointPrice(candle: Candle, kind: SnapKind): number {
  switch (kind) {
    case 'open':
      return candle.open;
    case 'high':
      return candle.high;
    case 'low':
      return candle.low;
    case 'close':
      return candle.close;
    case 'mid':
      return (candle.high + candle.low) / 2;
  }
}

export interface SnapPoint {
  kind: SnapKind;
  price: number;
  y: number;
}

/** Returns the snap point whose screen-y is closest to `cursorY`. */
export function nearestSnapPoint(
  candle: Candle,
  cursorY: number,
  priceToY: (price: number) => number,
): SnapPoint {
  let best: SnapPoint | null = null;
  let bestDist = Infinity;
  for (const kind of SNAP_KINDS) {
    const price = snapPointPrice(candle, kind);
    const y = priceToY(price);
    const dist = Math.abs(y - cursorY);
    if (dist < bestDist) {
      bestDist = dist;
      best = { kind, price, y };
    }
  }
  return best!;
}
