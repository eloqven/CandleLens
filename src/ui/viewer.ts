// Interactive viewer for the server-spike mode. Owns the canvas, the
// Canvas2DRenderer, and the Viewport, and wires the MD §22–§31 interactions:
// zoom/pan, five-point snapping, click-to-reveal, multi-point common lines,
// layer visibility, and OHLC source filtering. Recolor happens without
// recomputation (MD §29).

import type { Candle } from '../core/types';
import type { IndicatorLine } from '../indicators/engine';
import type { RenderGeometry } from '../render/geometry';
import { Canvas2DRenderer } from '../render/canvasRenderer';
import type { RenderScene, RenderLine } from '../render/renderer';
import { priceToY } from '../render/scale';
import { Viewport } from '../interaction/viewport';
import { nearestSnapPoint, type SnapKind } from '../interaction/snapping';
import { findNearbyLines, relativeTolerance } from '../interaction/intersection';
import { commonLines, type SelectedPoint } from '../interaction/multiSelect';
import {
  defaultToggles,
  isLineVisible,
  type LayerToggles,
} from '../interaction/layers';
import {
  defaultOHLCToggles,
  filterBySource,
  type OHLCToggles,
} from '../interaction/ohlcToggles';

export class Viewer {
  readonly canvas: HTMLCanvasElement;
  private renderer: Canvas2DRenderer;
  private viewport!: Viewport;
  private candles: Candle[] = [];
  private lines: IndicatorLine[] = [];
  private geometry: RenderGeometry | null = null;
  private colors: Record<string, string> = {};
  private toggles: LayerToggles = { byType: {}, bySource: {} };
  private revealed: Set<string> | null = null;
  private selected: SelectedPoint[] = [];
  private ohlc: OHLCToggles = defaultOHLCToggles();
  private hoverLabel: HTMLElement;
  private revealPanel: HTMLElement;
  private dragging = false;
  private dragMoved = false;
  private lastX = 0;

  constructor(container: HTMLElement) {
    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    this.canvas.style.cursor = 'crosshair';
    container.appendChild(this.canvas);
    this.renderer = new Canvas2DRenderer(this.canvas);

    this.hoverLabel = document.createElement('div');
    Object.assign(this.hoverLabel.style, {
      position: 'absolute',
      pointerEvents: 'none',
      background: 'rgba(0,0,0,0.7)',
      color: '#fff',
      font: '11px monospace',
      padding: '2px 4px',
      borderRadius: '3px',
      display: 'none',
    } as Partial<CSSStyleDeclaration>);
    container.style.position = 'relative';
    container.appendChild(this.hoverLabel);

    this.revealPanel = document.createElement('div');
    Object.assign(this.revealPanel.style, {
      position: 'absolute',
      top: '8px',
      left: '8px',
      background: 'rgba(0,0,0,0.7)',
      color: '#fff',
      font: '11px monospace',
      padding: '6px',
      borderRadius: '4px',
      display: 'none',
    } as Partial<CSSStyleDeclaration>);
    container.appendChild(this.revealPanel);

    this.bindEvents();
  }

  setData(
    candles: Candle[],
    lines: IndicatorLine[],
    geometry: RenderGeometry,
    colors: Record<string, string>,
  ): void {
    this.candles = candles;
    this.lines = lines;
    this.geometry = geometry;
    this.colors = colors;
    this.toggles = defaultToggles(lines);
    this.revealed = null;
    this.selected = [];
    this.ohlc = defaultOHLCToggles();
    this.viewport = new Viewport(candles.length, this.canvas.getBoundingClientRect().width || 800);
    this.render();
  }

  recolor(colors: Record<string, string>): void {
    this.colors = colors;
    this.render();
  }

  setLayerToggles(toggles: LayerToggles): void {
    this.toggles = toggles;
    this.render();
  }

  /** Toggle a single layer family/source on or off (MD §26). */
  patchLayer(kind: 'byType' | 'bySource', key: string, value: boolean): void {
    (this.toggles[kind] as Record<string, boolean>)[key] = value;
    this.render();
  }

  getScene(): RenderScene {
    const visible = (id: string) =>
      isLineVisible(this.lines.find((l) => l.id === id)!, this.toggles) &&
      (this.revealed === null || this.revealed.has(id));
    const renderLines: RenderLine[] = this.lines.map((l) => ({
      id: l.id,
      color: this.colors[l.id] ?? '#888888',
      values: l.values,
      visible: visible(l.id),
    }));
    return {
      candles: this.candles,
      lines: renderLines,
      mode: 'lines',
      priceMin: this.geometry?.priceMin,
      priceMax: this.geometry?.priceMax,
      geometry: this.geometry ?? undefined,
      viewStart: this.viewport?.viewStart ?? 0,
      viewCount: this.viewport?.viewCount ?? this.candles.length,
    };
  }

