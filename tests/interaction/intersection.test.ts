import { describe, it, expect } from 'vitest';
import { findNearbyLines, relativeTolerance } from '../../src/interaction/intersection';
import type { IndicatorLine } from '../../src/indicators/engine';

function line(id: string, values: number[]): IndicatorLine {
  return { id, type: 'MA', source: 'close', period: 1, values: Float64Array.from(values) };
}

describe('click-to-reveal intersection', () => {
  const lines = [
    line('a', [10, 20, 30]),
    line('b', [12, 19, 31]),
    line('c', [50, 50, 50]),
  ];

  it('finds lines within absolute tolerance', () => {
    // at index 1, price 20: a=20 (dist 0), b=19 (dist 1), c=50 (dist 30)
    expect(findNearbyLines(lines, 1, 20, 1.5).sort()).toEqual(['a', 'b']);
    expect(findNearbyLines(lines, 1, 20, 0.5)).toEqual(['a']);
  });

  it('ignores NaN values', () => {
    const withNaN = [line('x', [NaN, 20, NaN])];
    expect(findNearbyLines(withNaN, 1, 20, 0.1)).toEqual(['x']);
    expect(findNearbyLines(withNaN, 0, 20, 0.1)).toEqual([]);
  });

  it('derives tolerance from a price-range fraction', () => {
    expect(relativeTolerance(100, 0.02)).toBe(2);
    expect(relativeTolerance(100, 0)).toBe(0);
  });
});
