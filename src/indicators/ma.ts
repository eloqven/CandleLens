// Simple Moving Average (MD §9, §34). For each index >= period-1 the value is
// the arithmetic mean of the last `period` prices; earlier indices are NaN.

export function sma(prices: ArrayLike<number>, period: number): Float64Array {
  if (period <= 0) throw new Error(`period must be positive, got ${period}`);
  const n = prices.length;
  const out = new Float64Array(n).fill(NaN);
  if (n < period) return out;

  let sum = 0;
  for (let i = 0; i < period; i++) sum += prices[i];
  out[period - 1] = sum / period;

  for (let i = period; i < n; i++) {
    sum += prices[i] - prices[i - period];
    out[i] = sum / period;
  }
  return out;
}
