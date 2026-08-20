// Canvas2D implementation of the Renderer interface (MD §13, §32). Draws candles
// and, in 'lines' mode, each visible indicator line as a polyline. Mesh/heat
// rendering is added in a later commit (C16).

import type { Candle } from '../core/types';
import { drawCandles } from './candles';
import { computePriceRange, priceToY, indexToX, indexToXViewport } from './scale';
import { computeMeshField, heatColor } from './mesh';
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

    const layout = {
      left: 8,
      right: w - this.axisW,
      top: 8,
      bottom: h - 8,
      viewStart: scene.viewStart,
      viewCount: scene.viewCount,
    };
    drawCandles(this.ctx, scene.candles, layout);

    if (scene.mode === 'mesh') {
      this.drawMesh(scene, layout);
    } else if (scene.mode === 'lines') {
      this.drawLines(scene.candles, scene.lines, layout, scene.priceMin, scene.priceMax);
    }
  }

  private drawMesh(
    scene: RenderScene,
    layout: { left: number; right: number; top: number; bottom: number },
  ): void {
    const rows = 240;
    const steepness = scene.meshSteepness ?? 0.5;
    const geometry =
      scene.geometry ?? {
        candleCount: scene.candles.length,
        priceMin: scene.priceMin ?? computePriceRange(scene.candles).min,
        priceMax: scene.priceMax ?? computePriceRange(scene.candles).max,
        lines: scene.lines.map((l) => ({
          id: l.id,
          type: 'MA' as const,
          source: 'close' as const,
          period: 0,
          raw: l.values,
          normalized: new Float64Array(l.values.length),
        })),
      };
    const field = computeMeshField(geometry, rows, steepness);

    const off = document.createElement('canvas');
    off.width = field.cols;
    off.height = field.rows;
    const octx = off.getContext('2d');
    if (!octx) return;
    const img = octx.createImageData(field.cols, field.rows);
    for (let i = 0; i < field.data.length; i++) {
      const [r, g, b, a] = heatColor(field.data[i]);
      img.data[i * 4] = r;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = b;
      img.data[i * 4 + 3] = a;
    }
    octx.putImageData(img, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    this.ctx.drawImage(off, layout.left, layout.top, layout.right - layout.left, layout.bottom - layout.top);
  }

  private drawLines(
    candles: Candle[],
    lines: RenderLine[],
    layout: { left: number; right: number; top: number; bottom: number; viewStart?: number; viewCount?: number },
    priceMin?: number,
    priceMax?: number,
  ): void {
    if (candles.length === 0) return;
    const range =
      priceMin != null && priceMax != null
        ? { min: priceMin, max: priceMax }
        : computePriceRange(candles);
    const n = candles.length;
    const viewStart = layout.viewStart ?? 0;
    const viewCount = layout.viewCount ?? n;
    const start = Math.max(0, Math.floor(viewStart));
    const end = Math.min(n - 1, Math.ceil(viewStart + viewCount));
    const xAt = (i: number) =>
      viewCount >= n ? indexToX(i, n, layout.left, layout.right) : indexToXViewport(i, viewStart, viewCount, layout.left, layout.right);

    for (const line of lines) {
      if (!line.visible) continue;
      this.ctx.strokeStyle = line.color;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      let started = false;
      for (let i = start; i <= end; i++) {
        const v = line.values[i];
        if (Number.isNaN(v)) {
          started = false;
          continue;
        }
        const x = xAt(i);
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
