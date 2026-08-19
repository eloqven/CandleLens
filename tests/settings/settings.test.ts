import { describe, it, expect } from 'vitest';
import { saveSettings, loadSettings, clearSettings } from '../../src/settings/settings';
import type { RunConfig, AssetConfig } from '../../src/core/config';
import type { StorageLike } from '../../src/settings/settings';

function fakeStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
  };
}

const asset: AssetConfig = { symbol: 'BTCUSDT', sourceName: 'Binance' };
const config: RunConfig = {
  asset,
  candle: { intervalMinutes: 233, historyPercent: 1 },
  indicator: { slots: [{ type: 'MA', sources: ['close'] }], range: { min: 1, max: 5 }, mode: 'sequential', step: 1 },
  color: { mode: 'sequential', start: '#000', end: '#fff' },
  renderMode: 'mesh',
  mesh: { steepness: 0.5 },
};

describe('settings persistence', () => {
  it('round-trips config and viewer settings', () => {
    const s = fakeStorage();
    const settings = {
      config,
      viewer: { renderMode: 'mesh' as const, color: config.color, mesh: config.mesh },
    };
    saveSettings(settings, s);
    const loaded = loadSettings(s);
    expect(loaded?.config?.asset.symbol).toBe('BTCUSDT');
    expect(loaded?.viewer?.renderMode).toBe('mesh');
    expect(loaded?.viewer?.mesh.steepness).toBe(0.5);
  });

  it('returns null when nothing stored', () => {
    expect(loadSettings(fakeStorage())).toBeNull();
  });

  it('returns null on corrupt data', () => {
    const s = fakeStorage();
    s.setItem('candlelens.settings', '{not json');
    expect(loadSettings(s)).toBeNull();
  });

  it('clears to empty', () => {
    const s = fakeStorage();
    saveSettings({ config }, s);
    clearSettings(s);
    expect(loadSettings(s)).toEqual({});
  });
});
