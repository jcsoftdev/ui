import { estimateTextWidth } from "@jcsoftdev/ui-core/chart/axis";
import { inkOn, tint } from "@jcsoftdev/ui-core/chart/color-scale";
import { descendants, type HierarchyNode } from "@jcsoftdev/ui-core/chart/hierarchy";
import { projectSpan } from "@jcsoftdev/ui-core/chart/partition";
import { adoptStyles, type DefineOptions, defineElement, rootOf } from "../internal/base.js";
import { type DrawContext, type DrawResult, join, svg } from "../internal/chart-base.js";
import {
  fitLabel,
  type HierarchyModel,
  hierarchyNav,
  levelStrength,
  NAV_DOWN,
  NAV_RIGHT,
  nearestBox,
  num,
} from "../internal/e21-hierarchy.js";
import { PartitionChart } from "../internal/e21-partition.js";
import css from "./icicle-chart.css.js";

const MIN_BAND = 84;
const EASE = "cubic-bezier(.22,1,.36,1)";

interface Cell {
  node: HierarchyNode;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /** Band, 0 for the open node's own. */
  level: number;
}

/**
 * `<ui-icicle-chart>`: rectangular partition. The open node fills the first band and every band
 * after it splits its parent by value. A double click, Shift+Enter or a second tap on touch zooms
 * a cell to the full extent with an animated transition (`chart-drill`, then `chart-focus`); the
 * first band, a breadcrumb, Backspace on a second-band cell or Escape zoom back out.
 *
 * Keyboard (one tab stop over the cells): with `orientation="horizontal"` Right goes to the first
 * child, Left to the parent and Down/Up across siblings; with `vertical` Down goes to the first
 * child, Up to the parent and Right/Left across siblings. Home/End jump to the first/last sibling,
 * Enter pins, Shift+Enter opens.
 *
 * Attributes: `data` (JSON `{ name, value?, color?, children? }`; or the `data` property),
 * `orientation` (`horizontal` default, `vertical`), `levels` (bands after the open node, 3), `gap`
 * (px, 2), `radius` (px, 4), `drill-down="off"`, `sort="off"`, `focus-id`, `breadcrumb` (id of a
 * `<ui-chart-breadcrumb>`; one inside the chart is found by itself), plus the chart attributes.
 * Properties: `data`, `focusId`, `path`, `labels`. Methods: `zoomTo(id)`, `zoomOut()`. Events: the
 * chart events and `chart-focus`.
 */
export class UiIcicleChart extends PartitionChart {
  static override observedAttributes = [
    ...PartitionChart.observedAttributes,
    "orientation",
    "levels",
    "gap",
    "radius",
  ];
  static override retain = true;
  #cells: SVGGElement | undefined;
  #labels: SVGGElement | undefined;
  #geo = { horizontal: true, band: 0, gap: 0 };

  override connectedCallback(): void {
    this.dataset.ui = "icicle-chart";
    adoptStyles(rootOf(this), css);
    super.connectedCallback();
  }

  /** The first band is the open node: a click on it goes back up. */
  protected override isCenter(x: number, y: number): boolean {
    const { horizontal, band } = this.#geo;
    return (horizontal ? x : y) <= band;
  }

