// Run state model (MD §17, §36). A run is a persistent record with an explicit
// lifecycle status and independently tracked progress. Failed runs keep enough
// metadata to be diagnosed.

import type { RunConfig, AssetConfig } from '../core/config';
import type { RunStatus, DataProvenance } from '../core/types';
import type { IndicatorLine } from '../indicators/engine';
import type { RenderGeometry } from '../render/geometry';

export interface RunStats {
  /** Estimated data points (candles × lines). */
  estimatedPoints: number;
  /** Actual data points once computed. */
  actualPoints?: number;
  /** Estimated computation time in ms (best-effort). */
  estimatedMs?: number;
  actualMs?: number;
  linesCompleted?: number;
  linesTotal?: number;
}

export interface RunMeta {
  id: string;
  status: RunStatus;
  createdAt: string;
  completedAt?: string;
  asset: AssetConfig;
  dataSource: string;
  baseRangeStart: number;
  baseRangeEnd: number;
  intervalMinutes: number;
  candleCount: number;
  config: RunConfig;
  /** Deterministic configuration fingerprint (MD §22). */
  fingerprint: string;
  stats: RunStats;
  /** Present when the run failed, for diagnosis. */
  error?: string;
}

/** Layer 2 (raw matrix) + Layer 3 (render geometry) payload. */
export interface RunPayload {
  lines: IndicatorLine[];
  geometry: RenderGeometry;
}

export interface RunRecord {
  meta: RunMeta;
  payload: RunPayload;
}

const VALID_TRANSITIONS: Record<RunStatus, RunStatus[]> = {
  CREATED: ['QUEUED', 'RUNNING', 'FAILED', 'CANCELLED'],
  QUEUED: ['RUNNING', 'CANCELLED', 'FAILED'],
  RUNNING: ['COMPLETED', 'FAILED', 'CANCELLED'],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
};

export function canTransition(from: RunStatus, to: RunStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function newRunId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `run-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createRunMeta(params: {
  config: RunConfig;
  asset: AssetConfig;
  provenance: DataProvenance;
  intervalMinutes: number;
  candleCount: number;
  fingerprint: string;
  stats: RunStats;
}): RunMeta {
  return {
    id: newRunId(),
    status: 'CREATED',
    createdAt: new Date().toISOString(),
    asset: params.asset,
    dataSource: params.provenance.sourceName,
    baseRangeStart: params.provenance.startTime,
    baseRangeEnd: params.provenance.endTime,
    intervalMinutes: params.intervalMinutes,
    candleCount: params.candleCount,
    config: params.config,
    fingerprint: params.fingerprint,
    stats: params.stats,
  };
}
