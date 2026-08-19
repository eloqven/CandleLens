import { describe, it, expect } from 'vitest';
import { ingestSymbol, MAX_HISTORY_MS } from '../../src/data/binanceSource';
import { MINUTE_MS } from '../../src/core/types';

function rawKline(openTime: number, price = 100): unknown[] {
  return [openTime, String(price), String(price), String(price), String(price), '1', openTime + MINUTE_MS - 1];
}

/** Lazy mock: generates candles from `startTime` up to `end`, 1000 per call. */
function lazyFetch(startTime: number, endTime: number) {
  return async (url: string | URL | Request): Promise<Response> => {
    const u = String(url);
    const m = u.match(/endTime=(\d+)/);
    const rawEnd = m ? Number(m[1]) : endTime;
    // Largest minute mark strictly below `rawEnd` (Binance returns openTime < endTime).
    const base = Math.floor((rawEnd - 1) / MINUTE_MS) * MINUTE_MS;
    const batch: unknown[][] = [];
    for (let k = 0; k < 1000; k++) {
      const t = base - k * MINUTE_MS;
      if (t < startTime) break;
      batch.push(rawKline(t));
    }
    batch.reverse(); // ascending
    return { ok: true, status: 200, statusText: 'OK', json: async () => batch } as Response;
  };
}

/** Explicit-array mock for gap injection. */
function arrayFetch(all: unknown[][]) {
  return async (url: string | URL | Request): Promise<Response> => {
    const u = String(url);
    const m = u.match(/endTime=(\d+)/);
    const end = m ? Number(m[1]) : Number.MAX_SAFE_INTEGER;
    const batch = all.filter((k) => (k[0] as number) < end).slice(-1000);
    return { ok: true, status: 200, statusText: 'OK', json: async () => batch } as Response;
  };
}

describe('ingestSymbol', () => {
  it('ingests a continuous series oldest→newest', async () => {
    const now = 1_000_000_000_000;
    const count = 2500;
    // Mock serves candles strictly below `end`, so the series spans now-1m … now-count*m.
    const start = now - count * MINUTE_MS;
    const { candles, provenance } = await ingestSymbol({
      symbol: 'BTCUSDT',
      fetchFn: lazyFetch(start, now) as unknown as typeof fetch,
      now,
      maxCandles: 5000,
    });
    expect(candles.length).toBe(count);
    expect(candles[0].timestamp).toBeLessThan(candles[count - 1].timestamp);
    expect(provenance.candleCount).toBe(count);
    expect(provenance.stopReason).toBe('partial');
  });

  it('stops at the 48-month boundary', async () => {
    const now = MAX_HISTORY_MS + 10 * MINUTE_MS;
    const { provenance } = await ingestSymbol({
      symbol: 'BTCUSDT',
      fetchFn: lazyFetch(0, now) as unknown as typeof fetch,
      now,
    });
    expect(provenance.stopReason).toBe('max-history');
    expect(now - provenance.startTime).toBeGreaterThanOrEqual(MAX_HISTORY_MS - MINUTE_MS);
  });

  it('stops at the first gap', async () => {
    const now = 2_000_000_000_000;
    const total = 500;
    const all: unknown[][] = [];
    for (let i = 0; i < total; i++) {
      if (i === 250) continue; // remove one candle → a single 1-minute gap
      const t = now - (total - 1 - i) * MINUTE_MS;
      all.push(rawKline(t));
    }
    const { candles, provenance } = await ingestSymbol({
      symbol: 'BTCUSDT',
      fetchFn: arrayFetch(all) as unknown as typeof fetch,
      now,
    });
    expect(provenance.stopReason).toBe('gap');
    // Single batch: collected newest (i=498) down to i=251 = 248 candles, then gap.
    expect(candles.length).toBe(248);
  });
});
