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
  findNode,
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
import { easeOutCubic } from "./chart-text.js";
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
  shareOf,
} from "./hierarchy-model.js";

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
}

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

/** The datum of `node` without the branches in `hidden`. */
function prune(node: HierarchyNode, hidden: ReadonlySet<string>): HierarchyDatum {
  const kept = node.children.filter((child) => !hidden.has(child.id));
  return kept.length > 0
    ? { ...node.data, children: kept.map((c) => prune(c, hidden)) }
    : node.data;
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
  #built: { data: HierarchyDatum; sort: boolean; full: HierarchyNode } | undefined;
  #pruned: { key: string; root: HierarchyNode } | undefined;
  #focusId: string | null = null;
  #refocus: string | null = null;
  #last: DrawResult | undefined;
  #frame = 0;
  #crumb: { el: HTMLElement; stop: AbortController } | undefined;
  #crumbItems: unknown;

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

  /** The hierarchy for the current data, `sort`, hidden branches and open node. */
  protected model(): HierarchyModel {
    const data = this.data ?? EMPTY;
    const sort = flag(this, "sort", true);
    if (this.#built?.data !== data || this.#built.sort !== sort) {
      this.#built = { data, sort, full: buildHierarchy(data, { sort }) };
      this.#pruned = undefined;
    }
    const full = this.#built.full;
    const hidden = new Set(
      descendants(full)
        .filter((node) => this.isHidden(node.id))
        .map((n) => n.id),
    );
    let root = full;
    if (hidden.size > 0) {
      const key = [...hidden].join("\n");
      if (this.#pruned?.key !== key)
        this.#pruned = { key, root: buildHierarchy(prune(full, hidden), { sort }) };
      root = this.#pruned.root;
    }
    const wanted = this.#focusId ?? this.getAttribute("focus-id");
    const focus = (wanted ? findNode(root, wanted) : null) ?? root;
    return { root, full, focus, path: ancestors(focus) };
  }

  /** Base color of `node`: its own, else the palette slot of its branch (stable when a branch is hidden). */
  protected tone(node: HierarchyNode, model: HierarchyModel, ctx: DrawContext): string {
    const whole = findNode(model.full, node.id) ?? node;
    const focus = findNode(model.full, model.focus.id) ?? model.focus;
    return branchColor(whole, focus, (i) => ctx.color(i));
  }

  protected override isEmpty(): boolean {
    return this.model().root.value <= 0;
  }

  /** Opens `id` (a node with children, or any ancestor). Returns false when nothing changed. */
  zoomTo(id: string): boolean {
    const { root, focus } = this.model();
    const node = findNode(root, id);
    if (!node || node.id === focus.id || node.children.length === 0) return false;
    this.#focusId = node.id;
    if (this.selected !== null) this.select(null);
    this.onZoom(focus, node);
    this.requestDraw();
    const path = ancestors(node).map((n) => ({ id: n.id, name: n.name }));
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
    cancelAnimationFrame(this.#frame);
    if (!this.tweening) {
      step(1);
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, Math.max(0, (now - start) / duration));
      step(easeOutCubic(t));
      this.requestDraw("transient");
      if (t < 1) this.#frame = requestAnimationFrame(tick);
    };
    this.#frame = requestAnimationFrame(tick);
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
      rows: nodeTooltipRows(node, focus, ctx.format, this.strings, this.tone(node, model, ctx)),
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
      label: describeNode(node, model.focus, ctx.format),
    }));
  }

  /** The legend, data table and export of the open level. */
  protected snapshotOf(model: HierarchyModel, ctx: DrawContext): () => ChartSnapshot {
    return () => {
      const { root, focus, full } = model;
      const strings = this.strings;
      const nodes = descendants(root).slice(1);
      const whole = findNode(full, focus.id) ?? focus;
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
            values: nodes.map((node) => shareOf(node, root)),
            text: nodes.map((node) => percent(shareOf(node, root))),
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
    const model = this.model();
    this.#bindCrumb(model.path);
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

  #bindCrumb(path: readonly HierarchyNode[]): void {
    const id = this.getAttribute("breadcrumb");
    const el =
      id === "off"
        ? null
        : id
          ? byId(this, id)
          : this.querySelector<HTMLElement>('[data-ui="chart-breadcrumb"]');
    if (el !== this.#crumb?.el) {
      this.#crumb?.stop.abort();
      this.#crumb = undefined;
      this.#crumbItems = undefined;
      if (el) {
        const stop = new AbortController();
        this.#crumb = { el, stop };
        el.addEventListener(
          "select",
          (event) => {
            const target = (event as CustomEvent<{ id?: string }>).detail?.id;
            if (target && event.target === el) this.zoomTo(target);
          },
          { signal: stop.signal },
        );
      }
    }
    if (!el || !("items" in el)) return;
    const items = path.map((node) => ({ id: node.id, name: node.name }));
    const same =
      this.#crumbItems === (el as HTMLElement & { items: unknown }).items &&
      JSON.stringify(this.#crumbItems) === JSON.stringify(items);
    if (same) return;
    if (!el.hasAttribute("label")) el.setAttribute("label", this.strings.breadcrumb);
    this.#crumbItems = items;
    (el as HTMLElement & { items: unknown }).items = items;
  }

  /** Pointer position in drawing units. */
  #local(svg: SVGSVGElement, event: PointerEvent | MouseEvent): [number, number] {
    const box = svg.getBoundingClientRect();
    const view = svg.viewBox.baseVal;
    return [
      (event.clientX - box.left) * (view.width / (box.width || 1)),
      (event.clientY - box.top) * (view.height / (box.height || 1)),
    ];
  }

  protected override setup(svg: SVGSVGElement, signal: AbortSignal): void {
    const opts = { signal };
    // The hole of a sunburst, or the first band of an icicle, zooms out (a click is not a selection).
    svg.addEventListener(
      "click",
      (event) => {
        if (!this.drillable || event.detail === 0) return;
        const [x, y] = this.#local(svg, event);
        if (!this.isCenter(x, y)) return;
        event.preventDefault();
        this.zoomOut();
      },
      opts,
    );
    // A second tap on the pinned node opens it (the first tap pins).
    svg.addEventListener(
      "pointerup",
      (event) => {
        if (event.pointerType === "mouse" || !this.drillable) return;
        const [x, y] = this.#local(svg, event);
        const index = this.#last?.hit?.(x, y, event.target as Element, 44) ?? -1;
        const node = this.nodes[index];
        const target = node && this.drillTarget(node);
        if (index < 0 || index !== this.selected || !target || target.children.length === 0) return;
        event.preventDefault();
        this.zoomTo(target.id);
      },
      opts,
    );
    // Escape goes up a level when no mark is pinned (a pinned mark takes Escape first).
    svg.addEventListener(
      "keydown",
      (event) => {
        if (event.key !== "Escape" || this.selected !== null || !this.drillable) return;
        if (!this.model().focus.parent) return;
        event.preventDefault();
        this.zoomOut();
      },
      opts,
    );
  }

  /** Called by `nav` when `parent` leaves the open node. */
  protected out = (): void => {
    this.zoomOut();
  };

  override connectedCallback(): void {
    this.toggleAttribute("data-hierarchy", true);
    adoptStyles(rootOf(this), css);
    super.connectedCallback();
  }

  override disconnectedCallback(): void {
    cancelAnimationFrame(this.#frame);
    this.#crumb?.stop.abort();
    this.#crumb = undefined;
    super.disconnectedCallback();
  }

  override attributeChangedCallback(name: string): void {
    if (name === "focus-id") this.#focusId = null;
    super.attributeChangedCallback(name);
  }
}
