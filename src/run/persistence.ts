// Run persistence (MD §19). Stores the full RunRecord — Layer 1 metadata, Layer 2
// raw indicator matrix, and Layer 3 render geometry — in IndexedDB so a run
// reloads almost instantly without recomputation. Typed arrays survive
// structured clone, so the raw matrix persists as-is.

import type { RunRecord } from './runModel';
import type { IDBFactoryLike } from '../data/storage';
import {
  compressLines,
  compressGeometry,
  decompressLines,
  decompressGeometry,
  type CompressedLines,
  type CompressedGeometry,
} from '../compress/codec';

const DB_NAME = 'candlelens';
const DB_VERSION = 2; // bumped to add the runs store
const STORE = 'runs';

/** On-disk form: the raw matrix + geometry are stored compressed. */
type StoredRun = {
  meta: RunRecord['meta'];
  payload: { lines: CompressedLines; geometry: CompressedGeometry };
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
        db.createObjectStore(STORE, { keyPath: 'meta.id' });
      }
      // Co-created so both stores exist regardless of which module opens first.
      if (!db.objectStoreNames.contains('datasets')) {
        db.createObjectStore('datasets', { keyPath: 'key' });
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

export async function saveRun(record: RunRecord, factory?: IDBFactoryLike): Promise<void> {
  const db = await openDB(getFactory(factory));
  const stored: StoredRun = {
    meta: record.meta,
    payload: {
      lines: compressLines(record.payload.lines),
      geometry: compressGeometry(record.payload.geometry),
    },
  };
  await reqToPromise(tx(db, 'readwrite').put(stored));
}

export async function loadRun(id: string, factory?: IDBFactoryLike): Promise<RunRecord | undefined> {
  const db = await openDB(getFactory(factory));
  const stored = await reqToPromise<StoredRun | undefined>(
    tx(db, 'readonly').get(id) as IDBRequest<StoredRun | undefined>,
  );
  if (!stored) return undefined;
  return {
    meta: stored.meta,
    payload: {
      lines: decompressLines(stored.payload.lines),
      geometry: decompressGeometry(stored.payload.geometry),
    },
  };
}

export async function deleteRun(id: string, factory?: IDBFactoryLike): Promise<void> {
  const db = await openDB(getFactory(factory));
  await reqToPromise(tx(db, 'readwrite').delete(id));
}

/** List run metadata only (no raw matrix / geometry) for the Load tab. */
export async function listRuns(factory?: IDBFactoryLike): Promise<RunRecord['meta'][]> {
  const db = await openDB(getFactory(factory));
  const all = await reqToPromise<StoredRun[]>(tx(db, 'readonly').getAll() as IDBRequest<StoredRun[]>);
  return all.map((r) => r.meta);
}
