import { describe, it, expect } from 'vitest';
import { selectHistory, historyCandleCount, clampPercent } from '../../src/candle/history';
import { MINUTE_MS, type Candle } from '../../src/core/types';

function series(n: number): Candle[] {
  return Array.from({ length: n }, (_, i) => ({
    timestamp: i * MINUTE_MS,
    open: 1,
    high: 2,
    low: 0.5,
    close: 1.5,
    volume: 1,
    sourceSymbol: 'X',
    sourceName: 'Y',
  }));
}

describe('history selection', () => {
  it('clamps the percentage to [0, 1]', () => {
    expect(clampPercent(-0.5)).toBe(0);
    expect(clampPercent(1.5)).toBe(1);
  });

  it('maps percentage to candle count', () => {
    expect(historyCandleCount(100, 0)).toBe(0);
    expect(historyCandleCount(100, 1)).toBe(100);
    expect(historyCandleCount(100, 0.25)).toBe(25);
  });

  it('selects the most recent candles', () => {
    const s = series(10);
    const sel = selectHistory(s, 0.3);
    expect(sel).toHaveLength(3);
    expect(sel[0].timestamp).toBe(7 * MINUTE_MS); // newest 3 of 10
  });

  it('returns empty for 0%', () => {
    expect(selectHistory(series(10), 0)).toHaveLength(0);
  });

  it('returns all for 100%', () => {
    const s = series(10);
    expect(selectHistory(s, 1)).toHaveLength(10);
  });
});
