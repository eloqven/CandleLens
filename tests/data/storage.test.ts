import { describe, it, expect } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import {
  saveDataset,
  loadDataset,
  listDatasets,
  deleteDataset,
  datasetKey,
  type DatasetRecord,
} from '../../src/data/storage';
import { MINUTE_MS, type Candle } from '../../src/core/types';

function candle(t: number): Candle {
  return { timestamp: t, open: 1, high: 2, low: 0.5, close: 1.5, volume: 3, sourceSymbol: 'BTCUSDT', sourceName: 'Binance' };
}

function record(): DatasetRecord {
  const candles = [candle(0), candle(MINUTE_MS), candle(2 * MINUTE_MS)];
  return {
    key: datasetKey('Binance', 'BTCUSDT'),
    sourceName: 'Binance',
    sourceSymbol: 'BTCUSDT',
    provenance: {
      sourceName: 'Binance',
      sourceSymbol: 'BTCUSDT',
      startTime: 0,
      endTime: 2 * MINUTE_MS,
      candleCount: 3,
      stopReason: 'max-history',
      ingestedAt: new Date(0).toISOString(),
    },
    candles,
  };
}

describe('dataset storage', () => {
  it('saves and loads a dataset', async () => {
    const factory = new IDBFactory();
    const rec = record();
    await saveDataset(rec, factory);
    const loaded = await loadDataset(rec.key, factory);
    expect(loaded).toBeDefined();
    expect(loaded!.candles).toHaveLength(3);
    expect(loaded!.provenance.stopReason).toBe('max-history');
  });

  it('lists datasets without candles', async () => {
    const factory = new IDBFactory();
    await saveDataset(record(), factory);
    const list = await listDatasets(factory);
    expect(list).toHaveLength(1);
    expect((list[0] as { candles?: unknown }).candles).toBeUndefined();
    expect(list[0].sourceSymbol).toBe('BTCUSDT');
  });

  it('deletes a dataset', async () => {
    const factory = new IDBFactory();
    const rec = record();
    await saveDataset(rec, factory);
    await deleteDataset(rec.key, factory);
    expect(await loadDataset(rec.key, factory)).toBeUndefined();
  });
});
