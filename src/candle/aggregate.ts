// Derived candle engine (MD §5). Aggregates the canonical 1-minute base dataset
// into any integer interval in [1, 377] minutes. Deterministic and testable:
// Open = first source open, High = max source high, Low = min source low,
// Close = last source close, Volume = sum of source volumes.

import { MINUTE_MS, type Candle } from '../core/types';

export const MIN_INTERVAL = 1;
export const MAX_INTERVAL = 377;

export function validateInterval(intervalMinutes: number): number {
  if (!Number.isInteger(intervalMinutes)) {
    throw new Error(`Candle interval must be an integer, got ${intervalMinutes}`);
  }
  if (intervalMinutes < MIN_INTERVAL || intervalMinutes > MAX_INTERVAL) {
    throw new Error(
      `Candle interval must be in [${MIN_INTERVAL}, ${MAX_INTERVAL}], got ${intervalMinutes}`,
    );
  }
  return intervalMinutes;
}

export interface AggregateOptions {
  /** Drop a trailing partial bucket that has fewer than `intervalMinutes` candles. */
  dropPartial?: boolean;
}

/**
 * Aggregate 1-minute `base` candles into `intervalMinutes`-minute candles.
 * The derived candle timestamp is the timestamp of its first constituent candle.
 */
export function aggregateCandles(
  base: Candle[],
  intervalMinutes: number,
  options: AggregateOptions = {},
): Candle[] {
  const interval = validateInterval(intervalMinutes);
  const bucketMs = interval * MINUTE_MS;
  if (base.length === 0) return [];

  const buckets = new Map<number, Candle[]>();
  for (const c of base) {
    const bucket = Math.floor(c.timestamp / bucketMs);
    const arr = buckets.get(bucket);
    if (arr) arr.push(c);
    else buckets.set(bucket, [c]);
  }

  const result: Candle[] = [];
  for (const [, group] of buckets) {
    if (options.dropPartial && group.length < interval) continue;
    result.push(aggregateGroup(group));
  }
  result.sort((a, b) => a.timestamp - b.timestamp);
  return result;
}

function aggregateGroup(group: Candle[]): Candle {
  const first = group[0];
  const last = group[group.length - 1];
  let high = -Infinity;
  let low = Infinity;
  let volume = 0;
  for (const c of group) {
    if (c.high > high) high = c.high;
    if (c.low < low) low = c.low;
    volume += c.volume;
  }
  return {
    timestamp: first.timestamp,
    open: first.open,
    high,
    low,
    close: last.close,
    volume,
    sourceSymbol: first.sourceSymbol,
    sourceName: first.sourceName,
  };
}
