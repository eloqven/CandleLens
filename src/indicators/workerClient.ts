// Client wrapper around the compute worker (MD §32). Keeps the heavy indicator
// math off the main thread. The worker factory is injectable so the same code
// can be exercised in tests without a real Worker.

import type { Candle } from '../core/types';
import type { IndicatorConfig } from '../core/config';
import type { ComputeResult } from '../indicators/engine';
import type { ComputeRequest, ComputeResponse } from '../workers/compute.worker';

export interface WorkerLike {
  postMessage(msg: ComputeRequest): void;
  terminate(): void;
  onmessage: ((e: MessageEvent<ComputeResponse>) => void) | null;
  onerror: ((e: unknown) => void) | null;
}

export interface RunComputeOptions {
  onProgress?: (completed: number, total: number) => void;
  workerFactory?: () => WorkerLike;
}

function defaultFactory(): WorkerLike {
  const worker = new Worker(new URL('../workers/compute.worker.ts', import.meta.url), {
    type: 'module',
  });
  return worker as unknown as WorkerLike;
}

export function runCompute(
  candles: Candle[],
  config: IndicatorConfig,
  options: RunComputeOptions = {},
): Promise<ComputeResult> {
  const factory = options.workerFactory ?? defaultFactory;
  const worker = factory();
  const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  return new Promise<ComputeResult>((resolve, reject) => {
    worker.onmessage = (e: MessageEvent<ComputeResponse>) => {
      const msg = e.data;
      if (msg.jobId !== jobId) return;
      if (msg.type === 'progress') {
        options.onProgress?.(msg.completed, msg.total);
      } else if (msg.type === 'done') {
        resolve(msg.result);
        worker.terminate();
      } else if (msg.type === 'error') {
        reject(new Error(msg.message));
        worker.terminate();
      }
    };
    worker.onerror = (e) => {
      reject(e instanceof Error ? e : new Error(String(e)));
      worker.terminate();
    };

    worker.postMessage({ jobId, candles, config });
  });
}
