export interface PanelConstraint {
  /** Percent of the group. */
  min: number;
  max: number;
}

const EPSILON = 1e-9;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Initial layout in percent summing to 100. Panels without a default share what the others
 * leave; then every panel is clamped to its constraint and the difference is spread over the
 * panels that still have room.
 */
export function normalizeSizes(
  defaults: Array<number | undefined>,
  constraints: PanelConstraint[],
): number[] {
  const count = defaults.length;
  if (count === 0) return [];
  const defined = defaults.reduce<number>((sum, size) => sum + (size ?? 0), 0);
  const open = defaults.filter((size) => size === undefined).length;
  const share = open > 0 ? Math.max(0, 100 - defined) / open : 0;
  const raw = defaults.map((size) => size ?? share);
  const total = raw.reduce((sum, size) => sum + size, 0) || 1;
  const sizes = raw.map((size, i) => {
    const c = constraints[i] ?? { min: 0, max: 100 };
    return clamp((size / total) * 100, c.min, c.max);
  });

  for (let pass = 0; pass < count; pass += 1) {
    const diff = 100 - sizes.reduce((sum, size) => sum + size, 0);
    if (Math.abs(diff) < EPSILON) break;
    const room = sizes.map((size, i) => {
      const c = constraints[i] ?? { min: 0, max: 100 };
      return diff > 0 ? c.max - size : size - c.min;
    });
    const roomSum = room.reduce((sum, r) => sum + Math.max(0, r), 0);
    if (roomSum < EPSILON) break;
    const apply = Math.min(Math.abs(diff), roomSum);
    for (let i = 0; i < count; i += 1) {
      const portion = (Math.max(0, room[i] ?? 0) / roomSum) * apply;
      sizes[i] = (sizes[i] ?? 0) + (diff > 0 ? portion : -portion);
    }
  }
  return sizes;
}

/**
 * Moves the boundary between panel `index` and `index + 1` by `delta` percent. The pair keeps
 * its combined size and both panels stay inside their min/max; other panels are untouched.
 */
export function resizePair(
  sizes: number[],
  constraints: PanelConstraint[],
  index: number,
  delta: number,
): number[] {
  const a = sizes[index];
  const b = sizes[index + 1];
  const ca = constraints[index];
  const cb = constraints[index + 1];
  if (a === undefined || b === undefined || !ca || !cb) return sizes;

  const total = a + b;
  const low = Math.max(ca.min, total - cb.max);
  const high = Math.min(ca.max, total - cb.min);
  if (low > high) return sizes;

  const nextA = clamp(a + delta, low, high);
  if (Math.abs(nextA - a) < EPSILON) return sizes;
  const next = sizes.slice();
  next[index] = nextA;
  next[index + 1] = total - nextA;
  return next;
}

/** Keyboard step in percent for a separator key, or null when the key is not handled. */
export function keyboardDelta(
  key: string,
  orientation: "horizontal" | "vertical",
  shift = false,
  step = 5,
): number | null {
  const amount = shift ? step * 2 : step;
  const [less, more] =
    orientation === "horizontal" ? ["ArrowLeft", "ArrowRight"] : ["ArrowUp", "ArrowDown"];
  if (key === less) return -amount;
  if (key === more) return amount;
  return null;
}
