// Compression codec for heavy numeric payloads (MD §2.3, §19). Columnar
// Float64Arrays are DEFLATEd via fflate so the canonical dataset and per-run
// raw matrix occupy a fraction of their uncompressed size on disk. Smooth
// indicator/price series compress well. Public stores keep their APIs; only
// the on-disk representation changes.

import { deflateSync, inflateSync } from 'fflate';
import type { Candle } from '../core/types';
import type { IndicatorLine } from '../indicators/engine';
import type { RenderGeometry, LineGeometry } from '../render/geometry';

export interface CompressedCandles {
  count: number;
  blob: Uint8Array;
}

export function compressCandles(candles: Candle[]): CompressedCandles {
  const n = candles.length;
  const buf = new Float64Array(n * 6);
  for (let i = 0; i < n; i++) {
    const c = candles[i];
    const o = i * 6;
    buf[o] = c.timestamp;
    buf[o + 1] = c.open;
    buf[o + 2] = c.high;
    buf[o + 3] = c.low;
    buf[o + 4] = c.close;
    buf[o + 5] = c.volume;
  }
  return { count: n, blob: deflateSync(new Uint8Array(buf.buffer)) };
}

export function decompressCandles(
  c: CompressedCandles,
  sourceSymbol: string,
  sourceName: string,
): Candle[] {
  const bytes = inflateSync(c.blob);
  const buf = new Float64Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 8);
  const out: Candle[] = new Array(c.count);
  for (let i = 0; i < c.count; i++) {
    const o = i * 6;
    out[i] = {
      timestamp: buf[o],
      open: buf[o + 1],
      high: buf[o + 2],
      low: buf[o + 3],
      close: buf[o + 4],
      volume: buf[o + 5],
      sourceSymbol,
      sourceName,
    };
  }
  return out;
}

export interface LineHeader {
  id: string;
  type: IndicatorLine['type'];
  source: IndicatorLine['source'];
  period: number;
  length: number;
}

export interface CompressedLines {
  header: LineHeader[];
  blob: Uint8Array;
}

export function compressLines(lines: IndicatorLine[]): CompressedLines {
  const header: LineHeader[] = lines.map((l) => ({
    id: l.id,
    type: l.type,
    source: l.source,
    period: l.period,
    length: l.values.length,
  }));
  let total = 0;
  for (const l of lines) total += l.values.length;
  const buf = new Float64Array(total);
  let off = 0;
  for (const l of lines) {
    buf.set(l.values, off);
    off += l.values.length;
  }
  return { header, blob: deflateSync(new Uint8Array(buf.buffer)) };
}

export function decompressLines(c: CompressedLines): IndicatorLine[] {
  const bytes = inflateSync(c.blob);
  const buf = new Float64Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 8);
  let off = 0;
  return c.header.map((h) => {
    const values = buf.slice(off, off + h.length);
    off += h.length;
    return { id: h.id, type: h.type, source: h.source, period: h.period, values };
  });
}

export interface GeomLineHeader {
  id: string;
  type: LineGeometry['type'];
  source: LineGeometry['source'];
  period: number;
  rawLen: number;
  normLen: number;
}

export interface CompressedGeometry {
  candleCount: number;
  priceMin: number;
  priceMax: number;
  header: GeomLineHeader[];
  blob: Uint8Array;
}

export function compressGeometry(g: RenderGeometry): CompressedGeometry {
  const header: GeomLineHeader[] = g.lines.map((l) => ({
    id: l.id,
    type: l.type,
    source: l.source,
    period: l.period,
    rawLen: l.raw.length,
    normLen: l.normalized.length,
  }));
  let total = 0;
  for (const l of g.lines) total += l.raw.length + l.normalized.length;
  const buf = new Float64Array(total);
  let off = 0;
  for (const l of g.lines) {
    buf.set(l.raw, off);
    off += l.raw.length;
    buf.set(l.normalized, off);
    off += l.normalized.length;
  }
  return {
    candleCount: g.candleCount,
    priceMin: g.priceMin,
    priceMax: g.priceMax,
    header,
    blob: deflateSync(new Uint8Array(buf.buffer)),
  };
}

export function decompressGeometry(c: CompressedGeometry): RenderGeometry {
  const bytes = inflateSync(c.blob);
  const buf = new Float64Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 8);
  let off = 0;
  const lines = c.header.map((h) => {
    const raw = buf.slice(off, off + h.rawLen);
    off += h.rawLen;
    const normalized = buf.slice(off, off + h.normLen);
    off += h.normLen;
    return { id: h.id, type: h.type, source: h.source, period: h.period, raw, normalized };
  });
  return {
    candleCount: c.candleCount,
    priceMin: c.priceMin,
    priceMax: c.priceMax,
    lines,
  };
}
