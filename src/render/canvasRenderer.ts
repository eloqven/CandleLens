// Canvas2D implementation of the Renderer interface (MD §13, §32). Draws candles
// and, in 'lines' mode, each visible indicator line as a polyline. Mesh/heat
// rendering is added in a later commit (C16).

import type { Candle } from '../core/types';
import { drawCandles } from './candles';
import { computePriceRange, priceToY, indexToX } from './scale';
import type { Renderer, RenderScene, RenderLine } from './renderer';

export class Canvas2DRenderer implements Renderer {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private axisW = 56;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.ctx = ctx;
  }

  render(scene: RenderScene): void {
    const dpr = (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1;
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const layout = { left: 8, right: w - this.axisW, top: 8, bottom: h - 8 };
    drawCandles(this.ctx, scene.candles, layout);

    if (scene.mode === 'lines') {
      this.drawLines(scene.candles, scene.lines, layout);
    }
  }

  private drawLines(
    candles: Candle[],
    lines: RenderLine[],
    layout: { left: number; right: number; top: number; bottom: number },
  ): void {
    if (candles.length === 0) return;
    const range = computePriceRange(candles);
    const n = candles.length;

    for (const line of lines) {
      if (!line.visible) continue;
      this.ctx.strokeStyle = line.color;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      let started = false;
      for (let i = 0; i < n; i++) {
        const v = line.values[i];
        if (Number.isNaN(v)) {
          started = false;
          continue;
        }
        const x = indexToX(i, n, layout.left, layout.right);
        const y = priceToY(v, range, layout.top, layout.bottom);
        if (!started) {
          this.ctx.moveTo(x, y);
          started = true;
        } else {
          this.ctx.lineTo(x, y);
        }
      }
      this.ctx.stroke();
    }
  }
}
