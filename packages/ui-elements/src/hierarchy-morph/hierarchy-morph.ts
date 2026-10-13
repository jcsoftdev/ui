import { estimateTextWidth } from "@jcsoftdev/ui-core/chart/axis";
import { inkOn, tint } from "@jcsoftdev/ui-core/chart/color-scale";
import type { HierarchyNode } from "@jcsoftdev/ui-core/chart/hierarchy";
import { partitionLayout } from "@jcsoftdev/ui-core/chart/partition";
import {
  blendRings,
  type RingPoint,
  rectRing,
  ringCenter,
  ringPath,
  sectorRing,
} from "@jcsoftdev/ui-core/chart/shape-morph";
import { treemapLayout } from "@jcsoftdev/ui-core/chart/treemap";
import { adoptStyles, type DefineOptions, defineElement, emit, rootOf } from "../internal/base.js";
import { type DrawContext, type DrawResult, join, svg } from "../internal/chart-base.js";
import {
  flag,
  HierarchyChart,
  type HierarchyModel,
  hierarchyNav,
  levelStrength,
  NAV_DOWN,
  num,
} from "../internal/e21-hierarchy.js";
import css from "./hierarchy-morph.css.js";

export type HierarchyMorphMode = "treemap" | "sunburst";

const HEADER = 22;
const TAU = Math.PI * 2;
const LABEL_FONT = 11;
const LABEL_PAD = 6;

interface Shape {
  node: HierarchyNode;
  rect: RingPoint[];
  sector: RingPoint[];
  inTreemap: boolean;
  rectLabel: { x: number; y: number; width: number; group: boolean } | null;
  sectorLabel: { width: number; height: number };
  sectorCenter: RingPoint;
}

const fitText = (text: string, maxWidth: number): string | null => {
  if (estimateTextWidth(text, LABEL_FONT) <= maxWidth) return text;
  for (let length = text.length - 1; length >= 3; length -= 1) {
    const cut = `${text.slice(0, length).trimEnd()}…`;
    if (estimateTextWidth(cut, LABEL_FONT) <= maxWidth) return cut;
  }
  return null;
};

/** Distance from (x, y) to a closed polygon, 0 inside. */
function polygonDistance(points: readonly RingPoint[], x: number, y: number): number {
  let inside = false;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i] as RingPoint;
    const b = points[j] as RingPoint;
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const t =
      dx || dy
        ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy)))
        : 0;
    best = Math.min(best, Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy)));
  }
  return inside ? 0 : best;
}

const sectorRoom = (angle: number, arc: number, thick: number) => {
  const sin = Math.abs(Math.sin(angle));
  const cos = Math.abs(Math.cos(angle));
  return { width: sin * thick + cos * arc, height: sin * arc + cos * thick };
};

/**
 * `<ui-hierarchy-morph>`: one hierarchy, two views. Switching between treemap rectangles and
 * sunburst rings morphs every shape: each is sampled as a polygon in both layouts and the points
 * glide from one to the other, so the eye follows a branch instead of re-reading the chart.
 *
 * Keyboard (one tab stop over the shapes): Right/Left walk the siblings, Down goes to the first
 * child, Up to the parent, Home/End to the first/last sibling, Enter pins.
 *
 * Attributes: `data` (JSON `{ name, value?, color?, children? }`; or the `data` property), `mode`
 * (`treemap` default, `sunburst`), `levels` (1 or 2, default 2), `gap` (px, 2), `switch="off"`
 * hides the built-in view switch, `sort="off"`, plus the chart attributes. Properties: `data`,
 * `mode`, `labels` (`view`, `treemap`, `sunburst`, `share`, `category`...). Events: the chart events
 * and `mode-change` (`{ mode }`) when the switch is used.
 */
export class UiHierarchyMorph extends HierarchyChart {
  static override observedAttributes = [
    ...HierarchyChart.observedAttributes,
    "mode",
    "levels",
    "gap",
    "switch",
  ];
  static override retain = true;
  protected override lighting = false;
  override labels: HierarchyChart["labels"] & {
    view?: string;
    treemap?: string;
    sunburst?: string;
  } = {};
  #shapes: SVGGElement | undefined;
  #text: SVGGElement | undefined;
  #progress: number | undefined;
  #switch: HTMLFieldSetElement | undefined;

  get mode(): HierarchyMorphMode {
    return this.getAttribute("mode") === "sunburst" ? "sunburst" : "treemap";
  }
  set mode(value: HierarchyMorphMode) {
    this.setAttribute("mode", value);
  }

  protected override get drillable(): boolean {
    return false;
  }

