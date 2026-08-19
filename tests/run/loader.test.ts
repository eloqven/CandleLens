import { describe, it, expect } from 'vitest';
import { canLoadTogether } from '../../src/run/loader';
import { createRunMeta } from '../../src/run/runModel';
import type { RunConfig, AssetConfig } from '../../src/core/config';
import type { DataProvenance } from '../../src/core/types';

const asset: AssetConfig = { symbol: 'BTCUSDT', sourceName: 'Binance' };
const config: RunConfig = {
  asset,
  candle: { intervalMinutes: 233, historyPercent: 1 },
  indicator: { slots: [{ type: 'MA', sources: ['close'] }], range: { min: 1, max: 5 }, mode: 'sequential', step: 1 },
  color: { mode: 'sequential', start: '#000', end: '#fff' },
  renderMode: 'lines',
  mesh: { steepness: 0.5 },
};
const provenance: DataProvenance = {
  sourceName: 'Binance', sourceSymbol: 'BTCUSDT', startTime: 0, endTime: 1, candleCount: 10,
  stopReason: 'max-history', ingestedAt: new Date(0).toISOString(),
};

function meta(interval: number, candles: number): ReturnType<typeof createRunMeta> {
  return createRunMeta({
    config: { ...config, candle: { ...config.candle, intervalMinutes: interval } },
    asset, provenance, intervalMinutes: interval, candleCount: candles,
    fingerprint: 'fp', stats: { estimatedPoints: 1 },
  });
}

describe('multi-run load policy', () => {
  it('allows a single run', () => {
    expect(canLoadTogether([meta(233, 10)]).ok).toBe(true);
  });
  it('allows runs with matching interval and count', () => {
    expect(canLoadTogether([meta(233, 10), meta(233, 10)]).ok).toBe(true);
  });
  it('rejects interval mismatch', () => {
    const r = canLoadTogether([meta(233, 10), meta(377, 10)]);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/Interval mismatch/);
  });
  it('rejects candle-count mismatch', () => {
    const r = canLoadTogether([meta(233, 10), meta(233, 20)]);
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/Candle count mismatch/);
  });
  it('rejects empty selection', () => {
    expect(canLoadTogether([]).ok).toBe(false);
  });
});
