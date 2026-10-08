import { niceDomain } from "../core/scales/linear.js";

export type Extent = readonly [number, number];

/** Smallest range covering every extent; null when none is finite. */
export function unionExtent(
  extents: ReadonlyArray<Extent | null | undefined>,
): [number, number] | null {
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  for (const extent of extents) {
    if (!extent) continue;
    const [a, b] = extent;
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    lo = Math.min(lo, a, b);
    hi = Math.max(hi, a, b);
  }
  return lo <= hi ? [lo, hi] : null;
}

export interface SharedDomainOptions {
  /** Widen the domain to round tick values (default true). */
  nice?: boolean;
  /** Force zero into the domain (bars). */
  includeZero?: boolean;
  tickCount?: number;
}

/** One domain for every panel, so the same height means the same value everywhere. */
export function sharedDomain(
  extents: ReadonlyArray<Extent | null | undefined>,
  { nice = true, includeZero = false, tickCount = 5 }: SharedDomainOptions = {},
): [number, number] | null {
  const union = unionExtent(extents);
  if (!union) return null;
  let [lo, hi] = union;
  if (includeZero) {
    lo = Math.min(lo, 0);
    hi = Math.max(hi, 0);
  }
  return nice ? niceDomain(lo, hi, tickCount) : [lo, hi];
}

export interface GridColumnsOptions {
  /** Narrowest a panel may get before the grid drops a column. */
  minPanelWidth: number;
  maxColumns?: number;
  gap?: number;
}

/**
 * Columns that fit a container: as many as keep every panel at least
 * `minPanelWidth` wide (gaps included), never more than `maxColumns` or
 * `count`, never fewer than one.
 */
export function gridColumns(
  width: number,
  count: number,
  { minPanelWidth, maxColumns = 6, gap = 16 }: GridColumnsOptions,
): number {
  if (count <= 0) return 1;
  const fit = Math.floor((width + gap) / (Math.max(1, minPanelWidth) + gap));
  return Math.max(1, Math.min(fit, maxColumns, count));
}

/** Width of one panel for a container width and a column count. */
export function panelWidth(width: number, columns: number, gap = 16): number {
  return Math.max(0, (width - gap * (columns - 1)) / Math.max(1, columns));
}