  protected render(ctx: DrawContext, model: HierarchyModel): DrawResult {
    const { svg: root, width, height, format } = ctx;
    const { focus } = model;
    if (ctx.phase === "enter" || !this.#cells || !this.#labels) {
      this.#cells = svg("g");
      this.#labels = svg("g", { "aria-hidden": "true" });
      root.append(this.#cells, this.#labels);
    }
    const horizontal = this.getAttribute("orientation") !== "vertical";
    const gap = num(this, "gap", 2);
    const radius = num(this, "radius", 4);
    const { spans, view, target } = this.partition(model);
    const depthExtent = horizontal ? width : height;
    const breadthExtent = horizontal ? height : width;
    // Narrow containers drop the deepest bands before they get too thin to read.
    const levels = Math.max(
      1,
      Math.min(Math.round(num(this, "levels", 3)), Math.floor(depthExtent / MIN_BAND) - 1),
    );
    const band = depthExtent / (levels + 1);
    this.#geo = { horizontal, band, gap };
    const all = [model.root, ...descendants(model.root).slice(1)];
    const cellsFor = (v: typeof view): Cell[] => {
      const out: Cell[] = [];
      for (const node of all) {
        const span = spans.get(node.id);
        if (!span) continue;
        const p = projectSpan(span, node.depth, v);
        const d0 = Math.max(0, Math.min(depthExtent, p.level * band));
        const d1 = Math.max(0, Math.min(depthExtent, (p.level + 1) * band));
        const b0 = Math.max(0, Math.min(1, p.x0)) * breadthExtent;
        const b1 = Math.max(0, Math.min(1, p.x1)) * breadthExtent;
        if (d1 - d0 - gap < 0.5 || b1 - b0 - gap < 0.5) continue;
        out.push(
          horizontal
            ? {
                node,
                x0: d0 + gap / 2,
                y0: b0 + gap / 2,
                x1: d1 - gap / 2,
                y1: b1 - gap / 2,
                level: Math.round(p.level),
              }
            : {
                node,
                x0: b0 + gap / 2,
                y0: d0 + gap / 2,
                x1: b1 - gap / 2,
                y1: d1 - gap / 2,
                level: Math.round(p.level),
              },
        );
      }
      return out;
    };
    const now = cellsFor(view);
    const end = view === target ? now : cellsFor(target);
    // Marks come from where the zoom is going; the open node itself is the first band, not a mark.
    const endIds = new Set(end.filter((cell) => cell.node !== focus).map((cell) => cell.node.id));
    const nodes = all.filter((node) => endIds.has(node.id));
    this.nodes = nodes;
    const index = new Map(nodes.map((node, i) => [node.id, i]));
    const nowIds = new Set(now.map((cell) => cell.node.id));
    const drawn = [...now, ...end.filter((cell) => !nowIds.has(cell.node.id))];
    const elements = join(
      this.#cells,
      drawn,
      (cell) => cell.node.id,
      (cell) => svg("rect", { "data-node": cell.node.id }),
      (el, cell) => {
        const open = cell.node.depth <= focus.depth;
        el.setAttribute("x", `${cell.x0}`);
        el.setAttribute("y", `${cell.y0}`);
        el.setAttribute("width", `${Math.max(0, cell.x1 - cell.x0)}`);
        el.setAttribute("height", `${Math.max(0, cell.y1 - cell.y0)}`);
        el.setAttribute(
          "rx",
          `${Math.min(radius, (cell.x1 - cell.x0) / 2, (cell.y1 - cell.y0) / 2)}`,
        );
        el.style.fill = open
          ? "var(--surface-2)"
          : tint(this.tone(cell.node, model, ctx), levelStrength(cell.node, focus));
        el.toggleAttribute("data-open", open);
        el.toggleAttribute(
          "data-drill",
          this.drillable && (open ? !!focus.parent : cell.node.children.length > 0),
        );
      },
    );
    const elOf = new Map(drawn.map((cell, i) => [cell.node.id, elements[i] as SVGElement]));

    const labelled: Array<{ cell: Cell; name: string; value: string | null; fill: string }> = [];
    for (const cell of now) {
      const w = cell.x1 - cell.x0;
      const h = cell.y1 - cell.y0;
      const name = h >= 20 ? fitLabel(cell.node.name, w - 14) : null;
      if (name == null) continue;
      const value = format(cell.node.value);
      const open = cell.node.depth <= focus.depth;
      labelled.push({
        cell,
        name,
        value: h >= 38 && w >= estimateTextWidth(value, 11) + 14 ? value : null,
        fill: open ? "var(--ink)" : inkOn(levelStrength(cell.node, focus)),
      });
    }
    join(
      this.#labels,
      labelled,
      (item) => item.cell.node.id,
      () => svg("text", { "data-label": "", "data-tabular": "" }),
      (el, { cell, name, value, fill }) => {
        el.replaceChildren(name);
        el.setAttribute("x", `${cell.x0 + 7}`);
        el.setAttribute("y", `${cell.y0 + 16}`);
        el.style.fill = fill;
        if (value) el.append(svg("tspan", { x: cell.x0 + 7, dy: 16, "data-value": "" }, value));
      },
    );

    if (ctx.animate)
      elements.forEach((el, i) => {
        const level = drawn[i]?.level ?? 0;
        el.animate(
          [
            { opacity: 0, transform: horizontal ? "translateX(-12px)" : "translateY(-12px)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 520, delay: level * 90, easing: EASE, fill: "backwards" },
        );
      });

    const marks = this.marksOf(nodes, model, ctx, (node) => elOf.get(node.id) as SVGElement);
    const keys = horizontal ? NAV_RIGHT : NAV_DOWN;
    const hittable = now.filter((cell) => index.has(cell.node.id) || cell.node.depth > focus.depth);
    const climb = (node: HierarchyNode): number => {
      for (let current: HierarchyNode | null = node; current; current = current.parent) {
        const found = index.get(current.id);
        if (found !== undefined) return found;
      }
      return -1;
    };
    return {
      label: model.root.name,
      summary: `${focus.name}: ${format(focus.value)}, ${focus.children.length}`,
      marks,
      snapshot: this.snapshotOf(model, ctx),
      maxHoverRows: 3,
      hit: (x, y) => {
        const i = nearestBox(hittable, x, y, gap + 1);
        const cell = hittable[i];
        return cell ? climb(cell.node) : -1;
      },
      hover: (i) => {
        const node = nodes[i];
        const cell = node && end.find((c) => c.node === node);
        if (!node || !cell) return null;
        return this.details(node, model, ctx, (cell.x0 + cell.x1) / 2, (cell.y0 + cell.y1) / 2);
      },
      nav: (i, intent) => hierarchyNav(nodes, focus, keys, i, intent, this.out),
    };
  }
}

/** Registers `<ui-icicle-chart>` (or `<prefix>-icicle-chart`) and returns the tag. */
export function defineIcicleChart(options?: DefineOptions): string {
  return defineElement("icicle-chart", UiIcicleChart, options);
}
