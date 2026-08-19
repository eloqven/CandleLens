// TypeScript client for the server-spike API (MD §9, proof of concept).
// The browser calls this instead of running the Web Worker: the server
// computes the indicator lines and returns only what the view needs. `fetch`
// is injectable so the client is unit-testable without a live server.

import type { Candle, IndicatorType, PriceSource } from '../core/types';
import type { IndicatorLine } from '../indicators/engine';

export type IndicatorKind = Extract<IndicatorType, 'MA' | 'EMA' | 'WMA'>;

export interface IndicatorQuery {
  symbol: string;
  /** Aggregation interval in minutes (1 = base 1-minute candles). */
  interval: number;
  type: IndicatorKind;
  source: PriceSource;
  min: number;
  max: number;
  mode?: 'sequential' | 'fibonacci';
  step?: number;
}

interface ApiLine {
  id: string;
  period: number;
  values: (number | null)[];
}

interface IndicatorsResponse {
  candleCount: number;
  lines: ApiLine[];
}

export class CandleLensClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async fetchCandles(symbol: string, limit = 1000): Promise<Candle[]> {
    const url = `${this.baseUrl}/candles?symbol=${encodeURIComponent(symbol)}&limit=${limit}`;
    const res = await this.fetchImpl(url);
    const data = (await res.json()) as { candles: Candle[] };
    return data.candles;
  }

  async fetchIndicators(q: IndicatorQuery): Promise<IndicatorLine[]> {
    const params = new URLSearchParams({
      symbol: q.symbol,
      interval: String(q.interval),
      type: q.type,
      source: q.source,
      min: String(q.min),
      max: String(q.max),
      mode: q.mode ?? 'sequential',
      step: String(q.step ?? 1),
    });
    const res = await this.fetchImpl(`${this.baseUrl}/indicators?${params.toString()}`);
    const data = (await res.json()) as IndicatorsResponse;
    return data.lines.map((l) => ({
      id: l.id,
      type: q.type,
      source: q.source,
      period: l.period,
      values: Float64Array.from(l.values.map((v) => (v == null ? NaN : v))),
    }));
  }
}
