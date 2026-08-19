import { describe, it, expect } from 'vitest';
import { Viewport } from '../../src/interaction/viewport';

describe('Viewport', () => {
  it('maps index ↔ pixel across the full view', () => {
    const v = new Viewport(100, 1000);
    expect(v.pixelAtIndex(0)).toBeCloseTo(0);
    expect(v.pixelAtIndex(100)).toBeCloseTo(1000);
    expect(v.indexAtPixel(500)).toBeCloseTo(50);
  });

  it('zooms in while keeping the anchor fixed', () => {
    const v = new Viewport(100, 1000);
    const anchorX = 500;
    const anchorIndex = v.indexAtPixel(anchorX); // 50
    v.zoomAt(anchorX, 0.5); // halve visible count → 50 visible
    expect(v.viewCount).toBe(50);
    expect(v.indexAtPixel(anchorX)).toBeCloseTo(anchorIndex);
  });

  it('pans and clamps to bounds', () => {
    const v = new Viewport(100, 1000);
    v.zoomAt(500, 0.5); // viewCount = 50, max start = 50
    v.panPixels(100); // move right by 10% of width → +5 indices (from 25)
    expect(v.viewStart).toBeCloseTo(30);
    v.panPixels(100000); // cannot exceed bounds
    expect(v.viewStart).toBeCloseTo(50);
  });

  it('never shows more than the whole series', () => {
    const v = new Viewport(100, 1000);
    v.zoomAt(0, 5); // zoom out
    expect(v.viewCount).toBe(100);
  });
});
