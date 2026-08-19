// Recolor without recomputation (MD §29): the indicator matrix is fixed, but
// its presentation is not. Given the raw lines and a new ColorConfig, produce
// freshly colored RenderLines — no indicator math, no worker. Pure.

import type { IndicatorLine } from '../indicators/engine';
import type { ColorConfig } from '../core/config';
import type { RenderLine } from './renderer';
import { assignLineColors } from './colors';

export function recolor(
  lines: IndicatorLine[],
  config: ColorConfig,
): RenderLine[] {
  const colors = assignLineColors(
    lines.map((l) => ({ id: l.id, period: l.period })),
    config,
  );
  return lines.map((l) => ({
    id: l.id,
    color: colors[l.id] ?? '#888888',
    values: l.values,
    visible: true,
  }));
}
