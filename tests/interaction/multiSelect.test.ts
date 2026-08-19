import { describe, it, expect } from 'vitest';
import { commonLines } from '../../src/interaction/multiSelect';
import type { IndicatorLine } from '../../src/indicators/engine';

function line(id: string, values: number[]): IndicatorLine {
  return { id, type: 'MA', source: 'close', period: 1, values: Float64Array.from(values) };
}

describe('multi-point common lines', () => {
  const lines = [
    line('a', [10, 20, 30]), // near both points
    line('b', [12, 19, 99]), // near point0, far from point1
    line('c', [99, 99, 31]), // far from point0, near point1
  ];
  const points = [
    { index: 0, price: 10 }, // a=10, b=12 within 2; c=99 no
    { index: 2, price: 30 }, // a=30, c=31 within 2; b=99 no
  ];

  it('returns only lines common to all selected points', () => {
    expect(commonLines(points, lines, 2).sort()).toEqual(['a']);
  });

  it('returns empty when no point is selected', () => {
    expect(commonLines([], lines, 2)).toEqual([]);
  });

  it('returns all when a single point selects several', () => {
    expect(commonLines([points[0]], lines, 2).sort()).toEqual(['a', 'b']);
  });
});
