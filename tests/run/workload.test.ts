import { describe, it, expect } from 'vitest';
import { estimateWorkload } from '../../src/run/workload';
import type { IndicatorConfig } from '../../src/core/config';

const config: IndicatorConfig = {
  slots: [
    { type: 'MA', sources: ['open', 'close'] },
    { type: 'EMA', sources: ['high'] },
  ],
  range: { min: 1, max: 10 },
  mode: 'sequential',
  step: 1,
};

describe('estimateWorkload', () => {
  it('counts lines as slots × sources × periods', () => {
    // periods 1..10 = 10; slots: (2 sources) + (1 source) = 3 → 30 lines
    const w = estimateWorkload(config, 100);
    expect(w.periods).toBe(10);
    expect(w.lines).toBe(30);
    expect(w.points).toBe(3000);
  });

  it('scales points with candle count', () => {
    const a = estimateWorkload(config, 100);
    const b = estimateWorkload(config, 200);
    expect(b.points).toBe(2 * a.points);
  });

  it('estimates time from throughput', () => {
    const w = estimateWorkload(config, 100, 2); // 3000 points / 2 per ms
    expect(w.estimatedMs).toBe(1500);
  });
});
