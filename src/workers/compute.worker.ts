// Web Worker entry point (MD §32). Runs indicator computation off the main
// thread so the UI never freezes. Reports real progress as lines complete.

import { computeIndicatorsWithProgress, type ComputeResult } from '../indicators/engine';
import type { Candle } from '../core/types';
import type { IndicatorConfig } from '../core/config';

export interface ComputeRequest {
  jobId: string;
  candles: Candle[];
  config: IndicatorConfig;
}

export type ComputeResponse =
  | { type: 'progress'; jobId: string; completed: number; total: number }
  | { type: 'done'; jobId: string; result: ComputeResult }
  | { type: 'error'; jobId: string; message: string };

self.onmessage = (e: MessageEvent<ComputeRequest>) => {
  const { jobId, candles, config } = e.data;
  try {
    const result = computeIndicatorsWithProgress(candles, config, (completed, total) => {
      const msg: ComputeResponse = { type: 'progress', jobId, completed, total };
      (self as unknown as Worker).postMessage(msg);
    });
    const done: ComputeResponse = { type: 'done', jobId, result };
    (self as unknown as Worker).postMessage(done);
  } catch (err) {
    const error: ComputeResponse = {
      type: 'error',
      jobId,
      message: err instanceof Error ? err.message : String(err),
    };
    (self as unknown as Worker).postMessage(error);
  }
};
