/**
 * The shared body of the hierarchy charts (sunburst, treemap, icicle, hierarchy morph): the nested
 * `data`, the open (zoomed) node, drill-down through the base's `chart-drill`, the breadcrumb, the
 * hover path and the legend. A subclass lays the nodes out and returns the marks.
 *
 * Drilling: a double click, Shift+Enter, `chart.drill(i)` (all `chart-drill`) and a second tap on
 * a pinned node open a node with children; the breadcrumb, Backspace on a first-level node and
 * Escape go back out. `chart-focus` (`detail`: `{ id, name, depth, path }`) says the open node
 * changed. A `<ui-chart-breadcrumb>` inside the chart (or named by the `breadcrumb` attribute) is
 * wired without either importing the other.
 */
import {
  ancestors,
  buildHierarchy,
  descendants,
  type HierarchyDatum,
  type HierarchyNode,
} from "@jcsoftdev/ui-core/chart/hierarchy";
import { adoptStyles, byId, emit, rootOf } from "./base.js";
import {
  CHART_ATTRIBUTES,
  CHART_EVENT,
  ChartElement,
  type ChartLabels,
  type ChartMark,
  type ChartSnapshot,
  type DrawContext,
  type DrawResult,
  type HoverContent,
  type HoverInfo,
} from "./chart-base.js";
import { numberAttr } from "./e5-forms.js";
import css from "./hierarchy.css.js";
import {
  branchColor,
  describeNode,
  HIERARCHY_STRINGS,
  type HierarchyStrings,
  litPath,
  nodePath,
  nodeTooltipRows,
  percent,
  pruneTree,
  shareOf,
} from "./hierarchy-model.js";
import type { Zoom, ZoomHost } from "./hierarchy-zoom.js";

export { fitLabel } from "./chart-text.js";
export { numberAttr as num } from "./e5-forms.js";
export * from "./hierarchy-model.js";

/** An attribute that is on unless it says `off` or `false` (`fallback` when it is absent). */
export const flag = (element: Element, name: string, fallback: boolean): boolean => {
  const value = element.getAttribute(name);
  return value === null ? fallback : value !== "off" && value !== "false";
};

export interface HierarchyModel {
  /** The tree that is drawn: without the branches the legend has hidden. */
  root: HierarchyNode;
  /** The whole tree, hidden branches included (colors stay put when one is hidden). */
  full: HierarchyNode;
  /** The open node. */
  focus: HierarchyNode;
  /** Root first, `focus` last. */
  path: HierarchyNode[];
  /** Value of the open node with nothing hidden: shares are measured against it, never renormalized. */
  total: number;
  /** Every node of the whole tree by id. */
  byId: ReadonlyMap<string, HierarchyNode>;
  /** Every node of the drawn tree by id. */
  drawn: ReadonlyMap<string, HierarchyNode>;
  /** Base color per node of the whole tree, filled as the nodes ask. */
  tones: Map<HierarchyNode, string>;
}

const indexOf = (root: HierarchyNode): Map<string, HierarchyNode> =>
  new Map(descendants(root).map((node) => [node.id, node]));

const parseData = (text: string | null): HierarchyDatum | undefined => {
  if (!text) return undefined;
  try {
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === "object" ? (parsed as HierarchyDatum) : undefined;
  } catch {
    return undefined;
  }
};

const EMPTY: HierarchyDatum = { name: "", children: [] };

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * Index of the box nearest to (`x`, `y`): the one that contains it (the last, so the deepest of
 * nested boxes), else the closest within `tolerance`. Gutters between neighbours snap to a box, so
 * crossing one never reports "nothing". -1 when none is that close.
 */
export function nearestBox(boxes: ArrayLike<Box>, x: number, y: number, tolerance: number): number {
  let best = -1;
  let distance = Number.POSITIVE_INFINITY;
  for (let i = 0; i < boxes.length; i += 1) {
    const box = boxes[i] as Box;
    const d = Math.hypot(Math.max(box.x0 - x, 0, x - box.x1), Math.max(box.y0 - y, 0, y - box.y1));
    if (d <= distance) {
      distance = d;
      best = i;
    }
  }
  return distance <= tolerance ? best : -1;
}

export abstract class HierarchyChart extends ChartElement {
  static override observedAttributes = [
    ...CHART_ATTRIBUTES,
    "data",
    "sort",
    "drill-down",
    "breadcrumb",
    "focus-id",
  ];
  override labels: Partial<ChartLabels & HierarchyStrings> = {};

