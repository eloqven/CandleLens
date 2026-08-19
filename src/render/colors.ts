// Color system (MD §13). Assigns a color to each indicator line according to the
// period-generation mode and its color configuration. Pure and testable.

import type { ColorConfig } from '../core/config';

export interface LineRef {
  id: string;
  period: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

export function lerpColor(start: string, end: string, t: number): string {
  const a = hexToRgb(start);
  const b = hexToRgb(end);
  const k = Math.max(0, Math.min(1, t));
  return rgbToHex(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k);
}

/** Generate `count` visually distinct colors via evenly spaced hues. */
export function hslPalette(count: number): string[] {
  if (count <= 0) return [];
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const hue = Math.round((360 * i) / count);
    out.push(`hsl(${hue}, 70%, 55%)`);
  }
  return out;
}

/**
 * Assign a color to every line based on its mode/scheme. Lines are ordered by
 * period so gradients and palettes are stable and reproducible.
 */
export function assignLineColors(lines: LineRef[], config: ColorConfig): Record<string, string> {
  const ordered = [...lines].sort((a, b) => a.period - b.period);
  const n = ordered.length;
  const result: Record<string, string> = {};

  const gradient = (start: string, end: string) => {
    ordered.forEach((line, i) => {
      result[line.id] = n <= 1 ? start : lerpColor(start, end, i / (n - 1));
    });
  };
  const palette = () => {
    const colors = hslPalette(n);
    ordered.forEach((line, i) => (result[line.id] = colors[i]));
  };

  switch (config.mode) {
    case 'sequential':
      gradient(config.start, config.end);
      break;
    case 'fibonacci':
      palette();
      break;
    case 'divisible':
      if (config.scheme === 'gradient') gradient(config.start ?? '#ff0000', config.end ?? '#0000ff');
      else palette(); // palette or per-line both yield distinct colors here
      break;
  }
  return result;
}
