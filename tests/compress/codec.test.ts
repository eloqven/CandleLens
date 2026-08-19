import { describe, it, expect } from 'vitest';
import {
  compressCandles,
  decompressCandles,
  compressLines,
  decompressLines,
  compressGeometry,
  decompressGeometry,
} from '../../src/compress/codec';
import type { Candle } from '../../src/core/types';
import type { IndicatorLine } from '../../src/indicators/engine';
import type { RenderGeometry } from '../../src/render/geometry';

function candle(t: number): Candle {
  return { timestamp: t, open: 1, high: 2, low: 0.5, close: 1.5, volume: 3, sourceSymbol: 'BTCUSDT', sourceName: 'Binance' };
}

describe('candle compression', () => {
  it('round-trips candles', () => {
    const candles = [candle(0), candle(60000), candle(120000)];
    const c = compressCandles(candles);
    expect(c.blob).toBeInstanceOf(Uint8Array);
    expect(c.count).toBe(3);
    const back = decompressCandles(c, 'BTCUSDT', 'Binance');
    expect(back[1].high).toBe(2);
    expect(back[2].timestamp).toBe(120000);
    expect(back[0].sourceSymbol).toBe('BTCUSDT');
  });
});

describe('line compression', () => {
  it('round-trips indicator lines', () => {
    const lines: IndicatorLine[] = [
      { id: 'MA-close-2', type: 'MA', source: 'close', period: 2, values: Float64Array.from([NaN, 1, 2, 3]) },
      { id: 'EMA-open-3', type: 'EMA', source: 'open', period: 3, values: Float64Array.from([4, 5, 6, 7]) },
    ];
    const c = compressLines(lines);
    const back = decompressLines(c);
    expect(back).toHaveLength(2);
    expect(back[0].values[3]).toBe(3);
    expect(back[1].type).toBe('EMA');
    expect(Number.isNaN(back[0].values[0])).toBe(true);
  });
});

describe('geometry compression', () => {
  it('round-trips render geometry', () => {
    const geom: RenderGeometry = {
      candleCount: 4,
      priceMin: 0,
      priceMax: 10,
      lines: [
        {
          id: 'MA-close-2',
          type: 'MA',
          source: 'close',
          period: 2,
          raw: Float64Array.from([1, 2, 3, 4]),
          normalized: Float64Array.from([0.1, 0.2, 0.3, 0.4]),
        },
      ],
    };
    const c = compressGeometry(geom);
    const back = decompressGeometry(c);
    expect(back.priceMax).toBe(10);
    expect(back.lines[0].raw[2]).toBe(3);
    expect(back.lines[0].normalized[3]).toBe(0.4);
  });
});
