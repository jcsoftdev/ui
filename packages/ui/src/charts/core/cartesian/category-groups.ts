import type { CategoryGroup } from "./types.js";

export interface CategoryGroupSpan {
  key: string;
  label: string;
  /** Left and right edge along the category axis, in plot pixels. */
  from: number;
  to: number;
  center: number;
}

/**
 * Pixel span of each group along the category axis. A group covers the slots
 * of its categories (`step` wide, centred on `positions`). Groups beyond the
 * category count are dropped and the last one is cut short.
 */
export function categoryGroupSpans(
  groups: readonly CategoryGroup[],
  positions: readonly number[],
  step: number,
): CategoryGroupSpan[] {
  const spans: CategoryGroupSpan[] = [];
  let cursor = 0;
  groups.forEach((group, index) => {
    const first = cursor;
    const last = Math.min(positions.length - 1, cursor + Math.max(0, group.count) - 1);
    cursor += Math.max(0, group.count);
    if (first > last || first >= positions.length) return;
    const from = (positions[first] as number) - step / 2;
    const to = (positions[last] as number) + step / 2;
    spans.push({
      key: `${index}-${group.label}`,
      label: group.label,
      from,
      to,
      center: (from + to) / 2,
    });
  });
  return spans;
}
