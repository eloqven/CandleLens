import { describe, it, expect } from 'vitest';
import { computePriceRange, priceToY, indexToX, candleWidth } from '../../src/render/scale';
import type { Candle } from '../../src/core/types';

function c(low: number, high: number): Candle {
  return { timestamp: 0, open: 1, high, low, close: 1, volume: 1, sourceSymbol: 'X', sourceName: 'Y' };
}

describe('scale helpers', () => {
  it('computes padded price range', () => {
    const r = computePriceRange([c(10, 20), c(15, 25)]);
    expect(r.min).toBeLessThan(10);
    expect(r.max).toBeGreaterThan(25);
  });

  it('maps price to y (higher price → smaller y)', () => {
    const r = { min: 0, max: 100 };
    expect(priceToY(0, r, 0, 100)).toBeCloseTo(100);
    expect(priceToY(100, r, 0, 100)).toBeCloseTo(0);
    expect(priceToY(50, r, 0, 100)).toBeCloseTo(50);
  });

  it('maps index to x centered in its slot', () => {
    expect(indexToX(0, 4, 0, 100)).toBeCloseTo(12.5);
    expect(indexToX(3, 4, 0, 100)).toBeCloseTo(87.5);
  });

  it('computes candle body width', () => {
    expect(candleWidth(10, 0, 100, 0.2)).toBeCloseTo(8);
  });
});
