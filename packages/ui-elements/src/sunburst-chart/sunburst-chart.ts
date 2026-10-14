import { estimateTextWidth } from "@jcsoftdev/ui-core/chart/axis";
import { inkOn, tint } from "@jcsoftdev/ui-core/chart/color-scale";
import { descendants, type HierarchyNode } from "@jcsoftdev/ui-core/chart/hierarchy";
import { type PartitionView, projectSpan, sectorPath } from "@jcsoftdev/ui-core/chart/partition";
import { adoptStyles, type DefineOptions, defineElement, rootOf } from "../internal/base.js";
import { type DrawContext, type DrawResult, join, svg } from "../internal/chart-base.js";
import {
  flag,
  type HierarchyModel,
  hierarchyNav,
  levelStrength,
  NAV_DOWN,
  num,
} from "../internal/hierarchy-base.js";
import { PartitionChart, sameView } from "../internal/hierarchy-partition.js";
import css from "./sunburst-chart.css.js";

const TAU = Math.PI * 2;
const MIN_RING = 30;
const EASE = "cubic-bezier(.22,1,.36,1)";

interface Arc {
  node: HierarchyNode;
  r0: number;
  r1: number;
  a0: number;
  a1: number;
}

interface Parts {
  rings: SVGGElement;
  labels: SVGGElement;
  hole: SVGPathElement;
  center: SVGGElement;
  up: SVGPathElement;
  name: SVGTextElement;
  value: SVGTextElement;
}

/** The hole in the middle: a full disc, or a half disc sitting on the baseline of a fan. */
function holePath(cx: number, cy: number, r: number, half: boolean): string {
  if (!half) return `M${cx - r},${cy}a${r},${r} 0 1 0 ${2 * r},0a${r},${r} 0 1 0 ${-2 * r},0z`;
  return `M${cx - r},${cy}A${r},${r} 0 0 1 ${cx + r},${cy}z`;
}

/** Width of a text line whose top edge sits `top` above the baseline of the hole. */
function labelRoom(radius: number, top: number, half: boolean): number {
  if (!half) return radius * 1.7;
  return Math.max(0, 2 * Math.sqrt(Math.max(0, radius * radius - top * top)) - 6);
}

function truncate(text: string, maxWidth: number, fontSize: number): string {
  if (estimateTextWidth(text, fontSize) <= maxWidth) return text;
  const chars = Math.max(1, Math.floor(maxWidth / (fontSize * 0.58)) - 1);
  return `${text.slice(0, chars)}…`;
}

/** Shrinks the font down to `minSize` before cutting the text. */
function shrink(text: string, maxWidth: number, size: number, minSize: number) {
  let fontSize = size;
  while (fontSize > minSize && estimateTextWidth(text, fontSize) > maxWidth) fontSize -= 0.5;
  return { text: truncate(text, maxWidth, fontSize), size: fontSize };
}

/**
 * `<ui-sunburst-chart>`: radial partition. The open node sits in the center and its descendants
 * in rings, each slice proportional to value. A double click, Shift+Enter or a second tap zooms
 * into a slice with an animated transition (`chart-drill`, then `chart-focus`); the center, a
 * breadcrumb, Backspace on a first-ring slice or Escape zoom back out.
 *
 * Keyboard (one tab stop over the slices): Right/Left walk the siblings, Down goes to the first
 * child, Up to the parent, Home/End to the first/last sibling, Enter pins, Shift+Enter opens.
 *
 * Attributes: `data` (JSON `{ name, value?, color?, children? }`; or the `data` property),
 * `half`, `levels` (rings shown, default 3), `gap` (px between slices, 1.5), `drill-down="off"`,
 * `segment-labels="off"`, `center-label="off"`, `sort="off"`, `focus-id`, `breadcrumb` (id of a
 * `<ui-chart-breadcrumb>`; one inside the chart is found by itself), plus the chart attributes.
 * Properties: `data`, `focusId`, `path`, `labels`. Methods: `zoomTo(id)`, `zoomOut()`. Events:
 * the chart events and `chart-focus` (`{ id, name, depth, path }`).
 */
export class UiSunburstChart extends PartitionChart {
  static override observedAttributes = [
    ...PartitionChart.observedAttributes,
    "half",
    "levels",
    "gap",
    "segment-labels",
    "center-label",
  ];
  static override retain = true;
  #parts: Parts | undefined;

  override connectedCallback(): void {
    this.dataset.ui = "sunburst-chart";
    adoptStyles(rootOf(this), css);
    super.connectedCallback();
  }

