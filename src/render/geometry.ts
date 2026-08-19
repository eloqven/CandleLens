// Render geometry generation (MD §19 Layer 3). Converts the raw computed
// indicator matrix into a render-ready representation: per-line metadata plus
// values normalized to the global price range, so the renderer and the
// interaction layer can work without recomputing indicators. Pixel coordinates
// are viewport-dependent and produced at draw time; this layer holds the
// stable, persistable geometry.

import type { Candle } from '../core/types';
import type { IndicatorLine } from '../indicators/engine';
import { computePriceRange } from './scale';

export interface LineGeometry {
  id: string;
  type: IndicatorLine['type'];
  source: IndicatorLine['source'];
  period: number;
  /** Original indicator values, aligned to candle indices. */
  raw: Float64Array;
  /** Values normalized to [0, 1] over the global price range (NaN preserved). */
  normalized: Float64Array;
}

export interface RenderGeometry {
  candleCount: number;
  priceMin: number;
  priceMax: number;
  lines: LineGeometry[];
}

export function buildGeometry(
  candles: Candle[],
  lines: IndicatorLine[],
): RenderGeometry {
  // Global price range spans candle extremes and all line values.
  const range = computePriceRange(candles);
  let min = range.min;
  let max = range.max;
  for (const line of lines) {
    for (let i = 0; i < line.values.length; i++) {
      const v = line.values[i];
      if (!Number.isNaN(v)) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
  }
  const span = max - min || 1;

  const geoLines: LineGeometry[] = lines.map((line) => {
    const normalized = new Float64Array(line.values.length);
    for (let i = 0; i < line.values.length; i++) {
      const v = line.values[i];
      normalized[i] = Number.isNaN(v) ? NaN : (v - min) / span;
    }
    return {
      id: line.id,
      type: line.type,
      source: line.source,
      period: line.period,
      raw: line.values,
      normalized,
    };
  });

  return { candleCount: candles.length, priceMin: min, priceMax: max, lines: geoLines };
}
