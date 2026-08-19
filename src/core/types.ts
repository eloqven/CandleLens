// Core domain primitives for CandleLens.
// These types are source-agnostic: no Binance / UI / storage specifics leak here.

export type PriceSource = 'open' | 'high' | 'low' | 'close';

export type IndicatorType = 'MA' | 'EMA' | 'WMA';

export type PeriodMode = 'sequential' | 'fibonacci' | 'divisible';

export type RenderMode = 'lines' | 'mesh';

export type RunStatus =
  | 'CREATED'
  | 'QUEUED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

/** A single OHLCV candle. Used for both the canonical 1-minute base and derived candles. */
export interface Candle {
  /** Unix epoch milliseconds of the candle open time. */
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** Symbol as provided by the source, e.g. "BTCUSDT". */
  sourceSymbol: string;
  /** Human-readable source name, e.g. "Binance". */
  sourceName: string;
}

/** Provenance recorded with every ingested dataset. */
export interface DataProvenance {
  sourceName: string;
  sourceSymbol: string;
  /** Earliest candle timestamp actually obtained (after gap stop). */
  startTime: number;
  /** Latest candle timestamp obtained. */
  endTime: number;
  /** Number of 1-minute candles stored. */
  candleCount: number;
  /** Why ingestion stopped: reached 48-month boundary or hit a gap. */
  stopReason: 'max-history' | 'gap' | 'partial';
  /** ISO timestamp of the ingestion run. */
  ingestedAt: string;
}

export const MINUTE_MS = 60_000;

/** The five inspectable snap points on a candle (MD §25). */
export type SnapPointKind = 'open' | 'high' | 'low' | 'close' | 'center';

export const SNAP_POINT_KINDS: SnapPointKind[] = [
  'open',
  'high',
  'low',
  'close',
  'center',
];
