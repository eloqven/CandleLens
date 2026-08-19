// Canonical 1-minute dataset persistence (MD §2.1, §2.3, §19 Layer 1).
// Stores the validated base dataset and its provenance in IndexedDB, keyed by
// source. The base dataset is the single source of truth from which all larger
// candles are derived.

import type { Candle, DataProvenance } from '../core/types';

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
  const db = openDB(getFactory(factory));
  const database = await db;
  const store = tx(database, 'readwrite');
  await reqToPromise(store.put(record));
}

export async function loadDataset(
  key: string,
  factory?: IDBFactoryLike,
): Promise<DatasetRecord | undefined> {
  const database = await openDB(getFactory(factory));
  const store = tx(database, 'readonly');
  return reqToPromise<DatasetRecord | undefined>(store.get(key) as IDBRequest<DatasetRecord | undefined>);
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
  const all = await reqToPromise<DatasetRecord[]>(store.getAll() as IDBRequest<DatasetRecord[]>);
  return all.map(({ candles: _candles, ...meta }) => meta);
}
