// Framework-free crossfilter engine: dimensions, filters and grouped counts that exclude the
// dimension's own filter, so a chart you are brushing keeps showing the context around the brush.

export type DimensionValue = string | number;

/** How a record exposes a dimension, e.g. `(sale) => sale.barber`. */
export type Accessor<T> = (record: T) => DimensionValue;
export type Accessors<T> = Readonly<Record<string, Accessor<T>>>;

/** One or more categories (clicking bars) or a numeric interval, inclusive (brushing a histogram). */
export type CrossfilterFilter =
  | { kind: "set"; values: readonly DimensionValue[] }
  | { kind: "range"; min: number; max: number };

export type CrossfilterFilters = Readonly<Record<string, CrossfilterFilter>>;

export const NO_FILTERS: CrossfilterFilters = Object.freeze({});

export function matchesFilter(filter: CrossfilterFilter, value: DimensionValue): boolean {
  if (filter.kind === "set") return filter.values.includes(value);
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) && numeric >= filter.min && numeric <= filter.max;
}

/**
 * Records that pass every filter. `exclude` leaves one dimension's own filter out, which is how
 * crossfilter keeps a chart stable while you interact with it.
 */
export function filterRecords<T>(
  records: readonly T[],
  accessors: Accessors<T>,
  filters: CrossfilterFilters,
  exclude?: string,
): T[] {
  const active = Object.entries(filters).filter(([id]) => id !== exclude && accessors[id]);
  if (active.length === 0) return records.slice();
  return records.filter((record) =>
    active.every(([id, filter]) => matchesFilter(filter, (accessors[id] as Accessor<T>)(record))),
  );
}

export interface Group {
  key: DimensionValue;
  /** Records in the group. */
  count: number;
  /** Sum of the `value` accessor (the count when none is given). */
  sum: number;
}

export interface GroupOptions<T> {
  /** Measure to add up; each record counts 1 by default. */
  value?: (record: T) => number;
  /** Keys to report, in this order, even when empty. Otherwise keys in order of first appearance. */
  keys?: readonly DimensionValue[];
}

/** Totals per value of `dimension`, over the records that pass every OTHER filter. */
export function groupRecords<T>(
  records: readonly T[],
  accessors: Accessors<T>,
  filters: CrossfilterFilters,
  dimension: string,
  { value, keys }: GroupOptions<T> = {},
): Group[] {
  const accessor = accessors[dimension];
  if (!accessor) return [];
  const groups = new Map<DimensionValue, Group>();
  for (const key of keys ?? []) groups.set(key, { key, count: 0, sum: 0 });
  for (const record of filterRecords(records, accessors, filters, dimension)) {
    const key = accessor(record);
    let group = groups.get(key);
    if (!group) {
      if (keys) continue;
      group = { key, count: 0, sum: 0 };
      groups.set(key, group);
    }
    group.count += 1;
    group.sum += value ? value(record) : 1;
  }
  return [...groups.values()];
}

/** Bin edges (`count + 1` of them) that split `[min, max]` evenly. */
export function evenEdges(min: number, max: number, count: number): number[] {
  const bins = Math.max(1, Math.round(count));
  const span = max - min || 1;
  return Array.from({ length: bins + 1 }, (_, i) => min + (span * i) / bins);
}

/** Index of the bin of `value`: bins are `[edge i, edge i+1)`, the last one includes its upper edge. -1 outside. */
export function binIndex(edges: readonly number[], value: number): number {
  const last = edges.length - 1;
  if (last < 1 || !Number.isFinite(value) || value < (edges[0] as number)) return -1;
  if (value > (edges[last] as number)) return -1;
  if (value === edges[last]) return last - 1;
  let lo = 0;
  let hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if ((edges[mid] as number) <= value) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Count per bin of a numeric dimension, over the records that pass every OTHER filter. */
export function binRecords<T>(
  records: readonly T[],
  accessors: Accessors<T>,
  filters: CrossfilterFilters,
  dimension: string,
  edges: readonly number[],
): number[] {
  const accessor = accessors[dimension];
  const counts = new Array<number>(Math.max(0, edges.length - 1)).fill(0);
  if (!accessor) return counts;
  for (const record of filterRecords(records, accessors, filters, dimension)) {
    const index = binIndex(edges, Number(accessor(record)));
    if (index >= 0) counts[index] = (counts[index] as number) + 1;
  }
  return counts;
}

/** Adds the value to a set filter, or removes it; a set that becomes empty clears the dimension. */
export function toggleValue(
  filters: CrossfilterFilters,
  dimension: string,
  value: DimensionValue,
): CrossfilterFilters {
  const current = filters[dimension];
  const values = current?.kind === "set" ? current.values : [];
  const next = values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
  return withFilter(filters, dimension, next.length > 0 ? { kind: "set", values: next } : null);
}

export function setRangeFilter(
  filters: CrossfilterFilters,
  dimension: string,
  range: readonly [number, number] | null,
): CrossfilterFilters {
  return withFilter(
    filters,
    dimension,
    range ? { kind: "range", min: Math.min(...range), max: Math.max(...range) } : null,
  );
}

/** Clears one dimension, or all of them. */
export function clearFilters(filters: CrossfilterFilters, dimension?: string): CrossfilterFilters {
  return dimension == null ? NO_FILTERS : withFilter(filters, dimension, null);
}

function withFilter(
  filters: CrossfilterFilters,
  dimension: string,
  filter: CrossfilterFilter | null,
): CrossfilterFilters {
  const { [dimension]: _removed, ...rest } = filters;
  return filter ? { ...rest, [dimension]: filter } : rest;
}

/** True when `value` is inside the dimension's filter (or the dimension has none). */
export function isSelected(
  filters: CrossfilterFilters,
  dimension: string,
  value: DimensionValue,
): boolean {
  const filter = filters[dimension];
  return !filter || matchesFilter(filter, value);
}

/** Indices of the bins a range filter covers (a bin is covered when it overlaps the range). */
export function binsInRange(
  edges: readonly number[],
  min: number,
  max: number,
): [number, number] | null {
  let first = -1;
  let last = -1;
  for (let i = 0; i < edges.length - 1; i += 1) {
    const lo = edges[i] as number;
    const hi = edges[i + 1] as number;
    if (hi > min && lo <= max) {
      if (first < 0) first = i;
      last = i;
    }
  }
  return first < 0 ? null : [first, last];
}

/** Interval covered by bins `from..to` (inclusive indices), as a range filter value. */
export function rangeOfBins(edges: readonly number[], from: number, to: number): [number, number] {
  const lo = Math.max(0, Math.min(from, to));
  const hi = Math.min(edges.length - 2, Math.max(from, to));
  const upper = edges[hi + 1] as number;
  // Bins are half open: stop just short of the next bin's lower edge, except at the very end.
  return [
    edges[lo] as number,
    hi === edges.length - 2 ? upper : upper - (upper - (edges[hi] as number)) * 1e-9,
  ];
}

export function activeFilterCount(filters: CrossfilterFilters): number {
  return Object.keys(filters).length;
}
