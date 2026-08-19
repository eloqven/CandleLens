// Canonical 1-minute dataset persistence (MD §2.1, §2.3, §19 Layer 1).
// Stores the validated base dataset and its provenance in IndexedDB, keyed by
// source. The base dataset is the single source of truth from which all larger
// candles are derived.

import type { Candle, DataProvenance } from '../core/types';
import { compressCandles, decompressCandles, type CompressedCandles } from '../compress/codec';

const DB_NAME = 'candlelens';
const DB_VERSION = 2;
const STORE = 'datasets';
const RUNS_STORE = 'runs';

export interface DatasetRecord {
  /** Stable key, e.g. "Binance:BTCUSDT". */
  key: string;
  sourceName: string;
  sourceSymbol: string;
  provenance: DataProvenance;
  candles: Candle[];
}

/** On-disk form: candles are stored compressed, not as objects. */
type StoredDataset = Omit<DatasetRecord, 'candles'> & CompressedCandles;

export type IDBFactoryLike = {
  open(name: string, version?: number): IDBOpenDBRequest;
};

function getFactory(injected?: IDBFactoryLike): IDBFactoryLike {
  if (injected) return injected;
  if (typeof indexedDB !== 'undefined') return indexedDB as unknown as IDBFactoryLike;
  throw new Error('IndexedDB is not available in this environment');
}

function openDB(factory: IDBFactoryLike): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = factory.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' });
      }
      // Co-created so both stores exist regardless of which module opens first.
      if (!db.objectStoreNames.contains(RUNS_STORE)) {
        db.createObjectStore(RUNS_STORE, { keyPath: 'meta.id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE);
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function datasetKey(sourceName: string, symbol: string): string {
  return `${sourceName}:${symbol}`;
}

export async function saveDataset(
  record: DatasetRecord,
  factory?: IDBFactoryLike,
): Promise<void> {
  const database = await openDB(getFactory(factory));
  const store = tx(database, 'readwrite');
  const stored: StoredDataset = {
    key: record.key,
    sourceName: record.sourceName,
    sourceSymbol: record.sourceSymbol,
    provenance: record.provenance,
    ...compressCandles(record.candles),
  };
  await reqToPromise(store.put(stored));
}

export async function loadDataset(
  key: string,
  factory?: IDBFactoryLike,
): Promise<DatasetRecord | undefined> {
  const database = await openDB(getFactory(factory));
  const store = tx(database, 'readonly');
  const stored = await reqToPromise<StoredDataset | undefined>(
    store.get(key) as IDBRequest<StoredDataset | undefined>,
  );
  if (!stored) return undefined;
  return {
    key: stored.key,
    sourceName: stored.sourceName,
    sourceSymbol: stored.sourceSymbol,
    provenance: stored.provenance,
    candles: decompressCandles(stored, stored.sourceSymbol, stored.sourceName),
  };
}

export async function deleteDataset(
  key: string,
  factory?: IDBFactoryLike,
): Promise<void> {
  const database = await openDB(getFactory(factory));
  const store = tx(database, 'readwrite');
  await reqToPromise(store.delete(key));
}

/** List stored datasets (metadata only; candles are omitted to stay light). */
export async function listDatasets(
  factory?: IDBFactoryLike,
): Promise<Array<Omit<DatasetRecord, 'candles'>>> {
  const database = await openDB(getFactory(factory));
  const store = tx(database, 'readonly');
  const all = await reqToPromise<StoredDataset[]>(store.getAll() as IDBRequest<StoredDataset[]>);
  return all.map(({ blob: _blob, count: _count, ...meta }) => meta);
}
