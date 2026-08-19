import { describe, it, expect } from 'vitest';
import { buildConfirmationSummary } from '../../src/ui/confirmation';
import { estimateRemainingMs } from '../../src/ui/progress';
import type { RunConfig } from '../../src/core/config';
import type { WorkloadEstimate } from '../../src/run/workload';

const config: RunConfig = {
  asset: { symbol: 'BTCUSDT', sourceName: 'Binance' },
  candle: { intervalMinutes: 233, historyPercent: 0.5 },
  indicator: {
    slots: [
      { type: 'MA', sources: ['close', 'open'] },
      { type: 'EMA', sources: ['high'] },
    ],
    range: { min: 10, max: 90 },
    mode: 'sequential',
    step: 2,
  },
  color: { mode: 'sequential', start: '#000', end: '#fff' },
  renderMode: 'mesh',
  mesh: { steepness: 0.5 },
};

describe('confirmation summary', () => {
  it('summarizes the configuration', () => {
    const w: WorkloadEstimate = { periods: 41, lines: 123, points: 12300, estimatedMs: 6000 };
    const lines = buildConfirmationSummary(config, w);
    expect(lines.some((l) => l.includes('BTCUSDT'))).toBe(true);
    expect(lines.some((l) => l.includes('233 min'))).toBe(true);
    expect(lines.some((l) => l.includes('123'))).toBe(true);
    expect(lines.some((l) => l.includes('mesh'))).toBe(true);
    expect(lines.some((l) => l.includes('Sequential (step 2)'))).toBe(true);
  });
});

describe('estimateRemainingMs', () => {
  it('scales remaining by observed throughput', () => {
    // 50 of 100 done in 1000ms → 1000ms remaining
    expect(estimateRemainingMs(50, 100, 1000)).toBe(1000);
  });
  it('returns null with no progress', () => {
    expect(estimateRemainingMs(0, 100, 1000)).toBeNull();
  });
  it('returns 0 when complete', () => {
    expect(estimateRemainingMs(100, 100, 5000)).toBe(0);
  });
});
