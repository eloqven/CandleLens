// Pure layout/scale helpers for candle rendering. Kept free of DOM so they are
// unit-testable; the canvas drawing code consumes them.

import type { Candle } from '../core/types';

export interface PriceRange {
  min: number;
  max: number;
}

/** Min low / max high across the given candles, with proportional padding. */
export function computePriceRange(candles: Candle[], pad = 0.05): PriceRange {
  if (candles.length === 0) return { min: 0, max: 1 };
  let min = Infinity;
  let max = -Infinity;
  for (const c of candles) {
    if (c.low < min) min = c.low;
    if (c.high > max) max = c.high;
  }
  const span = max - min || Math.abs(max) || 1;
  return { min: min - span * pad, max: max + span * pad };
}

/** Map a price to a vertical pixel coordinate within [top, bottom]. */
export function priceToY(price: number, range: PriceRange, top: number, bottom: number): number {
  const { min, max } = range;
  if (max === min) return (top + bottom) / 2;
  return bottom - ((price - min) / (max - min)) * (bottom - top);
}

/** Map a candle index to the horizontal center of its slot within [left, right]. */
export function indexToX(index: number, count: number, left: number, right: number): number {
  if (count <= 0) return left;
  const slot = (right - left) / count;
  return left + (index + 0.5) * slot;
}

/** Map a candle index to x when only `viewCount` candles are visible from `viewStart`. */
export function indexToXViewport(
  index: number,
  viewStart: number,
  viewCount: number,
  left: number,
  right: number,
): number {
  if (viewCount <= 0) return left;
  return left + ((index - viewStart) / viewCount) * (right - left);
}

/** Width of a single candle body in pixels (with a small gap). */
export function candleWidth(count: number, left: number, right: number, gap = 0.2): number {
  if (count <= 0) return 0;
  return ((right - left) / count) * (1 - gap);
}
