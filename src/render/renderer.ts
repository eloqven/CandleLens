// Renderer abstraction (MD §31, §32). The renderer turns render-ready geometry
// into pixels. It must never compute indicators. The interface is deliberately
// small so a Canvas2D implementation can later be swapped for WebGL.

import type { Candle, RenderMode } from '../core/types';
import type { RenderGeometry } from './geometry';

export interface RenderLine {
  id: string;
  color: string;
  /** Indicator values aligned to candle indices; NaN where undefined. */
  values: Float64Array;
  visible: boolean;
  /** Line opacity, 0..1 (MD §24). */
  opacity?: number;
}

export interface RenderScene {
  candles: Candle[];
  lines: RenderLine[];
  mode: RenderMode;
  /** Mesh gradient steepness, 0..1 (used when mode === 'mesh'). */
  meshSteepness?: number;
  /** Global price range including indicator values; defaults to candle range. */
  priceMin?: number;
  priceMax?: number;
  /** Full render geometry, used by mesh rendering. */
  geometry?: RenderGeometry;
  /** Zoom/pan window (MD §22). */
  viewStart?: number;
  viewCount?: number;
  /** Hovered snap point for visual highlighting (MD §23). */
  hover?: { index: number; kind: string; price: number };
}

export interface Renderer {
  render(scene: RenderScene): void;
}
