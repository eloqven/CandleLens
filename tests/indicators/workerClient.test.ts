import { describe, it, expect } from 'vitest';
import { runCompute, type WorkerLike } from '../../src/indicators/workerClient';
import { computeIndicatorsWithProgress } from '../../src/indicators/engine';
import type { ComputeRequest, ComputeResponse } from '../../src/workers/compute.worker';
import type { IndicatorConfig } from '../../src/core/config';
import { MINUTE_MS, type Candle } from '../../src/core/types';

function candles(n: number): Candle[] {
  return Array.from({ length: n }, (_, i) => ({
    timestamp: i * MINUTE_MS,
    open: 10 + i,
    high: 12 + i,
    low: 9 + i,
    close: 11 + i,
    volume: 1,
    sourceSymbol: 'X',
    sourceName: 'Y',
  }));
}

const config: IndicatorConfig = {
  slots: [{ type: 'MA', sources: ['close'] }],
  range: { min: 1, max: 5 },
  mode: 'sequential',
  step: 1,
};

/** Fake worker that mirrors the real worker's message protocol. */
class FakeWorker implements WorkerLike {
  onmessage: ((e: MessageEvent<ComputeResponse>) => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  postMessage(req: ComputeRequest): void {
    const progress: ComputeResponse[] = [];
    computeIndicatorsWithProgress(req.candles, req.config, (completed, total) => {
      progress.push({ type: 'progress', jobId: req.jobId, completed, total });
    });
    const result = computeIndicatorsWithProgress(req.candles, req.config);
    const done: ComputeResponse = { type: 'done', jobId: req.jobId, result };
    queueMicrotask(() => {
      for (const p of progress) this.onmessage?.({ data: p } as MessageEvent<ComputeResponse>);
      this.onmessage?.({ data: done } as MessageEvent<ComputeResponse>);
    });
  }
  terminate(): void {}
}

describe('runCompute (worker client)', () => {
  it('resolves with the computed result', async () => {
    const result = await runCompute(candles(10), config, {
      workerFactory: () => new FakeWorker(),
    });
    expect(result.lines).toHaveLength(5);
  });

  it('reports progress as lines complete', async () => {
    const seen: Array<[number, number]> = [];
    await runCompute(candles(10), config, {
      workerFactory: () => new FakeWorker(),
      onProgress: (c, t) => seen.push([c, t]),
    });
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[seen.length - 1]).toEqual([5, 5]);
  });
});
