// Multi-point selection (MD §25): when several snap points are selected, the
// researcher wants the lines that are common to *all* of them — the averages
// that describe every selected point, not just one. Pure.

import type { IndicatorLine } from '../indicators/engine';
import { findNearbyLines } from './intersection';

export interface SelectedPoint {
  index: number;
  price: number;
}

export function commonLines(
  points: SelectedPoint[],
  lines: IndicatorLine[],
  tolerance: number,
): string[] {
  if (points.length === 0) return [];
  const sets = points.map((p) => new Set(findNearbyLines(lines, p.index, p.price, tolerance)));
  const first = sets[0];
  const common: string[] = [];
  for (const id of first) {
    if (sets.every((s) => s.has(id))) common.push(id);
  }
  return common;
}
