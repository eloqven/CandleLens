// Load policy (MD §28): a single run or several may be loaded together, but
// only if they share the same candle interval and count — otherwise their
// indicator lines cannot be aligned index-by-index. Pure check + loader.

import type { RunMeta } from './runModel';
import { loadRun } from './persistence';
import type { RunRecord } from './runModel';
import type { IDBFactoryLike } from '../data/storage';

export interface LoadCheck {
  ok: boolean;
  reason?: string;
}

export function canLoadTogether(metas: RunMeta[]): LoadCheck {
  if (metas.length === 0) return { ok: false, reason: 'No run selected' };
  const first = metas[0];
  for (const m of metas) {
    if (m.intervalMinutes !== first.intervalMinutes) {
      return { ok: false, reason: `Interval mismatch: ${m.intervalMinutes} ≠ ${first.intervalMinutes}` };
    }
    if (m.candleCount !== first.candleCount) {
      return { ok: false, reason: `Candle count mismatch: ${m.candleCount} ≠ ${first.candleCount}` };
    }
  }
  return { ok: true };
}

export async function loadRuns(
  metas: RunMeta[],
  factory?: IDBFactoryLike,
): Promise<RunRecord[]> {
  const check = canLoadTogether(metas);
  if (!check.ok) throw new Error(check.reason);
  const records = await Promise.all(metas.map((m) => loadRun(m.id, factory)));
  return records.filter((r): r is RunRecord => r !== undefined);
}
