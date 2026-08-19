// Run list (MD §27): present saved runs with their metadata so the researcher
// can pick one to revisit. The display mapping is pure and testable.

import type { RunMeta } from '../run/runModel';

export interface RunRow {
  id: string;
  asset: string;
  interval: number;
  candles: number;
  status: string;
  createdAt: string;
  fingerprint: string;
}

export function formatRunMeta(meta: RunMeta): RunRow {
  return {
    id: meta.id,
    asset: meta.asset.symbol,
    interval: meta.intervalMinutes,
    candles: meta.candleCount,
    status: meta.status,
    createdAt: meta.createdAt,
    fingerprint: meta.fingerprint,
  };
}
