import { describe, it, expect } from 'vitest';
import { CandleLensClient } from '../../src/server/client';

function mockFetch(payload: unknown): typeof fetch {
  return (async () => ({ json: async () => payload }) as unknown as Response) as typeof fetch;
}

describe('CandleLensClient', () => {
  it('maps indicator lines and converts null warm-up to NaN', async () => {
    const payload = {
      candleCount: 3,
      candles: [],
      lines: [
        { id: 'MA-close-2', type: 'MA', source: 'close', period: 2, values: [null, 1, 2] },
        { id: 'MA-close-3', type: 'MA', source: 'close', period: 3, values: [null, null, 3] },
      ],
    };
    const client = new CandleLensClient('http://localhost:8000', mockFetch(payload));
    const result = await client.fetchIndicators({
      symbol: 'BTCUSDT',
      interval: 1,
      history: 1,
      slots: [{ type: 'MA', sources: ['close'] }],
      min: 2,
      max: 3,
      mode: 'sequential',
      step: 1,
    });
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].type).toBe('MA');
    expect(result.lines[0].source).toBe('close');
    expect(result.lines[0].period).toBe(2);
    expect(Number.isNaN(result.lines[0].values[0])).toBe(true);
    expect(result.lines[0].values[2]).toBe(2);
    expect(result.lines[1].values[2]).toBe(3);
  });

  it('fetches candles', async () => {
    const candles = [
      { timestamp: 0, open: 1, high: 2, low: 0.5, close: 1.5, volume: 3, sourceSymbol: 'BTCUSDT', sourceName: 'Binance' },
    ];
    const client = new CandleLensClient('http://localhost:8000', mockFetch({ candles }));
    const got = await client.fetchCandles('BTCUSDT', 10);
    expect(got).toHaveLength(1);
    expect(got[0].close).toBe(1.5);
  });
});
