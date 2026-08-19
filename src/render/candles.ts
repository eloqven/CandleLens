// Canvas2D candlestick drawing. Consumes the pure scale helpers. This is the
// basic viewer used by the CREATE tab before any indicator is calculated.

import type { Candle } from '../core/types';
import { computePriceRange, priceToY, indexToX, candleWidth } from './scale';

export interface CandleLayout {
  left: number;
  right: number;
  top: number;
  bottom: number;
  upColor?: string;
  downColor?: string;
  axisColor?: string;
}

export function drawCandles(
  ctx: CanvasRenderingContext2D,
  candles: Candle[],
  layout: CandleLayout,
): void {
  const {
    left,
    right,
    top,
    bottom,
    upColor = '#26a69a',
    downColor = '#ef5350',
    axisColor = '#888',
  } = layout;

  ctx.clearRect(left, top, right - left, bottom - top);
  if (candles.length === 0) return;

  const range = computePriceRange(candles);
  const w = candleWidth(candles.length, left, right);

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const x = indexToX(i, candles.length, left, right);
    const yHigh = priceToY(c.high, range, top, bottom);
    const yLow = priceToY(c.low, range, top, bottom);
    const yOpen = priceToY(c.open, range, top, bottom);
    const yClose = priceToY(c.close, range, top, bottom);

    const up = c.close >= c.open;
    const color = up ? upColor : downColor;

    // Wick
    ctx.strokeStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, yHigh);
    ctx.lineTo(x, yLow);
    ctx.stroke();

    // Body
    ctx.fillStyle = color;
    const bodyTop = Math.min(yOpen, yClose);
    const bodyH = Math.max(1, Math.abs(yClose - yOpen));
    ctx.fillRect(x - w / 2, bodyTop, w, bodyH);
  }

  // Price axis ticks (right side)
  ctx.fillStyle = axisColor;
  ctx.strokeStyle = axisColor;
  ctx.font = '10px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const ticks = 5;
  for (let t = 0; t <= ticks; t++) {
    const price = range.min + ((range.max - range.min) * t) / ticks;
    const y = priceToY(price, range, top, bottom);
    ctx.fillText(price.toFixed(2), right + 4, y);
    ctx.beginPath();
    ctx.moveTo(right, y);
    ctx.lineTo(right + 3, y);
    ctx.stroke();
  }
}
