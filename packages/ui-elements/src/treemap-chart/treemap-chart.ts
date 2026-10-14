import { estimateTextWidth } from "@jcsoftdev/ui-core/chart/axis";
import { inkOn, tint } from "@jcsoftdev/ui-core/chart/color-scale";
import type { HierarchyNode } from "@jcsoftdev/ui-core/chart/hierarchy";
import { type TreemapCell, treemapLayout } from "@jcsoftdev/ui-core/chart/treemap";
import { adoptStyles, type DefineOptions, defineElement, rootOf } from "../internal/base.js";
import { type DrawContext, type DrawResult, join, svg } from "../internal/chart-base.js";
import {
  fitLabel,
  HierarchyChart,
  type HierarchyModel,
  hierarchyNav,
  NAV_DOWN,
  nearestBox,
  num,
} from "../internal/hierarchy-base.js";
import css from "./treemap-chart.css.js";

const HEADER = 24;
const EASE = "cubic-bezier(.22,1,.36,1)";

/** Strength (0-100) of the branch hue in a cell, spread by sibling rank. */
function cellStrength(cell: TreemapCell): number {
  if (cell.group) return 14;
  const siblings = cell.node.parent?.children.length ?? 1;
  const spread = siblings > 1 ? cell.node.index / (siblings - 1) : 0;
  return cell.level === 1 ? 58 - spread * 24 : 50 - spread * 24;
}

/** The child of `focus` that contains `node`. */
function topLevel(node: HierarchyNode, focus: HierarchyNode): HierarchyNode {
  let current = node;
  while (current.parent && current.parent.id !== focus.id) current = current.parent;
  return current;
}

interface Label {
  cell: TreemapCell;
  name: string;
  value: string | null;
  fill: string;
}

/**
 * `<ui-treemap-chart>`: squarified treemap. Areas are proportional to value, groups carry a header
 * band, and each branch wears one palette hue whose children are lighter and darker tints of it.
 * Labels only show where they fit. A double click, Shift+Enter or a second tap on touch opens the
 * group a cell belongs to (`chart-drill`, then `chart-focus`); a breadcrumb, Backspace or Escape
 * go back.
 *
 * Keyboard (one tab stop over the cells): Right/Left walk the siblings, Down goes to the first
 * child, Up to the parent, Home/End to the first/last sibling, Enter pins, Shift+Enter opens.
 *
 * Attributes: `data` (JSON `{ name, value?, color?, children? }`; or the `data` property), `depth`
 * (levels drawn at once, default 2), `gap` (px, 3), `radius` (px, 6), `drill-down="off"`,
 * `sort="off"`, `focus-id`, `breadcrumb` (id of a `<ui-chart-breadcrumb>`; one inside the chart is
 * found by itself), plus the chart attributes. Properties: `data`, `focusId`, `path`, `labels`.
 * Methods: `zoomTo(id)`, `zoomOut()`. Events: the chart events and `chart-focus`.
 */
export class UiTreemapChart extends HierarchyChart {
  static override observedAttributes = [
    ...HierarchyChart.observedAttributes,
    "depth",
    "gap",
    "radius",
  ];
  static override retain = true;
  protected override lighting = false;
  #cells: SVGGElement | undefined;
  #labels: SVGGElement | undefined;
  #replay = false;

  override connectedCallback(): void {
    this.dataset.ui = "treemap-chart";
    adoptStyles(rootOf(this), css);
    super.connectedCallback();
  }

  protected override drillTarget(node: HierarchyNode): HierarchyNode {
    return topLevel(node, this.model().focus);
  }

  protected override onZoom(): void {
    this.#replay = true;
  }

