// Configuration controls for the server-spike mode (MD §3–§15). Builds a form
// that produces a validated RunConfig and emits it via onCalculate. The asset
// list is populated from the server's /assets endpoint.

import type { RunConfig, IndicatorSlotConfig, ColorConfig } from '../core/config';
import type { IndicatorType, PriceSource, PeriodMode, RenderMode } from '../core/types';
import type { AssetSummary } from '../server/client';

const SOURCES: PriceSource[] = ['open', 'high', 'low', 'close'];
const TYPES: IndicatorType[] = ['MA', 'EMA', 'WMA'];

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Omit<Partial<HTMLElementTagNameMap[K]>, 'style'> & { style?: string } = {} as Omit<Partial<HTMLElementTagNameMap[K]>, 'style'> & { style?: string },
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  const { style, ...rest } = props as Record<string, unknown> & { style?: string };
  Object.assign(node, rest);
  if (typeof style === 'string') node.style.cssText = style;
  for (const c of children) node.append(c);
  return node;
}

function field(label: string, control: HTMLElement): HTMLElement {
  return el('label', { style: 'display:block;margin:6px 0;font-size:12px;' }, [
    el('div', { textContent: label, style: 'color:#bbb;margin-bottom:2px;' }),
    control,
  ]);
}

export interface ControlsCallbacks {
  onCalculate: (config: RunConfig) => void;
}

export class ControlsPanel {
  readonly root: HTMLElement;
  private assetSelect: HTMLSelectElement;
  private intervalInput: HTMLInputElement;
  private historyInput: HTMLInputElement;
  private slotsBox: HTMLElement;
  private minInput: HTMLInputElement;
  private maxInput: HTMLInputElement;
  private modeSelect: HTMLSelectElement;
  private stepInput: HTMLInputElement;
  private divisorInput: HTMLInputElement;
  private colorBox: HTMLElement;
  private renderSelect: HTMLSelectElement;
  private steepnessInput: HTMLInputElement;
  private calculateBtn: HTMLButtonElement;
  private errorBox: HTMLElement;
  private slots: IndicatorSlotConfig[] = [{ type: 'MA', sources: ['close'] }];

  constructor(container: HTMLElement, private readonly cb: ControlsCallbacks) {
    this.root = el('div', { style: 'padding:10px;overflow:auto;height:100%;box-sizing:border-box;' });

    this.assetSelect = el('select', { style: 'width:100%;' });
    this.intervalInput = el('input', { type: 'number', value: '1', min: '1', max: '377', style: 'width:100%;' });
    this.historyInput = el('input', { type: 'range', min: '0', max: '1', step: '0.01', value: '1', style: 'width:100%;' });
    this.slotsBox = el('div', {});
    this.minInput = el('input', { type: 'number', value: '2', min: '1', style: 'width:100%;' });
    this.maxInput = el('input', { type: 'number', value: '50', min: '1', style: 'width:100%;' });
    this.modeSelect = el('select', { style: 'width:100%;' }, [
      el('option', { value: 'sequential', textContent: 'Sequential' }),
      el('option', { value: 'fibonacci', textContent: 'Fibonacci' }),
      el('option', { value: 'divisible', textContent: 'Divisible' }),
    ]);
    this.stepInput = el('input', { type: 'number', value: '1', min: '1', style: 'width:100%;' });
    this.divisorInput = el('input', { type: 'number', value: '2', min: '1', style: 'width:100%;' });
    this.colorBox = el('div', {});
    this.renderSelect = el('select', { style: 'width:100%;' }, [
      el('option', { value: 'lines', textContent: 'Lines' }),
      el('option', { value: 'mesh', textContent: 'Mesh' }),
    ]);
    this.steepnessInput = el('input', { type: 'range', min: '0', max: '1', step: '0.01', value: '0.5', style: 'width:100%;' });
    this.calculateBtn = el('button', { textContent: 'Calculate', style: 'width:100%;padding:8px;margin-top:8px;' });
    this.errorBox = el('div', { style: 'color:#e57373;font-size:11px;margin-top:6px;white-space:pre-wrap;' });

    this.root.append(
      field('Asset', this.assetSelect),
      field('Candle interval (min, 1–377)', this.intervalInput),
      field('History loaded (0–1)', this.historyInput),
      field('Indicator slots', this.slotsBox),
      el('button', { textContent: '+ Add slot', style: 'font-size:11px;', onclick: () => this.addSlot() }),
      field('Period min', this.minInput),
      field('Period max', this.maxInput),
      field('Period mode', this.modeSelect),
      field('Step (sequential)', this.stepInput),
      field('Divisor (divisible)', this.divisorInput),
      field('Colors', this.colorBox),
      field('Render mode', this.renderSelect),
      field('Mesh steepness', this.steepnessInput),
      this.calculateBtn,
      this.errorBox,
    );
    container.appendChild(this.root);

    this.renderSlots();
    this.renderColor();
    this.modeSelect.onchange = () => this.renderColor();
    this.renderSelect.onchange = () => this.syncModeVisibility();
    this.calculateBtn.onclick = () => this.tryCalculate();
    this.syncModeVisibility();
  }

