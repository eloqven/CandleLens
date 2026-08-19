// Historical data validation (MD §4).
// Verifies the 1-minute sequence before it is considered usable and produces a
// report distinguishing expected boundaries, duplicates, gaps, malformed rows,
// out-of-order rows, and invalid OHLC relationships.

import { MINUTE_MS, type Candle } from '../core/types';

export type ValidationIssueType =
  | 'empty'
  | 'duplicate-timestamp'
  | 'missing-timestamp'
  | 'out-of-order'
  | 'malformed-row'
  | 'invalid-ohlc';

export interface ValidationIssue {
  type: ValidationIssueType;
  index?: number;
  timestamp?: number;
  detail?: string;
}

export interface ValidationReport {
  ok: boolean;
  candleCount: number;
  startTime?: number;
  endTime?: number;
  /** True when a non-boundary gap was found (continuity broken mid-series). */
  hasGap: boolean;
  issues: ValidationIssue[];
}

function isFinitePositive(n: number): boolean {
  return Number.isFinite(n) && n > 0;
}

function ohlcValid(c: Candle): boolean {
  if (!isFinitePositive(c.open)) return false;
  if (!isFinitePositive(c.high)) return false;
  if (!isFinitePositive(c.low)) return false;
  if (!isFinitePositive(c.close)) return false;
  if (!Number.isFinite(c.volume) || c.volume < 0) return false;
  if (c.high < Math.max(c.open, c.close)) return false;
  if (c.low > Math.min(c.open, c.close)) return false;
  if (c.high < c.low) return false;
  return true;
}

export function validateCandles(candles: Candle[]): ValidationReport {
  const issues: ValidationIssue[] = [];

  if (candles.length === 0) {
    issues.push({ type: 'empty', detail: 'no candles supplied' });
    return { ok: false, candleCount: 0, hasGap: false, issues };
  }

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    if (
      c == null ||
      typeof c.timestamp !== 'number' ||
      typeof c.open !== 'number' ||
      !ohlcValid(c)
    ) {
      issues.push({ type: 'malformed-row', index: i, timestamp: c?.timestamp, detail: 'missing or invalid fields' });
      continue;
    }
    if (i > 0) {
      const prev = candles[i - 1];
      if (c.timestamp === prev.timestamp) {
        issues.push({ type: 'duplicate-timestamp', index: i, timestamp: c.timestamp });
      } else if (c.timestamp < prev.timestamp) {
        issues.push({ type: 'out-of-order', index: i, timestamp: c.timestamp });
      } else if (c.timestamp - prev.timestamp !== MINUTE_MS) {
        issues.push({
          type: 'missing-timestamp',
          index: i,
          timestamp: c.timestamp,
          detail: `gap of ${(c.timestamp - prev.timestamp) / MINUTE_MS} minutes`,
        });
      }
    }
  }

  const hasGap = issues.some((i) => i.type === 'missing-timestamp');
  const ok = issues.length === 0;

  return {
    ok,
    candleCount: candles.length,
    startTime: candles[0].timestamp,
    endTime: candles[candles.length - 1].timestamp,
    hasGap,
    issues,
  };
}
