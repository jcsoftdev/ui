/**
 * The parts of the donut that most charts never use, loaded on demand: outside labels on leader
 * lines, labels inside the slices, gradient and pattern fills and the monochrome shades. Never an
 * element entry.
 */
import { formatPercent } from "@jcsoftdev/ui-core/chart/format";
import { monochromeByValue } from "@jcsoftdev/ui-core/chart/palette";
import { polarPoint, spreadLabels } from "@jcsoftdev/ui-core/chart/polar";
import { svg } from "./chart-base.js";
import { paint, truncate } from "./e20-polar.js";

const LABEL_ELBOW = 14;
const LABEL_RUN = 30;
const PATTERNS = 5;
const CHAR_WIDTH = 0.6;
const FILL_RATIO = 0.92;

export type Outside = "name" | "percent" | "both";
type Fill = "gradient" | "pattern";

interface LayerItem {
  datum: { id: string; name: string; value: number };
  color: string;
  format: (value: number) => string;
}
interface Slice {
  fraction: number;
  start: number;
  end: number;
  mid: number;
}
interface Layer {
  visible: readonly number[];
  slices: readonly Slice[];
  items: readonly LayerItem[];
  cx: number;
  cy: number;
  locale: string;
}

/**
 * Where a horizontal label sits inside a ring slice, relative to the centre, or null when the text
 * does not fit: its box is projected on the radial and the tangential direction of the slice and
 * must stay within the ring thickness and the arc length at the middle radius.
 */
function fitSliceLabel(
  inner: number,
  radius: number,
  start: number,
  end: number,
  chars: number,
  fontSize: number,
): { x: number; y: number } | null {
  const mid = (start + end) / 2;
  const at = inner <= 0 ? radius * 0.62 : (inner + radius) / 2;
  const thickness = inner <= 0 ? radius * 0.7 : radius - inner;
  const arc = (end - start) * at;
  const width = chars * fontSize * CHAR_WIDTH;
  const height = fontSize * 1.1;
  const rx = Math.sin(mid);
  const ry = -Math.cos(mid);
  const radial = width * Math.abs(rx) + height * Math.abs(ry);
  const tangent = width * Math.abs(ry) + height * Math.abs(rx);
  if (radial > thickness * FILL_RATIO || tangent > arc * FILL_RATIO) return null;
  return { x: at * rx, y: at * ry };
}

/** A texture swatch for one slice: the color with a surface-colored motif on top. */
function pattern(id: string, kind: number, color: string): SVGPatternElement {
  const motif = "fill:var(--surface);fill-opacity:.5";
  const line = "fill:none;stroke:var(--surface);stroke-opacity:.5";
  const which = kind % PATTERNS;
  const node = svg("pattern", {
    id,
    patternUnits: "userSpaceOnUse",
    width: 8,
    height: 8,
    patternTransform: which === 0 || which === 3 ? "rotate(45)" : undefined,
  });
  node.append(paint(svg("rect", { width: 8, height: 8 }), "fill", color));
  if (which === 0) node.append(svg("rect", { width: 8, height: 3, style: motif }));
  if (which === 1) node.append(svg("circle", { cx: 4, cy: 4, r: 1.6, style: motif }));
  if (which === 2)
    node.append(svg("path", { d: "M0 0H8M0 0V8", "stroke-width": 1.4, style: line }));
  if (which === 3) node.append(svg("rect", { width: 8, height: 1.4, y: 3.3, style: motif }));
  if (which === 4)
    node.append(
      svg("rect", { width: 4, height: 4, style: motif }),
      svg("rect", { x: 4, y: 4, width: 4, height: 4, style: motif }),
    );
  return node;
}

export const monochromeShades = monochromeByValue;

export function fillDefs(
  fill: Fill,
  items: readonly LayerItem[],
  uid: string,
  cx: number,
  cy: number,
  radius: number,
  inner: number,
): SVGDefsElement {
  const defs = svg("defs");
  items.forEach((item, index) => {
    const id = `${uid}-${index}`;
    if (fill === "pattern") defs.append(pattern(id, index, item.color));
    else
      defs.append(
        svg(
          "radialGradient",
          { id, gradientUnits: "userSpaceOnUse", cx, cy, r: Math.max(1, radius) },
          paint(
            svg("stop", { offset: Math.min(0.95, inner / Math.max(1, radius)) }),
            "stop-color",
            `color-mix(in oklab, ${item.color} 42%, var(--surface))`,
          ),
          paint(svg("stop", { offset: 1 }), "stop-color", item.color),
        ),
      );
  });
  return defs;
}