  override connectedCallback(): void {
    this.dataset.ui = "hierarchy-morph";
    adoptStyles(rootOf(this), css);
    super.connectedCallback();
    this.#syncSwitch();
  }

  override attributeChangedCallback(name: string): void {
    if (name === "mode" && this.isConnected && this.#progress !== undefined) {
      const from = this.#progress;
      const to = this.mode === "sunburst" ? 1 : 0;
      this.play((t) => {
        this.#progress = from + (to - from) * t;
      }, 900);
    }
    super.attributeChangedCallback(name);
    if (this.isConnected) this.#syncSwitch();
  }

  #syncSwitch(): void {
    if (!flag(this, "switch", true)) {
      this.#switch?.remove();
      return;
    }
    if (!this.#switch) {
      const set = document.createElement("fieldset");
      set.dataset.uiPart = "switch";
      set.append(document.createElement("legend"));
      for (const mode of ["treemap", "sunburst"] as const) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.mode = mode;
        set.append(button);
      }
      set.addEventListener("click", (event) => {
        const mode = (event.target as Element).closest<HTMLElement>("button[data-mode]")?.dataset
          .mode as HierarchyMorphMode | undefined;
        if (!mode || mode === this.mode) return;
        this.mode = mode;
        emit(this, "mode-change", { mode });
      });
      this.#switch = set;
    }
    const set = this.#switch;
    if (!set.isConnected) this.append(set);
    const labels = { view: "Chart view", treemap: "Treemap", sunburst: "Sunburst", ...this.labels };
    (set.firstElementChild as HTMLElement).textContent = labels.view;
    for (const button of set.querySelectorAll("button")) {
      button.textContent = labels[button.dataset.mode as HierarchyMorphMode];
      button.setAttribute("aria-pressed", `${button.dataset.mode === this.mode}`);
    }
  }

  protected render(ctx: DrawContext, model: HierarchyModel): DrawResult {
    const { svg: root, width, height, format } = ctx;
    const gap = num(this, "gap", 2);
    const maxDepth = num(this, "levels", 2) >= 2 ? 2 : 1;
    const treeRoot = model.root;
    if (ctx.phase === "enter" || !this.#shapes || !this.#text) {
      this.#shapes = svg("g");
      this.#text = svg("g", { "aria-hidden": "true" });
      root.append(this.#shapes, this.#text);
    }
    this.#progress ??= this.mode === "sunburst" ? 1 : 0;
    const progress = this.#progress;
    this.#syncSwitch();

    const cells = treemapLayout(
      treeRoot,
      { x0: 0, y0: 0, x1: width, y1: height },
      { maxDepth, gap, headerHeight: HEADER, padding: 3 },
    );
    const cellOf = new Map(cells.map((cell) => [cell.node.id, cell]));
    const spans = partitionLayout(treeRoot);
    const size = Math.max(0, Math.min(width, height));
    const cx = width / 2;
    const cy = height / 2;
    const outer = Math.max(0, size / 2 - 4);
    const hole = outer * 0.2;
    const ring = (outer - hole) / maxDepth;
    const pad = gap / 2;
    const shapes: Shape[] = [];
    const visit = (node: HierarchyNode) => {
      for (const child of node.children) {
        const span = spans.get(child.id);
        if (child.depth <= maxDepth && span) {
          const r0 = hole + (child.depth - 1) * ring + pad;
          const r1 = hole + child.depth * ring - pad;
          const mid = (r0 + r1) / 2;
          const padAngle = Math.min((span.x1 - span.x0) * TAU * 0.4, pad / Math.max(mid, 1));
          const a0 = span.x0 * TAU + padAngle;
          const a1 = span.x1 * TAU - padAngle;
          const sector = sectorRing(cx, cy, r0, r1, a0, Math.max(a0 + 1e-3, a1));
          const cell = cellOf.get(child.id);
          let rect: RingPoint[];
          let rectLabel: Shape["rectLabel"] = null;
          if (cell) {
            rect = rectRing(cell.x0, cell.y0, cell.x1, cell.y1);
            const h = cell.group ? HEADER : cell.y1 - cell.y0;
            if (h >= 16)
              rectLabel = {
                x: cell.x0 + LABEL_PAD,
                y: cell.y0 + (cell.group ? HEADER / 2 : 11),
                width: cell.x1 - cell.x0 - LABEL_PAD * 2,
                group: cell.group,
              };
          } else {
            const parent = cellOf.get(child.parent?.id ?? "");
            const px = parent ? (parent.x0 + parent.x1) / 2 : cx;
            const py = parent ? (parent.y0 + parent.y1) / 2 : cy;
            rect = rectRing(px, py, px, py);
          }
          shapes.push({
            node: child,
            rect,
            sector,
            inTreemap: cell != null,
            rectLabel,
            sectorLabel: sectorRoom((a0 + a1) / 2, (a1 - a0) * mid, r1 - r0),
            sectorCenter: {
              x: cx + mid * Math.sin((a0 + a1) / 2),
              y: cy - mid * Math.cos((a0 + a1) / 2),
            },
          });
        }
        visit(child);
      }
    };
    visit(treeRoot);
    shapes.sort((a, b) => a.node.depth - b.node.depth);
    const nodes = shapes.map((shape) => shape.node);
    this.nodes = nodes;

    const strength = (shape: Shape) => {
      const siblings = shape.node.parent?.children.length ?? 1;
      const spread = siblings > 1 ? shape.node.index / (siblings - 1) : 0;
      const tree = shape.node.children.length > 0 && shape.inTreemap ? 16 : 56 - spread * 22;
      return tree + (levelStrength(shape.node, treeRoot) - tree) * progress;
    };
    const drawn = shapes.map((shape) => ({
      shape,
      points: blendRings(shape.rect, shape.sector, progress),
    }));
    const elements = join(
      this.#shapes,
      drawn,
      (item) => item.shape.node.id,
      (item) => svg("path", { "data-node": item.shape.node.id }),
      (el, { shape, points }) => {
        el.setAttribute("d", ringPath(points));
        el.style.fill = tint(this.tone(shape.node, model, ctx), strength(shape));
        el.style.opacity = `${shape.inTreemap ? 1 : progress}`;
      },
    );
    const texts: Array<{ shape: Shape; kind: "rect" | "sector"; text: string; opacity: number }> =
      [];
    for (const shape of shapes) {
      const slot = shape.rectLabel;
      const rectText = slot ? fitText(shape.node.name, slot.width) : null;
      const rectOpacity = shape.inTreemap ? Math.max(0, 1 - progress * 2.5) : 0;
      if (slot && rectText && rectOpacity > 0)
        texts.push({ shape, kind: "rect", text: rectText, opacity: rectOpacity });
      const sectorText =
        shape.sectorLabel.height >= 14
          ? fitText(shape.node.name, shape.sectorLabel.width - 10)
          : null;
      const sectorOpacity = Math.max(0, progress * 2.5 - 1.5);
      if (sectorText && sectorOpacity > 0)
        texts.push({ shape, kind: "sector", text: sectorText, opacity: sectorOpacity });
    }
    join(
      this.#text,
      texts,
      (item) => `${item.shape.node.id}|${item.kind}`,
      () => svg("text", { "data-label": "", "dominant-baseline": "central" }),
      (el, { shape, kind, text, opacity }) => {
        el.textContent = text;
        const rect = kind === "rect" && shape.rectLabel;
        el.setAttribute("x", `${rect ? rect.x : shape.sectorCenter.x}`);
        el.setAttribute("y", `${rect ? rect.y : shape.sectorCenter.y}`);
        el.setAttribute("text-anchor", rect ? "start" : "middle");
        el.style.fill = inkOn(strength(shape));
        el.style.opacity = `${opacity}`;
        el.style.fontWeight = rect?.group ? "700" : "600";
      },
    );

    const marks = this.marksOf(nodes, model, ctx, (_, i) => elements[i] as SVGElement);
    return {
      label: treeRoot.name,
      summary: `${treeRoot.name}: ${format(treeRoot.value)}`,
      marks,
      snapshot: this.snapshotOf(model, ctx),
      maxHoverRows: 3,
      hit: (x, y) => {
        let best = -1;
        let distance = Number.POSITIVE_INFINITY;
        drawn.forEach(({ points }, i) => {
          const d = polygonDistance(points, x, y);
          if (d <= distance) {
            distance = d;
            best = i;
          }
        });
        return distance <= gap + 1 ? best : -1;
      },
      hover: (i) => {
        const item = drawn[i];
        if (!item) return null;
        const center = ringCenter(item.points);
        return this.details(item.shape.node, model, ctx, center.x, center.y);
      },
      nav: (i, intent) => hierarchyNav(nodes, treeRoot, NAV_DOWN, i, intent, this.out),
    };
  }
}

/** Registers `<ui-hierarchy-morph>` (or `<prefix>-hierarchy-morph`) and returns the tag. */
export function defineHierarchyMorph(options?: DefineOptions): string {
  return defineElement("hierarchy-morph", UiHierarchyMorph, options);
}
