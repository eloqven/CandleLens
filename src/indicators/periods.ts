// Period generation for indicator lines (MD §10, §11, §12). Produces the exact
// set of periods that will be computed, so the displayed line count always
// agrees with the actual computation. The range boundary `0` is never treated
// as an actual period — periods start at 1.

import type { PeriodMode, PeriodRange } from '../core/types';

export interface PeriodGenOptions {
  range: PeriodRange;
  mode: PeriodMode;
  /** Sequential mode density step (positive integer). */
  step: number;
  /** Divisible mode divisor (positive integer). */
  divisor?: number;
}

function fibonacciUpTo(max: number): number[] {
  // Canonical sequence as listed in the plan: 1, 2, 3, 5, 8, 13, …
  const out: number[] = [];
  let a = 1;
  let b = 2;
  while (a <= max) {
    out.push(a);
    const next = a + b;
    a = b;
    b = next;
  }
  return out;
}

export function generatePeriods(opts: PeriodGenOptions): number[] {
  const { range, mode, step, divisor } = opts;
  const min = Math.max(1, Math.floor(range.min));
  const max = Math.floor(range.max);
  if (max < min) return [];

  switch (mode) {
    case 'sequential': {
      if (!Number.isInteger(step) || step < 1) {
        throw new Error(`sequential step must be a positive integer, got ${step}`);
      }
      const out: number[] = [];
      // Start at `min` and step through the range (every Nth period).
      for (let p = min; p <= max; p += step) out.push(p);
      return out;
    }
    case 'fibonacci': {
      return fibonacciUpTo(max).filter((p) => p >= min);
    }
    case 'divisible': {
      if (divisor == null || !Number.isInteger(divisor) || divisor < 1) {
        throw new Error(`divisible mode requires a positive integer divisor, got ${divisor}`);
      }
      const out: number[] = [];
      let p = min;
      const rem = p % divisor;
      if (rem !== 0) p += divisor - rem;
      for (; p <= max; p += divisor) out.push(p);
      return out;
    }
  }
}

/** Number of lines that will be generated — for UI display before execution. */
export function countPeriods(opts: PeriodGenOptions): number {
  return generatePeriods(opts).length;
}
