// Viewport model for zoom/pan over the candle series (MD §22, §23). Pure and
// testable; the canvas event wiring lives in the viewer component.

export class Viewport {
  candleCount: number;
  width: number;
  /** Index of the leftmost visible candle (may be fractional). */
  viewStart: number;
  /** Number of candles visible across `width` pixels. */
  viewCount: number;

  constructor(candleCount: number, width: number) {
    this.candleCount = candleCount;
    this.width = width;
    this.viewStart = 0;
    this.viewCount = candleCount;
  }

  private clampView(): void {
    this.viewCount = Math.max(1, Math.min(this.candleCount, this.viewCount));
    this.viewStart = Math.max(0, Math.min(this.candleCount - this.viewCount, this.viewStart));
  }

  indexAtPixel(x: number): number {
    return this.viewStart + (x / this.width) * this.viewCount;
  }

  pixelAtIndex(i: number): number {
    return ((i - this.viewStart) / this.viewCount) * this.width;
  }

  /** Zoom by `factor` (<1 zooms in) keeping the candle under `pixelX` fixed. */
  zoomAt(pixelX: number, factor: number): void {
    const anchor = this.indexAtPixel(pixelX);
    this.viewCount = Math.max(1, this.viewCount * factor);
    this.clampView();
    // Re-anchor: keep `anchor` at the same pixel.
    this.viewStart = anchor - (pixelX / this.width) * this.viewCount;
    this.clampView();
  }

  /** Pan by a pixel delta (drag). Positive dx moves the view right (older). */
  panPixels(dx: number): void {
    this.viewStart += (dx / this.width) * this.viewCount;
    this.clampView();
  }
}
