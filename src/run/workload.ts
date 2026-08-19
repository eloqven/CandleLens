// Workload estimation (MD §16, §18, §34). Derives the number of indicator
// lines and data points from the actual selected configuration, so the
// pre-run confirmation shows a real estimate rather than a guess.

import type { IndicatorConfig } from '../core/config';
import { generatePeriods } from '../indicators/periods';

/** Assumed sustained throughput for the estimate (points per millisecond). */
export const DEFAULT_POINTS_PER_MS = 2;

export interface WorkloadEstimate {
  periods: number;
  lines: number;
  points: number;
  estimatedMs: number;
}

export function estimateWorkload(
  config: IndicatorConfig,
  candleCount: number,
  pointsPerMs: number = DEFAULT_POINTS_PER_MS,
): WorkloadEstimate {
  const periods = generatePeriods(config).length;
  const lines = config.slots.reduce(
    (acc, s) => acc + s.sources.length * periods,
    0,
  );
  const points = lines * candleCount;
  const estimatedMs = pointsPerMs > 0 ? points / pointsPerMs : 0;
  return { periods, lines, points, estimatedMs };
}
