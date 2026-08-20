// TypeScript client for the server-spike API (MD §9). The browser calls this
// instead of running the Web Worker: the server computes the indicator lines
// and returns only what the view needs. `fetch` is injectable so the client is
// unit-testable without a live server.

import type { Candle, IndicatorType, PeriodMode, PriceSource } from '../core/types';
import type { IndicatorLine } from '../indicators/engine';
import type { IndicatorSlotConfig } from '../core/config';

export type IndicatorKind = Extract<IndicatorType, 'MA' | 'EMA' | 'WMA'>;

export interface ComputeParams {
  symbol: string;
  /** Human-readable source name stamped onto returned candles. */
  sourceName?: string;
  /** Aggregation interval in minutes (1 = base 1-minute candles). */
  interval: number;
  /** Fraction of available derived candles to load, 0..1 (MD §6). */
  history: number;
  /** Indicator slots (MD §9). */
  slots: IndicatorSlotConfig[];
  min: number;
  max: number;
  mode: PeriodMode;
  step: number;
  /** Divisor for divisible mode (MD §12); omit otherwise. */
  divisor?: number;
}

export interface AssetSummary {
  symbol: string;
  sourceName: string;
  startTime: number;
  endTime: number;
  candleCount: number;
  status: string;
}

export interface RunMeta {
  id: string;
  createdAt: string;
  asset: { symbol: string };
  [key: string]: unknown;
}

export interface RunPayload {
  lines: unknown[];
  geometry: unknown;
}

export interface ComputeResult {
  candles: Candle[];
  lines: IndicatorLine[];
  candleCount: number;
}

interface ApiLine {
  id: string;
  type: IndicatorType;
  source: PriceSource;
  period: number;
  values: (number | null)[];
}

interface ApiCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface IndicatorsResponse {
  candleCount: number;
  candles: ApiCandle[];
  lines: ApiLine[];
}

export class CandleLensClient {
  private readonly fetchImpl: typeof fetch;

  constructor(
    private readonly baseUrl: string,
    fetchImpl: typeof fetch = fetch,
  ) {
    // Bind to the global so the detached reference stays callable (calling the
    // host `fetch` with a different `this` throws "Illegal invocation" in browsers).
    this.fetchImpl = fetchImpl.bind(globalThis);
  }

  async fetchCandles(symbol: string, limit = 1000): Promise<Candle[]> {
    const url = `${this.baseUrl}/candles?symbol=${encodeURIComponent(symbol)}&limit=${limit}`;
    const res = await this.fetchImpl(url);
    const data = (await res.json()) as { candles: ApiCandle[] };
    return data.candles.map((c) => this.toCandle(c, symbol));
  }

  async fetchIndicators(p: ComputeParams): Promise<ComputeResult> {
    const params = new URLSearchParams({
      symbol: p.symbol,
      interval: String(p.interval),
      history: String(p.history),
      slots: JSON.stringify(p.slots),
      min: String(p.min),
      max: String(p.max),
      mode: p.mode,
      step: String(p.step),
    });
    if (p.mode === 'divisible' && p.divisor != null) {
      params.set('divisor', String(p.divisor));
    }
    const res = await this.fetchImpl(`${this.baseUrl}/indicators?${params.toString()}`);
    const data = (await res.json()) as IndicatorsResponse;
    if ('error' in data) {
      throw new Error((data as { error: string }).error);
    }
    return {
      candleCount: data.candleCount,
      candles: data.candles.map((c) => this.toCandle(c, p.symbol, p.sourceName)),
      lines: data.lines.map((l) => ({
        id: l.id,
        type: l.type,
        source: l.source,
        period: l.period,
        values: Float64Array.from(l.values.map((v) => (v == null ? NaN : v))),
      })),
    };
  }

  async fetchAssets(): Promise<AssetSummary[]> {
    const res = await this.fetchImpl(`${this.baseUrl}/assets`);
    const data = (await res.json()) as { assets: AssetSummary[] };
    return data.assets;
  }

  async listRuns(): Promise<RunMeta[]> {
    const res = await this.fetchImpl(`${this.baseUrl}/runs`);
    const data = (await res.json()) as { runs: RunMeta[] };
    return data.runs;
  }

  async saveRun(meta: RunMeta, payload: RunPayload): Promise<void> {
    const res = await this.fetchImpl(`${this.baseUrl}/runs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meta, payload }),
    });
    if (!res.ok) {
      throw new Error(`saveRun failed: ${res.status}`);
    }
  }

  async loadRun(id: string): Promise<{ meta: RunMeta; payload: RunPayload }> {
    const res = await this.fetchImpl(`${this.baseUrl}/runs/${encodeURIComponent(id)}`);
    if (!res.ok) {
      throw new Error(`loadRun failed: ${res.status}`);
    }
    return (await res.json()) as { meta: RunMeta; payload: RunPayload };
  }

  async deleteRun(id: string): Promise<void> {
    const res = await this.fetchImpl(`${this.baseUrl}/runs/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      throw new Error(`deleteRun failed: ${res.status}`);
    }
  }

  private toCandle(c: ApiCandle, symbol: string, sourceName = 'server'): Candle {
    return {
      timestamp: c.timestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
      sourceSymbol: symbol,
      sourceName,
    };
  }
}
