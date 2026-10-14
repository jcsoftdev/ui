import {
  type Chord,
  chordLayout,
  chordsOf,
  groupAt,
  ribbonPath,
} from "@jcsoftdev/ui-core/chart/chord";
import { arcPath, degToRad, polarPoint } from "@jcsoftdev/ui-core/chart/polar";
import { adoptStyles, type DefineOptions, defineElement, rootOf } from "../internal/base.js";
import {
  CHART_ATTRIBUTES,
  CHART_EVENT,
  ChartElement,
  type ChartLabels,
  type DrawContext,
  type DrawResult,
  type HoverInfo,
  type NavIntent,
  svg,
  type TooltipRow,
} from "../internal/chart-base.js";
import { dimExcept } from "../internal/chart-flow.js";
import { cachedJson, textWidth } from "../internal/chart-text.js";
import { numberAttr } from "../internal/e5-forms.js";
import css from "./chord-chart.css.js";

export interface ChordGroupInput {
  id: string;
  name: string;
  /** CSS color; defaults to a palette slot. */
  color?: string;
}

/** What a chord chart mark index stands for (see `chart.describe(index)`). */
export type ChordMark =
  | { kind: "group"; index: number; id: string; name: string }
  | { kind: "ribbon"; from: number; to: number };

/** Visible strings of the chord chart (English defaults; override with `chart.labels`). */
export interface ChordLabels {
  /** Data table header of the row (where a flow starts). */
  from: string;
  to: string;
  /** Tooltip row: everything entering a group. */
  inflow: string;
  /** Tooltip row: everything leaving a group. */
  outflow: string;
  /** `{groups}` and `{total}`. */
  summary: string;
}

const DEFAULTS: ChordLabels = {
  from: "From",
  to: "To",
  inflow: "In",
  outflow: "Out",
  summary: "{groups} groups, total flow {total}",
};
const EASE = "cubic-bezier(.22,1,.36,1)";
const RIM_GAP = 8;
const SAMPLES = 12;

type Sort = "input" | "ascending" | "descending";
const sortOf = (value: string | null, fallback: Sort): Sort =>
  value === "input" || value === "ascending" || value === "descending" ? value : fallback;

const finite = (value: number): number => (Number.isFinite(value) ? value : 0);
const normalize = (angle: number) => ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

/**
 * `<ui-chord-chart>`: groups share a circle and the ribbons between them are the flows (who
 * switches to whom, which service goes with which), on the chart base. Hover a group to light its
 * ribbons and dim the rest, a ribbon to isolate it. The pointer is resolved by angle and radius
 * with snapping in the gaps, so the tooltip never blinks between groups or ribbons.
 *
 * Keyboard: the marks are the groups (clockwise from the start angle) and then the ribbons. Left
 * and Right walk the groups around the ring (wrapping); Down (or Shift+Enter) goes into the
 * group's ribbons, largest first; Left and Right then walk those ribbons and Up (or Backspace)
 * returns to the group. Home and End jump to the first and last group. Enter or a tap pins, Shift+
 * Enter drills.
 *
 * Attributes: `groups` (JSON `[{ id, name, color? }]`), `matrix` (JSON number matrix, `[i][j]` is
 * the flow from group i to group j), `pad-angle` (degrees, default 3), `start-angle` (degrees),
 * `ring-width` (fraction of the radius, default .09), `sort-groups` and `sort-subgroups`
 * (`input`, `ascending`, `descending`; subgroups default `descending`), `show-labels="off"`, plus
 * the chart attributes. Properties: `groups`, `matrix`, `labels`;
 * `describe(index)` names the group or ribbon behind a mark index. The groups are legend items
 * (`ui-chart-legend` toggles them).
 */
export class UiChordChart extends ChartElement {
  static override observedAttributes = [
    ...CHART_ATTRIBUTES,
    "groups",
    "matrix",
    "pad-angle",
    "start-angle",
    "ring-width",
    "sort-groups",
    "sort-subgroups",
    "show-labels",
  ];
  override labels: Partial<ChartLabels & ChordLabels> = {};
  readonly #json = cachedJson(this);
  #groups: readonly ChordGroupInput[] | undefined;
  #matrix: ReadonlyArray<readonly number[]> | undefined;
  #view:
    | {
        marks: ChordMark[];
        groups: Array<{ index: number; els: Element[] }>;
        ribbons: Array<{ key: string; el: Element }>;
        lit(index: number): { ribbons: Set<string>; groups: Set<number> } | null;
      }
    | undefined;

