/** Interpolation behind the bar race: values and ranks between two frames. */

export interface RaceFrame {
  /** Caption of the moment, e.g. "2026" or "oct". */
  label: string;
  /** One value per entity, in the order of the entities. */
  values: readonly number[];
}

export interface RaceItem {
  /** Index of the entity. */
  index: number;
  value: number;
  /** 0 is the longest bar; fractional while two bars swap places. */
  rank: number;
}

/** A value that is not a finite number races as 0 instead of poisoning ranks and bar lengths. */
const finite = (value: number): number => (Number.isFinite(value) ? value : 0);

/** Rank of every value, 0 for the largest; ties keep the entity order. */
export function ranksOf(values: readonly number[]): number[] {
  const order = values
    .map((_, index) => index)
    .sort((a, b) => {
      const diff = finite(values[b] as number) - finite(values[a] as number);
      return diff !== 0 ? diff : a - b;
    });
  const ranks = new Array<number>(values.length).fill(0);
  order.forEach((entity, rank) => {
    ranks[entity] = rank;
  });
  return ranks;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/**
 * State at a fractional frame `position`: values move linearly, ranks follow a smoothstep so a bar
 * glides into its new row instead of jumping.
 */
export function raceItems(frames: readonly RaceFrame[], position: number): RaceItem[] {
  if (frames.length === 0) return [];
  const last = frames.length - 1;
  const at = Math.min(last, Math.max(0, position));
  const lo = Math.floor(at);
  const hi = Math.min(last, lo + 1);
  const t = at - lo;
  const a = frames[lo] as RaceFrame;
  const b = frames[hi] as RaceFrame;
  const ranksA = ranksOf(a.values);
  const ranksB = ranksOf(b.values);
  return a.values.map((value, index) => {
    const from = finite(value);
    const next = finite(b.values[index] ?? value);
    return {
      index,
      value: from + (next - from) * t,
      rank:
        (ranksA[index] as number) +
        ((ranksB[index] as number) - (ranksA[index] as number)) * smooth(t),
    };
  });
}

/** Largest value among the `limit` bars that are on screen at this moment. */
export function visibleMax(items: readonly RaceItem[], limit: number): number {
  let max = 0;
  for (const item of items) if (item.rank < limit) max = Math.max(max, finite(item.value));
  return max;
}
