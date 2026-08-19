import { describe, it, expect } from 'vitest';
import { lerpColor, hslPalette, assignLineColors, type LineRef } from '../../src/render/colors';
import type { ColorConfig } from '../../src/core/config';

const lines: LineRef[] = [
  { id: 'MA-close-10', period: 10 },
  { id: 'MA-close-50', period: 50 },
  { id: 'MA-close-90', period: 90 },
];

describe('colors', () => {
  it('lerps between two hex colors', () => {
    expect(lerpColor('#000000', '#ffffff', 0)).toBe('#000000');
    expect(lerpColor('#000000', '#ffffff', 1)).toBe('#ffffff');
    expect(lerpColor('#000000', '#ffffff', 0.5)).toBe('#808080');
  });

  it('generates distinct palette colors', () => {
    const p = hslPalette(3);
    expect(p).toHaveLength(3);
    expect(new Set(p).size).toBe(3);
  });

  it('interpolates a sequential gradient across lines', () => {
    const cfg: ColorConfig = { mode: 'sequential', start: '#000000', end: '#ffffff' };
    const colors = assignLineColors(lines, cfg);
    expect(colors['MA-close-10']).toBe('#000000');
    expect(colors['MA-close-90']).toBe('#ffffff');
  });

  it('assigns a palette for fibonacci mode', () => {
    const cfg: ColorConfig = { mode: 'fibonacci', scheme: 'palette' };
    const colors = assignLineColors(lines, cfg);
    expect(Object.keys(colors)).toHaveLength(3);
  });

  it('assigns distinct colors for divisible per-line', () => {
    const cfg: ColorConfig = { mode: 'divisible', scheme: 'per-line' };
    const colors = assignLineColors(lines, cfg);
    expect(new Set(Object.values(colors)).size).toBe(3);
  });
});
