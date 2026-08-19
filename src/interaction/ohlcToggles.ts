// Point-click OHLC source toggles (MD §31): when a snap point is selected and
// nearby indicator lines are revealed, a panel offers four toggles — Open,
// High, Low, Close — all on by default. Disabling a source filters the revealed
// lines down to the enabled price sources. Pure.

import type { IndicatorLine } from '../indicators/engine';

export type OHLCSource = 'open' | 'high' | 'low' | 'close';

export interface OHLCToggles {
  open: boolean;
  high: boolean;
  low: boolean;
  close: boolean;
}

export function defaultOHLCToggles(): OHLCToggles {
  return { open: true, high: true, low: true, close: true };
}

export function filterBySource(
  lineIds: string[],
  lines: IndicatorLine[],
  toggles: OHLCToggles,
): string[] {
  const byId = new Map(lines.map((l) => [l.id, l]));
  return lineIds.filter((id) => {
    const line = byId.get(id);
    if (!line) return false;
    return toggles[line.source as OHLCSource] ?? true;
  });
}
