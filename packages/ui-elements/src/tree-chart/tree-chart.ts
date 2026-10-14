import { tint } from "@jcsoftdev/ui-core/chart/color-scale";
import type { PanZoom, PanZoomView } from "@jcsoftdev/ui-core/chart/pan-zoom";
import {
  type TreeDirection,
  type TreeLayout,
  type TreeLayoutNode,
  treeLayout,
} from "@jcsoftdev/ui-core/chart/tree";
import { type TreeEdgeStyle, treeEdgePath } from "@jcsoftdev/ui-core/chart/tree-edge";
import { type TreeFitMode, treeFitView } from "@jcsoftdev/ui-core/chart/tree-fit";
import { adoptStyles, type DefineOptions, defineElement, emit, rootOf } from "../internal/base.js";
import {
  CHART_ATTRIBUTES,
  CHART_EVENT,
  ChartElement,
  type ChartLabels,
  type ChartMark,
  type DrawContext,
  type DrawResult,
  join,
  type NavIntent,
  type SnapshotSeries,
  svg,
  type TooltipRow,
} from "../internal/chart-base.js";
import { SR_ONLY } from "../internal/chart-dom.js";
import {
  DEFAULT_TREE_LABELS,
  describeNode,
  type TreeLabels,
} from "../internal/tree-labels.js";
import {
  ancestorIds,
  buildTreeModel,
  edgeColorOf,
  groupLeaves,
  initialCollapsed,
  initials,
  searchTree,
  subtreeSize,
  type TreeChartDatum,
  type TreeChartNode,
  type TreeEdgeColor,
  type TreeModel,
  visibleTree,
} from "../internal/tree-model.js";
import css from "./tree-chart.css.js";
import type { Pose, Tween } from "./tree-chart-input.js";
import type { TreeUi } from "./tree-chart-ui.js";

export type { TreeChartDatum, TreeChartNode, TreeLabels };
export type TreeLayoutKind = "tidy" | "radial" | "dendrogram";

/** State of a node passed to a custom `renderNode` template. */
export interface TreeNodeState {
  /** On the highlighted path from the root (hover, focus or selection). */
  highlighted: boolean;
  /** Something else is highlighted: the node may fade back. */
  dimmed: boolean;
  /** Keyboard cursor. */
  active: boolean;
  /** Children are hidden. */
  collapsed: boolean;
  hasChildren: boolean;
  /** Nodes below this one, at any depth. */
  descendants: number;
  /** `show-counts` is on: the template should display `descendants`. */
  showCount: boolean;
  /** Children are being fetched. */
  loading: boolean;
  /** Matches the search box. */
  matched: boolean;
  /** The pinned node (click, tap, Enter or the search). */
  selected: boolean;
  /** The node box, in pixels: the template draws inside `0, 0, width, height`. */
  width: number;
  height: number;
}

type ViewTween = { from: PanZoomView; to: PanZoomView; start: number };
type Stage = { g: SVGGElement; edges: SVGGElement; nodes: SVGGElement; toggles: SVGGElement };

const DURATION = 360;
const ZOOM_STEP = 1.25;
const TOOLBAR_BAND = 36;
const DIRECTIONS = ["top", "bottom", "left", "right"];
const KEYS: Record<string, string> = {
  left: "ArrowLeft",
  right: "ArrowRight",
  up: "ArrowUp",
  down: "ArrowDown",
};
const easeOut = (t: number) => 1 - (1 - t) ** 3;
const round = (n: number) => Math.round(n * 100) / 100;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ---- text -----------------------------------------------------------------------------------------

let canvas2d: CanvasRenderingContext2D | null | undefined;
const widths = new Map<string, number>();
function textWidth(font: string, text: string): number {
  const key = `${font}|${text}`;
  let width = widths.get(key);
  if (width === undefined) {
    canvas2d ??= document.createElement("canvas").getContext("2d");
    if (canvas2d) {
      canvas2d.font = font;
      width = canvas2d.measureText(text).width;
    } else width = text.length * 7;
    if (widths.size > 4000) widths.clear();
    widths.set(key, width);
  }
  return width;
}
/** `text` cut with an ellipsis so it fits `max` pixels in `font`. */
function ellipsize(font: string, text: string, max: number): string {
  if (max <= 0) return "";
  if (textWidth(font, text) <= max) return text;
  let lo = 0;
  let hi = text.length;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (textWidth(font, `${text.slice(0, mid).trimEnd()}…`) <= max) lo = mid;
    else hi = mid - 1;
  }
  return lo ? `${text.slice(0, lo).trimEnd()}…` : "…";
}

/** Point of a node box that faces its children, where the toggle button sits. */
function toggleAnchor(pose: TreeLayoutNode, direction: TreeDirection, radial: boolean) {
  if (radial && pose.angle != null) {
    const dx = Math.sin(pose.angle);
    const dy = -Math.cos(pose.angle);
    const reach = Math.min(
      pose.width / 2 / Math.max(1e-6, Math.abs(dx)),
      pose.height / 2 / Math.max(1e-6, Math.abs(dy)),
    );
    return { x: pose.x + dx * reach, y: pose.y + dy * reach };
  }
  switch (direction) {
    case "top":
      return { x: pose.x, y: pose.y + pose.height / 2 };
    case "bottom":
      return { x: pose.x, y: pose.y - pose.height / 2 };
    case "left":
      return { x: pose.x + pose.width / 2, y: pose.y };
    default:
      return { x: pose.x - pose.width / 2, y: pose.y };
  }
}

// What a chart pays for only once it draws: pan and zoom, the keyboard moves and the tween (loaded
// right after the first draw), and the radial and dendrogram layouts (loaded when asked for).
let input: typeof import("./tree-chart-input.js") | undefined;
const loadInput = () =>
  import("./tree-chart-input.js").then((module) => {
    input = module;
    return module;
  });
let radialModule: typeof import("./tree-chart-radial.js") | undefined;
const loadRadial = () =>
  import("./tree-chart-radial.js").then((module) => {
    radialModule = module;
    return module;
  });

const parseData = (text: string | null): TreeChartDatum | null => {
  if (!text) return null;
  try {
    return JSON.parse(text) as TreeChartDatum;
  } catch {
    return null;
  }
};