  #geometry(width: number, height: number, half: boolean, levels: number) {
    const size = half
      ? Math.max(0, Math.min(width / 2, height - 30))
      : Math.max(0, Math.min(width, height)) / 2;
    const cx = width / 2;
    const outer = Math.max(0, size - 4);
    const cy = half ? (height + outer) / 2 : height / 2;
    // Small discs drop the outer rings before they get too thin to read.
    const rings = Math.max(1, Math.min(levels, Math.floor((outer * 0.72) / MIN_RING)));
    const center = outer * (half ? (rings > 2 ? 0.36 : 0.4) : rings > 2 ? 0.26 : 0.32);
    return { cx, cy, outer, center, ring: (outer - center) / rings };
  }

  #g: { cx: number; cy: number; center: number; half: boolean } = {
    cx: 0,
    cy: 0,
    center: 0,
    half: false,
  };
  protected override isCenter(x: number, y: number): boolean {
    const { cx, cy, center, half } = this.#g;
    return Math.hypot(x - cx, y - cy) <= center && !(half && y > cy);
  }

  protected render(ctx: DrawContext, model: HierarchyModel): DrawResult {
    const { svg: root, width, height, format } = ctx;
    const { focus } = model;
    const half = flag(this, "half", false);
    const levels = Math.max(1, Math.round(num(this, "levels", 3)));
    const gap = num(this, "gap", 1.5);
    const drillable = this.drillable;
    const { spans, view, target } = this.partition(model);
    if (ctx.phase === "enter" || !this.#parts) this.#parts = this.#build(root);
    const parts = this.#parts;

    const sweep = half ? Math.PI : TAU;
    const origin = half ? -Math.PI / 2 : 0;
    const { cx, cy, outer, center, ring } = this.#geometry(width, height, half, levels);
    this.#g = { cx, cy, center, half };
    const radius = (level: number) =>
      level <= 1 ? center : Math.min(outer, center + (level - 1) * ring);
    const nodes = descendants(model.root).slice(1);
    const arcsFor = (v: PartitionView): Map<string, Arc> => {
      const out = new Map<string, Arc>();
      for (const node of nodes) {
        const span = spans.get(node.id);
        if (!span) continue;
        const p = projectSpan(span, node.depth, v);
        const r0 = radius(p.level);
        const r1 = radius(p.level + 1);
        const a0 = origin + Math.max(0, Math.min(1, p.x0)) * sweep;
        const a1 = origin + Math.max(0, Math.min(1, p.x1)) * sweep;
        if (r1 - r0 < 0.5 || a1 - a0 < 1e-4) continue;
        out.set(node.id, { node, r0, r1, a0, a1 });
      }
      return out;
    };
    const now = arcsFor(view);
    const end = view === target || sameView(view, target) ? now : arcsFor(target);
    const marked = nodes.filter((node) => end.has(node.id));
    const index = new Map(marked.map((node, i) => [node.id, i]));
    this.nodes = marked;

    // Marks come from where the zoom is going, so their order holds still while it plays.
    const drawn = nodes.filter((node) => now.has(node.id) || end.has(node.id));
    const elements = join(
      parts.rings,
      drawn,
      (node) => node.id,
      (node) => svg("path", { "data-node": node.id }),
      (el, node) => {
        const arc = now.get(node.id);
        const strength = levelStrength(node, focus);
        el.setAttribute(
          "d",
          arc
            ? sectorPath(
                cx,
                cy,
                arc.r0 + gap / 2,
                arc.r1 - gap / 2,
                arc.a0,
                arc.a1,
                gap / Math.max(arc.r0, 1),
              )
            : "",
        );
        el.style.fill = tint(this.tone(node, model, ctx), strength);
        el.toggleAttribute("data-drill", drillable && node.children.length > 0);
      },
    );
    const elOf = new Map(drawn.map((node, i) => [node.id, elements[i] as SVGPathElement]));
    parts.rings.style.transformOrigin = `${cx}px ${cy}px`;

    if (flag(this, "segment-labels", true)) {
      const labelled: Array<{ arc: Arc; text: string; x: number; y: number; rotate: number }> = [];
      for (const arc of now.values()) {
        const placed = this.#placeLabel(arc, cx, cy);
        if (placed) labelled.push({ arc, ...placed });
      }
      join(
        parts.labels,
        labelled,
        (item) => item.arc.node.id,
        (item) =>
          svg("text", {
            "data-node": item.arc.node.id,
            "data-label": "",
            "text-anchor": "middle",
            "dominant-baseline": "central",
          }),
        (el, item) => {
          el.textContent = item.arc.node.name;
          el.setAttribute("x", `${item.x.toFixed(2)}`);
          el.setAttribute("y", `${item.y.toFixed(2)}`);
          el.setAttribute(
            "transform",
            `rotate(${item.rotate.toFixed(2)} ${item.x.toFixed(2)} ${item.y.toFixed(2)})`,
          );
          el.style.fill = inkOn(levelStrength(item.arc.node, focus));
        },
      );
    } else parts.labels.replaceChildren();

    const hole = Math.max(0, center - gap - 2);
    parts.hole.setAttribute("d", holePath(cx, cy, hole, half));
    parts.hole.toggleAttribute("data-drill", drillable && !!focus.parent);
    const showCenter = flag(this, "center-label", true) && center > 24;
    parts.center.style.display = showCenter ? "" : "none";
    if (showCenter) {
      const nameY = half ? cy - 26 : cy - 4;
      const valueY = half ? cy - 8 : cy + 16;
      const name = shrink(focus.name, labelRoom(hole, cy - nameY + 10, half), 12, half ? 9 : 12);
      const value = shrink(
        format(focus.value),
        labelRoom(hole, cy - valueY + 14, half),
        17,
        half ? 11 : 17,
      );
      for (const [el, y, f] of [
        [parts.name, nameY, name],
        [parts.value, valueY, value],
      ] as const) {
        el.textContent = f.text;
        el.setAttribute("x", `${cx}`);
        el.setAttribute("y", `${y}`);
        el.setAttribute("font-size", `${f.size}`);
      }
      parts.up.setAttribute("d", `M${cx - 5},${half ? cy - 42 : cy - 22}l5,-5l5,5`);
      parts.up.style.display = focus.parent && drillable ? "" : "none";
    }

    if (ctx.animate)
      parts.rings.animate(
        [
          { opacity: 0, transform: "rotate(-24deg) scale(0.82)" },
          { opacity: 1, transform: "rotate(0deg) scale(1)" },
        ],
        { duration: 760, easing: EASE, fill: "backwards" },
      );

    const arcsList = [...now.values()];
    const climb = (node: HierarchyNode | null): number => {
      for (let current = node; current; current = current.parent) {
        const found = index.get(current.id);
        if (found !== undefined) return found;
      }
      return -1;
    };
    const marks = this.marksOf(marked, model, ctx, (node) => elOf.get(node.id) as SVGElement);
    return {
      label: model.root.name,
      summary: `${focus.name}: ${format(focus.value)}, ${focus.children.length}`,
      marks,
      snapshot: this.snapshotOf(model, ctx),
      maxHoverRows: 3,
      hit: (x, y) => {
        const dx = x - cx;
        const dy = y - cy;
        const r = Math.hypot(dx, dy);
        if ((half && dy > 0) || r <= center || r > outer) return -1;
        const raw = Math.atan2(dx, -dy);
        const angle = half ? raw : (raw + TAU) % TAU;
        for (const arc of arcsList)
          if (r >= arc.r0 && r <= arc.r1 && angle >= arc.a0 && angle <= arc.a1)
            return climb(arc.node);
        return -1;
      },
      hover: (i) => {
        const node = marked[i];
        const arc = node && end.get(node.id);
        if (!node || !arc) return null;
        const mid = (arc.a0 + arc.a1) / 2;
        const r = (arc.r0 + arc.r1) / 2;
        return this.details(node, model, ctx, cx + r * Math.sin(mid), cy - r * Math.cos(mid));
      },
      nav: (i, intent) => hierarchyNav(marked, focus, NAV_DOWN, i, intent, this.out),
    };
  }

  /** Radial when the ring is thick enough, otherwise tangential and upright, or none. */
  #placeLabel(arc: Arc, cx: number, cy: number) {
    const thickness = arc.r1 - arc.r0;
    const mid = (arc.a0 + arc.a1) / 2;
    const r = (arc.r0 + arc.r1) / 2;
    const arcLength = (arc.a1 - arc.a0) * r;
    const width = estimateTextWidth(arc.node.name, 11);
    const radial = arcLength >= 14 && thickness >= width + 10;
    const tangential = !radial && thickness >= 15 && arcLength >= width + 12;
    if (!radial && !tangential) return null;
    const degrees = ((((mid * 180) / Math.PI) % 360) + 360) % 360;
    const rotate = radial
      ? degrees < 180
        ? degrees - 90
        : degrees + 90
      : degrees > 90 && degrees < 270
        ? degrees - 180
        : degrees;
    return {
      text: arc.node.name,
      x: cx + r * Math.sin(mid),
      y: cy - r * Math.cos(mid),
      rotate,
    };
  }

  #build(root: SVGSVGElement): Parts {
    const rings = svg("g", { "data-rings": "" });
    const labels = svg("g", { "aria-hidden": "true" });
    const hole = svg("path", { "data-hole": "" });
    const up = svg("path", {
      fill: "none",
      "stroke-width": 1.8,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
      style: "stroke:var(--ink-3)",
    });
    const name = svg("text", { "font-weight": 600, style: "fill:var(--ink-3)" });
    const value = svg("text", { "font-weight": 700, "data-tabular": "", style: "fill:var(--ink)" });
    const center = svg(
      "g",
      { "text-anchor": "middle", "aria-hidden": "true", "pointer-events": "none" },
      up,
      name,
      value,
    );
    root.append(rings, labels, hole, center);
    return { rings, labels, hole, center, up, name, value };
  }
}

/** Registers `<ui-sunburst-chart>` (or `<prefix>-sunburst-chart`) and returns the tag. */
export function defineSunburstChart(options?: DefineOptions): string {
  return defineElement("sunburst-chart", UiSunburstChart, options);
}
