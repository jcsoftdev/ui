// Reference marks of the cartesian charts (threshold lines, highlighted ranges, points and text),
// loaded on demand when a chart has `annotations`. Geometry follows the React kit's layout.
import { estimateTextWidth } from "@jcsoftdev/ui-core/chart/axis";
import { type ChartTone, TONE_COLORS } from "@jcsoftdev/ui-core/chart/palette";
import type { ContinuousScale } from "@jcsoftdev/ui-core/chart/scale";
import { svg } from "./chart-dom.js";
import type { CartesianLayout, ChartAnnotation, XValue } from "./e17-layout.js";

interface Base {
  key: string;
  label?: string;
  tooltip?: string;
  tone: ChartTone;
}
export interface AnnotationSpan extends Base {
  kind: "line" | "range";
  direction: "horizontal" | "vertical";
  from: number;
  to: number;
}
export interface AnnotationMarker extends Base {
  kind: "point" | "text";
  x: number;
  y: number;
}
export type AnnotationGeometry = AnnotationSpan | AnnotationMarker;

const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));
const sameX = (a: XValue, b: XValue) =>
  a instanceof Date || b instanceof Date ? +a === +b : a === b;

/** Pixel geometry of `notes` on `layout`; marks outside the plot are dropped, as in React. */
export function annotationGeometry(
  layout: CartesianLayout,
  categories: readonly XValue[],
  notes: readonly ChartAnnotation[],
): AnnotationGeometry[] {
  const { horizontal, innerWidth, innerHeight, positions, mode, axes } = layout;
  const out: AnnotationGeometry[] = [];
  const valueLength = horizontal ? innerWidth : innerHeight;
  const categoryLength = horizontal ? innerHeight : innerWidth;
  const primary = (axes[0] as { id: string }).id;
  const scaleOf = (id: string | undefined): ContinuousScale =>
    (axes.find((axis) => axis.id === (id ?? primary)) ?? (axes[0] as (typeof axes)[number])).scale;
  let lo = Number.POSITIVE_INFINITY;
  let hi = Number.NEGATIVE_INFINITY;
  if (mode === "time")
    for (const value of categories) {
      lo = Math.min(lo, +value);
      hi = Math.max(hi, +value);
    }
  const categoryPixel = (value: XValue): number | null => {
    if (mode === "time") {
      const time = +value;
      if (time < lo || time > hi) return null;
      return ((time - lo) / (hi - lo || 1)) * categoryLength;
    }
    const index = categories.findIndex((item) => sameX(item, value));
    return index < 0 ? null : (positions[index] as number);
  };
  const count = categories.length;
  const halfSlot =
    mode === "band" ? layout.step / 2 : count > 1 ? categoryLength / (count - 1) / 2 : 0;
  notes.forEach((note, index) => {
    const tone = note.tone ?? "neutral";
    const key = `note-${index}`;
    if (note.type === "point" || note.type === "text") {
      const along = categoryPixel(note.x);
      const across = scaleOf(note.yAxis).map(note.y);
      if (along == null || across < -0.5 || across > valueLength + 0.5) return;
      out.push({
        key,
        kind: note.type,
        x: horizontal ? across : along,
        y: horizontal ? along : across,
        label: note.label,
        tooltip: note.tooltip,
        tone,
      });
      return;
    }
    if (note.axis === "y") {
      const scale = scaleOf(note.yAxis);
      const direction = horizontal ? "vertical" : "horizontal";
      if (note.type === "line") {
        const at = scale.map(note.value);
        if (at < -0.5 || at > valueLength + 0.5) return;
        out.push({ key, kind: "line", direction, from: at, to: at, label: note.label, tone });
      } else {
        const a = clamp(scale.map(note.from), 0, valueLength);
        const b = clamp(scale.map(note.to), 0, valueLength);
        if (a === b) return;
        out.push({
          key,
          kind: "range",
          direction,
          from: Math.min(a, b),
          to: Math.max(a, b),
          label: note.label,
          tone,
        });
      }
      return;
    }
    const direction = horizontal ? "horizontal" : "vertical";
    if (note.type === "line") {
      const at = categoryPixel(note.value);
      if (at != null)
        out.push({ key, kind: "line", direction, from: at, to: at, label: note.label, tone });
      return;
    }
    const a = categoryPixel(note.from);
    const b = categoryPixel(note.to);
    if (a == null || b == null) return;
    out.push({
      key,
      kind: "range",
      direction,
      from: clamp(Math.min(a, b) - halfSlot, 0, categoryLength),
      to: clamp(Math.max(a, b) + halfSlot, 0, categoryLength),
      label: note.label,
      tone,
    });
  });
  return out;
}

