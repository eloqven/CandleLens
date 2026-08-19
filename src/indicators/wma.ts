// Weighted Moving Average (MD §9, §34). Weights increase linearly (1..period);
// the most recent price has the highest weight. Indices before period-1 are NaN.

export function wma(prices: ArrayLike<number>, period: number): Float64Array {
  if (period <= 0) throw new Error(`period must be positive, got ${period}`);
  const n = prices.length;
  const out = new Float64Array(n).fill(NaN);
  if (n < period) return out;

  const weightSum = (period * (period + 1)) / 2;

  for (let i = period - 1; i < n; i++) {
    let acc = 0;
    for (let j = 0; j < period; j++) {
      const weight = j + 1; // oldest=1 … newest=period
      acc += prices[i - period + 1 + j] * weight;
    }
    out[i] = acc / weightSum;
  }
  return out;
}
