// Click-to-reveal (MD §24): given a selected snap point (index + price), find
// the indicator lines that pass within a tolerance of that price at that index.
// Tolerance is in price units; callers derive it from a normalized fraction of
// the visible price range. Pure.

import type { IndicatorLine } from '../indicators/engine';

export function relativeTolerance(priceRange: number, fraction: number): number {
  return Math.max(0, priceRange * fraction);
}

export function findNearbyLines(
  lines: IndicatorLine[],
  index: number,
  price: number,
  tolerance: number,
): string[] {
  const hits: string[] = [];
  for (const line of lines) {
    const v = line.values[index];
    if (Number.isNaN(v)) continue;
    if (Math.abs(v - price) <= tolerance) hits.push(line.id);
  }
  return hits;
}
