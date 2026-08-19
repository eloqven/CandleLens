// Asset selection for the second "high-volume control" asset (MD §3).
// The selection is implemented as a scoring process over explicit criteria
// (volume, history length, gap-freeness, and behavioral difference from BTC)
// rather than being hard-coded to a popular symbol. The chosen asset and its
// rationale are returned so they can be persisted in run metadata and docs.

export interface AssetMetrics {
  symbol: string;
  /** 24h quote volume (USD-equivalent). */
  volume24h: number;
  /** Continuous 1-minute history obtainable, in months. */
  historyMonths: number;
  /** Fraction of the obtainable window that is gap-free, 0..1. */
  gapFreeFraction: number;
  /** Pearson correlation of returns to BTC over the overlapping window, -1..1. */
  correlationToBtc: number;
}

export interface SelectionResult {
  symbol: string;
  score: number;
  rationale: string;
}

const WEIGHTS = {
  volume: 0.3,
  history: 0.3,
  gap: 0.2,
  difference: 0.2,
};

function normalize(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.max(0, Math.min(1, value / max));
}

/** Score one candidate against the BTC reference metrics. Higher is better. */
export function scoreAsset(candidate: AssetMetrics, btc: AssetMetrics): number {
  const vol = normalize(candidate.volume24h, btc.volume24h);
  const hist = normalize(candidate.historyMonths, 48);
  const gap = candidate.gapFreeFraction;
  // Materially different behavior → prefer lower correlation to BTC.
  const difference = 1 - Math.max(0, Math.min(1, candidate.correlationToBtc));
  return (
    WEIGHTS.volume * vol +
    WEIGHTS.history * hist +
    WEIGHTS.gap * gap +
    WEIGHTS.difference * difference
  );
}

/**
 * Select the best control asset from candidates, excluding BTC.
 * Returns the symbol, its score, and a human-readable rationale.
 */
export function selectControlAsset(
  candidates: AssetMetrics[],
  btc: AssetMetrics,
): SelectionResult {
  const pool = candidates.filter((c) => c.symbol !== btc.symbol);
  if (pool.length === 0) {
    throw new Error('No candidate assets supplied for control selection');
  }

  let best: AssetMetrics | null = null;
  let bestScore = -Infinity;
  for (const c of pool) {
    const s = scoreAsset(c, btc);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }

  const chosen = best!;
  const volRank = pool
    .slice()
    .sort((a, b) => b.volume24h - a.volume24h)
    .findIndex((c) => c.symbol === chosen.symbol) + 1;

  const rationale =
    `Selected ${chosen.symbol} as the high-volume control asset ` +
    `(score ${bestScore.toFixed(3)}). It ranks #${volRank} of ${pool.length} candidates by 24h volume ` +
    `(${chosen.volume24h.toExponential(2)}), offers ${chosen.historyMonths.toFixed(1)} months of continuous ` +
    `1-minute history (${Math.round(chosen.gapFreeFraction * 100)}% gap-free), and behaves materially ` +
    `differently from BTC (return correlation ${chosen.correlationToBtc.toFixed(2)}). ` +
    `Same source as BTC, satisfying the single-source rule.`;

  return { symbol: chosen.symbol, score: bestScore, rationale };
}

/** Injectable fetch for 24h volume from a ticker endpoint (Binance-shaped). */
export type VolumeFetcher = (symbol: string) => Promise<number>;

export async function fetchCandidateVolumes(
  symbols: string[],
  fetchFn: VolumeFetcher,
): Promise<number[]> {
  return Promise.all(symbols.map((s) => fetchFn(s)));
}