/**
 * `<ui-tree-chart>`: an org chart or hierarchy tree on the chart base. Three layouts (`tidy`,
 * `radial`, `dendrogram`), four directions, curved, step or straight edges, cards (chips in the
 * compact layouts) or your own SVG template, animated expand and collapse, pan and zoom, the path
 * to the root lit on hover or focus, search, lazy children and a screen-reader table of the nodes.
 *
 * Keyboard (one tab stop, the marks are the visible nodes in pre-order): the arrows move to the
 * parent, the children and the siblings as the `direction` reads (a top-down tree: Down is the
 * middle child, Up the parent, Left and Right the siblings; a left-to-right tree swaps the two),
 * Backspace goes to the parent, Home to the root, End to the last node, Enter or Space pins the
 * node, Shift+Enter expands or collapses it, `+` and `-` zoom and `0` fits the view. A mouse click
 * pins the node, a double click or the toggle button expands or collapses it.
 *
 * Attributes: `data` (JSON; the `data` property takes the object), `layout`, `direction`
 * (`top|bottom|left|right`), `edge-style` (`curved|step|straight`), `node-width`, `node-height`,
 * `sibling-gap`, `level-gap`, `initial-depth` (nodes from this depth start collapsed),
 * `collapsible` (default on), `highlight-path` (default on), `edge-color` (`neutral|depth|branch`),
 * `searchable`, `selectable` (the pinned node keeps its path lit), `show-counts`, `group-leaves`
 * (fold at least this many leaf siblings into one group), `fit` (`auto|contain|readable`),
 * `controls` (zoom toolbar, default on), `wheel-zoom` (`modifier|always|off`), `min-zoom`,
 * `max-zoom`, plus the chart attributes. Properties: `data`, `labels`, `loadChildren(node)`,
 * `renderNode(node, state)`. Methods: `expand(id)`, `collapse(id)`, `toggle(id)`, `fit()`,
 * `zoomIn()`, `zoomOut()`, `focusNode(id)`, `search(query)`. Events: `toggle` (`{ id, expanded }`),
 * `load-error` (`{ id, error }`) and the chart events (`chart-drill` is the expand or collapse).
 */
export class UiTreeChart extends ChartElement {
  static override observedAttributes = [
    ...CHART_ATTRIBUTES,
    "data",
    "layout",
    "direction",
    "edge-style",
    "node-width",
    "node-height",
    "sibling-gap",
    "level-gap",
    "initial-depth",
    "collapsible",
    "highlight-path",
    "edge-color",
    "searchable",
    "selectable",
    "show-counts",
    "group-leaves",
    "fit",
    "controls",
    "wheel-zoom",
    "min-zoom",
    "max-zoom",
  ];
  static override retain = true;
  static override touchAction = "none";

  declare labels: Partial<ChartLabels & TreeLabels>;
  /** Fetches the children of a `lazy` node the first time it expands; resolve with their data. */
  loadChildren: ((node: TreeChartNode) => Promise<readonly TreeChartDatum[]>) | undefined;
  /** A custom SVG node template, drawn inside the box `0, 0, state.width, state.height`; `null` keeps the card. */
  renderNode: ((node: TreeChartNode, state: TreeNodeState) => SVGElement | null) | undefined;

  #data: TreeChartDatum | null | undefined;
  #json: { text: string | null; value: TreeChartDatum | null } | undefined;
  // model
  #model: TreeModel | null = null;
  #modelData: unknown;
  #modelGroup = 0;
  #modelWord = "";
  #modelDepth = Number.NaN;
  #modelVersion = 0;
  #loaded = new Map<string, readonly TreeChartDatum[]>();
  #loadedVersion = 0;
  #modelLoaded = 0;
  #grouped: TreeChartDatum | null = null;
  #collapsed = new Set<string>();
  #collapsedVersion = 0;
  #busy = new Set<string>();
  #failed = new Set<string>();
  #fresh = true;
  // search
  #query = "";
  #matches: TreeChartNode[] = [];
  #matchIndex = 0;
  #matchSet: ReadonlySet<string> = new Set();
  // layout and motion
  #layoutKey = "";
  #layoutValue: TreeLayout | undefined;
  #target: TreeLayout | undefined;
  #poses = new Map<string, Pose>();
  #tween: Tween | undefined;
  #viewTween: ViewTween | undefined;
  #view: PanZoomView = { k: 1, x: 0, y: 0 };
  #fitView: PanZoomView | undefined;
  #fitChoice: TreeFitMode | null = null;
  #appliedFit: TreeFitMode = "contain";
  #glideNext = false;
  #interacting = false;
  #syncing = false;
  #panZoom: PanZoom | undefined;
  #panKey = "";
  #size = { width: 0, height: 0 };
  // drawing
  #stage: Stage | undefined;
  #status: HTMLElement | undefined;
  #ids: string[] = [];
  #index = new Map<string, number>();
  #navNodes: readonly TreeLayoutNode[] = [];
  #cards = new Map<string, Element>();
  #family = "sans-serif";
  #direction: TreeDirection = "top";
  #siblingGap = 20;
  #drilled = false;
  #keepFocus: string | undefined;
  #pendingCenter: string | undefined;
  #pendingSelect: string | undefined;
  #ui: TreeUi | undefined;
  #uiKey = "";
  #uiState = "";

  constructor() {
    super();
    // The path to the root follows the hover, the keyboard and the pin.
    const restyle = () => {
      if (this.#model) this.requestDraw("transient");
    };
    this.addEventListener(CHART_EVENT.hover, restyle);
    this.addEventListener(CHART_EVENT.select, restyle);
    this.addEventListener(CHART_EVENT.drill, (event) => {
      const id = this.#ids[(event as CustomEvent<{ index: number }>).detail.index];
      if (id === undefined) return;
      this.#drilled = true;
      queueMicrotask(() => {
        this.#drilled = false;
      });
      this.toggle(id);
    });
  }

  // ---- properties -----------------------------------------------------------------------------------

  get data(): TreeChartDatum | null {
    if (this.#data !== undefined) return this.#data;
    const text = this.getAttribute("data");
    if (this.#json?.text !== text) this.#json = { text, value: parseData(text) };
    return this.#json?.value ?? null;
  }
  set data(value: TreeChartDatum | null) {
    this.#data = value;
    this.requestDraw();
  }
  /** The id of the pinned node, or `null`. */
  get selectedId(): string | null {
    const index = this.selected;
    return index === null ? null : (this.#ids[index] ?? null);
  }

  // ---- attributes -----------------------------------------------------------------------------------

  #flag(name: string, fallback: boolean): boolean {
    const value = this.getAttribute(name);
    if (value === null) return fallback;
    return value !== "off" && value !== "false";
  }
  #number(name: string): number | undefined {
    const value = this.getAttribute(name);
    const number = value === null || value === "" ? Number.NaN : Number(value);
    return Number.isFinite(number) ? number : undefined;
  }
  get #kind(): TreeLayoutKind {
    const value = this.getAttribute("layout");
    return value === "radial" || value === "dendrogram" ? value : "tidy";
  }
  get #labels(): TreeLabels {
    return { ...DEFAULT_TREE_LABELS, ...this.labels };
  }

