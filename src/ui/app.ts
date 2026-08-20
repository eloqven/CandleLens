// Application shell for the server-spike mode (MD §3). Wires the controls panel,
// the interactive viewer, server-side compute, run persistence, and settings.
// The browser never computes indicators here — it asks the Python API.

import type { RunConfig } from '../core/config';
import type { Candle } from '../core/types';
import type { IndicatorLine } from '../indicators/engine';
import type { RenderGeometry } from '../render/geometry';
import { CandleLensClient, type RunMeta, type RunPayload } from '../server/client';
import { computeIndicatorsServer } from '../server/serverCompute';
import { buildGeometry } from '../render/geometry';
import { assignLineColors } from '../render/colors';
import { buildConfirmationSummary } from '../ui/confirmation';
import { estimateWorkload } from '../run/workload';
import { saveSettings, loadSettings } from '../settings/settings';
import { ControlsPanel } from './controls';
import { Viewer } from './viewer';

const API_BASE = (typeof window !== 'undefined' && (window as unknown as { CANDLELENS_API_BASE?: string }).CANDLELENS_API_BASE) || 'http://localhost:8000';

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

export class App {
  private client = new CandleLensClient(API_BASE);
  private controls: ControlsPanel;
  private viewer: Viewer;
  private lastConfig: RunConfig | null = null;
  private lastLines: IndicatorLine[] = [];
  private lastCandles: Candle[] = [];
  private lastGeometry: RenderGeometry | null = null;
  private status: HTMLElement;
  private runSelect: HTMLSelectElement;
  private layersBox: HTMLElement;

  constructor(root: HTMLElement) {
    root.style.display = 'flex';
    root.style.height = '100vh';
    root.style.margin = '0';
    root.style.fontFamily = 'system-ui, sans-serif';
    root.style.color = '#eee';
    root.style.background = '#111';

    // Left column: controls + layers
    const left = el('div', { style: 'width:320px;background:#1a1a1a;border-right:1px solid #333;display:flex;flex-direction:column;' });
    const controlsHost = el('div', { style: 'flex:1;min-height:0;' });
    this.layersBox = el('div', { style: 'border-top:1px solid #333;padding:8px;font-size:12px;max-height:200px;overflow:auto;' });
    this.layersBox.append(el('div', { textContent: 'Layers', style: 'color:#bbb;margin-bottom:4px;' }));
    left.append(controlsHost, this.layersBox);

    // Right column: top bar + viewer + status
    const right = el('div', { style: 'flex:1;display:flex;flex-direction:column;min-width:0;' });
    const topbar = el('div', { style: 'display:flex;gap:8px;align-items:center;padding:8px;border-bottom:1px solid #333;flex-wrap:wrap;' });
    const saveBtn = el('button', { textContent: 'Save run' });
    const recolorBtn = el('button', { textContent: 'Recolor' });
    this.runSelect = el('select', { style: 'flex:1;min-width:160px;' });
    const loadBtn = el('button', { textContent: 'Load' });
    const delBtn = el('button', { textContent: 'Delete' });
    topbar.append(saveBtn, recolorBtn, this.runSelect, loadBtn, delBtn);

    const viewerHost = el('div', { style: 'flex:1;min-height:0;position:relative;' });
    this.status = el('div', { style: 'padding:8px;font:12px monospace;color:#ccc;border-top:1px solid #333;white-space:pre-wrap;max-height:140px;overflow:auto;' });
    right.append(topbar, viewerHost, this.status);

    root.append(left, right);

    this.controls = new ControlsPanel(controlsHost, { onCalculate: (c) => this.calculate(c) });
    this.viewer = new Viewer(viewerHost);

    saveBtn.onclick = () => this.saveRun();
    recolorBtn.onclick = () => this.recolor();
    loadBtn.onclick = () => this.loadSelectedRun();
    delBtn.onclick = () => this.deleteSelectedRun();

    this.init();
  }

  private async init(): Promise<void> {
    try {
      const assets = await this.client.fetchAssets();
      this.controls.setAssets(assets);
      this.setStatus(`Loaded ${assets.length} asset(s): ${assets.map((a) => a.symbol).join(', ')}`);
    } catch (e) {
      this.setStatus(`Could not reach API at ${API_BASE}.\nStart it with: python server/api.py --serve\n\n${(e as Error).message}`);
    }
    const saved = loadSettings();
    if (saved?.config) this.controls.setConfig(saved.config);
    await this.refreshRuns();
  }

  private setStatus(text: string): void {
    this.status.textContent = text;
  }

