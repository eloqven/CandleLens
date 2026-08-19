// Configuration fingerprint (MD §22). A deterministic hash of the parts of a
// RunConfig that materially affect the calculation (asset, interval, history,
// indicator slots/sources/range/mode/step/divisor). Presentation settings
// (colors, render mode, mesh steepness) are intentionally excluded, so two
// runs that compute the same thing produce the same fingerprint even if styled
// differently.

import type { RunConfig } from './config';

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

/** FNV-1a 32-bit hash, returned as an 8-char hex string. */
function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/** The calculation-affecting subset of a run configuration. */
export function canonicalConfig(config: RunConfig): unknown {
  return {
    symbol: config.asset.symbol,
    source: config.asset.sourceName,
    interval: config.candle.intervalMinutes,
    history: config.candle.historyPercent,
    indicator: {
      slots: config.indicator.slots.map((s) => ({
        type: s.type,
        sources: [...s.sources].sort(),
      })),
      range: config.indicator.range,
      mode: config.indicator.mode,
      step: config.indicator.step,
      divisor: config.indicator.divisor ?? null,
    },
  };
}

export function fingerprint(config: RunConfig): string {
  return `fnv1a:${fnv1a(stableStringify(canonicalConfig(config)))}`;
}
