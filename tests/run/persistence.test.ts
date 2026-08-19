import { describe, it, expect } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { saveRun, loadRun, listRuns, deleteRun } from '../../src/run/persistence';
import { createRunMeta } from '../../src/run/runModel';
import type { RunRecord } from '../../src/run/runModel';
import type { RunConfig, AssetConfig } from '../../src/core/config';
import type { DataProvenance, PriceSource } from '../../src/core/types';
import type { IndicatorLine } from '../../src/indicators/engine';
import type { RenderGeometry } from '../../src/render/geometry';

const asset: AssetConfig = { symbol: 'BTCUSDT', sourceName: 'Binance' };
const config: RunConfig = {
  asset,
  candle: { intervalMinutes: 233, historyPercent: 1 },
  indicator: { slots: [{ type: 'MA', sources: ['close'] as PriceSource[] }], range: { min: 1, max: 5 }, mode: 'sequential', step: 1 },
  color: { mode: 'sequential', start: '#000', end: '#fff' },
  renderMode: 'lines',
  mesh: { steepness: 0.5 },
};
const provenance: DataProvenance = {
  sourceName: 'Binance',
  sourceSymbol: 'BTCUSDT',
  startTime: 0,
  endTime: 1000,
  candleCount: 10,
  stopReason: 'max-history',
  ingestedAt: new Date(0).toISOString(),
};

function record(): RunRecord {
  const meta = createRunMeta({
    config,
    asset,
    provenance,
    intervalMinutes: 233,
    candleCount: 10,
    fingerprint: 'fp1',
    stats: { estimatedPoints: 50 },
  });
  const lines: IndicatorLine[] = [
    { id: 'MA-close-2', type: 'MA', source: 'close', period: 2, values: Float64Array.from([NaN, 1, 2, 3, 4, 5, 6, 7, 8, 9]) },
  ];
  const geometry: RenderGeometry = { candleCount: 10, priceMin: 0, priceMax: 10, lines: [] };
  return { meta, payload: { lines, geometry } };
}

describe('run persistence', () => {
  it('saves and reloads a run with its raw matrix', async () => {
    const factory = new IDBFactory();
    const rec = record();
    await saveRun(rec, factory);
    const loaded = await loadRun(rec.meta.id, factory);
    expect(loaded).toBeDefined();
    expect(loaded!.payload.lines[0].values[9]).toBe(9);
    expect(loaded!.meta.status).toBe('CREATED');
  });

  it('lists metadata without the heavy payload', async () => {
    const factory = new IDBFactory();
    await saveRun(record(), factory);
    const list = await listRuns(factory);
    expect(list).toHaveLength(1);
    expect((list[0] as { payload?: unknown }).payload).toBeUndefined();
  });

  it('deletes a run', async () => {
    const factory = new IDBFactory();
    const rec = record();
    await saveRun(rec, factory);
    await deleteRun(rec.meta.id, factory);
    expect(await loadRun(rec.meta.id, factory)).toBeUndefined();
  });
});
