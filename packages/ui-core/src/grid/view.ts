/** What a view row is. `group` header rows arrive with grouping; D1 only produces `data`. */
export type ViewRowKind = "data" | "group";

/**
 * The rows the grid shows, after filter, sort and group, as a read-only index over the source
 * rows. Everything that walks rows (rendering, focus, selection, scrolling) goes through it, so a
 * later stage changes the view and nothing else.
 */
export interface GridView {
  /** Rows in the view. */
  readonly count: number;
  /** Index into the source rows of view row `v`. */
  sourceAt(v: number): number;
  /** Unique key of view row `v` (see `uniqueKeys`). */
  keyAt(v: number): string;
  kind(v: number): ViewRowKind;
  /** View position of a key, `-1` when the key is not in the view. */
  indexOfKey(key: string): number;
}

export interface ViewInput {
  /** One unique key per source row (see `uniqueKeys`). */
  keys: readonly string[];
  /** Keeps a source row. Skipped when omitted. */
  filter?: (source: number) => boolean;
  /** Orders source indices; receives the indices that survived the filter. */
  sort?: (indices: number[]) => number[];
  /** Reserved for grouping: orders the sorted indices into groups. Identity when omitted. */
  group?: (indices: number[]) => number[];
}

/** Keys of the source rows, made unique so no row is ever dropped. */
export interface UniqueKeys {
  keys: string[];
  /** Each key that appeared more than once, once per extra occurrence. */
  duplicates: string[];
}

/**
 * Reads `keyOf` for every row. The first row with a key keeps it; later rows with the same key get
 * `key#2`, `key#3`... (a suffix that is not taken yet), so the result is the same for the same input.
 */
export function uniqueKeys(count: number, keyOf: (index: number) => string): UniqueKeys {
  const keys = new Array<string>(count);
  const seen = new Set<string>();
  const duplicates: string[] = [];
  let repeats: Map<string, number> | undefined;
  for (let i = 0; i < count; i += 1) {
    let key = keyOf(i);
    if (seen.has(key)) {
      duplicates.push(key);
      repeats ??= new Map();
      let n = repeats.get(key) ?? 1;
      let candidate: string;
      do {
        n += 1;
        candidate = `${key}#${n}`;
      } while (seen.has(candidate));
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
  if (group) order = group(order ?? identity());
  const finalOrder = order;
  let index: Map<string, number> | undefined;
  const source = (v: number) => (finalOrder ? (finalOrder[v] as number) : v);
  return {
    count: finalOrder ? finalOrder.length : total,
    sourceAt: source,
    keyAt: (v) => keys[source(v)] ?? "",
    kind: () => "data",
    indexOfKey(key) {
      if (!index) {
        index = new Map();
        const count = finalOrder ? finalOrder.length : total;
        for (let v = 0; v < count; v += 1) index.set(keys[source(v)] as string, v);
      }
      return index.get(key) ?? -1;
    },
  };
}
