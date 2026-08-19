import { describe, it, expect } from 'vitest';
import { buildGeometry } from '../../src/render/geometry';
import type { IndicatorLine } from '../../src/indicators/engine';
import { MINUTE_MS, type Candle } from '../../src/core/types';

function candle(n: number): Candle {
  return {
    timestamp: n * MINUTE_MS,
    open: 10,
    high: 20,
    low: 5,
    close: 15,
    volume: 1,
    sourceSymbol: 'X',
    sourceName: 'Y',
  };
}

const lines: IndicatorLine[] = [
  { id: 'MA-close-2', type: 'MA', source: 'close', period: 2, values: Float64Array.from([NaN, 12, 13, 14]) },
];

describe('buildGeometry', () => {
  it('preserves line metadata', () => {
    const g = buildGeometry([candle(0), candle(1), candle(2), candle(3)], lines);
    expect(g.lines[0].id).toBe('MA-close-2');
    expect(g.lines[0].period).toBe(2);
    expect(g.lines[0].raw).toEqual(lines[0].values);
  });

  it('normalizes values into [0, 1]', () => {
    const g = buildGeometry([candle(0), candle(1), candle(2), candle(3)], lines);
    const norm = g.lines[0].normalized;
    expect(norm[0]).toBeNaN(); // NaN preserved
    for (let i = 1; i < norm.length; i++) {
      expect(norm[i]).toBeGreaterThanOrEqual(0);
      expect(norm[i]).toBeLessThanOrEqual(1);
    }
  });

  it('records the global price range', () => {
    const g = buildGeometry([candle(0), candle(1), candle(2), candle(3)], lines);
    expect(g.priceMin).toBeLessThanOrEqual(5);
    expect(g.priceMax).toBeGreaterThanOrEqual(20);
  });
});
