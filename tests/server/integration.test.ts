import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import { CandleLensClient } from '../../src/server/client';
import { computeIndicatorsServer } from '../../src/server/serverCompute';
import { buildGeometry } from '../../src/render/geometry';
import { assignLineColors } from '../../src/render/colors';
import type { RunConfig } from '../../src/core/config';

const PY = process.env.CANDLELENS_PYTHON ?? 'python';
const PORT = 8231;
const BASE = `http://127.0.0.1:${PORT}`;
const DB = 'integration_test.db';

async function waitForHealth(timeoutMs = 10000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/health`);
      if (r.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  return false;
}

const pythonAvailable = (() => {
  try {
    spawn(PY, ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
})();

describe.skipIf(!pythonAvailable)('live server-spike integration', () => {
  let server: ChildProcess;

  beforeAll(async () => {
    // seed then serve
    await new Promise<void>((resolve, reject) => {
      const seed = spawn(PY, ['server/api.py', '--seed-synthetic', 'BTCUSDT', '--seed-n', '300'], {
        env: { ...process.env, CANDLELENS_DB: DB },
        stdio: 'ignore',
      });
      seed.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`seed exited ${code}`))));
    });
    server = spawn(PY, ['server/api.py', '--serve', '--port', String(PORT)], {
      env: { ...process.env, CANDLELENS_DB: DB },
      stdio: 'ignore',
    });
    const up = await waitForHealth();
    if (!up) throw new Error('server did not start');
  }, 20000);

  afterAll(() => {
    server?.kill();
    if (existsSync(DB)) require('fs').unlinkSync(DB);
  });

  it('fetches computed indicator lines from the running API', async () => {
    const client = new CandleLensClient(BASE);
    const result = await client.fetchIndicators({
      symbol: 'BTCUSDT',
      interval: 1,
      history: 1,
      slots: [{ type: 'EMA', sources: ['close'] }],
      min: 2,
      max: 4,
      mode: 'sequential',
      step: 1,
    });
    expect(result.lines.length).toBe(3);
    expect(result.lines[0].type).toBe('EMA');
    expect(result.lines[0].values.length).toBeGreaterThan(0);
  });

  it('computes a full scene via serverCompute + geometry + colors', async () => {
    const client = new CandleLensClient(BASE);
    const config: RunConfig = {
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
    const res = await computeIndicatorsServer(config, client);
    expect(res.lines.length).toBe(3);
    expect(res.candles.length).toBeGreaterThan(0);
    const geo = buildGeometry(res.candles, res.lines);
    expect(geo.lines.length).toBe(3);
    const colors = assignLineColors(
      res.lines.map((l) => ({ id: l.id, period: l.period })),
      config.color,
    );
    expect(Object.keys(colors).length).toBe(3);
  });
});