  override connectedCallback(): void {
    this.dataset.ui = "tree-chart";
    adoptStyles(rootOf(this), css);
    if (!this.hasAttribute("height") && !this.hasAttribute("aspect-ratio"))
      this.setAttribute("height", "480");
    super.connectedCallback();
    loadInput();
    if (this.#kind !== "tidy") loadRadial();
  }

  override attributeChangedCallback(name: string): void {
    if (name === "wheel-zoom" || name === "min-zoom" || name === "max-zoom") this.#bindPanZoom();
    if (name === "fit") this.#fitChoice = null;
    super.attributeChangedCallback(name);
  }

  protected override isEmpty(): boolean {
    return !this.data;
  }

  // ---- model ------------------------------------------------------------------------------------------

  /** Rebuilds the node model when the data (or how it is grouped) changed; a lazy load keeps the state. */
  #ensureModel(): TreeModel | null {
    const data = this.data;
    if (!data) {
      this.#model = null;
      this.#modelData = undefined;
      return null;
    }
    const labels = this.#labels;
    const group = this.#number("group-leaves") ?? 0;
    const depth = this.#number("initial-depth") ?? Number.POSITIVE_INFINITY;
    const changed =
      data !== this.#modelData ||
      group !== this.#modelGroup ||
      labels.groupWord !== this.#modelWord ||
      depth !== this.#modelDepth ||
      !this.#model;
    if (!changed && this.#modelLoaded === this.#loadedVersion) return this.#model;
    if (changed) {
      const sameData = data === this.#modelData;
      this.#modelData = data;
      this.#modelGroup = group;
      this.#modelWord = labels.groupWord;
      this.#modelDepth = depth;
      this.#grouped = group
        ? groupLeaves(data, group, (count) => `${count} ${labels.groupWord}`)
        : data;
      if (!sameData) {
        this.#loaded = new Map();
        this.#busy = new Set();
        this.#failed = new Set();
        this.#query = "";
        this.#matches = [];
        this.#matchSet = new Set();
        if (this.selected !== null) this.select(null);
      }
      this.#fresh = true;
    }
    this.#modelLoaded = this.#loadedVersion;
    this.#model = buildTreeModel(this.#grouped as TreeChartDatum, this.#loaded);
    this.#modelVersion++;
    if (changed) {
      this.#collapsed = initialCollapsed(this.#model, depth);
      this.#collapsedVersion++;
    }
    this.#matches = searchTree(this.#model, this.#query);
    this.#matchSet = new Set(this.#matches.map((node) => node.id));
    return this.#model;
  }

  // ---- actions ------------------------------------------------------------------------------------------

  expand(id: string): void {
    const node = this.#model?.byId.get(id);
    if (!node) return;
    if (node.lazy) void this.#load(node);
    else if (this.#collapsed.has(id)) this.#setCollapsed(node, false);
  }
  collapse(id: string): void {
    const node = this.#model?.byId.get(id);
    if (node && !node.lazy && node.children.length > 0 && !this.#collapsed.has(id))
      this.#setCollapsed(node, true);
  }
  toggle(id: string): void {
    const node = this.#model?.byId.get(id);
    if (!node || (node.children.length === 0 && !node.lazy)) return;
    if (node.lazy || this.#collapsed.has(id)) this.expand(id);
    else this.collapse(id);
  }

  #setCollapsed(node: TreeChartNode, collapsed: boolean): void {
    const next = new Set(this.#collapsed);
    if (collapsed) next.add(node.id);
    else next.delete(node.id);
    this.#collapsed = next;
    this.#collapsedVersion++;
    this.#keepFocus = node.id;
    emit(this, "toggle", { id: node.id, expanded: !collapsed });
    this.requestDraw();
  }

  async #load(node: TreeChartNode): Promise<void> {
    if (!this.loadChildren || this.#busy.has(node.id)) return;
    this.#busy = new Set(this.#busy).add(node.id);
    this.#failed.delete(node.id);
    this.requestDraw("transient");
    try {
      const children = await this.loadChildren(node);
      this.#loaded = new Map(this.#loaded).set(node.id, children);
      this.#loadedVersion++;
      this.#keepFocus = node.id;
      emit(this, "toggle", { id: node.id, expanded: true });
    } catch (error) {
      this.#failed = new Set(this.#failed).add(node.id);
      this.#announce(this.#labels.loadFailed);
      emit(this, "load-error", { id: node.id, error });
    } finally {
      this.#busy = new Set([...this.#busy].filter((id) => id !== node.id));
      this.requestDraw();
    }
  }

  #announce(text: string): void {
    this.#status ??= document.createElement("p");
    this.#status.setAttribute("role", "status");
    this.#status.style.cssText = SR_ONLY;
    this.#status.textContent = text;
    if (!this.#status.isConnected) this.drawing.append(this.#status);
  }

  /** Zooms in by one step, around the middle of the drawing. */
  zoomIn(): void {
    this.#panZoom?.zoomBy(ZOOM_STEP);
  }
  zoomOut(): void {
    this.#panZoom?.zoomBy(1 / ZOOM_STEP);
  }
  /**
   * Fits the tree to the drawing. After panning or zooming it restores the current fit; on a fitted
   * view it switches between the whole tree and the readable view.
   */
  fit(): void {
    const panZoom = this.#panZoom;
    if (!panZoom) return;
    this.#glideNext = true;
    if (panZoom.userMoved) panZoom.reset();
    else {
      this.#fitChoice = this.#appliedFit === "contain" ? "readable" : "contain";
      this.requestDraw("transient");
    }
  }

  /** Opens the ancestors of a node, pins it and brings it to the middle of the view. */
  focusNode(id: string): void {
    const node = this.#model?.byId.get(id);
    if (!node) return;
    const hidden = ancestorIds(node).filter((ancestor) => this.#collapsed.has(ancestor));
    if (hidden.length > 0) {
      this.#collapsed = new Set([...this.#collapsed].filter((c) => !hidden.includes(c)));
      this.#collapsedVersion++;
    }
    this.#pendingCenter = id;
    this.#pendingSelect = id;
    this.requestDraw();
  }

  /** Rings the nodes whose name, role or badge contain every word of `query`, and goes to the first. */
  search(query: string): void {
    this.#query = query;
    this.#matchIndex = 0;
    this.#syncSearch();
    const first = this.#matches[0];
    if (first) this.focusNode(first.id);
    else this.requestDraw("transient");
  }
  #syncSearch(): void {
    this.#matches = this.#model ? searchTree(this.#model, this.#query) : [];
    this.#matchSet = new Set(this.#matches.map((node) => node.id));
  }
  #step(delta: number): void {
    if (this.#matches.length === 0) return;
    this.#matchIndex = (this.#matchIndex + delta + this.#matches.length) % this.#matches.length;
    const node = this.#matches[this.#matchIndex];
    if (node) this.focusNode(node.id);
  }

  // ---- layout -------------------------------------------------------------------------------------------

  #layoutFor(model: TreeModel, width: number, height: number): TreeLayout {
    const kind = this.#kind;
    const compact = kind !== "tidy";
    const radial = kind === "radial";
    const nodeWidth = this.#number("node-width") ?? (compact ? 132 : 196);
    const nodeHeight = this.#number("node-height") ?? (compact ? 28 : 64);
    const siblingGap = this.#number("sibling-gap") ?? 20;
    const levelGap = this.#number("level-gap") ?? (radial ? 112 : compact ? 76 : 56);
    const direction = this.#direction;
    const key = [
      this.#modelVersion,
      this.#collapsedVersion,
      kind,
      direction,
      nodeWidth,
      nodeHeight,
      siblingGap,
      levelGap,
      radial ? `${width}x${height}` : "",
    ].join("|");
    if (this.#layoutValue && key === this.#layoutKey) return this.#layoutValue;
    const sized = (scale: number) =>
      visibleTree(model.root, this.#collapsed, () => ({
        width: Math.round(nodeWidth * scale),
        height: nodeHeight,
      }));
    let layout: TreeLayout;
    if (radial) {
      // Chips shrink a little (to 85%) before the readable view takes over: names stay legible.
      layout = (radialModule as NonNullable<typeof radialModule>).radialTreeLayout(sized(1), {
        levelGap,
        siblingGap,
      });
      for (const scale of [1, 0.85]) {
        layout = (radialModule as NonNullable<typeof radialModule>).radialTreeLayout(sized(scale), {
          levelGap,
          siblingGap,
        });
        const zoom = Math.min(width / layout.width, height / layout.height);
        if (zoom >= 0.8 || width <= 0 || height <= 0) break;
      }
    } else if (kind === "dendrogram")
      layout = (radialModule as NonNullable<typeof radialModule>).dendrogramLayout(sized(1), {
        direction,
        siblingGap,
        levelGap,
      });
    else layout = treeLayout(sized(1), { direction, siblingGap, levelGap });
    this.#layoutKey = key;
    this.#layoutValue = layout;
    return layout;
  }

  // ---- view ---------------------------------------------------------------------------------------------

  #motion(): boolean {
    return this.getAttribute("animate") !== "off" && !this.reduced;
  }

  /** Moves to `view` at once, or glides there over the next frames. */
  #goTo(view: PanZoomView, glide: boolean): void {
    if (glide) {
      this.#viewTween = { from: this.#view, to: view, start: performance.now() };
      this.requestDraw("transient");
    } else {
      this.#viewTween = undefined;
      this.#view = view;
      this.#applyView();
    }
  }