  constructor() {
    super();
    this.addEventListener(CHART_EVENT.hover, (event) =>
      this.#light((event as CustomEvent<HoverInfo | null>).detail?.index ?? null),
    );
  }

  get groups(): readonly ChordGroupInput[] {
    return this.#groups ?? this.#json<ChordGroupInput[]>("groups") ?? [];
  }
  set groups(value: readonly ChordGroupInput[]) {
    this.#groups = value;
    this.requestDraw();
  }
  get matrix(): ReadonlyArray<readonly number[]> {
    return this.#matrix ?? this.#json<number[][]>("matrix") ?? [];
  }
  set matrix(value: ReadonlyArray<readonly number[]>) {
    this.#matrix = value;
    this.requestDraw();
  }

  /** The group or ribbon behind a mark index (what `chart-select` and `chart-drill` report). */
  describe(index: number): ChordMark | undefined {
    return this.#view?.marks[index];
  }

  override connectedCallback(): void {
    this.dataset.ui = "chord-chart";
    adoptStyles(rootOf(this), css);
    // TODO(natural-height): the base PR will add a natural-height hook; the default height goes there.
    super.connectedCallback();
  }

  protected override isEmpty(): boolean {
    return this.groups.length === 0 || !this.matrix.some((row) => row.some((value) => value > 0));
  }

