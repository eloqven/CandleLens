import { describe, it, expect } from 'vitest';
import { fingerprint, canonicalConfig } from '../../src/core/fingerprint';
import type { RunConfig } from '../../src/core/config';

const base: RunConfig = {
  asset: { symbol: 'BTCUSDT', sourceName: 'Binance' },
  candle: { intervalMinutes: 233, historyPercent: 1 },
  indicator: {
    slots: [{ type: 'MA', sources: ['close', 'open'] }],
    range: { min: 1, max: 10 },
    mode: 'sequential',
    step: 1,
  },
  color: { mode: 'sequential', start: '#000', end: '#fff' },
  renderMode: 'lines',
  mesh: { steepness: 0.5 },
};

describe('fingerprint', () => {
  it('is stable for identical calculation configs', () => {
    expect(fingerprint(base)).toBe(fingerprint(base));
  });

  it('ignores presentation changes (color, render mode, steepness)', () => {
    const styled: RunConfig = {
      ...base,
      color: { mode: 'sequential', start: '#f00', end: '#0f0' },
      renderMode: 'mesh',
      mesh: { steepness: 0.9 },
    };
    expect(fingerprint(styled)).toBe(fingerprint(base));
  });

  it('changes when a calculation-affecting field changes', () => {
    const changed: RunConfig = {
      ...base,
      indicator: { ...base.indicator, step: 2 },
    };
    expect(fingerprint(changed)).not.toBe(fingerprint(base));
  });

  it('is order-independent for sources', () => {
    const a = { ...base, indicator: { ...base.indicator, slots: [{ type: 'MA' as const, sources: ['open', 'close'] }] } };
    const b = { ...base, indicator: { ...base.indicator, slots: [{ type: 'MA' as const, sources: ['close', 'open'] }] } };
    expect(fingerprint(a)).toBe(fingerprint(b));
  });

  it('canonicalConfig excludes presentation', () => {
    const c = canonicalConfig(base) as Record<string, unknown>;
    expect(c).not.toHaveProperty('color');
    expect(c).not.toHaveProperty('renderMode');
    expect(c).not.toHaveProperty('mesh');
  });
});
