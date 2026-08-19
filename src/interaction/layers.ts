// Layer controls (MD §26): toggle indicator visibility by family (type) and by
// price source. Opacity is carried alongside for the renderer. Pure logic.

import type { IndicatorLine } from '../indicators/engine';
import type { IndicatorType, PriceSource } from '../core/types';

export interface LayerToggles {
  byType: Partial<Record<IndicatorType, boolean>>;
  bySource: Partial<Record<PriceSource, boolean>>;
}

export function defaultToggles(lines: IndicatorLine[]): LayerToggles {
  const byType: Partial<Record<IndicatorType, boolean>> = {};
  const bySource: Partial<Record<PriceSource, boolean>> = {};
  for (const l of lines) {
    byType[l.type] = true;
    bySource[l.source] = true;
  }
  return { byType, bySource };
}

export function isLineVisible(line: IndicatorLine, toggles: LayerToggles): boolean {
  return (toggles.byType[line.type] ?? true) && (toggles.bySource[line.source] ?? true);
}

export function visibleLineIds(lines: IndicatorLine[], toggles: LayerToggles): Set<string> {
  const ids = new Set<string>();
  for (const l of lines) if (isLineVisible(l, toggles)) ids.add(l.id);
  return ids;
}
