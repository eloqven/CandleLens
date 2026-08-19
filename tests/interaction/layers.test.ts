import { describe, it, expect } from 'vitest';
import { defaultToggles, isLineVisible, visibleLineIds } from '../../src/interaction/layers';
import type { IndicatorLine } from '../../src/indicators/engine';

function line(id: string, type: IndicatorLine['type'], source: IndicatorLine['source']): IndicatorLine {
  return { id, type, source, period: 1, values: new Float64Array([1]) };
}

describe('layer controls', () => {
  const lines = [line('a', 'MA', 'close'), line('b', 'EMA', 'close'), line('c', 'MA', 'open')];

  it('defaults everything visible', () => {
    const t = defaultToggles(lines);
    expect(visibleLineIds(lines, t).size).toBe(3);
  });

  it('hides a whole type', () => {
    const t = defaultToggles(lines);
    t.byType['EMA'] = false;
    expect(visibleLineIds(lines, t)).toEqual(new Set(['a', 'c']));
  });

  it('hides a whole source', () => {
    const t = defaultToggles(lines);
    t.bySource['open'] = false;
    expect(isLineVisible(lines[2], t)).toBe(false);
    expect(isLineVisible(lines[0], t)).toBe(true);
  });
});
