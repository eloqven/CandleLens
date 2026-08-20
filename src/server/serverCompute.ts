// Server-side compute entry point for the server-spike mode (MD §9). Mirrors
// the browser `computeIndicators` signature from the UI's perspective: given a
// RunConfig it returns the candles and computed lines. The heavy lifting
// (period generation, indicator math, aggregation) happens on the Python
// server; the browser only builds geometry and renders.

import type { RunConfig } from '../core/config';
import type { Candle } from '../core/types';
import type { ComputeResult, IndicatorLine } from '../indicators/engine';
import { CandleLensClient, type ComputeResult as ClientResult } from './client';

export interface ServerComputeResult extends ComputeResult {
  candles: Candle[];
}

export async function computeIndicatorsServer(
  config: RunConfig,
  client: CandleLensClient,
): Promise<ServerComputeResult> {
  const result: ClientResult = await client.fetchIndicators({
    symbol: config.asset.symbol,
    sourceName: config.asset.sourceName,
    interval: config.candle.intervalMinutes,
    history: config.candle.historyPercent,
    slots: config.indicator.slots,
    min: config.indicator.range.min,
    max: config.indicator.range.max,
    mode: config.indicator.mode,
    step: config.indicator.step,
    divisor: config.indicator.divisor,
  });

  return {
    candles: result.candles,
    lines: result.lines as IndicatorLine[],
    candleCount: result.candleCount,
  };
}
