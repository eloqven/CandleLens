// Basic candlestick viewer component (MD §8). Renders a candle series to a
// canvas. Zoom/pan, snapping, and indicator overlays are added in later commits.

import type { Candle } from '../core/types';
import { drawCandles } from '../render/candles';

export class CandlestickView {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private candles: Candle[] = [];

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    container.appendChild(this.canvas);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas context unavailable');
    this.ctx = ctx;
  }

  setCandles(candles: Candle[]): void {
    this.candles = candles;
    this.render();
  }

  render(): void {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width));
    const h = Math.max(1, Math.floor(rect.height));
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const axisW = 56;
    drawCandles(this.ctx, this.candles, {
      left: 8,
      right: w - axisW,
      top: 8,
      bottom: h - 8,
    });
  }
}
