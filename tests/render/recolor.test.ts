import { describe, it, expect } from 'vitest';
import { recolor } from '../../src/render/recolor';
import type { IndicatorLine } from '../../src/indicators/engine';
import type { ColorConfig } from '../../src/core/config';

function line(id: string, period: number): IndicatorLine {
  return { id, type: 'MA', source: 'close', period, values: new Float64Array([1, 2]) };
}

describe('recolor without recomputation', () => {
  const lines = [line('a', 2), line('b', 5), line('c', 10)];

  it('assigns colors from a sequential config', () => {
    const cfg: ColorConfig = { mode: 'sequential', start: '#000000', end: '#ffffff' };
    const out = recolor(lines, cfg);
    expect(out).toHaveLength(3);
    expect(out[0].color).toBe('#000000');
    expect(out[2].color).toBe('#ffffff');
    // values are passed through untouched (no recompute)
    expect(out[1].values[1]).toBe(2);
  });

  it('recolors the same lines differently with a palette', () => {
    const seq: ColorConfig = { mode: 'sequential', start: '#000000', end: '#ffffff' };
    const pal: ColorConfig = { mode: 'fibonacci', scheme: 'palette' };
    const a = recolor(lines, seq);
    const b = recolor(lines, pal);
    expect(a[0].color).not.toBe(b[0].color);
  });
});