  protected render(ctx: DrawContext, model: HierarchyModel): DrawResult {
    const { svg: root, width, height, format } = ctx;
    const { focus } = model;
    if (ctx.phase === "enter" || !this.#cells || !this.#labels) {
      this.#cells = svg("g");
      this.#labels = svg("g", { "aria-hidden": "true" });
      root.append(this.#cells, this.#labels);
    }
    const gap = num(this, "gap", 3);
    const radius = num(this, "radius", 6);
    const cells = treemapLayout(
      focus,
      { x0: 0, y0: 0, x1: width, y1: height },
      {
        maxDepth: Math.max(1, Math.round(num(this, "depth", 2))),
        gap,
        headerHeight: HEADER,
        padding: 4,
      },
    );
    const nodes = cells.map((cell) => cell.node);
    this.nodes = nodes;
    const replay = this.#replay && ctx.motion;
    this.#replay = false;

    const strengths = new Map<string, number>();
    const elements = join(
      this.#cells,
      cells,
      (cell) => cell.node.id,
      (cell) => svg("rect", { "data-node": cell.node.id }),
      (el, cell) => {
        const strength = cellStrength(cell);
        strengths.set(cell.node.id, strength);
        el.setAttribute("x", `${cell.x0}`);
        el.setAttribute("y", `${cell.y0}`);
        el.setAttribute("width", `${cell.x1 - cell.x0}`);
        el.setAttribute("height", `${cell.y1 - cell.y0}`);
        el.setAttribute(
          "rx",
          `${Math.min(radius, (cell.x1 - cell.x0) / 2, (cell.y1 - cell.y0) / 2)}`,
        );
        el.style.fill = tint(this.tone(cell.node, model, ctx), strength);
        el.toggleAttribute(
          "data-drill",
          this.drillable && topLevel(cell.node, focus).children.length > 0,
        );
      },
    );

    const labels: Label[] = [];
    for (const cell of cells) {
      const w = cell.x1 - cell.x0;
      const h = cell.y1 - cell.y0;
      const name = h >= 24 ? fitLabel(cell.node.name, w - 16) : null;
      if (name == null) continue;
      const value = format(cell.node.value);
      const valueFits = cell.group
        ? name === cell.node.name && w >= estimateTextWidth(`${name}${value}`, 12) + 30
        : h >= 44 && w >= estimateTextWidth(value, 11) + 16;
      labels.push({
        cell,
        name,
        value: valueFits ? value : null,
        fill: cell.group ? "var(--ink)" : inkOn(strengths.get(cell.node.id) ?? cellStrength(cell)),
      });
    }
    join(
      this.#labels,
      labels,
      (label) => label.cell.node.id,
      () => svg("text", { "data-label": "" }),
      (el, { cell, name, value, fill }) => {
        el.replaceChildren(name);
        el.setAttribute("x", `${cell.x0 + 8}`);
        el.setAttribute("y", `${cell.y0 + (cell.group ? 16 : 18)}`);
        el.style.fill = fill;
        el.toggleAttribute("data-group", cell.group);
        if (value)
          el.append(
            svg(
              "tspan",
              cell.group
                ? { dx: 6, "data-value": "" }
                : { x: cell.x0 + 8, dy: 17, "data-value": "" },
              value,
            ),
          );
      },
    );

    if (ctx.animate || replay)
      elements.forEach((el, index) => {
        el.animate(
          [
            { opacity: 0, transform: "scale(0.94)" },
            { opacity: 1, transform: "scale(1)" },
          ],
          { duration: 460, delay: Math.min(index * 14, 280), easing: EASE, fill: "backwards" },
        );
      });

    const marks = this.marksOf(nodes, model, ctx, (_, i) => elements[i] as SVGElement);
    const reach = gap + 1;
    return {
      label: model.root.name,
      summary: `${focus.name}: ${format(focus.value)}, ${focus.children.length}`,
      marks,
      snapshot: this.snapshotOf(model, ctx),
      maxHoverRows: 3,
      hit: (x, y) => nearestBox(cells, x, y, reach),
      hover: (i) => {
        const cell = cells[i];
        if (!cell) return null;
        return this.details(
          cell.node,
          model,
          ctx,
          (cell.x0 + cell.x1) / 2,
          (cell.y0 + cell.y1) / 2,
        );
      },
      nav: (i, intent) => hierarchyNav(nodes, focus, NAV_DOWN, i, intent, this.out),
    };
  }
}

/** Registers `<ui-treemap-chart>` (or `<prefix>-treemap-chart`) and returns the tag. */
export function defineTreemapChart(options?: DefineOptions): string {
  return defineElement("treemap-chart", UiTreemapChart, options);
}
