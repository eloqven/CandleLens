// Renderer abstraction (MD §31, §32). The renderer turns render-ready geometry
// into pixels. It must never compute indicators. The interface is deliberately
// small so a Canvas2D implementation can later be swapped for WebGL.

import type { Candle, RenderMode } from '../core/types';

export interface RenderLine {
  id: string;
  color: string;
  /** Indicator values aligned to candle indices; NaN where undefined. */
  values: Float64Array;
  visible: boolean;
}

export interface RenderScene {
  candles: Candle[];
  lines: RenderLine[];
  mode: RenderMode;
  /** Mesh gradient steepness, 0..1 (used when mode === 'mesh'). */
  meshSteepness?: number;
}

export interface Renderer {
  render(scene: RenderScene): void;
}