  /** The node of each mark of the last draw, in mark order. */
  protected nodes: readonly HierarchyNode[] = [];
  /** Fade everything but the path to the hovered node (off for a treemap, which highlights one cell). */
  protected lighting = true;
  #data: HierarchyDatum | undefined;
  #parsed: { text: string | null; value: HierarchyDatum | undefined } | undefined;
  #built:
    | { data: HierarchyDatum; sort: boolean; full: HierarchyNode; byId: Map<string, HierarchyNode> }
    | undefined;
  #pruned: { key: string; root: HierarchyNode; byId: Map<string, HierarchyNode> } | undefined;
  #model: HierarchyModel | undefined;
  #touch = false;
  #focusId: string | null = null;
  #refocus: string | null = null;
  #last: DrawResult | undefined;
  #zoom: Zoom | undefined;
  #zoomLoad: Promise<void> | undefined;
  /** What the zoom module asks of this chart. */
  readonly #host: ZoomHost = {
    zoomTo: (id) => this.zoomTo(id),
    zoomOut: () => this.zoomOut(),
    drillable: () => this.drillable,
    canExit: () => !!this.model().focus.parent,
    pinned: () => this.selected !== null,
    center: (x, y) => this.isCenter(x, y),
    tapTarget: (x, y, el) => {
      const index = this.#last?.hit?.(x, y, el, 44) ?? -1;
      const node = this.nodes[index];
      const target = node && this.drillTarget(node);
      return index >= 0 && index === this.selected && target && target.children.length > 0
        ? target.id
        : null;
    },
    touch: (on) => {
      this.#touch = on;
    },
    animate: () => this.tweening,
    redraw: () => this.requestDraw("transient"),
  };

  constructor() {
    super();
    this.addEventListener(CHART_EVENT.drill, (event) => {
      const { index } = (event as CustomEvent<{ index: number }>).detail;
      const node = this.nodes[index];
      const target = node && this.drillTarget(node);
      if (!target || !this.drillable || target.children.length === 0) return;
      this.#keepFocus(target.children[0]?.id ?? null);
      this.zoomTo(target.id);
    });
    this.addEventListener(CHART_EVENT.hover, (event) =>
      this.#light((event as CustomEvent<HoverInfo | null>).detail),
    );
  }

  get data(): HierarchyDatum | undefined {
    if (this.#data) return this.#data;
    const text = this.getAttribute("data");
    if (this.#parsed?.text !== text) this.#parsed = { text, value: parseData(text) };
    return this.#parsed.value;
  }
  set data(value: HierarchyDatum | undefined) {
    this.#data = value;
    this.#model = undefined;
    this.requestDraw();
  }

  /** The id of the open node (the root when nothing is zoomed). */
  get focusId(): string {
    return this.model().focus.id;
  }
  set focusId(id: string) {
    this.zoomTo(id);
  }

  /** Root first, the open node last: what a breadcrumb shows. */
  get path(): ReadonlyArray<{ id: string; name: string }> {
    return this.model().path.map((node) => ({ id: node.id, name: node.name }));
  }

  /**
   * The node behind mark `index` of the last draw (what `chart-select` and `chart-drill` report as
   * `detail.index`), or `undefined`. `path` runs from the root to the node.
   */
  nodeAt(
    index: number,
  ):
    | { id: string; name: string; depth: number; value: number; path: readonly string[] }
    | undefined {
    const node = this.nodes[index];
    return (
      node && {
        id: node.id,
        name: node.name,
        depth: node.depth,
        value: node.value,
        path: ancestors(node).map((n) => n.name),
      }
    );
  }

  /** Whether opening a node is on (`drill-down="off"` turns it off). */
  protected get drillable(): boolean {
    return flag(this, "drill-down", true);
  }
  protected get strings(): HierarchyStrings {
    return { ...HIERARCHY_STRINGS, ...this.labels };
  }
  /** Whether a zoom may be animated now. */
  protected get tweening(): boolean {
    return this.getAttribute("animate") !== "off" && !this.reduced;
  }

  /** The `focus-id` attribute: a subclass that cannot zoom ignores it. */
  protected get wantedFocus(): string | null {
    return this.#focusId ?? this.getAttribute("focus-id");
  }
  /** Id of the breadcrumb element (`off` for none), `null` to look for one inside the chart. */
  protected get crumbId(): string | null {
    return this.getAttribute("breadcrumb");
  }

  /**
   * The hierarchy for the current data, `sort`, hidden branches and open node. Built once per draw
   * (and again when the data, an attribute or the open node changes), so asking is free.
   */
  protected model(): HierarchyModel {
    if (this.#model) return this.#model;
    const data = this.data ?? EMPTY;
    const sort = flag(this, "sort", true);
    if (this.#built?.data !== data || this.#built.sort !== sort) {
      const full = buildHierarchy(data, { sort });
      this.#built = { data, sort, full, byId: indexOf(full) };
      this.#pruned = undefined;
    }
    const { full, byId } = this.#built;
    const hidden = new Set<string>();
    for (const id of byId.keys()) if (this.isHidden(id)) hidden.add(id);
    let root = full;
    let drawn = byId;
    if (hidden.size > 0) {
      const key = [...hidden].join("\n");
      if (this.#pruned?.key !== key) {
        const pruned = pruneTree(full, hidden);
        this.#pruned = { key, root: pruned, byId: indexOf(pruned) };
      }
      root = this.#pruned.root;
      drawn = this.#pruned.byId;
    }
    const wanted = this.wantedFocus;
    const focus = (wanted ? drawn.get(wanted) : undefined) ?? root;
    const total = (byId.get(focus.id) ?? focus).value;
    this.#model = {
      root,
      full,
      focus,
      path: ancestors(focus),
      total,
      byId,
      drawn,
      tones: new Map(),
    };
    return this.#model;
  }

  /** Base color of `node`: its own, else the palette slot of its branch (stable when a branch is hidden). */
  protected tone(node: HierarchyNode, model: HierarchyModel, ctx: DrawContext): string {
    const { tones, byId } = model;
    const climb: HierarchyNode[] = [];
    let color = "";
    let current: HierarchyNode = byId.get(node.id) ?? node;
    for (;;) {
      const known = tones.get(current);
      if (known !== undefined) {
        color = known;
        break;
      }
      const parent: HierarchyNode | null = current.parent;
      if (current.color) color = current.color;
      else if (!parent) color = ctx.color(0);
      else if (parent.id === model.focus.id) color = ctx.color(current.index);
      else {
        climb.push(current);
        current = parent;
        continue;
      }
      tones.set(current, color);
      break;
    }
    for (const passed of climb) tones.set(passed, color);
    return color;
  }

  protected override isEmpty(): boolean {
    return this.model().root.value <= 0;
  }

  /** Opens `id` (a node with children, or any ancestor). Returns false when nothing changed. */
  zoomTo(id: string): boolean {
    const { drawn, focus } = this.model();
    const node = drawn.get(id);
    if (!node || node.id === focus.id || node.children.length === 0) return false;
    // The legend lists the open node's children: branches hidden on the way would stay out of reach.
    for (const hiddenId of this.model().byId.keys())
      if (this.isHidden(hiddenId)) this.toggleSeries(hiddenId);
    this.#focusId = node.id;
    this.#model = undefined;
    if (this.selected !== null) this.select(null);
    this.onZoom(focus, node);
    this.requestDraw();
    const path = ancestors(node).map((n) => ({ id: n.id, name: n.name }));
    this.#syncCrumb();
    emit(this, "chart-focus", { id: node.id, name: node.name, depth: node.depth, path });
    return true;
  }

  /** Goes one level up. Returns false at the root. */
  zoomOut(): boolean {
    const { focus } = this.model();
    if (!focus.parent) return false;
    this.#keepFocus(focus.id);
    return this.zoomTo(focus.parent.id);
  }

  /** The node that opens when mark `node` is drilled (a treemap opens the group, not the leaf). */
  protected drillTarget(node: HierarchyNode): HierarchyNode {
    return node;
  }
  /** The open node changed: a subclass starts its zoom animation here. */
  protected onZoom(_from: HierarchyNode, _to: HierarchyNode): void {}
  /** Pointer position (drawing units) in the hole of a sunburst, where a click zooms out. */
  protected isCenter(_x: number, _y: number): boolean {
    return false;
  }

  /** Runs `step(t)` with `t` easing from 0 to 1 over `duration` ms, one transient frame each; at once when motion is off. */
  protected play(step: (t: number) => void, duration = 650): void {
    if (!this.tweening) {
      this.#zoom?.cancel();
      step(1);
    } else this.#withZoom((zoom) => zoom.play(step, duration));
  }

  /** Details of `node` for the tooltip, anchored at (`x`, `y`). */
  protected details(
    node: HierarchyNode,
    model: HierarchyModel,
    ctx: DrawContext,
    x: number,
    y: number,
    side?: HoverContent["side"],
  ): HoverContent {
    const { focus } = model;
    return {
      title: node.parent && node.parent !== focus ? nodePath(node.parent, focus) : focus.name,
      rows: nodeTooltipRows(node, focus, ctx.format, this.strings, this.tone(node, model, ctx), {
        total: model.total,
        drill: this.drillable,
        touch: this.#touch,
      }),
      x,
      y,
      side,
    };
  }

  /** Marks for `nodes`, each on the element `el(node)`. */
  protected marksOf(
    nodes: readonly HierarchyNode[],
    model: HierarchyModel,
    ctx: DrawContext,
    el: (node: HierarchyNode, index: number) => SVGElement,
  ): ChartMark[] {
    return nodes.map((node, i) => ({
      el: el(node, i),
      label: describeNode(node, model.focus, ctx.format, model.total),
    }));
  }

  /** The legend, data table and export of the open level. */
  protected snapshotOf(model: HierarchyModel, ctx: DrawContext): () => ChartSnapshot {
    return () => {
      const { root, focus } = model;
      const strings = this.strings;
      const nodes = descendants(root).slice(1);
      const whole = model.byId.get(focus.id) ?? focus;
      return {
        title: this.getAttribute("label") || root.name,
        categoryHeader: strings.category,
        categories: nodes.map((node) => nodePath(node, root)),
        series: [
          {
            id: "value",
            name: root.name,
            color: ctx.color(0),
            values: nodes.map((node) => node.value),
            text: nodes.map((node) => ctx.format(node.value)),
          },
          {
            id: "share",
            name: strings.share,
            color: ctx.color(1),
            values: nodes.map((node) => shareOf(node, model.full)),
            text: nodes.map((node) => percent(shareOf(node, model.full))),
          },
        ],
        legend: whole.children.slice(0, 8).map((child) => ({
          id: child.id,
          name: child.name,
          color: this.tone(child, model, ctx),
        })),
      };
    };
  }

  protected abstract render(ctx: DrawContext, model: HierarchyModel): DrawResult;

  protected override draw(ctx: DrawContext): DrawResult {
    this.#model = undefined;
    const model = this.model();
    this.#syncCrumb();
    const result = this.render(ctx, model);
    this.#last = result;
    queueMicrotask(() => {
      this.#settleFocus(result);
      this.#light(this.hover);
    });
    return result;
  }

  /** Remember to focus node `id` after the next draw, when the keyboard is what moved. */
  #keepFocus(id: string | null): void {
    const active = document.activeElement;
    if (id && active && this.drawing.contains(active)) this.#refocus = id;
  }

  /** A redraw restores focus by mark index; the open node changed, so put it on the right node. */
  #settleFocus(result: DrawResult): void {
    const id = this.#refocus;
    if (!id || result !== this.#last) return;
    this.#refocus = null;
    const marks = result.marks;
    const index = this.nodes.findIndex((node) => node.id === id);
    const mark = marks && !("count" in marks) ? marks[index] : undefined;
    const active = document.activeElement;
    if (!mark || (active !== document.body && !this.drawing.contains(active))) return;
    if (active !== mark.el) (mark.el as SVGElement & HTMLElement).focus({ preventScroll: true });
  }

  /** Lights the path from the root to the hovered mark and fades the rest. */
  #light(info: HoverInfo | null): void {
    const drawing = this.drawing;
    const node = info && this.lighting ? this.nodes[info.index] : undefined;
    drawing.toggleAttribute("data-lighting", !!node);
    const ids = node ? litPath(node) : undefined;
    for (const el of drawing.querySelectorAll("[data-node]"))
      el.toggleAttribute("data-lit", !!ids?.has(el.getAttribute("data-node") ?? ""));
  }

  /** Runs `use` with the zoom module (gestures, breadcrumb, tween), loading it the first time. */
  #withZoom(use: (zoom: Zoom) => void): void {
    if (this.#zoom) {
      use(this.#zoom);
      return;
    }
    this.#zoomLoad ??= import("./hierarchy-zoom.js").then((mod) => {
      this.#zoom = new mod.Zoom(this.#host);
    });
    this.#zoomLoad.then(() => this.#zoom && use(this.#zoom));
  }

  /** Gives the breadcrumb (named by `breadcrumb`, or the one inside the chart) the open path. */
  #syncCrumb(): void {
    const id = this.crumbId;
    const el =
      id === "off"
        ? null
        : id
          ? byId(this, id)
          : this.querySelector<HTMLElement>('[data-ui="chart-breadcrumb"]');
    if (!el && !this.#zoom) return;
    this.#withZoom((zoom) => zoom.crumb(el, this.model().path, this.strings.breadcrumb));
  }

  protected override setup(svg: SVGSVGElement, signal: AbortSignal): void {
    this.#withZoom((zoom) => {
      if (!signal.aborted) zoom.gestures(svg, signal);
    });
  }

  /** Called by `nav` when `parent` leaves the open node. */
  protected out = (): void => {
    this.zoomOut();
  };

  override connectedCallback(): void {
    this.toggleAttribute("data-hierarchy", true);
    adoptStyles(rootOf(this), css);
    super.connectedCallback();
    this.#syncCrumb();
  }

  override disconnectedCallback(): void {
    this.#zoom?.cancel();
    this.#zoom?.crumb(null, [], "");
    super.disconnectedCallback();
  }

  override attributeChangedCallback(name: string): void {
    if (name === "focus-id") this.#focusId = null;
    this.#model = undefined;
    super.attributeChangedCallback(name);
  }
}