export function sliceLabelLayer({
  visible,
  slices,
  items,
  sliceLabels,
  inner,
  radius,
  cx,
  cy,
  locale,
}: Layer & { sliceLabels: boolean | string; inner: number; radius: number }): SVGGElement {
  const labels = svg("g", { "data-pointer-none": "", "data-fade": "" });
  for (const index of visible) {
    const slice = slices[index];
    const item = items[index];
    if (!slice || !item) continue;
    const label =
      sliceLabels === "value"
        ? item.format(item.datum.value)
        : formatPercent(slice.fraction, { decimals: 0, locale });
    const fit = fitSliceLabel(inner, radius, slice.start, slice.end, label.length, 11);
    if (!fit) continue;
    labels.append(
      svg(
        "text",
        {
          x: cx + fit.x,
          y: cy + fit.y,
          "text-anchor": "middle",
          "dominant-baseline": "central",
          "aria-hidden": "true",
          style:
            "fill:var(--surface);font-size:11px;font-weight:700;font-variant-numeric:tabular-nums",
        },
        label,
      ),
    );
  }
  return labels;
}

export function outsideLayer({
  visible,
  slices,
  items,
  outside,
  cx,
  cy,
  radius,
  width,
  height,
  locale,
}: Layer & { outside: Outside; radius: number; width: number; height: number }): SVGGElement {
  const lines = outside === "both" ? 2 : 1;
  const boxHeight = lines === 2 ? 30 : 15;
  const sides: Record<"1" | "-1", Array<{ index: number; side: 1 | -1; y: number }>> = {
    "1": [],
    "-1": [],
  };
  for (const index of visible) {
    const slice = slices[index];
    if (!slice || slice.fraction < 0.02) continue;
    const side: 1 | -1 = Math.sin(slice.mid) >= 0 ? 1 : -1;
    sides[String(side) as "1" | "-1"].push({
      index,
      side,
      y: polarPoint(cx, cy, radius + LABEL_ELBOW, slice.mid).y,
    });
  }
  const labels = svg("g", { "data-pointer-none": "", "data-fade": "", "aria-hidden": "true" });
  for (const entries of Object.values(sides)) {
    const ys = spreadLabels(
      entries.map((entry) => ({ y: entry.y, height: boxHeight })),
      4,
      height - 4,
      3,
    );
    entries.forEach((entry, i) => {
      const slice = slices[entry.index];
      const item = items[entry.index];
      if (!slice || !item) return;
      const y = ys[i] ?? entry.y;
      const x = cx + entry.side * (radius + LABEL_RUN);
      const anchor = polarPoint(cx, cy, radius + 2, slice.mid);
      const elbow = polarPoint(cx, cy, radius + LABEL_ELBOW, slice.mid);
      const room = Math.max(24, (entry.side > 0 ? width - x : x) - 6);
      const maxChars = Math.floor(room / (11 * 0.58));
      const pct = formatPercent(slice.fraction, { decimals: 0, locale });
      const tail = `${x - entry.side * 4},${y}`;
      const label = svg(
        "g",
        { "data-series": item.datum.id },
        svg("polyline", {
          fill: "none",
          "stroke-width": 1,
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
          points: `${anchor.x},${anchor.y} ${elbow.x},${elbow.y} ${tail}`,
          style: "stroke:var(--ink-3);stroke-opacity:.55",
        }),
      );
      const textNode = svg("text", {
        x,
        y,
        "text-anchor": entry.side > 0 ? "start" : "end",
        style: "font-size:11px",
      });
      if (lines === 2)
        textNode.append(
          svg(
            "tspan",
            { x, dy: "-0.25em", style: "fill:var(--ink-2);font-weight:500" },
            truncate(item.datum.name, maxChars),
          ),
          svg(
            "tspan",
            {
              x,
              dy: "1.35em",
              style: "fill:var(--ink);font-weight:700;font-variant-numeric:tabular-nums",
            },
            pct,
          ),
        );
      else
        textNode.append(
          svg(
            "tspan",
            {
              dy: "0.34em",
              style:
                outside === "percent"
                  ? "fill:var(--ink);font-weight:700;font-variant-numeric:tabular-nums"
                  : "fill:var(--ink-2);font-weight:500;font-variant-numeric:tabular-nums",
            },
            outside === "percent" ? pct : truncate(item.datum.name, maxChars),
          ),
        );
      label.append(textNode);
      labels.append(label);
    });
  }
  return labels;
}
