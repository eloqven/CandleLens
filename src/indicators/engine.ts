// Indicator computation engine (MD §9, §11). Orchestrates the three indicator
// slots, their price sources, and the generated period set into a flat list of
// computed lines. Pure and deterministic; the Web Worker (C12) wraps it.

import type { Candle, IndicatorType, PriceSource } from '../core/types';
import type { IndicatorConfig } from '../core/config';
import { sma } from './ma';
import { ema } from './ema';
import { wma } from './wma';
import { generatePeriods } from './periods';

export interface IndicatorLine {
  id: string;
  type: IndicatorType;
  source: PriceSource;
  period: number;
  values: Float64Array;
}

export interface ComputeResult {
  lines: IndicatorLine[];
  candleCount: number;
}

function priceSeries(candles: Candle[], source: PriceSource): Float64Array {
  const out = new Float64Array(candles.length);
  for (let i = 0; i < candles.length; i++) {
    out[i] = candles[i][source];
  }
  return out;
}

function computeOne(
  type: IndicatorType,
  series: Float64Array,
  period: number,
): Float64Array {
  switch (type) {
    case 'MA':
      return sma(series, period);
    case 'EMA':
      return ema(series, period);
    case 'WMA':
      return wma(series, period);
  }
}

/** Compute a single indicator line for one type/source/period. */
export function computeLine(
  candles: Candle[],
  type: IndicatorType,
  source: PriceSource,
  period: number,
): IndicatorLine {
  const series = priceSeries(candles, source);
  return {
    id: `${type}-${source}-${period}`,
    type,
    source,
    period,
    values: computeOne(type, series, period),
  };
}

/** Compute all indicator lines described by the configuration. */
export function computeIndicators(
  candles: Candle[],
  config: IndicatorConfig,
): ComputeResult {
  const periods = generatePeriods(config);
  const lines: IndicatorLine[] = [];

  for (const slot of config.slots) {
    for (const source of slot.sources) {
      const series = priceSeries(candles, source);
      for (const period of periods) {
        lines.push({
          id: `${slot.type}-${source}-${period}`,
          type: slot.type,
          source,
          period,
          values: computeOne(slot.type, series, period),
        });
      }
    }
  }

  return { lines, candleCount: candles.length };
}

export type ProgressFn = (completed: number, total: number) => void;

/**
 * Compute all lines while reporting progress. The progress count is the number
 * of fully computed lines, so the UI can show real completion rather than
 * elapsed time (MD §18).
 */
export function computeIndicatorsWithProgress(
  candles: Candle[],
  config: IndicatorConfig,
  onProgress?: ProgressFn,
): ComputeResult {
  const periods = generatePeriods(config);
  const lines: IndicatorLine[] = [];
  const total = config.slots.reduce(
    (acc, s) => acc + s.sources.length * periods.length,
    0,
  );

  let completed = 0;
  for (const slot of config.slots) {
    for (const source of slot.sources) {
      const series = priceSeries(candles, source);
      for (const period of periods) {
        lines.push({
          id: `${slot.type}-${source}-${period}`,
          type: slot.type,
          source,
          period,
          values: computeOne(slot.type, series, period),
        });
        completed++;
        onProgress?.(completed, total);
      }
    }
  }

  return { lines, candleCount: candles.length };
}