  render(): void {
    this.renderer.render(this.getScene());
  }

  private bindEvents(): void {
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const factor = e.deltaY > 0 ? 1.1 : 0.9;
      this.viewport.zoomAt(x, factor);
      this.render();
    });

    this.canvas.addEventListener('mousedown', (e) => {
      this.dragging = true;
      this.dragMoved = false;
      this.lastX = e.clientX;
    });

    window.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      if (this.dragging) {
        const dx = e.clientX - this.lastX;
        if (Math.abs(dx) > 2) this.dragMoved = true;
        this.viewport.panPixels(-dx);
        this.lastX = e.clientX;
        this.render();
        return;
      }
      this.updateHover(e.clientX - rect.left, e.clientY - rect.top, rect);
    });

    window.addEventListener('mouseup', (e) => {
      if (!this.dragging) return;
      this.dragging = false;
      if (!this.dragMoved) this.handleClick(e);
    });
  }

  private updateHover(x: number, y: number, rect: DOMRect): void {
    if (this.candles.length === 0 || !this.geometry) {
      this.hoverLabel.style.display = 'none';
      return;
    }
    const idx = Math.max(0, Math.min(this.candles.length - 1, Math.round(this.viewport.indexAtPixel(x))));
    const candle = this.candles[idx];
    const range = { min: this.geometry.priceMin, max: this.geometry.priceMax };
    const priceToYAt = (p: number) => priceToY(p, range, 8, rect.height - 8);
    const snap = nearestSnapPoint(candle, y, priceToYAt);
    this.hoverLabel.style.display = 'block';
    this.hoverLabel.style.left = `${x + 12}px`;
    this.hoverLabel.style.top = `${y + 12}px`;
    this.hoverLabel.textContent = `#${idx} ${snap.kind} ${snap.price.toFixed(2)}`;
  }

  private handleClick(e: MouseEvent): void {
    if (this.candles.length === 0 || !this.geometry) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const idx = Math.max(0, Math.min(this.candles.length - 1, Math.round(this.viewport.indexAtPixel(x))));
    const candle = this.candles[idx];
    const range = { min: this.geometry.priceMin, max: this.geometry.priceMax };
    const priceToYAt = (p: number) => priceToY(p, range, 8, rect.height - 8);
    const snap = nearestSnapPoint(candle, y, priceToYAt);
    const tolerance = relativeTolerance(range.max - range.min, 0.01);

    if (e.shiftKey) {
      this.selected.push({ index: idx, price: snap.price });
      const common = commonLines(this.selected, this.lines, tolerance);
      this.revealed = new Set(filterBySource(common, this.lines, this.ohlc));
    } else {
      this.selected = [{ index: idx, price: snap.price }];
      const hits = findNearbyLines(this.lines, idx, snap.price, tolerance);
      this.revealed = new Set(filterBySource(hits, this.lines, this.ohlc));
    }
    this.render();
    this.renderRevealPanel(snap.kind, snap.price);
  }

  private renderRevealPanel(kind: SnapKind, price: number): void {
    if (!this.revealed || this.revealed.size === 0) {
      this.revealPanel.style.display = 'none';
      return;
    }
    this.revealPanel.style.display = 'block';
    this.revealPanel.replaceChildren();
    const header = document.createElement('div');
    header.textContent = `Revealed ${this.revealed.size} line(s) @ ${kind} ${price.toFixed(2)}`;
    this.revealPanel.appendChild(header);

    const sources: (keyof OHLCToggles)[] = ['open', 'high', 'low', 'close'];
    for (const s of sources) {
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = this.ohlc[s];
      cb.onchange = () => {
        this.ohlc[s] = cb.checked;
        if (this.selected.length > 0) {
          const tolerance = relativeTolerance(
            (this.geometry!.priceMax - this.geometry!.priceMin),
            0.01,
          );
          const base =
            this.selected.length > 1
              ? commonLines(this.selected, this.lines, tolerance)
              : findNearbyLines(this.lines, this.selected[0].index, this.selected[0].price, tolerance);
          this.revealed = new Set(filterBySource(base, this.lines, this.ohlc));
          this.render();
        }
      };
      const label = document.createElement('label');
      label.style.display = 'inline-block';
      label.style.marginRight = '6px';
      label.append(cb, document.createTextNode(s));
      this.revealPanel.appendChild(label);
    }
  }
}
