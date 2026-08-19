import { describe, it, expect } from 'vitest';
import { defaultOHLCToggles, filterBySource } from '../../src/interaction/ohlcToggles';
import type { IndicatorLine } from '../../src/indicators/engine';

function line(id: string, source: IndicatorLine['source']): IndicatorLine {
  return { id, type: 'MA', source, period: 1, values: new Float64Array([1]) };
}

describe('OHLC source toggles', () => {
  const lines = [line('o', 'open'), line('h', 'high'), line('l', 'low'), line('c', 'close')];

  it('defaults all sources on', () => {
    const t = defaultOHLCToggles();
    expect(filterBySource(['o', 'h', 'l', 'c'], lines, t)).toEqual(['o', 'h', 'l', 'c']);
  });

  it('filters out disabled sources', () => {
    const t = defaultOHLCToggles();
    t.open = false;
    t.close = false;
    expect(filterBySource(['o', 'h', 'l', 'c'], lines, t)).toEqual(['h', 'l']);
  });

  it('drops unknown line ids', () => {
    const t = defaultOHLCToggles();
    expect(filterBySource(['o', 'missing'], lines, t)).toEqual(['o']);
  });
});
