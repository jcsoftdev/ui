/** What a view row is: a source `data` row, or a `group` header that grouping inserts. */
export type ViewRowKind = "data" | "group";

/** One row of the view. A `group` row has no source row (`source` is `-1`). */
export interface ViewRow {
  kind: ViewRowKind;
  /** Unique key (see `uniqueKeys`); a group row brings its own. */
  key: string;
  /** Index into the source rows, `-1` for a group row. */
  source: number;
  /** Nesting level: `0` for top-level rows. */
  depth: number;
}

/**
 * The rows the grid shows, after filter, sort and group, as a read-only index over the source
 * rows. Everything that walks rows (rendering, focus, selection, scrolling, export) goes through
 * it, so a later stage changes the view and nothing else. Group rows count as rows of the view but
 * never as selectable rows.
 */
export interface GridView {
  /** Rows in the view, group rows included. */
  readonly count: number;
  /** Rows that can be selected: the data rows. */
  readonly dataCount: number;
  row(v: number): ViewRow;
  /** Index into the source rows of view row `v`, `-1` for a group row. */
  sourceAt(v: number): number;
  keyAt(v: number): string;
  kind(v: number): ViewRowKind;
  /** View position of a key, `-1` when the key is not in the view. */
  indexOfKey(key: string): number;
  /** Position among the data rows of a key, `-1` for an unknown or group key. */
  dataIndexOf(key: string): number;
  /** Key of the `i`-th data row. */
  dataKeyAt(i: number): string;
}

export interface ViewInput {
  /** One unique key per source row (see `uniqueKeys`). */
  keys: readonly string[];
  /** Keeps a source row. Skipped when omitted. */
  filter?: (source: number) => boolean;
  /** Orders source indices; receives the indices that survived the filter. */
  sort?: (indices: number[]) => number[];
  /** Turns the sorted data rows into the final rows, inserting `group` entries. Identity when omitted. */
  group?: (rows: ViewRow[]) => ViewRow[];
}

/** Keys of the source rows, made unique so no row is ever dropped. */
export interface UniqueKeys {
  keys: string[];
  /** Each key that appeared more than once, once per extra occurrence. */
  duplicates: string[];
}

/**
 * Reads `keyOf` for every row. Every original key is reserved first, so a real row `x#2` keeps its
 * key; the first row with a key keeps it, later ones get `key#2`, `key#3`... (a suffix nobody owns),
 * and the result is the same for the same input.
 */
export function uniqueKeys(count: number, keyOf: (index: number) => string): UniqueKeys {
  const original = new Array<string>(count);
  const reserved = new Set<string>();
  for (let i = 0; i < count; i += 1) {
    original[i] = keyOf(i);
    reserved.add(original[i] as string);
  }
  const keys = new Array<string>(count);
  const seen = new Set<string>();
  const duplicates: string[] = [];
  let repeats: Map<string, number> | undefined;
  for (let i = 0; i < count; i += 1) {
    let key = original[i] as string;
    if (seen.has(key)) {
      duplicates.push(key);
      repeats ??= new Map();
      let n = repeats.get(key) ?? 1;
      let candidate: string;
      do {
        n += 1;
        candidate = `${key}#${n}`;
      } while (reserved.has(candidate) || seen.has(candidate));
      repeats.set(key, n);
      key = candidate;
    }
    seen.add(key);
    keys[i] = key;
  }
  return { keys, duplicates };
}

/** Builds the view with the pipeline filter, then sort, then group. */
export function buildView({ keys, filter, sort, group }: ViewInput): GridView {
  const total = keys.length;
  const identity = () => Array.from({ length: total }, (_, i) => i);
  let order: number[] | null = null;
  if (filter) {
    order = [];
    for (let i = 0; i < total; i += 1) if (filter(i)) order.push(i);
  }
  if (sort) order = sort(order ?? identity());
  const finalOrder = order;
  const dataRow = (source: number): ViewRow => ({
    kind: "data",
    key: keys[source] as string,
    source,
    depth: 0,
  });
  let grouped: ViewRow[] | undefined;
  if (group) grouped = group((finalOrder ?? identity()).map(dataRow));
  const count = grouped ? grouped.length : finalOrder ? finalOrder.length : total;
  const sourceAt = (v: number) =>
    grouped ? (grouped[v]?.source ?? -1) : finalOrder ? (finalOrder[v] as number) : v;
  const row = (v: number): ViewRow => (grouped ? (grouped[v] as ViewRow) : dataRow(sourceAt(v)));
  let index: Map<string, number> | undefined;
  let dataPos: number[] | undefined;
  const data = () => {
    if (!dataPos) {
      dataPos = [];
      for (let v = 0; v < count; v += 1)
        if (!grouped || grouped[v]?.kind === "data") dataPos.push(v);
    }
    return dataPos;
  };
  const keyAt = (v: number) => (grouped ? (grouped[v]?.key ?? "") : (keys[sourceAt(v)] ?? ""));
  const lookup = () => {
    if (!index) {
      index = new Map();
      for (let v = 0; v < count; v += 1) index.set(keyAt(v), v);
    }
    return index;
  };
  return {
    count,
    get dataCount() {
      return grouped ? data().length : count;
    },
    row,
    sourceAt,
    keyAt,
    kind: (v) => (grouped ? (grouped[v]?.kind ?? "data") : "data"),
    indexOfKey: (key) => lookup().get(key) ?? -1,
    dataIndexOf(key) {
      const v = lookup().get(key);
      if (v === undefined) return -1;
      if (!grouped) return v;
      if (grouped[v]?.kind !== "data") return -1;
      const list = data();
      let low = 0;
      let high = list.length - 1;
      while (low <= high) {
        const mid = (low + high) >> 1;
        const at = list[mid] as number;
        if (at === v) return mid;
        if (at < v) low = mid + 1;
        else high = mid - 1;
      }
      return -1;
    },
    dataKeyAt: (i) => (grouped ? keyAt(data()[i] as number) : keyAt(i)),
  };
}
