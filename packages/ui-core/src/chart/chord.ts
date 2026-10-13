/**
 * Chord diagram layout: groups around a circle, ribbons between them whose
 * widths are the flows. Pure functions.
 *
 * `matrix[i][j]` is the flow from group `i` to group `j`. A group's arc spans
 * its outflow (the row sum); each ribbon touches the source group with
 * `matrix[i][j]` and the target group with `matrix[j][i]`, so a symmetric
 * matrix gives ribbons of equal width at both ends.
 */

import { polarPoint, TAU } from "../internal/polar-math.ts";

export interface ChordOptions {
  /** Empty angle between neighbouring groups, radians. */
  padAngle?: number;
  /** Where the first group starts, radians, 0 at twelve o'clock clockwise. */
  startAngle?: number;
  /** Order of the groups around the circle. */
  sortGroups?: "input" | "ascending" | "descending";
  /** Order of the ribbon ends inside a group. */
  sortSubgroups?: "input" | "ascending" | "descending";
}

export interface ChordGroup {
  index: number;
  startAngle: number;
  endAngle: number;
  /** Row sum: everything that leaves this group. */
  value: number;
}

export interface ChordEnd {
  /** The group this end belongs to. */
  index: number;
  /** The group at the other end. */
  other: number;
  startAngle: number;
  endAngle: number;
  value: number;
}

export interface Chord {
  /** Larger end first. */
  source: ChordEnd;
  target: ChordEnd;
  /** `source.value + target.value`, the weight of the whole ribbon. */
  value: number;
}

export interface ChordLayout {
  /** In input order (not drawing order). */
  groups: ChordGroup[];
  chords: Chord[];
}

const compare = (mode: "input" | "ascending" | "descending") =>
  mode === "ascending"
    ? (a: number, b: number) => a - b
    : mode === "descending"
      ? (a: number, b: number) => b - a
      : null;

export function chordLayout(
  matrix: ReadonlyArray<readonly number[]>,
  {
    padAngle = 0.04,
    startAngle = 0,
    sortGroups = "input",
    sortSubgroups = "input",
  }: ChordOptions = {},
): ChordLayout {
  const n = matrix.length;
  const cell = (i: number, j: number) => {
    const value = matrix[i]?.[j] ?? 0;
    return Number.isFinite(value) && value > 0 ? value : 0;
  };
  const rows = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => cell(i, j)).reduce((a, b) => a + b, 0),
  );
  const total = rows.reduce((a, b) => a + b, 0);
  if (n === 0 || total <= 0) return { groups: [], chords: [] };

  const pads = padAngle * n;
  const k = Math.max(0, TAU - pads) / total;
  const groupOrder = Array.from({ length: n }, (_, i) => i);
  const byGroup = compare(sortGroups);
  if (byGroup) groupOrder.sort((a, b) => byGroup(rows[a] as number, rows[b] as number));
  const bySub = compare(sortSubgroups);

  const groups: ChordGroup[] = new Array(n);
  const ends = new Map<string, ChordEnd>();
  let angle = startAngle;
  for (const i of groupOrder) {
    const from = angle;
    const order = Array.from({ length: n }, (_, j) => j);
    if (bySub) order.sort((a, b) => bySub(cell(i, a), cell(i, b)));
    for (const j of order) {
      const value = cell(i, j);
      ends.set(`${i}:${j}`, {
        index: i,
        other: j,
        startAngle: angle,
        endAngle: angle + value * k,
        value,
      });
      angle += value * k;
    }
    groups[i] = { index: i, startAngle: from, endAngle: angle, value: rows[i] as number };
    angle += padAngle;
  }

  const chords: Chord[] = [];
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j <= i; j += 1) {
      const a = ends.get(`${i}:${j}`) as ChordEnd;
      const b = ends.get(`${j}:${i}`) as ChordEnd;
      if (!(a.value > 0) && !(b.value > 0)) continue;
      const [source, target] = a.value < b.value ? [b, a] : [a, b];
      chords.push({ source, target, value: a.value + (i === j ? 0 : b.value) });
    }
  }
  return { groups, chords };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

function arcTo(radius: number, from: number, to: number, cx: number, cy: number): string {
  const end = polarPoint(cx, cy, radius, to);
  const large = Math.abs(to - from) > Math.PI ? 1 : 0;
  return `A${r2(radius)},${r2(radius)} 0 ${large} 1 ${r2(end.x)},${r2(end.y)}`;
}

/**
 * Closed ribbon between the two ends of a chord at `radius`: along the source
 * arc, a curve through the centre to the target arc, along it, and back. A
 * chord from a group to itself is a single loop.
 */
export function ribbonPath(chord: Chord, radius: number, cx = 0, cy = 0): string {
  const { source: s, target: t } = chord;
  const point = (angle: number) => {
    const p = polarPoint(cx, cy, radius, angle);
    return `${r2(p.x)},${r2(p.y)}`;
  };
  const centre = `${r2(cx)},${r2(cy)}`;
  if (s.index === t.index) {
    return `M${point(s.startAngle)}${arcTo(radius, s.startAngle, s.endAngle, cx, cy)}Q${centre} ${point(s.startAngle)}Z`;
  }
  return [
    `M${point(s.startAngle)}`,
    arcTo(radius, s.startAngle, s.endAngle, cx, cy),
    `Q${centre} ${point(t.startAngle)}`,
    arcTo(radius, t.startAngle, t.endAngle, cx, cy),
    `Q${centre} ${point(s.startAngle)}`,
    "Z",
  ].join("");
}

/** Ribbons that touch a group (as source or target). */
export function chordsOf(layout: ChordLayout, group: number): Chord[] {
  return layout.chords.filter(
    (chord) => chord.source.index === group || chord.target.index === group,
  );
}

/** Index of the group whose arc contains `angle`, or -1 (in the padding or outside). */
export function groupAt(layout: ChordLayout, angle: number): number {
  const a = ((angle % TAU) + TAU) % TAU;
  for (const group of layout.groups) {
    const from = ((group.startAngle % TAU) + TAU) % TAU;
    const span = group.endAngle - group.startAngle;
    const offset = (a - from + TAU) % TAU;
    if (offset <= span) return group.index;
  }
  return -1;
}
