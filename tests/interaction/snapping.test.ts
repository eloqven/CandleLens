import { describe, it, expect } from 'vitest';
import { snapPointPrice, nearestSnapPoint, SNAP_KINDS } from '../../src/interaction/snapping';
import type { Candle } from '../../src/core/types';

const candle: Candle = {
  timestamp: 0,
  open: 100,
  high: 120,
  low: 80,
  close: 110,
  volume: 1,
  sourceSymbol: 'BTCUSDT',
  sourceName: 'Binance',
};

describe('snap points', () => {
  it('computes the five prices', () => {
    expect(snapPointPrice(candle, 'open')).toBe(100);
    expect(snapPointPrice(candle, 'high')).toBe(120);
    expect(snapPointPrice(candle, 'low')).toBe(80);
    expect(snapPointPrice(candle, 'close')).toBe(110);
    expect(snapPointPrice(candle, 'mid')).toBe(100);
  });

  it('snaps to the nearest in screen space', () => {
    // priceToY: higher price → smaller y (screen). mid=100 → y=100.
    const priceToY = (p: number) => p;
    const nearHigh = nearestSnapPoint(candle, 118, priceToY);
    expect(nearHigh.kind).toBe('high');
    const nearLow = nearestSnapPoint(candle, 83, priceToY);
    expect(nearLow.kind).toBe('low');
    expect(SNAP_KINDS).toHaveLength(5);
  });
});