  #applyView(): void {
    const { x, y, k } = this.#view;
    if (this.#stage) this.#stage.g.style.transform = `translate(${x}px,${y}px) scale(${k})`;
    this.#syncUi();
  }

  #bindPanZoom(): void {
    if (!input || !this.drawing.querySelector("svg") || !this.isConnected) return;
    const key = [
      this.getAttribute("wheel-zoom"),
      this.getAttribute("min-zoom"),
      this.getAttribute("max-zoom"),
    ].join("|");
    if (key === this.#panKey && this.#panZoom) return;
    const previous = this.#panZoom;
    const moved = previous?.userMoved ?? false;
    previous?.destroy();
    this.#panKey = key;
    const wheel = this.getAttribute("wheel-zoom");
    const panZoom = input.attachPanZoom(this.drawing, {
      minZoom: this.#number("min-zoom") ?? 0.1,
      maxZoom: this.#number("max-zoom") ?? 2.5,
      wheel: wheel === "always" || wheel === "off" ? wheel : "modifier",
      keyboard: false,
      initial: this.#view,
      home: () => this.#fitView ?? this.#view,
      onChange: (view) => {
        if (this.#syncing) return;
        this.#goTo(view, !this.#interacting && this.#motion());
      },
      onInteract: (interacting) => {
        this.#interacting = interacting;
      },
    });
    if (moved) panZoom.setView(this.#view);
    this.#panZoom = panZoom;
  }

  /** The view that brings a node fully into the drawing, or `undefined` when it already is. */
  #reveal(id: string): PanZoomView | undefined {
    const node = this.#target?.nodes.find((candidate) => candidate.id === id);
    if (!node) return undefined;
    const margin = 12;
    const { k, x, y } = this.#view;
    const left = x + (node.x - node.width / 2) * k;
    const right = x + (node.x + node.width / 2) * k;
    const top = y + (node.y - node.height / 2) * k;
    const bottom = y + (node.y + node.height / 2) * k;
    const { width, height } = this.#size;
    let dx = 0;
    let dy = 0;
    if (left < margin) dx = margin - left;
    else if (right > width - margin) dx = width - margin - right;
    if (top < margin) dy = margin - top;
    else if (bottom > height - margin) dy = height - margin - bottom;
    return dx || dy ? { k, x: x + dx, y: y + dy } : undefined;
  }

  // ---- setup --------------------------------------------------------------------------------------------

  protected override setup(_svg: SVGSVGElement, signal: AbortSignal): void {
    const drawing = this.drawing;
    loadInput().then(() => {
      if (!signal.aborted) this.#bindPanZoom();
    });
    signal.addEventListener("abort", () => {
      this.#panZoom?.destroy();
      this.#panZoom = undefined;
      this.#panKey = "";
      this.#ui?.destroy();
      this.#ui = undefined;
      this.#uiKey = "";
    });
    const toggleOf = (event: Event) =>
      (event.target as Element | null)?.closest?.("[data-toggle]") ?? null;
    let press: { x: number; y: number; dragged: boolean } | undefined;
    let dragged = false;
    const capture = { capture: true, signal };
    // A drag pans: it is claimed (`preventDefault`) so it never becomes a selection. A press on a
    // toggle button is claimed too, and its click expands or collapses the node.
    drawing.addEventListener(
      "pointerdown",
      (event) => {
        if ((event.target as Element).closest?.("[data-tree-ui]")) return;
        press = { x: event.clientX, y: event.clientY, dragged: false };
        dragged = false;
        if (toggleOf(event)) event.preventDefault();
      },
      capture,
    );
    drawing.addEventListener(
      "pointermove",
      (event) => {
        if (!press || press.dragged) return;
        if (Math.hypot(event.clientX - press.x, event.clientY - press.y) < 4) return;
        press.dragged = true;
        this.toggleAttribute("data-panning", true);
      },
      capture,
    );
    const release = (event: Event) => {
      if (press?.dragged) {
        dragged = true;
        event.preventDefault();
        // The click that ends a drag arrives right after this event.
        setTimeout(() => {
          dragged = false;
        });
      }
      press = undefined;
      this.removeAttribute("data-panning");
    };
    drawing.addEventListener("pointerup", release, capture);
    drawing.addEventListener("pointercancel", release, capture);
    drawing.addEventListener(
      "click",
      (event) => {
        const toggle = toggleOf(event);
        if (!toggle) return;
        event.preventDefault();
        if (!dragged) this.toggle(toggle.getAttribute("data-id") ?? "");
      },
      capture,
    );
    drawing.addEventListener(
      "keydown",
      (event) => {
        if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
        if ((event.target as Element).closest?.("[data-tree-ui]")) return;
        if (event.key === "+" || event.key === "=") this.zoomIn();
        else if (event.key === "-" || event.key === "_") this.zoomOut();
        else if (event.key === "0") this.fit();
        else return;
        event.preventDefault();
      },
      { signal },
    );
    // A node reached with the keyboard is brought into view.
    drawing.addEventListener(
      "focusin",
      (event) => {
        const target = event.target as Element;
        if (!target.matches?.("[data-card]") || !target.matches(":focus-visible")) return;
        const view = this.#reveal(target.getAttribute("data-id") ?? "");
        if (view) this.#panZoom?.setView(view);
      },
      { signal },
    );
  }

  protected override teardown(): void {
    this.#tween = undefined;
    this.#viewTween = undefined;
    this.#stage = undefined;
    this.#status?.remove();
  }

  // ---- toolbar and search (a lazy chunk) -----------------------------------------------------------------

  #mountUi(): void {
    const controls = this.#flag("controls", true);
    const searchable = this.#flag("searchable", false) && this.hasAttribute("searchable");
    const hint = controls && (this.getAttribute("wheel-zoom") ?? "modifier") === "modifier";
    const key = `${controls}|${searchable}|${hint}|${this.#labels.search}|${this.#labels.fit}`;
    if (key === this.#uiKey) return;
    this.#uiKey = key;
    this.#ui?.destroy();
    this.#ui = undefined;
    if (!controls && !searchable) return;
    import("./tree-chart-ui.js").then(({ mountUi }) => {
      if (this.#uiKey !== key || !this.isConnected) return;
      this.#ui = mountUi(this.drawing, {
        labels: this.#labels,
        controls,
        searchable,
        hint,
        zoomBy: (factor) => this.#panZoom?.zoomBy(factor),
        fit: () => this.fit(),
        search: (query) => this.search(query),
        step: (delta) => this.#step(delta),
      });
      this.#uiState = "";
      this.#syncUi();
    });
  }
  #syncUi(): void {
    if (!this.#ui) return;
    const state = {
      zoom: this.#view.k,
      query: this.#query,
      count: this.#matches.length,
      index: this.#matchIndex,
    };
    const text = JSON.stringify(state);
    if (text === this.#uiState && this.drawing.querySelector("[data-tree-ui]")) return;
    this.#uiState = text;
    this.#ui.sync(state);
  }

  // ---- draw ---------------------------------------------------------------------------------------------

  protected draw(ctx: DrawContext): DrawResult | undefined {
    const model = this.#ensureModel();
    if (!model) return undefined;
    if (this.#kind !== "tidy" && !radialModule) {
      loadRadial().then(() => this.requestDraw());
      return undefined;
    }
    const { svg: root, width, height } = ctx;
    const labels = this.#labels;
    const kind = this.#kind;
    const radial = kind === "radial";
    const compact = kind !== "tidy";
    const attr = this.getAttribute("direction") ?? "top";
    const direction = (DIRECTIONS.includes(attr) ? attr : "top") as TreeDirection;
    this.#direction = direction;
    this.#siblingGap = this.#number("sibling-gap") ?? 20;
    if (!ctx.transient) this.#family = getComputedStyle(this).fontFamily || "sans-serif";
    this.#size = { width, height };

    const collapsible = this.#flag("collapsible", true);
    const highlightPath = this.#flag("highlight-path", true);
    const selectable = this.#flag("selectable", false) && this.hasAttribute("selectable");
    const showCounts = this.#flag("show-counts", false) && this.hasAttribute("show-counts");
    const edgeStyle = (this.getAttribute("edge-style") ?? "curved") as TreeEdgeStyle;
    const edgeMode = (this.getAttribute("edge-color") ?? "neutral") as TreeEdgeColor;
    const controls = this.#flag("controls", true);
    const searchable = this.#flag("searchable", false) && this.hasAttribute("searchable");
    this.#mountUi();

    const layout = this.#layoutFor(model, width, height);

    // The previous frame's nodes (by mark index) give the hovered, pinned and focused ids.
    const before = this.#ids;
    const hoverId = ctx.hover === null ? undefined : before[ctx.hover];
    const selectedId = this.selected === null ? undefined : before[this.selected];
    const keyboardId = this.hover?.source === "keyboard" ? hoverId : undefined;
    const active = document.activeElement;
    const focusInside = !!active && this.drawing.contains(active);
    const focusedId = focusInside ? (active.getAttribute?.("data-id") ?? undefined) : undefined;
    const keepWanted = focusedId ?? this.#keepFocus;
    this.#keepFocus = undefined;

    // ---- motion between layouts
    const now = performance.now();
    if (layout !== this.#target) {
      const fresh = this.#fresh;
      this.#target = layout;
      this.#fresh = false;
      this.#tween = undefined;
      if (ctx.motion && ctx.phase === "update" && this.#poses.size > 0 && !fresh)
        this.#tween = input?.buildTween(
          this.#poses,
          layout,
          now,
          (id) => model.byId.get(id)?.parent?.id,
        );
    }
    let poses: Pose[];
    const tween = this.#tween;
    let moving = false;
    if (tween) {
      const t = Math.min(1, Math.max(0, (now - tween.start) / DURATION));
      if (t >= 1) {
        this.#tween = undefined;
        poses = tween.final;
      } else {
        const e = easeOut(t);
        poses = tween.tracks.map(({ node, from, to }) => ({
          ...node,
          x: lerp(from.x, to.x, e),
          y: lerp(from.y, to.y, e),
          opacity: lerp(from.opacity, to.opacity, e),
        }));
        moving = true;
      }
    } else poses = layout.nodes.map((node) => ({ ...node, opacity: 1 }));
    this.#poses = new Map(poses.map((pose) => [pose.id, pose]));

    // ---- the view
    const toolbarBand = controls || searchable ? TOOLBAR_BAND : 0;
    const panZoom = this.#panZoom;
    const minZoom = this.#number("min-zoom") ?? 0.1;
    const fitAttr = this.getAttribute("fit");
    const fit = treeFitView(layout, width, height, radial ? "left" : direction, {
      inset: toolbarBand,
      mode: this.#fitChoice ?? (fitAttr === "contain" || fitAttr === "readable" ? fitAttr : "auto"),
      minZoom,
      centerRoot: radial,
    });
    this.#appliedFit = fit.mode;
    this.#fitView = fit.view;
    if (!panZoom?.userMoved) {
      const same =
        Math.abs(fit.view.k - this.#view.k) < 1e-4 &&
        Math.abs(fit.view.x - this.#view.x) < 0.01 &&
        Math.abs(fit.view.y - this.#view.y) < 0.01;
      const target = this.#viewTween?.to;
      if (!same && !(target && target.k === fit.view.k && target.x === fit.view.x)) {
        this.#syncing = true;
        panZoom?.setView(fit.view, { user: false });
        this.#syncing = false;
        const glide = ctx.motion && (ctx.phase === "update" || this.#glideNext);
        this.#glideNext = false;
        this.#goTo(fit.view, glide);
      }
    }
    const pending = this.#pendingCenter;
    if (pending) {
      const node = layout.nodes.find((candidate) => candidate.id === pending);
      if (node) {
        this.#pendingCenter = undefined;
        const k = Math.min(1.4, Math.max(0.8, this.#view.k));
        const view = {
          k,
          x: width / 2 - node.x * k,
          y: toolbarBand + (height - toolbarBand) / 2 - node.y * k,
        };
        if (panZoom) panZoom.setView(view);
        else this.#goTo(view, false);
      }
    }
    const view = this.#viewTween;
    if (view) {
      const t = Math.min(1, Math.max(0, (now - view.start) / DURATION));
      const e = easeOut(t);
      this.#view = {
        k: lerp(view.from.k, view.to.k, e),
        x: lerp(view.from.x, view.to.x, e),
        y: lerp(view.from.y, view.to.y, e),
      };
      if (t >= 1) {
        this.#view = view.to;
        this.#viewTween = undefined;
      } else moving = true;
    }

    // ---- the stage
    let stage = this.#stage;
    if (!stage || stage.g.parentNode !== root) {
      stage = {
        g: svg("g", { "data-stage": "" }),
        edges: svg("g", { "data-edges": "" }),
        nodes: svg("g", { "data-nodes": "" }),
        toggles: svg("g", { "data-toggles": "" }),
      };
      stage.g.append(stage.edges, stage.nodes, stage.toggles);
      root.append(stage.g);
      this.#stage = stage;
    }
    this.#applyView();
    root.toggleAttribute("aria-busy", this.#busy.size > 0);

    const path = new Set<string>();
    const lit = highlightPath && hoverId ? hoverId : selectable ? selectedId : undefined;
    for (let at = lit ? model.byId.get(lit) : undefined; at; at = at.parent ?? undefined)
      path.add(at.id);
    const descendants = showCounts ? new Map<string, number>() : undefined;
    const stateOf = (node: TreeChartNode, pose: TreeLayoutNode): TreeNodeState => {
      let count = 0;
      if (descendants) {
        count = descendants.get(node.id) ?? subtreeSize(node);
        descendants.set(node.id, count);
      }
      return {
        highlighted: path.has(node.id),
        dimmed: path.size > 0 && !path.has(node.id),
        active: keyboardId === node.id,
        collapsed: node.lazy || this.#collapsed.has(node.id),
        hasChildren: node.children.length > 0 || node.lazy,
        descendants: count,
        showCount: showCounts,
        loading: this.#busy.has(node.id),
        matched: this.#matchSet.has(node.id),
        selected: selectedId === node.id,
        width: pose.width,
        height: pose.height,
      };
    };

    // ---- edges
    const byId = this.#poses;
    const edges: Array<{ pose: Pose; parent: Pose; on: boolean }> = [];
    for (const pose of poses) {
      const parent = pose.parentId ? byId.get(pose.parentId) : undefined;
      if (parent) edges.push({ pose, parent, on: path.has(pose.id) && path.has(parent.id) });
    }
    edges.sort((a, b) => Number(a.on) - Number(b.on));
    join(
      stage.edges,
      edges,
      (edge) => edge.pose.id,
      () => svg("path", { "data-edge": "" }),
      (el, { pose, parent, on }) => {
        const node = model.byId.get(pose.id);
        el.setAttribute(
          "d",
          radial && layout.center
            ? (radialModule as NonNullable<typeof radialModule>).radialEdgePath(
                parent,
                pose,
                layout.center,
                edgeStyle,
              )
            : treeEdgePath(parent, pose, direction, edgeStyle),
        );
        el.style.stroke =
          edgeMode !== "neutral" && node
            ? edgeColorOf(node, edgeMode)
            : on
              ? (node?.color ?? "var(--accent-word)")
              : "var(--line-strong)";
        el.style.opacity = `${Math.min(pose.opacity, parent.opacity) * (path.size > 0 && !on ? 0.35 : 1)}`;
        el.toggleAttribute("data-on", on);
      },
    );

    // ---- nodes
    const visible = new Set(layout.nodes.map((node) => node.id));
    const font = (weight: number, size: number) => `${weight} ${size}px ${this.#family}`;
    const cardElements = join(
      stage.nodes,
      poses,
      (pose) => pose.id,
      (pose) => svg("g", { "data-node": "" }, svg("g", { "data-card": "", "data-id": pose.id })),
      (el, pose) => {
        const node = model.byId.get(pose.id);
        const card = el.firstElementChild as SVGGElement;
        if (!node) return;
        const state = stateOf(node, pose);
        el.setAttribute(
          "transform",
          `translate(${round(pose.x - pose.width / 2)},${round(pose.y - pose.height / 2)})`,
        );
        if (pose.opacity < 1) el.setAttribute("opacity", `${round(pose.opacity)}`);
        else el.removeAttribute("opacity");
        // A node folding away is drawn for a moment but is no longer part of the tree.
        if (visible.has(pose.id)) el.removeAttribute("aria-hidden");
        else {
          el.setAttribute("aria-hidden", "true");
          card.removeAttribute("tabindex");
        }
        card.style.setProperty("--ui-tree-color", node.color);
        card.toggleAttribute("data-path", state.highlighted);
        card.toggleAttribute("data-dimmed", state.dimmed);
        card.toggleAttribute("data-matched", state.matched);
        card.toggleAttribute("data-group", node.group);
        card.toggleAttribute("data-chip", compact);
        // The card is rebuilt only when what it shows changed.
        const key = this.renderNode
          ? JSON.stringify(state)
          : [
              compact,
              pose.width,
              pose.height,
              node.name,
              node.subtitle,
              node.badge,
              node.image,
              node.color,
              state.showCount ? state.descendants : "",
              this.#family,
            ].join("|");
        if (card.dataset.key === key) return;
        card.dataset.key = key;
        card.replaceChildren(...this.#cardContent(node, state, compact, font));
      },
      (el) => el.remove(),
    ).map((el) => el.firstElementChild as SVGGElement);
    const targetCount = layout.nodes.length;
    this.#cards = new Map(poses.map((pose, i) => [pose.id, cardElements[i] as Element]));

    // ---- toggles
    if (collapsible) {
      const withKids = poses.filter((pose) => {
        const node = model.byId.get(pose.id);
        return !!node && (node.children.length > 0 || node.lazy);
      });
      join(
        stage.toggles,
        withKids,
        (pose) => pose.id,
        (pose) => svg("g", { "data-toggle": "", "data-id": pose.id, "aria-hidden": "true" }),
        (el, pose) => {
          const node = model.byId.get(pose.id) as TreeChartNode;
          const at = toggleAnchor(pose, direction, radial);
          const loading = this.#busy.has(node.id);
          const label = loading
            ? ""
            : this.#failed.has(node.id)
              ? "!"
              : node.lazy
                ? `${node.data.childCount ?? "+"}`
                : this.#collapsed.has(node.id)
                  ? `${node.children.length}`
                  : "−";
          const w = Math.max(20, Math.round(textWidth(font(700, 10), label) + 10));
          el.setAttribute("transform", `translate(${round(at.x)},${round(at.y)})`);
          if (pose.opacity < 1) el.setAttribute("opacity", `${round(pose.opacity)}`);
          else el.removeAttribute("opacity");
          el.style.setProperty("--ui-tree-color", node.color);
          el.toggleAttribute("data-path", path.has(node.id));
          const key = `${loading}|${label}|${w}`;
          if (el.getAttribute("data-key") === key) return;
          el.setAttribute("data-key", key);
          el.replaceChildren(
            svg("rect", { x: -w / 2, y: -10, width: w, height: 20 }),
            loading
              ? svg("path", { "data-spin": "", d: "M0,-5A5,5 0 1 0 5,0" })
              : svg(
                  "text",
                  { "text-anchor": "middle", "dominant-baseline": "central", y: 0.5 },
                  ...(this.#failed.has(node.id)
                    ? [svg("title", {}, labels.loadFailed), label]
                    : [label]),
                ),
          );
        },
      );
    } else stage.toggles.replaceChildren();

    // ---- entry animation
    if (ctx.animate) {
      cardElements.forEach((card, i) => {
        const depth = (poses[i] as TreeLayoutNode).depth;
        card.animate(
          [
            { opacity: 0, transform: "scale(0.92)" },
            { opacity: 1, transform: "scale(1)" },
          ],
          {
            duration: 420,
            delay: Math.min(depth * 90, 360),
            easing: "cubic-bezier(.22,1,.36,1)",
            fill: "backwards",
          },
        );
      });
      stage.edges.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 500,
        delay: 160,
        easing: "ease-out",
        fill: "backwards",
      });
    }

    // ---- marks: the visible nodes, in pre-order
    const marks: ChartMark[] = [];
    const markPoses: Pose[] = [];
    const ids: string[] = [];
    const index = new Map<string, number>();
    for (let i = 0; i < targetCount; i += 1) {
      const pose = poses[i] as Pose;
      const node = model.byId.get(pose.id);
      if (!node) continue;
      index.set(pose.id, marks.length);
      ids.push(pose.id);
      markPoses.push(pose);
      marks.push({
        el: cardElements[i] as SVGElement,
        label: describeNode(node, this.#collapsed, labels),
      });
    }
    this.#ids = ids;
    this.#index = index;
    this.#navNodes = layout.nodes;
    // The toolbar and the search box live in the drawing, which the base fills after this returns.
    queueMicrotask(() => this.#syncUi());

    // ---- keep focus on the same node across a change of the visible set
    if (focusInside) {
      let wanted = keepWanted;
      while (wanted && !index.has(wanted)) wanted = model.byId.get(wanted)?.parent?.id;
      const oldIndex = focusedId ? before.indexOf(focusedId) : -1;
      if (wanted)
        queueMicrotask(() => {
          const el = this.#cards.get(wanted as string) as SVGElement | undefined;
          if (!el?.isConnected || !this.isConnected) return;
          const current = document.activeElement;
          if (current === el && oldIndex === index.get(wanted as string)) return;
          for (const card of this.#cards.values())
            card.setAttribute("tabindex", card === el ? "0" : "-1");
          if (current !== el && (this.drawing.contains(current) || current === document.body))
            el.focus({ preventScroll: true });
          else if (current === el && oldIndex !== index.get(wanted as string)) {
            // The index of the focused node changed: refocus so the details follow the node.
            el.blur();
            el.focus({ preventScroll: true });
          }
        });
    }
    if (this.#pendingSelect && index.has(this.#pendingSelect)) {
      const id = this.#pendingSelect;
      this.#pendingSelect = undefined;
      queueMicrotask(() => this.select(this.#index.get(id) ?? null));
    }
    if (moving) this.requestDraw("transient");

    const navIndex = (id: string) => index.get(id);
    return {
      label: this.labels.chart ?? "Tree",
      summary: labels.explore,
      marks,
      maxHoverRows: 5,
      hit: (x, y, target, radius) => {
        if (target?.closest?.("[data-tree-ui]")) return -1;
        const owner = target?.closest?.("[data-id]")?.getAttribute("data-id");
        const direct = owner ? navIndex(owner) : undefined;
        if (direct !== undefined) return direct;
        const { k, x: vx, y: vy } = this.#view;
        const px = (x - vx) / k;
        const py = (y - vy) / k;
        // The card under the pointer, else the nearest one: the gutters between cards belong to a card.
        const reach = Math.max(radius, this.#siblingGap * k);
        let best = -1;
        let distance = reach;
        for (let i = 0; i < markPoses.length; i += 1) {
          const pose = markPoses[i] as Pose;
          const dx = Math.max(Math.abs(px - pose.x) - pose.width / 2, 0);
          const dy = Math.max(Math.abs(py - pose.y) - pose.height / 2, 0);
          const d = Math.hypot(dx, dy) * k;
          if (d === 0) return i;
          if (d < distance) {
            distance = d;
            best = i;
          }
        }
        return best;
      },
      hover: (i) => {
        const pose = markPoses[i];
        const node = pose && model.byId.get(pose.id);
        if (!pose || !node) return null;
        const rows: TooltipRow[] = [];
        const row = (id: string, name: string, value: string) =>
          rows.push({ id, name, value, color: node.color });
        if (node.subtitle) row("role", labels.subtitle, node.subtitle);
        row("level", labels.level, `${node.depth + 1}`);
        if (node.parent) row("parent", labels.parent, node.parent.name);
        if (node.children.length > 0) {
          row("children", labels.children, `${node.children.length}`);
          row("descendants", labels.descendants, `${subtreeSize(node)}`);
        }
        const { k, x: vx, y: vy } = this.#view;
        return {
          title: node.name,
          rows,
          body: node.badge,
          x: vx + pose.x * k,
          y: vy + (pose.y - pose.height / 2) * k,
          side: "top",
        };
      },
      nav: (i, intent: NavIntent) => {
        const nodes = this.#navNodes;
        const current = nodes[i];
        if (!current || !input) return undefined;
        const { treeKeyMove, treeNeighbor } = input;
        const at = (id: string) => index.get(id);
        if (intent === "home") return 0;
        if (intent === "end") return nodes.length - 1;
        if (intent === "parent") return at(treeNeighbor(nodes, current.id, "parent"));
        if (intent === "child")
          // Shift+Enter just expanded or collapsed this node: the children are about to change.
          return this.#drilled ? undefined : at(treeNeighbor(nodes, current.id, "child"));
        // The layout is not mirrored in right-to-left pages, so the base's swap is undone.
        const rtl = getComputedStyle(this).direction === "rtl";
        const side = rtl
          ? intent === "left"
            ? "right"
            : intent === "right"
              ? "left"
              : intent
          : intent;
        const move = treeKeyMove(KEYS[side] as string, direction);
        return move ? at(treeNeighbor(nodes, current.id, move)) : undefined;
      },
      snapshot: () => {
        const all = model.nodes;
        const color = ctx.color(0);
        const series = (
          id: string,
          name: string,
          values: Array<string | number>,
        ): SnapshotSeries => ({
          id,
          name,
          color,
          values,
          text: values.map(String),
        });
        return {
          title: this.getAttribute("label") || this.labels.chart || "Tree",
          categoryHeader: labels.category,
          categories: all.map((node) => node.name),
          series: [
            series(
              "subtitle",
              labels.subtitle,
              all.map((node) => node.subtitle ?? ""),
            ),
            series(
              "level",
              labels.level,
              all.map((node) => node.depth + 1),
            ),
            series(
              "parent",
              labels.parent,
              all.map((node) => node.parent?.name ?? ""),
            ),
            series(
              "children",
              labels.children,
              all.map((node) => node.children.length),
            ),
            series(
              "descendants",
              labels.descendants,
              all.map((node) => subtreeSize(node)),
            ),
          ],
          legend: [],
        };
      },
    };
  }

  /** The inside of a node box: the custom template, else the card (or the chip of the compact layouts). */
  #cardContent(
    node: TreeChartNode,
    state: TreeNodeState,
    compact: boolean,
    font: (weight: number, size: number) => string,
  ): SVGElement[] {
    const { width: w, height: h } = state;
    const custom = this.renderNode?.(node, state);
    const out: SVGElement[] = [
      svg("rect", {
        "data-bg": "",
        "data-custom": custom ? "" : null,
        x: 0,
        y: 0,
        width: w,
        height: h,
      }),
      svg("rect", { "data-ring": "", x: -4, y: -4, width: w + 8, height: h + 8 }),
    ];
    if (custom) {
      out.push(custom);
      return out;
    }
    const count =
      state.showCount && state.descendants > 0
        ? {
            text: `${state.descendants}`,
            bw: Math.max(18, Math.round(textWidth(font(700, 10), `${state.descendants}`)) + 8),
          }
        : undefined;
    /** A tinted pill with a centred label, `bh` tall, centred on `cy`. */
    const pill = (
      x: number,
      cy: number,
      bw: number,
      bh: number,
      percent: number,
      text: string,
      mark: string,
    ) => [
      svg("rect", {
        x,
        y: cy - bh / 2,
        width: bw,
        height: bh,
        rx: bh / 2,
        style: `fill:${tint(node.color, percent)}`,
      }),
      svg(
        "text",
        {
          [mark]: "",
          x: x + bw / 2,
          y: cy + 0.5,
          "text-anchor": "middle",
          "dominant-baseline": "central",
        },
        text,
      ),
    ];
    if (compact) {
      const right = w - 8 - (count ? count.bw + 4 : 0);
      out.push(
        svg("circle", { cx: 12, cy: h / 2, r: 4, style: `fill:${node.color}` }),
        svg(
          "text",
          { "data-name": "", x: 22, y: h / 2 + 0.5, "dominant-baseline": "central" },
          ellipsize(font(600, 11), node.name, right - 22),
        ),
      );
      if (count)
        out.push(...pill(w - 8 - count.bw, h / 2, count.bw, 18, 22, count.text, "data-count"));
      return out;
    }
    out.push(
      svg("rect", {
        x: 0,
        y: 8,
        width: 4,
        height: Math.max(0, h - 16),
        rx: 2,
        style: `fill:${node.color}`,
      }),
      svg("circle", { cx: 32, cy: h / 2, r: 18, style: `fill:${tint(node.color, 24)}` }),
    );
    if (node.image)
      out.push(
        svg("image", {
          "data-image": "",
          href: node.image,
          x: 14,
          y: h / 2 - 18,
          width: 36,
          height: 36,
          preserveAspectRatio: "xMidYMid slice",
        }),
      );
    else
      out.push(
        svg(
          "text",
          {
            "data-initials": "",
            x: 32,
            y: h / 2 + 0.5,
            "text-anchor": "middle",
            "dominant-baseline": "central",
          },
          initials(node.name),
        ),
      );
    const left = 60;
    const right = w - 10 - (count ? count.bw + 6 : 0);
    const two = !!(node.subtitle || node.badge);
    out.push(
      svg(
        "text",
        {
          "data-name": "",
          x: left,
          y: two ? h / 2 - 8 : h / 2 + 0.5,
          "dominant-baseline": "central",
        },
        ellipsize(font(600, 13), node.name, right - left),
      ),
    );
    let subRight = right;
    if (node.badge) {
      const text = ellipsize(font(700, 10), node.badge, (right - left) * 0.6 - 12);
      const bw = Math.round(textWidth(font(700, 10), text)) + 12;
      subRight = right - bw - 6;
      out.push(...pill(right - bw, h / 2 + 9, bw, 16, 16, text, "data-pill"));
    }
    if (node.subtitle)
      out.push(
        svg(
          "text",
          { "data-sub": "", x: left, y: h / 2 + 9, "dominant-baseline": "central" },
          ellipsize(font(400, 11), node.subtitle, subRight - left),
        ),
      );
    if (count)
      out.push(...pill(w - 10 - count.bw, h / 2, count.bw, 18, 22, count.text, "data-count"));
    return out;
  }
}

/** Registers `<ui-tree-chart>` (or `<prefix>-tree-chart`) and returns the tag. */
export function defineTreeChart(options?: DefineOptions): string {
  return defineElement("tree-chart", UiTreeChart, options);
}
