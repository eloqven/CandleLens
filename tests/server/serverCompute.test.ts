import { describe, it, expect } from 'vitest';
import { computeIndicatorsServer } from '../../src/server/serverCompute';
import type { RunConfig } from '../../src/core/config';
import type { CandleLensClient } from '../../src/server/client';

const baseConfig: RunConfig = {
  asset: { symbol: 'BTCUSDT', sourceName: 'server' },
  candle: { intervalMinutes: 1, historyPercent: 1 },
  indicator: {
    slots: [{ type: 'MA', sources: ['close'] }],
    range: { min: 2, max: 4 },
    mode: 'sequential',
    step: 1,
  },
  color: { mode: 'sequential', start: '#ff0000', end: '#0000ff' },
  renderMode: 'lines',
  mesh: { steepness: 0.5 },
};

describe('computeIndicatorsServer', () => {
  it('maps the server response into candles + lines + candleCount', async () => {
    const fake = {
      fetchIndicators: async (p: Record<string, unknown>) => {
        expect(p.symbol).toBe('BTCUSDT');
        expect(p.slots).toEqual([{ type: 'MA', sources: ['close'] }]);
        expect(p.mode).toBe('sequential');
        return {
          candleCount: 1,
          candles: [
            { timestamp: 0, open: 1, high: 2, low: 0.5, close: 1.5, volume: 3, sourceSymbol: 'BTCUSDT', sourceName: 'server' },
          ],
          lines: [
            { id: 'MA-close-2', type: 'MA', source: 'close', period: 2, values: Float64Array.from([NaN, 1]) },
          ],
        };
      },
    } as unknown as CandleLensClient;

    const res = await computeIndicatorsServer(baseConfig, fake);
    expect(res.candleCount).toBe(1);
    expect(res.candles).toHaveLength(1);
    expect(res.lines[0].id).toBe('MA-close-2');
  });

  it('forwards the divisor when mode is divisible', async () => {
    const config: RunConfig = {
      ...baseConfig,
      indicator: { ...baseConfig.indicator, mode: 'divisible', divisor: 3 },
    };
    const fake = {
      fetchIndicators: async (p: Record<string, unknown>) => {
        expect(p.mode).toBe('divisible');
        expect(p.divisor).toBe(3);
        return { candleCount: 0, candles: [], lines: [] };
      },
    } as unknown as CandleLensClient;
    await computeIndicatorsServer(config, fake);
  });
});