const pill = (
  x: number,
  y: number,
  text: string,
  ink: string,
  soft: string,
  anchor: "start" | "middle" | "end",
) => {
  const width = estimateTextWidth(text, 10.5) + 12;
  const left = anchor === "end" ? x - width : anchor === "middle" ? x - width / 2 : x;
  return svg(
    "g",
    {},
    svg("rect", { x: left, y: y - 9, width, height: 18, rx: 9, style: `fill:${soft}` }),
    svg(
      "text",
      {
        x: left + width / 2,
        y,
        dy: "0.35em",
        "text-anchor": "middle",
        "font-size": 10.5,
        "font-weight": 700,
        "pointer-events": "none",
        style: `fill:${ink}`,
      },
      text,
    ),
  );
};

/** SVG of the marks of one layer: ranges sit under the data, everything else over it. */
export function drawAnnotations(
  notes: readonly AnnotationGeometry[],
  width: number,
  height: number,
  layer: "under" | "over",
): SVGGElement {
  const group = svg("g", { "data-e17": "annotations" });
  for (const note of notes) {
    if ((layer === "under") !== (note.kind === "range")) continue;
    const { ink, soft } = TONE_COLORS[note.tone];
    const el = svg("g", { "data-annotation": note.kind, "aria-hidden": "true" });
    group.append(el);
    if ("direction" in note) {
      const horizontal = note.direction === "horizontal";
      if (note.kind === "range") {
        el.append(
          svg("rect", {
            x: horizontal ? 0 : note.from,
            y: horizontal ? note.from : 0,
            width: horizontal ? width : note.to - note.from,
            height: horizontal ? note.to - note.from : height,
            style: `fill:${ink};fill-opacity:.07`,
          }),
        );
        if (note.label)
          el.append(
            svg(
              "text",
              {
                x: (horizontal ? 0 : note.from) + 6,
                y: (horizontal ? note.from : 0) + 13,
                "font-size": 10.5,
                "font-weight": 700,
                "pointer-events": "none",
                style: `fill:${ink}`,
              },
              note.label,
            ),
          );
        continue;
      }
      el.append(
        svg("line", {
          x1: horizontal ? 0 : note.from,
          x2: horizontal ? width : note.from,
          y1: horizontal ? note.from : 0,
          y2: horizontal ? note.from : height,
          "stroke-width": 1.25,
          "stroke-dasharray": "5 4",
          "shape-rendering": "crispEdges",
          style: `stroke:${ink}`,
        }),
      );
      if (note.label)
        el.append(
          horizontal
            ? pill(width - 2, note.from, note.label, ink, soft, "end")
            : pill(
                note.from + (note.from > width * 0.7 ? -4 : 4),
                11,
                note.label,
                ink,
                soft,
                note.from > width * 0.7 ? "end" : "start",
              ),
        );
      continue;
    }
    const half = note.label ? (estimateTextWidth(note.label, 10.5) + 12) / 2 : 0;
    const x = Math.min(Math.max(note.x, half), Math.max(half, width - half));
    const above = note.y > 26;
    const y = note.kind === "point" ? note.y + (above ? -16 : 16) : note.y;
    if (note.kind === "point")
      el.append(
        svg("circle", {
          cx: note.x,
          cy: note.y,
          r: 5,
          "stroke-width": 2.5,
          style: `fill:${ink};stroke:var(--surface)`,
        }),
      );
    if (note.label)
      el.append(
        note.kind === "point"
          ? pill(x, y, note.label, ink, soft, "middle")
          : svg(
              "text",
              {
                x,
                y,
                dy: "0.35em",
                "text-anchor": "middle",
                "paint-order": "stroke",
                "stroke-width": 3,
                "stroke-linejoin": "round",
                "font-size": 10.5,
                "font-weight": 700,
                "pointer-events": "none",
                style: `fill:${ink};stroke:var(--surface)`,
              },
              note.label,
            ),
      );
    if (note.tooltip) {
      el.removeAttribute("aria-hidden");
      el.append(svg("title", {}, note.tooltip));
    }
  }
  return group;
}
