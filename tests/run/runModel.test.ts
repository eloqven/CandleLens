import { describe, it, expect } from 'vitest';
import { canTransition, createRunMeta, newRunId } from '../../src/run/runModel';
import type { RunConfig, AssetConfig } from '../../src/core/config';
import type { DataProvenance } from '../../src/core/types';

const asset: AssetConfig = { symbol: 'BTCUSDT', sourceName: 'Binance' };
const config: RunConfig = {
  asset,
  candle: { intervalMinutes: 233, historyPercent: 1 },
  indicator: { slots: [{ type: 'MA', sources: ['close'] }], range: { min: 1, max: 10 }, mode: 'sequential', step: 1 },
  color: { mode: 'sequential', start: '#000', end: '#fff' },
  renderMode: 'lines',
  mesh: { steepness: 0.5 },
};
const provenance: DataProvenance = {
  sourceName: 'Binance',
  sourceSymbol: 'BTCUSDT',
  startTime: 0,
  endTime: 1000,
  candleCount: 100,
  stopReason: 'max-history',
  ingestedAt: new Date(0).toISOString(),
};

describe('run model', () => {
  it('generates a unique run id', () => {
    expect(newRunId()).not.toBe(newRunId());
  });

  it('creates a CREATED run meta', () => {
    const meta = createRunMeta({
      config,
      asset,
      provenance,
      intervalMinutes: 233,
      candleCount: 100,
      fingerprint: 'abc',
      stats: { estimatedPoints: 1000 },
    });
    expect(meta.status).toBe('CREATED');
    expect(meta.fingerprint).toBe('abc');
    expect(meta.intervalMinutes).toBe(233);
  });

  it('enforces valid status transitions', () => {
    expect(canTransition('CREATED', 'RUNNING')).toBe(true);
    expect(canTransition('RUNNING', 'COMPLETED')).toBe(true);
    expect(canTransition('COMPLETED', 'RUNNING')).toBe(false);
    expect(canTransition('RUNNING', 'CREATED')).toBe(false);
  });
});
