// Configuration types for a CandleLens run.
// A RunConfig is the complete, serializable description of one calculation.

import type {
  IndicatorType,
  PeriodMode,
  PriceSource,
  RenderMode,
} from './types';

export interface AssetConfig {
  /** Symbol as provided by the source, e.g. "BTCUSDT". */
  symbol: string;
  sourceName: string;
}

export interface CandleConfig {
  /** Derived candle interval in minutes, 1..377 (MD §5). */
  intervalMinutes: number;
  /** Fraction of available derived candles to load, 0..1 (MD §6). */
  historyPercent: number;
}

export interface IndicatorSlotConfig {
  type: IndicatorType;
  /** One or more price sources; each is computed separately (MD §9). */
  sources: PriceSource[];
}

export interface PeriodRange {
  min: number;
  max: number;
}

export interface IndicatorConfig {
  /** Up to three indicator slots (MD §9). */
  slots: IndicatorSlotConfig[];
  /** Selected period range; `0` is a boundary, not an actual period (MD §10). */
  range: PeriodRange;
  mode: PeriodMode;
  /** Density step for sequential mode; must be a positive integer (MD §11). */
  step: number;
  /** Divisor for divisible mode (MD §12). */
  divisor?: number;
}

/** Color configuration varies by period-generation mode (MD §13). */
export type ColorConfig =
  | { mode: 'sequential'; start: string; end: string }
  | { mode: 'fibonacci'; scheme: 'individual' | 'palette' }
  | {
      mode: 'divisible';
      scheme: 'gradient' | 'palette' | 'per-line';
      start?: string;
      end?: string;
    };

export interface MeshConfig {
  /** Gradient steepness for mesh rendering, 0..1 (MD §15). */
  steepness: number;
}

export interface RunConfig {
  asset: AssetConfig;
  candle: CandleConfig;
  indicator: IndicatorConfig;
  color: ColorConfig;
  renderMode: RenderMode;
  mesh: MeshConfig;
}
