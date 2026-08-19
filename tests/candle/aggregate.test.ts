import { describe, it, expect } from 'vitest';
import { aggregateCandles, validateInterval, MIN_INTERVAL, MAX_INTERVAL } from '../../src/candle/aggregate';
import { MINUTE_MS, type Candle } from '../../src/core/types';

function base(start: number, count: number): Candle[] {
  const out: Candle[] = [];
  for (let i = 0; i < count; i++) {
    const t = start + i * MINUTE_MS;
    out.push({
      timestamp: t,
      open: 10 + i,
      high: 12 + i,
      low: 9 + i,
      close: 11 + i,
      volume: 1,
      sourceSymbol: 'X',
      sourceName: 'Y',
    });
  }
  return out;
}

describe('aggregateCandles', () => {
  it('rejects out-of-range intervals', () => {
    expect(() => validateInterval(0)).toThrow();
    expect(() => validateInterval(378)).toThrow();
    expect(validateInterval(233)).toBe(233);
  });

  it('returns identity for interval = 1', () => {
    const b = base(0, 5);
    expect(aggregateCandles(b, 1)).toHaveLength(5);
  });

  it('aggregates OHLCV correctly for interval = 3', () => {
    const b = base(0, 6); // two full 3-min buckets
    const out = aggregateCandles(b, 3);
    expect(out).toHaveLength(2);
    const first = out[0];
    expect(first.open).toBe(b[0].open); // first source open
    expect(first.high).toBe(12 + 2); // max of highs in bucket 0..2
    expect(first.low).toBe(9); // min of lows in bucket 0..2
    expect(first.close).toBe(b[2].close); // last source close
    expect(first.volume).toBe(3);
    expect(first.timestamp).toBe(b[0].timestamp);
  });

  it('keeps a partial trailing bucket by default', () => {
    const b = base(0, 7); // 2 full buckets of 3 + 1 partial
    expect(aggregateCandles(b, 3)).toHaveLength(3);
  });

  it('drops a partial trailing bucket when requested', () => {
    const b = base(0, 7);
    expect(aggregateCandles(b, 3, { dropPartial: true })).toHaveLength(2);
  });
});