  private async calculate(config: RunConfig): Promise<void> {
    this.lastConfig = config;
    this.setStatus('Computing on server…');
    try {
      const result = await computeIndicatorsServer(config, this.client);
      const geometry = buildGeometry(result.candles, result.lines);
      const colors = assignLineColors(
        result.lines.map((l) => ({ id: l.id, period: l.period })),
        config.color,
      );
      this.lastLines = result.lines;
      this.lastCandles = result.candles;
      this.lastGeometry = geometry;
      this.viewer.setData(result.candles, result.lines, geometry, colors);
      this.renderLayers(result.lines);
      const workload = estimateWorkload(config.indicator, result.candleCount);
      this.setStatus(
        [
          `Computed ${result.lines.length} lines over ${result.candleCount} candles.`,
          ...buildConfirmationSummary(config, workload),
        ].join('\n'),
      );
      saveSettings({ config, viewer: { renderMode: config.renderMode, color: config.color, mesh: config.mesh } });
    } catch (e) {
      this.setStatus(`Compute failed: ${(e as Error).message}`);
    }
  }

  private recolor(): void {
    if (!this.lastConfig || !this.lastLines.length) return;
    const colors = assignLineColors(
      this.lastLines.map((l) => ({ id: l.id, period: l.period })),
      this.controls.getConfig().color,
    );
    this.viewer.recolor(colors);
  }

  private renderLayers(lines: IndicatorLine[]): void {
    this.layersBox.replaceChildren(el('div', { textContent: 'Layers', style: 'color:#bbb;margin-bottom:4px;' }));
    const types = [...new Set(lines.map((l) => l.type))];
    const sources = [...new Set(lines.map((l) => l.source))];
    const addToggle = (label: string, checked: boolean, on: (v: boolean) => void) => {
      const cb = el('input', { type: 'checkbox', checked });
      cb.onchange = () => on(cb.checked);
      const row = el('label', { style: 'display:inline-block;margin:2px 8px 2px 0;font-size:11px;' }, [cb, label]);
      this.layersBox.append(row);
    };
    types.forEach((t) => addToggle(t, true, (v) => this.viewer.patchLayer('byType', t, v)));
    sources.forEach((s) => addToggle(s, true, (v) => this.viewer.patchLayer('bySource', s, v)));
  }

  private async saveRun(): Promise<void> {
    if (!this.lastConfig || !this.lastLines.length) {
      this.setStatus('Nothing to save — calculate first.');
      return;
    }
    const meta: RunMeta = {
      id: `run-${Date.now()}`,
      createdAt: new Date().toISOString(),
      asset: { symbol: this.lastConfig.asset.symbol },
      config: this.lastConfig,
    };
    const payload: RunPayload = {
      lines: this.lastLines.map((l) => ({ ...l, values: Array.from(l.values) })),
      geometry: this.lastGeometry as unknown as Record<string, unknown>,
    };
    await this.client.saveRun(meta, payload);
    this.setStatus(`Saved run ${meta.id}`);
    await this.refreshRuns();
  }

  private async refreshRuns(): Promise<void> {
    try {
      const runs = await this.client.listRuns();
      this.runSelect.replaceChildren(
        el('option', { value: '', textContent: '— saved runs —' }),
        ...runs.map((r) => el('option', { value: r.id, textContent: `${r.id.slice(0, 8)} (${r.asset.symbol})` })),
      );
    } catch {
      /* ignore */
    }
  }

  private async loadSelectedRun(): Promise<void> {
    const id = this.runSelect.value;
    if (!id) return;
    try {
      const { meta, payload } = await this.client.loadRun(id);
      const lines = (payload.lines as unknown as IndicatorLine[]).map((l) => ({
        ...l,
        values: Float64Array.from((l.values as unknown as (number | null)[]).map((v) => (v == null ? NaN : v))),
      }));
      const candles = this.lastCandles;
      const geometry = buildGeometry(candles, lines);
      const colors = assignLineColors(
        lines.map((l) => ({ id: l.id, period: l.period })),
        (meta.config as RunConfig).color,
      );
      this.lastConfig = meta.config as RunConfig;
      this.lastLines = lines;
      this.lastCandles = candles;
      this.lastGeometry = geometry;
      this.viewer.setData(candles, lines, geometry, colors);
      this.renderLayers(lines);
      this.setStatus(`Loaded run ${id}`);
    } catch (e) {
      this.setStatus(`Load failed: ${(e as Error).message}`);
    }
  }

  private async deleteSelectedRun(): Promise<void> {
    const id = this.runSelect.value;
    if (!id) return;
    await this.client.deleteRun(id);
    this.setStatus(`Deleted run ${id}`);
    await this.refreshRuns();
  }
}
