// Mesh / heat-field rendering (MD §14, §15). The mesh is the combined field of
// all underlying indicator lines, shown without drawing each line individually.
// Steepness controls the spatial falloff: low = smooth, high = abrupt near lines.

import type { RenderGeometry } from './geometry';

export interface MeshField {
  /** Intensity in [0, 1], row-major: field[row * cols + col]. */
  data: Float32Array;
  cols: number;
  rows: number;
}

/**
 * Compute the mesh intensity field. For each candle column and each price row,
 * intensity is the strongest line influence at that point, using a Gaussian
 * falloff whose width shrinks as `steepness` (0..1) increases.
 */
export function computeMeshField(
  geometry: RenderGeometry,
  rows: number,
  steepness: number,
): MeshField {
  const cols = geometry.candleCount;
  const { priceMin, priceMax } = geometry;
  const span = priceMax - priceMin || 1;
  const data = new Float32Array(rows * cols);

  // Map steepness to a falloff width in price units. High steepness → narrow.
  const s = Math.max(0, Math.min(1, steepness));
  const sigma = (span / rows) * (1 + (1 - s) * 12);

  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const price = priceMin + (span * r) / (rows - 1 || 1);
      let best = 0;
      for (const line of geometry.lines) {
        const v = line.raw[c];
        if (Number.isNaN(v)) continue;
        const d = price - v;
        const influence = Math.exp(-(d * d) / (2 * sigma * sigma));
        if (influence > best) best = influence;
      }
      data[r * cols + c] = best;
    }
  }
  return { data, cols, rows };
}

/** Map an intensity in [0,1] to an RGBA heat color (blue → orange). */
export function heatColor(t: number): [number, number, number, number] {
  const k = Math.max(0, Math.min(1, t));
  return [Math.round(255 * k), Math.round(80 + 120 * k), Math.round(255 * (1 - k)), Math.round(255 * k)];
}
