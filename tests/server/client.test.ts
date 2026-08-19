import { describe, it, expect } from 'vitest';
import { CandleLensClient } from '../../src/server/client';

function mockFetch(payload: unknown): typeof fetch {
  return (async () => ({ json: async () => payload }) as unknown as Response) as typeof fetch;
}

describe('CandleLensClient', () => {
  it('maps indicator lines and converts null warm-up to NaN', async () => {
    const payload = {
      candleCount: 3,
      lines: [
        { id: 'MA-close-2', period: 2, values: [null, 1, 2] },
        { id: 'MA-close-3', period: 3, values: [null, null, 3] },
      ],
    };
    const client = new CandleLensClient('http://localhost:8000', mockFetch(payload));
    const lines = await client.fetchIndicators({
      symbol: 'BTCUSDT',
      interval: 1,
      type: 'MA',
      source: 'close',
      min: 2,
      max: 3,
    });
    expect(lines).toHaveLength(2);
    expect(lines[0].type).toBe('MA');
    expect(lines[0].source).toBe('close');
    expect(lines[0].period).toBe(2);
    expect(Number.isNaN(lines[0].values[0])).toBe(true);
    expect(lines[0].values[2]).toBe(2);
    expect(lines[1].values[2]).toBe(3);
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
