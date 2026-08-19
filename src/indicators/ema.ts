// Exponential Moving Average (MD §9, §34). Seeded with the SMA of the first
// `period` prices, then iterated with smoothing factor k = 2/(period+1).
// Indices before period-1 are NaN.

export function ema(prices: ArrayLike<number>, period: number): Float64Array {
  if (period <= 0) throw new Error(`period must be positive, got ${period}`);
  const n = prices.length;
  const out = new Float64Array(n).fill(NaN);
  if (n < period) return out;

  const k = 2 / (period + 1);
  // Seed with SMA of the first `period` values.
  let seed = 0;
  for (let i = 0; i < period; i++) seed += prices[i];
  let prev = seed / period;
  out[period - 1] = prev;

  for (let i = period; i < n; i++) {
    prev = prices[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}