  setAssets(assets: AssetSummary[]): void {
    this.assetSelect.replaceChildren(
      ...assets.map((a) => el('option', { value: a.symbol, textContent: `${a.symbol} (${a.candleCount})` })),
    );
  }

  setConfig(config: RunConfig): void {
    this.assetSelect.value = config.asset.symbol;
    this.intervalInput.value = String(config.candle.intervalMinutes);
    this.historyInput.value = String(config.candle.historyPercent);
    this.slots = config.indicator.slots.map((s) => ({ type: s.type, sources: [...s.sources] }));
    this.minInput.value = String(config.indicator.range.min);
    this.maxInput.value = String(config.indicator.range.max);
    this.modeSelect.value = config.indicator.mode;
    this.stepInput.value = String(config.indicator.step);
    this.divisorInput.value = String(config.indicator.divisor ?? 2);
    this.renderSlots();
    this.renderColor();
    this.renderSelect.value = config.renderMode;
    this.steepnessInput.value = String(config.mesh.steepness);
    this.syncModeVisibility();
  }

  private addSlot(): void {
    if (this.slots.length >= 3) return;
    this.slots.push({ type: 'EMA', sources: ['close'] });
    this.renderSlots();
  }

  private renderSlots(): void {
    this.slotsBox.replaceChildren();
    this.slots.forEach((slot, i) => {
      const typeSel = el('select', { style: 'width:100%;' },
        TYPES.map((t) => el('option', { value: t, textContent: t, selected: t === slot.type })));
      typeSel.onchange = () => (this.slots[i].type = typeSel.value as IndicatorType);

      const srcBox = el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;margin-top:4px;' });
      for (const s of SOURCES) {
        const cb = el('input', { type: 'checkbox', checked: slot.sources.includes(s) });
        cb.onchange = () => {
          if (cb.checked) {
            if (!this.slots[i].sources.includes(s)) this.slots[i].sources.push(s);
          } else {
            this.slots[i].sources = this.slots[i].sources.filter((x) => x !== s);
          }
        };
        srcBox.append(el('label', { style: 'font-size:11px;color:#ccc;' }, [cb, s]));
      }

      const row = el('div', { style: 'border:1px solid #333;padding:6px;margin:4px 0;border-radius:4px;' }, [
        typeSel,
        srcBox,
      ]);
      if (this.slots.length > 1) {
        const rm = el('button', { textContent: 'remove', style: 'font-size:10px;margin-top:4px;' });
        rm.onclick = () => {
          this.slots.splice(i, 1);
          this.renderSlots();
        };
        row.append(rm);
      }
      this.slotsBox.append(row);
    });
  }

