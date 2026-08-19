import { describe, it, expect } from 'vitest';
import { computeMeshField, heatColor } from '../../src/render/mesh';
import type { RenderGeometry } from '../../src/render/geometry';

function geometryAt(value: number, cols: number): RenderGeometry {
  const raw = new Float64Array(cols).fill(value);
  return {
    candleCount: cols,
    priceMin: 0,
    priceMax: 200,
    lines: [{ id: 'L', type: 'MA', source: 'close', period: 1, raw, normalized: new Float64Array(cols) }],
  };
}

describe('computeMeshField', () => {
  it('is strongest at the line value', () => {
    const g = geometryAt(100, 10);
    const field = computeMeshField(g, 200, 0.5);
    const rowAt100 = Math.round((100 / 200) * 199);
    const col = 5;
    expect(field.data[rowAt100 * field.cols + col]).toBeCloseTo(1, 1);
  });

  it('falls off away from the line', () => {
    const g = geometryAt(100, 10);
    const field = computeMeshField(g, 200, 0.5);
    const rowFar = 10; // price ~10, far from 100
    const col = 5;
    expect(field.data[rowFar * field.cols + col]).toBeLessThan(0.5);
  });

  it('higher steepness sharpens the falloff', () => {
    const g = geometryAt(100, 10);
    const low = computeMeshField(g, 200, 0.1);
    const high = computeMeshField(g, 200, 0.9);
    const rowMid = 80; // price ~80, moderately off the line
    const col = 5;
    expect(high.data[rowMid * high.cols + col]).toBeLessThan(low.data[rowMid * low.cols + col]);
  });
});

describe('heatColor', () => {
  it('maps 0 to transparent blue and 1 to opaque orange', () => {
    const lo = heatColor(0);
    const hi = heatColor(1);
    expect(lo[3]).toBe(0);
    expect(hi[3]).toBe(255);
    expect(hi[0]).toBeGreaterThan(lo[0]);
  });
});
