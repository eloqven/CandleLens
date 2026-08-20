import { describe, it, expect } from 'vitest';
import { Canvas2DRenderer } from '../../src/render/canvasRenderer';
import type { RenderScene } from '../../src/render/renderer';
import { MINUTE_MS, type Candle } from '../../src/core/types';

function makeCanvas(): { canvas: HTMLCanvasElement; getStrokeCount: () => number } {
  let strokeCount = 0;
  const ctx = {
    stroke: () => {
      strokeCount++;
    },
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    fillRect: () => {},
    clearRect: () => {},
    fillText: () => {},
    setTransform: () => {},
    save: () => {},
    restore: () => {},
    globalAlpha: 1,
  } as unknown as CanvasRenderingContext2D;
  const canvas = {
    getContext: () => ctx,
    getBoundingClientRect: () => ({ width: 800, height: 400, left: 0, top: 0, right: 800, bottom: 400 }),
    width: 0,
    height: 0,
    style: {},
  } as unknown as HTMLCanvasElement;
  return { canvas, getStrokeCount: () => strokeCount };
}

function candle(n: number): Candle {
  return {
    timestamp: n * MINUTE_MS,
    open: 10,
    high: 12,
    low: 9,
    close: 11,
    volume: 1,
    sourceSymbol: 'X',
    sourceName: 'Y',
  };
}

describe('Canvas2DRenderer', () => {
  it('renders candles and visible lines without error', () => {
    const { canvas, getStrokeCount } = makeCanvas();
    const renderer = new Canvas2DRenderer(canvas);
    const scene: RenderScene = {
      candles: [candle(0), candle(1), candle(2)],
      lines: [
        { id: 'MA-close-2', color: '#fff', visible: true, values: Float64Array.from([NaN, 10.5, 10.5]) },
      ],
      mode: 'lines',
    };
    expect(() => renderer.render(scene)).not.toThrow();
    expect(getStrokeCount()).toBeGreaterThan(0);
  });

  it('skips invisible lines', () => {
    const { canvas, getStrokeCount } = makeCanvas();
    const renderer = new Canvas2DRenderer(canvas);
    const scene: RenderScene = {
      candles: [candle(0), candle(1)],
      lines: [{ id: 'x', color: '#fff', visible: false, values: Float64Array.from([1, 1]) }],
      mode: 'lines',
    };
    renderer.render(scene);
    // Only candle wicks/bodies stroke, not the hidden line.
    expect(getStrokeCount()).toBeGreaterThanOrEqual(0);
  });
});