  private renderColor(): void {
    const mode = this.modeSelect.value as PeriodMode;
    this.colorBox.replaceChildren();
    if (mode === 'sequential') {
      const start = el('input', { type: 'color', value: '#ff0000', id: 'col-start' });
      const end = el('input', { type: 'color', value: '#0000ff', id: 'col-end' });
      this.colorBox.append(
        field('Start', start),
        field('End', end),
      );
    } else if (mode === 'fibonacci') {
      const scheme = el('select', { style: 'width:100%;' }, [
        el('option', { value: 'individual', textContent: 'Individual' }),
        el('option', { value: 'palette', textContent: 'Palette' }),
      ]);
      this.colorBox.append(field('Scheme', scheme));
    } else {
      const scheme = el('select', { style: 'width:100%;' }, [
        el('option', { value: 'gradient', textContent: 'Gradient' }),
        el('option', { value: 'palette', textContent: 'Palette' }),
        el('option', { value: 'per-line', textContent: 'Per-line' }),
      ]);
      const start = el('input', { type: 'color', value: '#ff0000', id: 'col-start' });
      const end = el('input', { type: 'color', value: '#0000ff', id: 'col-end' });
      this.colorBox.append(field('Scheme', scheme), field('Start', start), field('End', end));
    }
  }

  private syncModeVisibility(): void {
    const mode = this.modeSelect.value;
    this.stepInput.style.display = mode === 'sequential' ? '' : 'none';
    this.divisorInput.style.display = mode === 'divisible' ? '' : 'none';
    this.steepnessInput.style.display = this.renderSelect.value === 'mesh' ? '' : 'none';
  }

  private buildColorConfig(): ColorConfig {
    const mode = this.modeSelect.value as PeriodMode;
    if (mode === 'sequential') {
      return { mode, start: this.qColor('col-start', '#ff0000'), end: this.qColor('col-end', '#0000ff') };
    }
    if (mode === 'fibonacci') {
      const scheme = this.colorBox.querySelector('select')?.value as 'individual' | 'palette';
      return { mode, scheme: scheme ?? 'individual' };
    }
    const schemeSel = this.colorBox.querySelector('select');
    const scheme = (schemeSel?.value as 'gradient' | 'palette' | 'per-line') ?? 'gradient';
    return {
      mode,
      scheme,
      start: this.qColor('col-start', '#ff0000'),
      end: this.qColor('col-end', '#0000ff'),
    };
  }

  private qColor(id: string, fallback: string): string {
    const node = this.colorBox.querySelector<HTMLInputElement>(`#${id}`);
    return node?.value ?? fallback;
  }

  private buildConfig(): { config: RunConfig; errors: string[] } {
    const errors: string[] = [];
    const symbol = this.assetSelect.value;
    if (!symbol) errors.push('No asset selected (fetch data first).');
    const interval = Number(this.intervalInput.value);
    if (!(interval >= 1 && interval <= 377)) errors.push('Interval must be 1–377.');
    const history = Number(this.historyInput.value);
    if (!(history >= 0 && history <= 1)) errors.push('History must be 0–1.');
    const min = Number(this.minInput.value);
    const max = Number(this.maxInput.value);
    if (!(min >= 1)) errors.push('Period min must be >= 1.');
    if (!(max >= min)) errors.push('Period max must be >= min.');
    const mode = this.modeSelect.value as PeriodMode;
    const step = Number(this.stepInput.value);
    if (mode === 'sequential' && !(step >= 1)) errors.push('Step must be >= 1.');
    let divisor: number | undefined;
    if (mode === 'divisible') {
      divisor = Number(this.divisorInput.value);
      if (!(divisor >= 1)) errors.push('Divisor must be >= 1.');
    }
    const slots = this.slots
      .map((s) => ({ type: s.type, sources: s.sources.filter((x) => SOURCES.includes(x)) }))
      .filter((s) => s.sources.length > 0);
    if (slots.length === 0) errors.push('At least one indicator slot with a source is required.');

    const config: RunConfig = {
      asset: { symbol, sourceName: 'server' },
      candle: { intervalMinutes: interval, historyPercent: history },
      indicator: { slots, range: { min, max }, mode, step, divisor },
      color: this.buildColorConfig(),
      renderMode: this.renderSelect.value as RenderMode,
      mesh: { steepness: Number(this.steepnessInput.value) },
    };
    return { config, errors };
  }

  private tryCalculate(): void {
    const { config, errors } = this.buildConfig();
    if (errors.length > 0) {
      this.errorBox.textContent = errors.join('\n');
      return;
    }
    this.errorBox.textContent = '';
    this.cb.onCalculate(config);
  }

  /** Current configuration without triggering validation/calc (used for recolor). */
  getConfig(): RunConfig {
    return this.buildConfig().config;
  }
}