  #light(index: number | null): void {
    const view = this.#view;
    if (!view) return;
    const lit = index == null || index < 0 ? null : view.lit(index);
    dimExcept(
      view.groups.map(({ index: key, els }) => ({ key, els })),
      lit ? lit.groups : null,
    );
    dimExcept(
      view.ribbons.map(({ key, el }) => ({ key, els: [el] })),
      lit ? lit.ribbons : null,
    );
  }

  protected draw({
    svg: root,
    width,
    height,
    format,
    color,
    animate,
    hover,
  }: DrawContext): DrawResult {
    const text = { ...DEFAULTS, ...this.labels };
    const show = (value: number) => format(finite(value));
    const groups = this.groups;
    // Hidden groups leave the matrix; `kept[k]` is the original index of visible group `k`.
    const kept = groups
      .map((_, i) => i)
      .filter((i) => !this.isHidden((groups[i] as ChordGroupInput).id));
    const source = this.matrix;
    const matrix = kept.map((i) => kept.map((j) => finite(source[i]?.[j] ?? 0)));
    const layout = chordLayout(matrix, {
      padAngle: degToRad(numberAttr(this, "pad-angle", 3)),
      startAngle: degToRad(numberAttr(this, "start-angle", 0)),
      sortGroups: sortOf(this.getAttribute("sort-groups"), "input"),
      sortSubgroups: sortOf(this.getAttribute("sort-subgroups"), "descending"),
    });
    if (layout.groups.length === 0) return {};
    const input = (k: number) => groups[kept[k] as number] as ChordGroupInput;
    const colors = groups.map((group, i) => color(i, group.color));
    const colorOf = (k: number) => colors[kept[k] as number] as string;

    const rim = this.getAttribute("show-labels") !== "off" && width >= 420;
    let widest = 0;
    if (rim)
      for (const i of kept)
        widest = Math.max(widest, textWidth((groups[i] as ChordGroupInput).name, 11.5));
    const labelRoom = rim ? Math.min(width * 0.28, widest + RIM_GAP + 6) : 0;
    const radius = Math.max(40, Math.min(width / 2 - labelRoom - 4, height / 2 - (rim ? 16 : 4)));
    const inner =
      radius * (1 - Math.min(0.4, Math.max(0.03, numberAttr(this, "ring-width", 0.09))));
    const cx = width / 2;
    const cy = height / 2;

    const ring = [...layout.groups].sort((a, b) => a.startAngle - b.startAngle);
    const groupCount = ring.length;
    const groupMark = new Map(ring.map((group, i) => [group.index, i]));
    const key = (chord: Chord) => `${chord.source.index}:${chord.target.index}`;
    const ribbons = layout.chords;
    const ribbonMark = new Map(ribbons.map((chord, j) => [key(chord), groupCount + j]));
    const inflowOf = (k: number) =>
      matrix.reduce((sum, row, i) => sum + (i === k ? 0 : (row[k] ?? 0)), 0) +
      (matrix[k]?.[k] ?? 0);
    const flowsOut = (k: number) =>
      (matrix[k] ?? [])
        .map((value, j) => ({ value, j }))
        .filter(({ value, j }) => value > 0 && j !== k)
        .sort((a, b) => b.value - a.value);

    const plot = svg("g", { transform: `translate(${cx},${cy})` });
    const ribbonLayer = svg("g");
    const ribbonEls = ribbons.map((chord, j) => {
      const tone = colorOf(chord.source.index);
      const el = svg("path", {
        d: ribbonPath(chord, inner - 2),
        "data-ribbon": "",
        "data-mark": groupCount + j,
        "stroke-width": 0.75,
        style: `fill:${tone};stroke:${tone}`,
      });
      ribbonLayer.append(el);
      return el;
    });
    const arcEls = ring.map((group, i) => {
      const el = svg("path", {
        d: arcPath({
          cx: 0,
          cy: 0,
          innerRadius: inner,
          outerRadius: radius,
          startAngle: group.startAngle,
          endAngle: group.endAngle,
          cornerRadius: 3,
        }),
        "data-arc": "",
        "data-mark": i,
        "data-series": input(group.index).id,
        style: `fill:${colorOf(group.index)};transform-box:fill-box;transform-origin:center`,
      });
      return el;
    });
    plot.append(ribbonLayer, ...arcEls);
    const rimEls = new Map<number, SVGTextElement>();
    if (rim) {
      const labelLayer = svg("g", { "aria-hidden": "true", "data-label": "" });
      for (const group of ring) {
        const mid = (group.startAngle + group.endAngle) / 2;
        const at = polarPoint(0, 0, radius + RIM_GAP, mid);
        const sin = Math.sin(mid);
        const cos = Math.cos(mid);
        const label = svg(
          "text",
          {
            x: at.x,
            y: at.y + (cos > 0.4 ? -2 : cos < -0.4 ? 10 : 4),
            "text-anchor": sin > 0.25 ? "start" : sin < -0.25 ? "end" : "middle",
            style: "fill:var(--ink-2);font-size:11.5px;font-weight:600",
          },
          input(group.index).name,
        );
        labelLayer.append(label);
        rimEls.set(group.index, label);
      }
      plot.append(labelLayer);
    }
    root.append(plot);

    if (animate) {
      for (const [i, el] of ribbonEls.entries())
        el.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 500,
          delay: i * 25,
          easing: "ease-out",
          fill: "backwards",
        });
      for (const [i, el] of arcEls.entries())
        el.animate(
          [
            { opacity: 0, transform: "scale(.9)" },
            { opacity: 1, transform: "scale(1)" },
          ],
          { duration: 520, delay: i * 50, easing: EASE, fill: "backwards" },
        );
    }

    const marks: ChordMark[] = [
      ...ring.map(
        (group): ChordMark => ({
          kind: "group",
          index: kept[group.index] as number,
          id: input(group.index).id,
          name: input(group.index).name,
        }),
      ),
      ...ribbons.map(
        (chord): ChordMark => ({
          kind: "ribbon",
          from: kept[chord.source.index] as number,
          to: kept[chord.target.index] as number,
        }),
      ),
    ];
    this.#view = {
      marks,
      groups: ring.map((group, i) => ({
        index: group.index,
        els: [
          arcEls[i] as Element,
          ...(rimEls.has(group.index) ? [rimEls.get(group.index) as Element] : []),
        ],
      })),
      ribbons: ribbons.map((chord, j) => ({ key: key(chord), el: ribbonEls[j] as Element })),
      lit: (index) => {
        if (index < groupCount) {
          const group = ring[index] as (typeof ring)[number];
          const touching = chordsOf(layout, group.index);
          const groupsLit = new Set([group.index]);
          for (const chord of touching) {
            groupsLit.add(chord.source.index);
            groupsLit.add(chord.target.index);
          }
          return { ribbons: new Set(touching.map(key)), groups: groupsLit };
        }
        const chord = ribbons[index - groupCount];
        return chord
          ? {
              ribbons: new Set([key(chord)]),
              groups: new Set([chord.source.index, chord.target.index]),
            }
          : null;
      },
    };
    this.#light(hover);

    // ---- navigation: group to group, then into its ribbons ----
    const ribbonsOf = (group: number): number[] =>
      chordsOf(layout, group)
        .sort((a, b) => b.value - a.value)
        .map((chord) => ribbonMark.get(key(chord)) as number);
    let entered = -1;
    const contextOf = (index: number): number => {
      const chord = ribbons[index - groupCount] as Chord;
      return entered === chord.source.index || entered === chord.target.index
        ? entered
        : chord.source.index;
    };
    const nav = (index: number, intent: NavIntent): number | undefined => {
      if (intent === "home") return 0;
      if (intent === "end") return groupCount - 1;
      if (index < groupCount) {
        const group = (ring[index] as (typeof ring)[number]).index;
        switch (intent) {
          case "right":
            return (index + 1) % groupCount;
          case "left":
            return (index + groupCount - 1) % groupCount;
          case "down":
          case "child": {
            const first = ribbonsOf(group)[0];
            if (first != null) entered = group;
            return first;
          }
          default:
            return undefined;
        }
      }
      const context = contextOf(index);
      const list = ribbonsOf(context);
      const at = list.indexOf(index);
      switch (intent) {
        case "right":
          return list[at + 1];
        case "left":
          return list[at - 1];
        case "up":
        case "parent":
          entered = -1;
          return groupMark.get(context);
        default:
          return undefined;
      }
    };

    // ---- pointer ----
    const centres = ribbons.map((chord) => {
      const a = (chord.source.startAngle + chord.source.endAngle) / 2;
      const b = (chord.target.startAngle + chord.target.endAngle) / 2;
      const p = polarPoint(0, 0, inner - 2, a);
      const q = polarPoint(0, 0, inner - 2, b);
      return Array.from({ length: SAMPLES + 1 }, (_, i) => {
        const t = i / SAMPLES;
        const u = 1 - t;
        return { x: u * u * p.x + t * t * q.x, y: u * u * p.y + t * t * q.y };
      });
    });
    const groupAtAngle = (angle: number): number => {
      const direct = groupAt(layout, angle);
      if (direct >= 0) return groupMark.get(direct) as number;
      // In a gap between groups: the nearest edge.
      const apart = (a: number, b: number) => {
        const d = Math.abs(normalize(a) - normalize(b));
        return Math.min(d, Math.PI * 2 - d);
      };
      let best = 0;
      let distance = Number.POSITIVE_INFINITY;
      ring.forEach((group, i) => {
        const d = Math.min(apart(angle, group.startAngle), apart(angle, group.endAngle));
        if (d < distance) {
          distance = d;
          best = i;
        }
      });
      return best;
    };
    const hit = (x: number, y: number, target: Element | null, pointerRadius: number): number => {
      const owner = target?.closest("[data-mark]");
      if (owner && root.contains(owner)) return Number(owner.getAttribute("data-mark"));
      const dx = x - cx;
      const dy = y - cy;
      const r = Math.hypot(dx, dy);
      if (r > radius + Math.max(6, pointerRadius / 2)) return -1;
      if (r >= inner - 3 || ribbons.length === 0) return groupAtAngle(Math.atan2(dx, -dy));
      const point = new DOMPoint(dx, dy);
      for (let j = ribbonEls.length - 1; j >= 0; j -= 1)
        if ((ribbonEls[j] as SVGGeometryElement).isPointInFill(point)) return groupCount + j;
      let best = 0;
      let distance = Number.POSITIVE_INFINITY;
      centres.forEach((samples, j) => {
        for (const s of samples) {
          const d = (s.x - dx) ** 2 + (s.y - dy) ** 2;
          if (d < distance) {
            distance = d;
            best = j;
          }
        }
      });
      return groupCount + best;
    };

    // ---- details ----
    const rowsOfGroup = (group: number): TooltipRow[] => {
      const rows: TooltipRow[] = [
        {
          id: "out",
          name: text.outflow,
          value: show((layout.groups.find((g) => g.index === group) as { value: number }).value),
          color: colorOf(group),
          shape: "dot",
        },
        { id: "in", name: text.inflow, value: show(inflowOf(group)), color: "transparent" },
      ];
      for (const { value, j } of flowsOut(group).slice(0, 4))
        rows.push({
          id: `to-${j}`,
          name: `→ ${input(j).name}`,
          value: show(value),
          color: colorOf(j),
          shape: "dot",
        });
      return rows;
    };
    const labelOf = (index: number): string => {
      if (index < groupCount) {
        const group = (ring[index] as (typeof ring)[number]).index;
        const flows = flowsOut(group).map(({ value, j }) => `${input(j).name} ${show(value)}`);
        return `${input(group).name}: ${text.outflow} ${show((ring[index] as { value: number }).value)}, ${text.inflow} ${show(inflowOf(group))}. ${flows.join(", ")}`;
      }
      const chord = ribbons[index - groupCount] as Chord;
      const [a, b] = [chord.source.index, chord.target.index];
      return a === b
        ? `${input(a).name} → ${input(a).name}: ${show(matrix[a]?.[a] ?? 0)}`
        : `${input(a).name} → ${input(b).name}: ${show(matrix[a]?.[b] ?? 0)}; ${input(b).name} → ${input(a).name}: ${show(matrix[b]?.[a] ?? 0)}`;
    };

    const total = layout.groups.reduce((sum, group) => sum + group.value, 0);
    return {
      summary: text.summary.replace("{groups}", `${groupCount}`).replace("{total}", show(total)),
      marks: [...arcEls, ...ribbonEls].map((el, index) => ({ el, label: labelOf(index) })),
      maxHoverRows: 6,
      hit,
      nav,
      hover: (index) => {
        if (index < groupCount) {
          const group = ring[index] as (typeof ring)[number];
          const at = polarPoint(cx, cy, inner, (group.startAngle + group.endAngle) / 2);
          return {
            title: input(group.index).name,
            rows: rowsOfGroup(group.index),
            x: at.x,
            y: at.y,
          };
        }
        const chord = ribbons[index - groupCount];
        const samples = centres[index - groupCount];
        if (!chord || !samples) return null;
        const [a, b] = [chord.source.index, chord.target.index];
        const rows: TooltipRow[] = [
          {
            id: "ab",
            name: `${input(a).name} → ${input(b).name}`,
            value: show(matrix[a]?.[b] ?? 0),
            color: colorOf(a),
            shape: "dot",
          },
        ];
        if (a !== b)
          rows.push({
            id: "ba",
            name: `${input(b).name} → ${input(a).name}`,
            value: show(matrix[b]?.[a] ?? 0),
            color: colorOf(b),
            shape: "dot",
          });
        const mid = samples[SAMPLES / 2] as { x: number; y: number };
        return { title: `${input(a).name} ↔ ${input(b).name}`, rows, x: cx + mid.x, y: cy + mid.y };
      },
      snapshot: () => ({
        title: this.getAttribute("label") ?? text.from,
        categoryHeader: text.from,
        categories: groups.map((group) => group.name),
        series: groups.map((group, j) => ({
          id: group.id,
          name: `${text.to} ${group.name}`,
          color: colors[j] as string,
          shape: "dot" as const,
          values: groups.map((_, i) => finite(source[i]?.[j] ?? 0)),
          text: groups.map((_, i) => show(source[i]?.[j] ?? 0)),
        })),
        legend: groups.map((group, i) => ({
          id: group.id,
          name: group.name,
          color: colors[i] as string,
          shape: "dot" as const,
        })),
      }),
    };
  }
}

/** Registers `<ui-chord-chart>` (or `<prefix>-chord-chart`) and returns the tag. */
export function defineChordChart(options?: DefineOptions): string {
  return defineElement("chord-chart", UiChordChart, options);
}
