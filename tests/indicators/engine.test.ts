import { describe, it, expect } from 'vitest';
import { computeIndicators, computeLine, type IndicatorLine } from '../../src/indicators/engine';
import type { IndicatorConfig } from '../../src/core/config';
import { MINUTE_MS, type Candle } from '../../src/core/types';

function candles(n: number): Candle[] {
  return Array.from({ length: n }, (_, i) => ({
    timestamp: i * MINUTE_MS,
    open: 10 + i,
    high: 12 + i,
    low: 9 + i,
    close: 11 + i,
    volume: 1,
    sourceSymbol: 'X',
    sourceName: 'Y',
  }));
}

const config: IndicatorConfig = {
  slots: [{ type: 'MA', sources: ['close'] }],
  range: { min: 2, max: 4 },
  mode: 'sequential',
  step: 1,
};

describe('computeIndicators', () => {
  it('produces one line per (slot, source, period)', () => {
    const r = computeIndicators(candles(10), config);
    // periods 2,3,4 × 1 source × 1 slot = 3 lines
    expect(r.lines).toHaveLength(3);
    expect(r.candleCount).toBe(10);
  });

  it('computes correct MA values per line', () => {
    const r = computeIndicators(candles(5), config);
    const line = r.lines.find((l: IndicatorLine) => l.period === 2)!;
    // close series = 11,12,13,14,15 → MA(2): NaN, 11.5, 12.5, 13.5, 14.5
    expect(line.values[1]).toBeCloseTo(11.5);
    expect(line.values[4]).toBeCloseTo(14.5);
  });

  it('expands multiple sources and slots', () => {
    const multi: IndicatorConfig = {
      slots: [
        { type: 'MA', sources: ['open', 'close'] },
        { type: 'EMA', sources: ['high'] },
      ],
      range: { min: 1, max: 2 },
      mode: 'sequential',
      step: 1,
    };
    const r = computeIndicators(candles(10), multi);
    // (2 sources + 1 source) × 2 periods = 6 lines
    expect(r.lines).toHaveLength(6);
  });

  it('computeLine matches engine output', () => {
    const cs = candles(8);
    const line = computeLine(cs, 'EMA', 'close', 3);
    expect(line.id).toBe('EMA-close-3');
    expect(line.values[2]).toBeCloseTo((11 + 12 + 13) / 3);
  });
});
