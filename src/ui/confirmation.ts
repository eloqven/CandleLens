// Pre-calculation confirmation summary (MD §16). Builds the human-readable
// recap shown before a run starts. Pure and testable.

import type { RunConfig } from '../core/config';
import type { WorkloadEstimate } from '../run/workload';

function fmtMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${(ms / 60_000).toFixed(1)} min`;
}

export function buildConfirmationSummary(
  config: RunConfig,
  workload: WorkloadEstimate,
): string[] {
  const ind = config.indicator;
  const types = [...new Set(ind.slots.map((s) => s.type))].join(', ');
  const sources = [...new Set(ind.slots.flatMap((s) => s.sources))].join(', ');
  const modeDetail =
    ind.mode === 'divisible'
      ? `Divisible (divisor ${ind.divisor ?? '?'})`
      : ind.mode === 'fibonacci'
        ? 'Fibonacci'
        : `Sequential (step ${ind.step})`;

  return [
    `Asset: ${config.asset.symbol} (${config.asset.sourceName})`,
    `Candle interval: ${config.candle.intervalMinutes} min`,
    `Candles: ${config.candle.historyPercent * 100}% of available`,
    `Indicator types: ${types}`,
    `Price sources: ${sources}`,
    `Period range: ${ind.range.min}–${ind.range.max}`,
    `Generation mode: ${modeDetail}`,
    `Number of indicator lines: ${workload.lines}`,
    `Rendering mode: ${config.renderMode}`,
    `Estimated data points: ${workload.lines * 0 + workload.points}`,
    `Estimated time: ${fmtMs(workload.estimatedMs)}`,
  ];
}
