import { describe, it, expect } from 'vitest';
import { validateCandles } from '../../src/data/validation';
import { MINUTE_MS, type Candle } from '../../src/core/types';

function candle(t: number, o = 10, h = 12, l = 9, c = 11, v = 1): Candle {
  return { timestamp: t, open: o, high: h, low: l, close: c, volume: v, sourceSymbol: 'X', sourceName: 'Y' };
}

describe('validateCandles', () => {
  it('accepts a continuous valid series', () => {
    const candles = [candle(0), candle(MINUTE_MS), candle(2 * MINUTE_MS)];
    const r = validateCandles(candles);
    expect(r.ok).toBe(true);
    expect(r.hasGap).toBe(false);
    expect(r.issues).toHaveLength(0);
  });

  it('detects a missing-timestamp gap', () => {
    const candles = [candle(0), candle(3 * MINUTE_MS)];
    const r = validateCandles(candles);
    expect(r.ok).toBe(false);
    expect(r.hasGap).toBe(true);
    expect(r.issues[0].type).toBe('missing-timestamp');
  });

  it('detects duplicate timestamps', () => {
    const candles = [candle(0), candle(0)];
    const r = validateCandles(candles);
    expect(r.issues.some((i) => i.type === 'duplicate-timestamp')).toBe(true);
  });

  it('detects out-of-order rows', () => {
    const candles = [candle(2 * MINUTE_MS), candle(0)];
    const r = validateCandles(candles);
    expect(r.issues.some((i) => i.type === 'out-of-order')).toBe(true);
  });

  it('detects invalid OHLC relationships', () => {
    const bad = candle(0, 10, 8, 9, 11); // high < open
    const r = validateCandles([bad]);
    expect(r.issues.some((i) => i.type === 'invalid-ohlc' || i.type === 'malformed-row')).toBe(true);
  });

  it('reports empty input', () => {
    const r = validateCandles([]);
    expect(r.ok).toBe(false);
    expect(r.issues[0].type).toBe('empty');
  });
});
