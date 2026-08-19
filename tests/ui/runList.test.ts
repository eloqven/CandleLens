import { describe, it, expect } from 'vitest';
import { formatRunMeta } from '../../src/ui/runList';
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

describe('run list formatting', () => {
  it('maps metadata to a display row', () => {
    const meta = createRunMeta({
      config, asset, provenance, intervalMinutes: 233, candleCount: 10,
      fingerprint: 'fp', stats: { estimatedPoints: 50 },
    });
    const row = formatRunMeta(meta);
    expect(row.asset).toBe('BTCUSDT');
    expect(row.interval).toBe(233);
    expect(row.candles).toBe(10);
    expect(row.status).toBe('CREATED');
    expect(row.fingerprint).toBe('fp');
  });
});
