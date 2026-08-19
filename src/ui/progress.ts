// Progress UI (MD §18). Shows real completion (lines done / total) plus live
// stats. The ETA is derived from actual throughput and is labelled an estimate
// — never presented as certain.

export function estimateRemainingMs(
  completed: number,
  total: number,
  elapsedMs: number,
): number | null {
  if (completed <= 0 || total <= 0) return null;
  if (completed >= total) return 0;
  const perLine = elapsedMs / completed;
  return Math.round(perLine * (total - completed));
}

export interface ProgressState {
  completed: number;
  total: number;
  candlesProcessed?: number;
  current?: string;
  startedAt?: number;
}

export class ProgressView {
  readonly root: HTMLElement;
  private bar: HTMLElement;
  private label: HTMLElement;

  constructor(container: HTMLElement) {
    this.root = document.createElement('div');
    this.root.style.fontFamily = 'monospace';
    this.root.style.fontSize = '12px';

    this.bar = document.createElement('div');
    this.bar.style.height = '10px';
    this.bar.style.background = '#222';
    this.bar.style.borderRadius = '4px';
    this.bar.style.overflow = 'hidden';
    const fill = document.createElement('div');
    fill.style.height = '100%';
    fill.style.width = '0%';
    fill.style.background = '#26a69a';
    fill.id = 'progress-fill';
    this.bar.appendChild(fill);

    this.label = document.createElement('div');
    this.label.style.marginTop = '4px';
    this.label.style.color = '#ccc';

    this.root.appendChild(this.bar);
    this.root.appendChild(this.label);
    container.appendChild(this.root);
  }

  update(state: ProgressState): void {
    const pct = state.total > 0 ? Math.round((state.completed / state.total) * 100) : 0;
    const fill = this.bar.querySelector<HTMLElement>('#progress-fill')!;
    fill.style.width = `${pct}%`;

    const remaining = state.startedAt
      ? estimateRemainingMs(state.completed, state.total, Date.now() - state.startedAt)
      : null;
    const eta = remaining == null ? 'ETA: —' : `ETA: ~${(remaining / 1000).toFixed(0)}s`;
    const parts = [
      `Lines: ${state.completed}/${state.total} (${pct}%)`,
      state.candlesProcessed != null ? `Candles: ${state.candlesProcessed}` : '',
      state.current ? `Now: ${state.current}` : '',
      eta,
    ].filter(Boolean);
    this.label.textContent = parts.join('  |  ');
  }

  reset(): void {
    this.update({ completed: 0, total: 0 });
  }
}
