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
  private lastY = 0;
  private hover: { index: number; kind: SnapKind; price: number } | null = null;
  /** Vertical (price-axis) zoom window; null until data is loaded. */
  private priceView: { min: number; max: number } | null = null;
  /** Per-line visibility overrides (MD §24). */
  private hiddenLines = new Set<string>();
  /** Per-line opacity overrides (MD §24), 0..1. */
  private lineOpacity: Record<string, number> = {};
  private helpLabel: HTMLElement;

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

    this.helpLabel = document.createElement('div');
    Object.assign(this.helpLabel.style, {
      position: 'absolute',
      left: '8px',
      bottom: '8px',
      pointerEvents: 'none',
      background: 'rgba(0,0,0,0.55)',
      color: '#cfcfcf',
      font: '10px monospace',
      padding: '4px 6px',
      borderRadius: '4px',
      lineHeight: '1.4',
    } as Partial<CSSStyleDeclaration>);
    this.helpLabel.textContent =
      'Wheel: zoom X · Shift+Wheel: zoom Y · Drag: pan X · Shift+Drag: pan Y · Dbl-click: reset';
    container.appendChild(this.helpLabel);

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
    this.priceView = { min: geometry.priceMin, max: geometry.priceMax };
    this.hiddenLines = new Set();
    this.lineOpacity = {};
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

  /** Per-line visibility (MD §24). */
  setLineVisible(id: string, visible: boolean): void {
    if (visible) this.hiddenLines.delete(id);
    else this.hiddenLines.add(id);
    this.render();
  }

  /** Per-line opacity, 0..1 (MD §24). Purely visual. */
  setLineOpacity(id: string, opacity: number): void {
    this.lineOpacity[id] = Math.max(0, Math.min(1, opacity));
    this.render();
  }

  /** Per-line color (MD §24 / §29). */
  setLineColor(id: string, color: string): void {
    this.colors[id] = color;
    this.render();
  }

  /** Reset both horizontal and vertical zoom to the full data extent. */
  resetZoom(): void {
    if (this.geometry) {
      this.priceView = { min: this.geometry.priceMin, max: this.geometry.priceMax };
    }
    if (this.viewport) {
      this.viewport.viewStart = 0;
      this.viewport.viewCount = this.candles.length;
    }
    this.render();
  }

  /** Zoom the price axis around the cursor's y position (MD §23 vertical zoom). */
  private zoomPriceAt(y: number, factor: number): void {
    if (!this.priceView || !this.geometry) return;
    const rect = this.canvas.getBoundingClientRect();
    const top = 8;
    const bottom = rect.height - 8;
    const span = this.priceView.max - this.priceView.min;
    const anchor = this.priceView.min + ((bottom - y) / (bottom - top)) * span;
    const fullSpan = this.geometry.priceMax - this.geometry.priceMin || 1;
    let newSpan = span * factor;
    newSpan = Math.max(fullSpan * 0.002, Math.min(fullSpan, newSpan));
    const ratio = span > 0 ? (anchor - this.priceView.min) / span : 0.5;
    this.priceView.min = anchor - ratio * newSpan;
    this.priceView.max = this.priceView.min + newSpan;
    this.render();
  }

  /** Pan the price axis by a vertical pixel delta (MD §23 vertical pan). */
  private panPrice(dy: number): void {
    if (!this.priceView) return;
    const rect = this.canvas.getBoundingClientRect();
    const span = this.priceView.max - this.priceView.min;
    const pricePerPx = span / Math.max(1, rect.height - 16);
    const delta = dy * pricePerPx;
    this.priceView.min += delta;
    this.priceView.max += delta;
    this.render();
  }

  getScene(): RenderScene {
    const visible = (id: string) =>
      isLineVisible(this.lines.find((l) => l.id === id)!, this.toggles) &&
      !this.hiddenLines.has(id) &&
      (this.revealed === null || this.revealed.has(id));
    const renderLines: RenderLine[] = this.lines.map((l) => ({
      id: l.id,
      color: this.colors[l.id] ?? '#888888',
      values: l.values,
      visible: visible(l.id),
      opacity: this.lineOpacity[l.id] ?? 1,
    }));
    return {
      candles: this.candles,
      lines: renderLines,
      mode: 'lines',
      priceMin: this.priceView?.min,
      priceMax: this.priceView?.max,
      geometry: this.geometry ?? undefined,
      viewStart: this.viewport?.viewStart ?? 0,
      viewCount: this.viewport?.viewCount ?? this.candles.length,
      hover: this.hover ?? undefined,
    };
  }

  render(): void {
    this.renderer.render(this.getScene());
  }

  private bindEvents(): void {
    this.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const factor = e.deltaY > 0 ? 1.1 : 0.9;
      if (e.shiftKey) {
        this.zoomPriceAt(e.clientY - rect.top, factor);
      } else {
        this.viewport.zoomAt(e.clientX - rect.left, factor);
      }
    });

    this.canvas.addEventListener('mousedown', (e) => {
      this.dragging = true;
      this.dragMoved = false;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });

    this.canvas.addEventListener('dblclick', () => this.resetZoom());

    window.addEventListener('mousemove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      if (this.dragging && this.viewport) {
        const dx = e.clientX - this.lastX;
        const dy = e.clientY - this.lastY;
        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) this.dragMoved = true;
        if (e.shiftKey) {
          this.panPrice(dy);
        } else {
          this.viewport.panPixels(-dx);
        }
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this.render();
        return;
      }
      this.updateHover(e.clientX - rect.left, e.clientY - rect.top, rect);
    });

    window.addEventListener('mouseup', (e) => {
      if (!this.viewport) return;
      if (!this.dragging) return;
      this.dragging = false;
      if (!this.dragMoved) this.handleClick(e);
    });

    this.canvas.addEventListener('mouseleave', () => {
      if (this.hover !== null) {
        this.hover = null;
        this.hoverLabel.style.display = 'none';
        this.render();
      }
    });
  }

  private updateHover(x: number, y: number, rect: DOMRect): void {
    if (this.candles.length === 0 || !this.geometry || x < 0 || x > rect.width || y < 0 || y > rect.height) {
      if (this.hover !== null) {
        this.hover = null;
        this.hoverLabel.style.display = 'none';
        this.render();
      }
      return;
    }
    const idx = Math.max(0, Math.min(this.candles.length - 1, Math.round(this.viewport.indexAtPixel(x))));
    const candle = this.candles[idx];
    const range = this.priceView ?? { min: this.geometry!.priceMin, max: this.geometry!.priceMax };
    const priceToYAt = (p: number) => priceToY(p, range, 8, rect.height - 8);
    const snap = nearestSnapPoint(candle, y, priceToYAt);
    const next = { index: idx, kind: snap.kind, price: snap.price };
    if (this.hover && this.hover.index === next.index && this.hover.kind === next.kind && this.hover.price === next.price) {
      this.hoverLabel.style.left = `${x + 12}px`;
      this.hoverLabel.style.top = `${y + 12}px`;
      return;
    }
    this.hover = next;
    this.hoverLabel.style.display = 'block';
    this.hoverLabel.style.left = `${x + 12}px`;
    this.hoverLabel.style.top = `${y + 12}px`;
    this.hoverLabel.textContent = `#${idx} ${snap.kind} ${snap.price.toFixed(2)}`;
    this.render();
  }

  private handleClick(e: MouseEvent): void {
    if (this.candles.length === 0 || !this.geometry) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const idx = Math.max(0, Math.min(this.candles.length - 1, Math.round(this.viewport.indexAtPixel(x))));
    const candle = this.candles[idx];
    const range = this.priceView ?? { min: this.geometry!.priceMin, max: this.geometry!.priceMax };
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
