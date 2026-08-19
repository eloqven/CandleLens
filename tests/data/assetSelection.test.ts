import { describe, it, expect } from 'vitest';
import { scoreAsset, selectControlAsset, type AssetMetrics } from '../../src/data/assetSelection';

const btc: AssetMetrics = {
  symbol: 'BTCUSDT',
  volume24h: 20_000_000_000,
  historyMonths: 48,
  gapFreeFraction: 1,
  correlationToBtc: 1,
};

describe('asset selection', () => {
  it('scores higher volume and longer history better', () => {
    const a: AssetMetrics = { symbol: 'A', volume24h: 5e9, historyMonths: 40, gapFreeFraction: 1, correlationToBtc: 0.5 };
    const b: AssetMetrics = { symbol: 'B', volume24h: 1e9, historyMonths: 20, gapFreeFraction: 0.9, correlationToBtc: 0.5 };
    expect(scoreAsset(a, btc)).toBeGreaterThan(scoreAsset(b, btc));
  });

  it('prefers materially different behavior (lower BTC correlation)', () => {
    const lowCorr: AssetMetrics = { symbol: 'A', volume24h: 5e9, historyMonths: 40, gapFreeFraction: 1, correlationToBtc: 0.2 };
    const highCorr: AssetMetrics = { symbol: 'B', volume24h: 5e9, historyMonths: 40, gapFreeFraction: 1, correlationToBtc: 0.9 };
    expect(scoreAsset(lowCorr, btc)).toBeGreaterThan(scoreAsset(highCorr, btc));
  });

  it('selects the best control asset and explains why', () => {
    const candidates: AssetMetrics[] = [
      btc,
      { symbol: 'ETHUSDT', volume24h: 9e9, historyMonths: 48, gapFreeFraction: 1, correlationToBtc: 0.8 },
      { symbol: 'SOLUSDT', volume24h: 3e9, historyMonths: 36, gapFreeFraction: 0.95, correlationToBtc: 0.6 },
    ];
    const result = selectControlAsset(candidates, btc);
    expect(result.symbol).toBe('ETHUSDT');
    expect(result.rationale).toContain('ETHUSDT');
    expect(result.rationale).toContain('control asset');
  });

  it('excludes BTC from the candidate pool', () => {
    const candidates: AssetMetrics[] = [btc];
    expect(() => selectControlAsset(candidates, btc)).toThrow();
  });
});
