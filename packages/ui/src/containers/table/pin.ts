export type PinSide = "left" | "right";

/** Column ids pinned to each edge. Each list is ordered as the columns appear, left to right. */
export interface PinnedColumns {
  left?: readonly string[];
  right?: readonly string[];
}

export interface PinPosition {
  side: PinSide;
  /** Distance in px from the pinned edge (the `left` or `right` sticky offset). */
  offset: number;
  /** Innermost pinned column of its side: the one that casts the edge shadow. */
  edge: boolean;
}

/**
 * Cumulative sticky offsets from measured column widths. Left columns stack from the left
 * edge in order; right columns stack from the right edge, so the last id sits at offset 0.
 * Ids without a measured width are ignored; an id listed on both sides keeps its left pin.
 */
export function computePinOffsets(
  widths: Readonly<Record<string, number>>,
  pinned: PinnedColumns,
): Record<string, PinPosition> {
  const result: Record<string, PinPosition> = {};
  const left = (pinned.left ?? []).filter((id) => widths[id] !== undefined);
  const right = (pinned.right ?? []).filter((id) => widths[id] !== undefined && !left.includes(id));

  let offset = 0;
  left.forEach((id, index) => {
    result[id] = { side: "left", offset, edge: index === left.length - 1 };
    offset += widths[id] ?? 0;
  });

  offset = 0;
  for (let index = right.length - 1; index >= 0; index -= 1) {
    const id = right[index] as string;
    result[id] = { side: "right", offset, edge: index === 0 };
    offset += widths[id] ?? 0;
  }
  return result;
}

/** Drops ids that no longer exist, duplicates, and ids pinned on both sides. */
export function sanitizePinned(
  pinned: PinnedColumns,
  knownIds: readonly string[] | null,
): { left: string[]; right: string[] } {
  const keep = (id: unknown): id is string =>
    typeof id === "string" && (knownIds === null || knownIds.includes(id));
  const left = [...new Set((pinned.left ?? []).filter(keep))];
  const right = [...new Set((pinned.right ?? []).filter(keep))].filter((id) => !left.includes(id));
  return { left, right };
}

/** Pins `id` to `side`, or unpins it when `side` is null; lists follow `order` (column order). */
export function setColumnPin(
  pinned: PinnedColumns,
  id: string,
  side: PinSide | null,
  order: readonly string[],
): { left: string[]; right: string[] } {
  const without = (list: readonly string[] | undefined) => (list ?? []).filter((x) => x !== id);
  const left = without(pinned.left);
  const right = without(pinned.right);
  if (side === "left") left.push(id);
  if (side === "right") right.push(id);
  const rank = (x: string) => {
    const index = order.indexOf(x);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  return {
    left: left.sort((a, b) => rank(a) - rank(b)),
    right: right.sort((a, b) => rank(a) - rank(b)),
  };
}

export function parseStoredPins(raw: string | null): { left: string[]; right: string[] } | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null) return null;
    const { left, right } = value as { left?: unknown; right?: unknown };
    const list = (x: unknown) =>
      Array.isArray(x) ? x.filter((item): item is string => typeof item === "string") : [];
    return { left: list(left), right: list(right) };
  } catch {
    return null;
  }
}
