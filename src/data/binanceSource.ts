// Single-source ingestion from the Binance public klines API (MD §1.1, §3).
// No auth required. Fetches 1-minute history backward from the newest candle,
// stopping at the 48-month boundary or the first unacceptable timestamp gap.

import { MINUTE_MS, type Candle, type DataProvenance } from '../core/types';

const BINANCE_KLINES_URL = 'https://api.binance.com/api/v3/klines';

/** Approximate 48-month window in milliseconds (MD §2.2). */
export const MONTH_MS = 30 * 24 * 60 * 60 * 1000;
export const MAX_HISTORY_MS = 48 * MONTH_MS;

/** Raw Binance kline tuple (only the fields we use are typed). */
type RawKline = [
  number, // open time (ms)
  string, // open
  string, // high
  string, // low
  string, // close
  string, // volume
  number, // close time
  ...unknown[],
];

export interface IngestOptions {
  symbol: string;
  sourceName?: string;
  /** Injectable fetch for testability; defaults to global fetch. */
  fetchFn?: typeof fetch;
  /** Override "now" for deterministic tests. */
  now?: number;
  /** Hard cap on candles to avoid unbounded test runs. */
  maxCandles?: number;
}

export interface IngestResult {
  candles: Candle[];
  provenance: DataProvenance;
}

const LIMIT = 1000;

function toCandle(k: RawKline, sourceSymbol: string, sourceName: string): Candle {
  return {
    timestamp: k[0],
    open: Number(k[1]),
    high: Number(k[2]),
    low: Number(k[3]),
    close: Number(k[4]),
    volume: Number(k[5]),
    sourceSymbol,
    sourceName,
  };
}

async function fetchBatch(
  fetchFn: typeof fetch,
  symbol: string,
  endTime: number,
  limit: number,
): Promise<RawKline[]> {
  const url = `${BINANCE_KLINES_URL}?symbol=${symbol}&interval=1m&endTime=${endTime}&limit=${limit}`;
  const res = await fetchFn(url);
  if (!res.ok) {
    throw new Error(`Binance klines request failed: ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as RawKline[];
}

/**
 * Ingest 1-minute history for a symbol, walking backward from `now`.
 * Stops at the 48-month boundary, the first timestamp gap, or maxCandles.
 */
export async function ingestSymbol(opts: IngestOptions): Promise<IngestResult> {
  const fetchFn = opts.fetchFn ?? fetch;
  const sourceName = opts.sourceName ?? 'Binance';
  const now = opts.now ?? Date.now();
  const minStart = now - MAX_HISTORY_MS;

  const candles: Candle[] = [];
  let endTime = now;
  let stopReason: DataProvenance['stopReason'] = 'max-history';

  while (true) {
    const batch = await fetchBatch(fetchFn, opts.symbol, endTime, LIMIT);
    if (batch.length === 0) {
      stopReason = 'partial';
      break;
    }

    // Binance returns ascending order; prepend so the array stays ascending.
    for (let i = batch.length - 1; i >= 0; i--) {
      const c = toCandle(batch[i], opts.symbol, sourceName);
      // Detect a gap between this candle and the previously collected newest one.
      if (candles.length > 0) {
        const prev = candles[candles.length - 1];
        if (prev.timestamp - c.timestamp !== MINUTE_MS) {
          stopReason = 'gap';
          // Keep the continuous portion; do not append the gapped candle.
          break;
        }
      }
      candles.push(c);
    }

    if (stopReason === 'gap') break;
    if (opts.maxCandles && candles.length >= opts.maxCandles) {
      stopReason = 'partial';
      break;
    }

    const oldest = candles[candles.length - 1];
    if (oldest.timestamp <= minStart) {
      stopReason = 'max-history';
      break;
    }
    // Next batch ends just before the oldest collected candle.
    endTime = oldest.timestamp - 1;
  }

  candles.reverse(); // store oldest → newest

  const provenance: DataProvenance = {
    sourceName,
    sourceSymbol: opts.symbol,
    startTime: candles.length ? candles[0].timestamp : now,
    endTime: candles.length ? candles[candles.length - 1].timestamp : now,
    candleCount: candles.length,
    stopReason,
    ingestedAt: new Date(now).toISOString(),
  };

  return { candles, provenance };
}
