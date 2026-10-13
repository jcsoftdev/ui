import { tint } from "@jcsoftdev/ui-core/chart/color-scale";
import {
  type SankeyDiffLink,
  type SankeyGraph,
  type SankeyLink,
  type SankeyLinkInput,
  type SankeyNode,
  type SankeyNodeInput,
  sankeyDiff,
  sankeyFlowOf,
  sankeyLayout,
  sankeyLinkPath,
  sankeyTraceOf,
} from "@jcsoftdev/ui-core/chart/sankey";
import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  emit,
  rootOf,
  uid,
} from "../internal/base.js";
import {
  CHART_ATTRIBUTES,
  CHART_EVENT,
  ChartElement,
  type ChartLabels,
  type DrawContext,
  type DrawResult,
  type HoverContent,
  type HoverInfo,
  type NavIntent,
  svg,
  type TooltipRow,
} from "../internal/chart-base.js";
import {
  cachedJson,
  devWarn,
  fitLabel,
  numberAttr,
  sharePercent,
  textWidth,
} from "../internal/e21b-flow.js";
import css from "./sankey-chart.css.js";

export type { SankeyLinkInput, SankeyNodeInput };

/** Visible strings of the sankey chart (English defaults; override with `chart.labels`). */
export interface SankeyLabels {
  /** Data table header of the first column. */
  category: string;
  value: string;
  source: string;
  /** Table header and tooltip row: share of a flow's source node. */
  ofSource: string;
  /** Table header and tooltip row: share of everything that enters the diagram. */
  ofTotal: string;
  incoming: string;
  outgoing: string;
  before: string;
  after: string;
  change: string;
  /** `{nodes}`, `{links}` and `{total}`. */
  summary: string;
}

const DEFAULTS: SankeyLabels = {
  category: "Flow",
  value: "Value",
  source: "From",
  ofSource: "Share of",
  ofTotal: "Share of total",
  incoming: "In",
  outgoing: "Out",
  before: "Before",
  after: "After",
  change: "Change",
  summary: "{nodes} nodes, {links} flows, total {total}",
};

const EASE = "cubic-bezier(.22,1,.36,1)";
const LABEL_GAP = 6;
const HEADER = 22;
const SAMPLES = 24;

/** A flow of the diagram with its two ends, as the sankey chart reports it to the app. */
export type SankeyMark =
  | { kind: "node"; id: string; name: string }
  | { kind: "link"; id: string; source: string; target: string };

const flowsOf = (node: SankeyNode): SankeyLink[] =>
  node.outgoing.length > 0 ? node.outgoing : node.incoming;
const sourceTotal = (graph: SankeyGraph): number =>
  graph.nodes
    .filter((node) => node.incoming.length === 0)
    .reduce((sum, node) => sum + node.value, 0);

/** Samples of a link's centre line (the same cubic `sankeyLinkPath` draws): x and y, left to right. */
function sampleLink(link: SankeyLink): { xs: Float64Array; ys: Float64Array } {
  const x0 = link.source.x1;
  const x1 = link.target.x0;
  const mid = (x0 + x1) / 2;
  const xs = new Float64Array(SAMPLES + 1);
  const ys = new Float64Array(SAMPLES + 1);
  for (let i = 0; i <= SAMPLES; i += 1) {
    const t = i / SAMPLES;
    const u = 1 - t;
    xs[i] = u * u * u * x0 + 3 * u * u * t * mid + 3 * u * t * t * mid + t * t * t * x1;
    ys[i] = (u * u * u + 3 * u * u * t) * link.y0 + (3 * u * t * t + t * t * t) * link.y1;
  }
  return { xs, ys };
}

/** Pixels from (`x`, `y`) to the band of a link (0 on it). */
function bandDistance(
  link: SankeyLink,
  line: { xs: Float64Array; ys: Float64Array },
  x: number,
  y: number,
): number {
  const half = Math.max(1, link.width) / 2;
  const { xs, ys } = line;
  const last = SAMPLES;
  if (x <= (xs[0] as number))
    return Math.hypot((xs[0] as number) - x, Math.max(0, Math.abs(y - (ys[0] as number)) - half));
  if (x >= (xs[last] as number))
    return Math.hypot(
      x - (xs[last] as number),
      Math.max(0, Math.abs(y - (ys[last] as number)) - half),
    );
  let i = 0;
  while (i < last - 1 && (xs[i + 1] as number) < x) i += 1;
  const span = (xs[i + 1] as number) - (xs[i] as number) || 1;
  const yAt =
    (ys[i] as number) +
    ((x - (xs[i] as number)) / span) * ((ys[i + 1] as number) - (ys[i] as number));
  return Math.max(0, Math.abs(y - yAt) - half);
}

/** "+12 (+8.5%)" for a diff link. */
function signed(
  entry: Pick<SankeyDiffLink, "before" | "delta">,
  format: (value: number) => string,
  locale: string,
): string {
  const sign = entry.delta > 0 ? "+" : entry.delta < 0 ? "-" : "";
  const amount = `${sign}${format(Math.abs(entry.delta))}`;
  if (entry.before <= 0) return amount;
  const ratio = Math.abs(entry.delta) / entry.before;
  return `${amount} (${sign}${sharePercent(ratio, locale)})`;
}

/**
 * `<ui-sankey-chart>`: flows between columns of nodes, band widths proportional to the value, on
 * the chart base. Hover (or focus) a node to follow its flows upstream and downstream, or a link
 * to isolate it (`path-tracing` lights the whole path); the tooltip gives value and share. Links
 * that close a cycle are left out and reported by the `removed-links` event.
 *
 * Keyboard: the marks are the nodes (column by column, top to bottom) and then the links. Right and
 * Left follow the flow (a node goes to its largest outgoing or incoming link, a link to its
 * target or source node), Up and Down move between siblings in the same column, Home and End jump
 * to the first and last node, Enter or a tap pins, Shift+Enter drills, Backspace goes from a link
 * back to its source node. The pointer snaps across the gutters between marks, so the tooltip never
 * blinks.
 *
 * Attributes: `nodes` (JSON `[{ id, name, color?, column? }]`), `links` (JSON `[{ source, target,
 * value }]`), `compare` (JSON, links of the previous period: diff view), `path-tracing`,
 * `particles`, `columns` (JSON array or comma list of column titles), `relax="off"`, `node-width`,
 * `node-padding` (default 14), `align` (`justify`, `left`), `iterations` (default 6), `link-color`
 * (`gradient`, `source`, `target`, `neutral`), `link-opacity` (0-1, default .38), `label-position`
 * (`outside`, `inside`), `show-values="off"`, plus the chart attributes (height defaults to 380).
 * Properties: `nodes`, `links`, `compare`, `columns`, `legendItems`, `labels`; `describe(index)`
 * names the node or link behind a mark index of `chart-select` and `chart-drill`. Events:
 * `removed-links` (`detail`: the links left out, with the reason).
 */
export class UiSankeyChart extends ChartElement {
  static override observedAttributes = [
    ...CHART_ATTRIBUTES,
    "nodes",
    "links",
    "compare",
    "path-tracing",
    "particles",
    "columns",
    "relax",
    "node-width",
    "node-padding",
    "align",
    "iterations",
    "link-color",
    "link-opacity",
    "label-position",
    "show-values",
  ];
  override labels: Partial<ChartLabels & SankeyLabels> = {};
  legendItems: ReadonlyArray<{ id: string; name: string; color: string }> | undefined;
  readonly #id = uid("sankey");
  readonly #json = cachedJson(this);
  #nodes: readonly SankeyNodeInput[] | undefined;
  #links: readonly SankeyLinkInput[] | undefined;
  #compare: readonly SankeyLinkInput[] | undefined;
  #columns: readonly string[] | undefined;
  #removed = "";
  #view:
    | {
        marks: SankeyMark[];
        lit(index: number): { nodes: Set<string>; links: Set<string> } | null;
        nodes: Array<{ id: string; els: Element[] }>;
        links: Array<{ id: string; els: Element[] }>;
      }
    | undefined;

  constructor() {
    super();
    this.addEventListener(CHART_EVENT.hover, (event) =>
      this.#light((event as CustomEvent<HoverInfo | null>).detail?.index ?? null),
    );
  }

  get nodes(): readonly SankeyNodeInput[] {
    return this.#nodes ?? this.#json<SankeyNodeInput[]>("nodes") ?? [];
  }
  set nodes(value: readonly SankeyNodeInput[]) {
    this.#nodes = value;
    this.requestDraw();
  }
  get links(): readonly SankeyLinkInput[] {
    return this.#links ?? this.#json<SankeyLinkInput[]>("links") ?? [];
  }
  set links(value: readonly SankeyLinkInput[]) {
    this.#links = value;
    this.requestDraw();
  }
  get compare(): readonly SankeyLinkInput[] | undefined {
    return this.#compare ?? this.#json<SankeyLinkInput[]>("compare");
  }
  set compare(value: readonly SankeyLinkInput[] | undefined) {
    this.#compare = value;
    this.requestDraw();
  }
  get columns(): readonly string[] {
    if (this.#columns) return this.#columns;
    const text = this.getAttribute("columns");
    if (!text) return [];
    return text.trim().startsWith("[")
      ? (this.#json<string[]>("columns") ?? [])
      : text.split(",").map((part) => part.trim());
  }
  set columns(value: readonly string[]) {
    this.#columns = value;
    this.requestDraw();
  }

  /** The node or link behind a mark index (what `chart-select` and `chart-drill` report). */
  describe(index: number): SankeyMark | undefined {
    return this.#view?.marks[index];
  }

  override connectedCallback(): void {
    this.dataset.ui = "sankey-chart";
    adoptStyles(rootOf(this), css);
    if (!this.hasAttribute("height") && !this.hasAttribute("aspect-ratio"))
      this.setAttribute("height", "380");
    super.connectedCallback();
  }

  protected override isEmpty(): boolean {
    return (
      sankeyLayout(this.nodes, this.compare ? sankeyDiff(this.compare, this.links) : this.links, {
        width: 1,
        height: 1,
      }).nodes.length === 0
    );
  }

  /** Lights what the mark at `index` touches and dims the rest (`null` clears). */
  #light(index: number | null): void {
    const view = this.#view;
    if (!view) return;
    const lit = index == null || index < 0 ? null : view.lit(index);
    for (const node of view.nodes)
      for (const el of node.els)
        el.toggleAttribute("data-dim", lit !== null && !lit.nodes.has(node.id));
    for (const link of view.links)
      for (const el of link.els)
        el.toggleAttribute("data-dim", lit !== null && !lit.links.has(link.id));
  }

  protected draw({
    svg: root,
    width,
    height,
    format,
    color,
    animate,
    motion,
    locale,
    hover,
  }: DrawContext): DrawResult {
    const text = { ...DEFAULTS, ...this.labels };
    const allNodes = this.nodes;
    const hidden = new Set(
      allNodes.filter((node) => this.isHidden(node.id)).map((node) => node.id),
    );
    const visible = (link: SankeyLinkInput) => !hidden.has(link.source) && !hidden.has(link.target);
    const nodeInputs = hidden.size ? allNodes.filter((node) => !hidden.has(node.id)) : allNodes;
    const currentLinks = this.links.filter(visible);
    const previousLinks = this.compare?.filter(visible);
    const diff = previousLinks ? sankeyDiff(previousLinks, currentLinks) : null;
    const diffById = new Map(
      (diff ?? []).map((entry) => [`${entry.source}->${entry.target}`, entry]),
    );
    const colors = new Map(allNodes.map((node, index) => [node.id, color(index, node.color)]));
    const colorOf = (id: string) => colors.get(id) as string;

    const inside = this.getAttribute("label-position") === "inside";
    const titles = this.columns;
    const top = titles.length > 0 ? HEADER : 0;
    const plotHeight = Math.max(40, height - top);
    const nodeWidth = numberAttr(
      this,
      "node-width",
      inside ? Math.min(120, Math.max(56, width * 0.16)) : 12,
    );
    const graph = sankeyLayout(nodeInputs, diff ?? currentLinks, {
      width,
      height: plotHeight,
      nodeWidth,
      nodePadding: numberAttr(this, "node-padding", 14),
      iterations: numberAttr(this, "iterations", 6),
      align: this.getAttribute("align") === "left" ? "left" : "justify",
      relax: this.getAttribute("relax") !== "off",
    });
    this.#reportRemoved(graph);
    if (graph.nodes.length === 0) return {};

    const total = sourceTotal(graph);
    const lastColumn = graph.columns - 1;
    const step = lastColumn > 0 ? (width - nodeWidth) / lastColumn : width;
    const labelRoom = inside ? nodeWidth - 12 : step - nodeWidth - LABEL_GAP * 2;
    const pathTracing = this.hasAttribute("path-tracing");
    const linkColor = this.getAttribute("link-color") ?? "gradient";
    this.style.setProperty("--ui-sankey-link-opacity", `${numberAttr(this, "link-opacity", 0.38)}`);

    // Mark order: nodes (column by column, top to bottom), then the links.
    const ordered = [...graph.nodes].sort((a, b) => a.column - b.column || a.y0 - b.y0);
    const nodeCount = ordered.length;
    const nodeMark = new Map(ordered.map((node, i) => [node.id, i]));
    const linkMark = new Map(graph.links.map((link, j) => [link.id, nodeCount + j]));
    const nodeOf = (index: number) => ordered[index] as SankeyNode;
    const linkOf = (index: number) => graph.links[index - nodeCount] as SankeyLink;

    // ---- drawing ----
    const defs = svg("defs");
    root.append(defs);
    const reveal = svg("rect", {
      x: -2,
      y: -2,
      width: width + 4,
      height: plotHeight + 4,
      style: "transform-box:fill-box;transform-origin:left center",
    });
    defs.append(svg("clipPath", { id: `${this.#id}-reveal` }, reveal));
    if (linkColor === "gradient")
      for (const [j, link] of graph.links.entries())
        defs.append(
          svg(
            "linearGradient",
            {
              id: `${this.#id}-g${j}`,
              gradientUnits: "userSpaceOnUse",
              x1: link.source.x1,
              x2: link.target.x0,
              y1: 0,
              y2: 0,
            },
            svg("stop", { offset: "0%", style: `stop-color:${colorOf(link.source.id)}` }),
            svg("stop", { offset: "100%", style: `stop-color:${colorOf(link.target.id)}` }),
          ),
        );
    if (top > 0) {
      const header = svg("g", { "aria-hidden": "true", "data-label": "" });
      titles.slice(0, graph.columns).forEach((name, c) => {
        const x = c * step + (c === 0 ? 0 : c === lastColumn ? nodeWidth : nodeWidth / 2);
        const fitted = fitLabel(name, Math.max(40, step - 8), 11);
        if (fitted)
          header.append(
            svg(
              "text",
              {
                x,
                y: 12,
                "text-anchor": c === 0 ? "start" : c === lastColumn ? "end" : "middle",
                style:
                  "fill:var(--ink-3);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em",
              },
              fitted,
            ),
          );
      });
      root.append(header);
    }
    const plot = svg("g", { transform: `translate(0,${top})` });
    const linkLayer = svg("g", {
      fill: "none",
      ...(animate ? { "clip-path": `url(#${this.#id}-reveal)` } : {}),
    });
    const ghostLayer = svg("g", { fill: "none", "aria-hidden": "true" });
    const nodeLayer = svg("g");
    const labelLayer = svg("g", { "aria-hidden": "true", "data-label": "" });
    plot.append(linkLayer, nodeLayer, labelLayer);
    root.append(plot);

    const ghosts = new Map<string, SVGGElement>();
    if (diff) linkLayer.append(ghostLayer);
    const linkEls = graph.links.map((link, j) => {
      const entry = diffById.get(link.id);
      const d = sankeyLinkPath(link);
      if (entry) {
        const tone =
          entry.delta > 0
            ? "var(--chart-up)"
            : entry.delta < 0
              ? "var(--chart-down)"
              : "var(--ink-3)";
        const ghost = svg(
          "g",
          { "data-ghost": "" },
          svg("path", {
            d,
            "stroke-width": Math.max(1, entry.before * graph.ky),
            style: "stroke:var(--ink-3);stroke-opacity:.2",
          }),
        );
        ghost.append(
          entry.after > 0
            ? svg("path", {
                d,
                "stroke-width": Math.max(1, entry.after * graph.ky),
                style: `stroke:${tone};stroke-opacity:.58`,
              })
            : svg("path", {
                d,
                "stroke-width": Math.max(1, entry.before * graph.ky),
                "stroke-dasharray": "5 4",
                style: `stroke:${tone};stroke-opacity:.7`,
              }),
        );
        ghostLayer.append(ghost);
        ghosts.set(link.id, ghost);
      }
      const stroke =
        linkColor === "gradient"
          ? `url(#${this.#id}-g${j})`
          : linkColor === "source"
            ? colorOf(link.source.id)
            : linkColor === "target"
              ? colorOf(link.target.id)
              : "var(--ink-3)";
      const el = svg("path", {
        d,
        "data-link": "",
        "data-mark": nodeCount + j,
        "stroke-width": Math.max(1, link.width),
        style: entry ? "stroke:transparent;stroke-opacity:0" : `stroke:${stroke}`,
      });
      linkLayer.append(el);
      return el;
    });

    if (this.hasAttribute("particles") && motion) {
      const dots = svg("g", {
        "aria-hidden": "true",
        "data-export-skip": "",
        "data-particles": "",
      });
      for (const link of graph.links) {
        const width0 = diff ? (diffById.get(link.id)?.after ?? 0) * graph.ky : link.width;
        if (width0 < 3) continue;
        const d = sankeyLinkPath(link);
        const length = Math.hypot(link.target.x0 - link.source.x1, link.y1 - link.y0) * 1.1;
        const duration = Math.min(14, Math.max(3.5, length / 42));
        const count = Math.min(5, Math.max(1, Math.round(width0 / 6)));
        const radius = Math.min(2.6, Math.max(1.3, width0 * 0.16));
        for (let i = 0; i < count; i += 1) {
          const begin = `-${((i / count) * duration).toFixed(2)}s`;
          dots.append(
            svg(
              "circle",
              { r: radius, style: "fill:var(--surface);fill-opacity:.92", "data-link-id": link.id },
              svg("animateMotion", {
                dur: `${duration}s`,
                begin,
                repeatCount: "indefinite",
                path: d,
              }),
              svg("animate", {
                attributeName: "opacity",
                values: "0;1;1;0",
                keyTimes: "0;0.12;0.88;1",
                dur: `${duration}s`,
                begin,
                repeatCount: "indefinite",
              }),
            ),
          );
        }
      }
      linkLayer.append(dots);
    }

    const nodeEls = ordered.map((node, i) => {
      const base = colorOf(node.id);
      const el = svg("rect", {
        x: node.x0,
        y: node.y0,
        width: node.x1 - node.x0,
        height: Math.max(1, node.y1 - node.y0),
        rx: Math.min(3, (node.x1 - node.x0) / 2),
        "data-node": "",
        "data-mark": i,
        "data-series": node.id,
        style: `fill:${inside ? tint(base, 30) : base};${inside ? `stroke:${base};stroke-width:1;` : ""}transform-box:fill-box;transform-origin:center`,
      });
      nodeLayer.append(el);
      return el;
    });

    const showValues = this.getAttribute("show-values") !== "off";
    const labelEls = new Map<string, SVGTextElement>();
    if (labelRoom >= 40)
      for (const node of graph.nodes) {
        const tall = node.y1 - node.y0;
        if (tall < 10) continue;
        const end = !inside && node.column === lastColumn && lastColumn > 0;
        const x = inside ? node.x0 + 6 : end ? node.x0 - LABEL_GAP : node.x1 + LABEL_GAP;
        const name = fitLabel(node.name, labelRoom, 12);
        if (!name) continue;
        const value = format(node.value);
        const twoLines = showValues && tall >= 32;
        const oneLine =
          showValues &&
          !twoLines &&
          name === node.name &&
          textWidth(`${node.name}  ${value}`, 12) <= labelRoom;
        const y = (node.y0 + node.y1) / 2;
        const label = svg(
          "text",
          {
            x,
            y: twoLines ? y - 7 : y,
            "dominant-baseline": "middle",
            "text-anchor": end ? "end" : "start",
            style: "fill:var(--ink);font-size:12px;font-weight:600",
          },
          name,
        );
        if (oneLine)
          label.append(
            svg(
              "tspan",
              {
                dx: 6,
                style: "fill:var(--ink-3);font-weight:700;font-variant-numeric:tabular-nums",
              },
              value,
            ),
          );
        if (twoLines)
          label.append(
            svg(
              "tspan",
              {
                x,
                dy: 15,
                style: `fill:${inside ? "var(--ink-2)" : "var(--ink-3)"};font-size:11px;font-weight:700;font-variant-numeric:tabular-nums`,
              },
              value,
            ),
          );
        labelLayer.append(label);
        labelEls.set(node.id, label);
      }

    if (animate) {
      reveal.animate([{ transform: "scaleX(0)" }, { transform: "scaleX(1)" }], {
        duration: 1100,
        easing: EASE,
        fill: "backwards",
      });
      for (const [i, el] of nodeEls.entries())
        el.animate(
          [
            { opacity: 0, transform: "scaleY(0.4)" },
            { opacity: 1, transform: "scaleY(1)" },
          ],
          { duration: 420, delay: Math.min(i * 30, 300), easing: EASE, fill: "backwards" },
        );
    }

    // ---- hover lighting ----
    const marks: SankeyMark[] = [
      ...ordered.map((node): SankeyMark => ({ kind: "node", id: node.id, name: node.name })),
      ...graph.links.map(
        (link): SankeyMark => ({
          kind: "link",
          id: link.id,
          source: link.source.id,
          target: link.target.id,
        }),
      ),
    ];
    this.#view = {
      marks,
      lit: (index) => {
        if (index < nodeCount) return sankeyFlowOf(nodeOf(index));
        const link = linkOf(index);
        if (!link) return null;
        return pathTracing
          ? sankeyTraceOf(link)
          : { nodes: new Set([link.source.id, link.target.id]), links: new Set([link.id]) };
      },
      nodes: ordered.map((node, i) => ({
        id: node.id,
        els: [
          nodeEls[i] as Element,
          ...(labelEls.has(node.id) ? [labelEls.get(node.id) as Element] : []),
        ],
      })),
      links: graph.links.map((link, j) => ({
        id: link.id,
        els: [
          linkEls[j] as Element,
          ...(ghosts.has(link.id) ? [ghosts.get(link.id) as Element] : []),
        ],
      })),
    };
    this.#light(hover);

    // ---- navigation: follow the paths ----
    const byColumn = new Map<number, number[]>();
    ordered.forEach((node, i) => {
      const list = byColumn.get(node.column) ?? [];
      list.push(i);
      byColumn.set(node.column, list);
    });
    const linksOfColumn = new Map<number, number[]>();
    graph.links.forEach((link, j) => {
      const list = linksOfColumn.get(link.source.column) ?? [];
      list.push(nodeCount + j);
      linksOfColumn.set(link.source.column, list);
    });
    for (const list of linksOfColumn.values())
      list.sort((a, b) => linkOf(a).y0 - linkOf(b).y0 || linkOf(a).y1 - linkOf(b).y1 || a - b);
    const biggest = (flows: SankeyLink[]): number | undefined => {
      let best: SankeyLink | undefined;
      for (const link of flows) if (!best || link.value > best.value) best = link;
      return best ? linkMark.get(best.id) : undefined;
    };
    const sibling = (list: number[] | undefined, index: number, delta: number) => {
      const at = list?.indexOf(index) ?? -1;
      return at < 0 ? undefined : list?.[at + delta];
    };
    const nav = (index: number, intent: NavIntent): number | undefined => {
      if (intent === "home") return 0;
      if (intent === "end") return nodeCount - 1;
      if (index < nodeCount) {
        const node = nodeOf(index);
        switch (intent) {
          case "right":
          case "child":
            return biggest(node.outgoing);
          case "left":
            return biggest(node.incoming);
          case "up":
            return sibling(byColumn.get(node.column), index, -1);
          case "down":
            return sibling(byColumn.get(node.column), index, 1);
          default:
            return undefined;
        }
      }
      const link = linkOf(index);
      switch (intent) {
        case "right":
          return nodeMark.get(link.target.id);
        case "left":
        case "parent":
          return nodeMark.get(link.source.id);
        case "up":
          return sibling(linksOfColumn.get(link.source.column), index, -1);
        case "down":
          return sibling(linksOfColumn.get(link.source.column), index, 1);
        default:
          return undefined;
      }
    };

    // ---- pointer ----
    const lines = new Map<number, { xs: Float64Array; ys: Float64Array }>();
    const lineOf = (j: number) => {
      let line = lines.get(j);
      if (!line) {
        line = sampleLink(graph.links[j] as SankeyLink);
        lines.set(j, line);
      }
      return line;
    };
    const hit = (x: number, y: number, target: Element | null, radius: number): number => {
      const owner = target?.closest("[data-mark]");
      if (owner && root.contains(owner)) return Number(owner.getAttribute("data-mark"));
      const py = y - top;
      if (x < 0 || x > width || py < 0 || py > plotHeight) return -1;
      let best = -1;
      let distance = radius * 2 + 24;
      for (let i = 0; i < nodeCount; i += 1) {
        const node = nodeOf(i);
        const d = Math.hypot(
          Math.max(node.x0 - x, 0, x - node.x1),
          Math.max(node.y0 - py, 0, py - node.y1),
        );
        if (d === 0) return i;
        if (d < distance) {
          distance = d;
          best = i;
        }
      }
      for (let j = 0; j < graph.links.length; j += 1) {
        const d = bandDistance(graph.links[j] as SankeyLink, lineOf(j), x, py);
        if (d < distance) {
          distance = d;
          best = nodeCount + j;
        }
      }
      return best;
    };

    // ---- details ----
    const pct = (value: number) => sharePercent(value, locale);
    const nodeRows = (node: SankeyNode): TooltipRow[] => {
      const tone = colorOf(node.id);
      if (diff) {
        const flows = flowsOf(node);
        const sum = (pick: (entry: SankeyDiffLink) => number) =>
          flows.reduce((acc, link) => acc + pick(diffById.get(link.id) as SankeyDiffLink), 0);
        const before = sum((entry) => entry.before);
        const after = sum((entry) => entry.after);
        return [
          { id: "before", name: text.before, value: format(before), color: "var(--ink-3)" },
          { id: "after", name: text.after, value: format(after), color: tone },
          {
            id: "change",
            name: text.change,
            value: signed({ before, delta: after - before }, format, locale) || "0",
            color: "transparent",
            emphasis: true,
          },
        ];
      }
      const rows: TooltipRow[] = [
        {
          id: "value",
          name: text.value,
          value: format(node.value),
          color: tone,
          note: pct(total > 0 ? node.value / total : 0),
        },
      ];
      if (node.incoming.length > 0 && node.outgoing.length > 0 && node.inValue !== node.outValue)
        rows.push(
          { id: "in", name: text.incoming, value: format(node.inValue), color: "transparent" },
          { id: "out", name: text.outgoing, value: format(node.outValue), color: "transparent" },
        );
      for (const link of [...flowsOf(node)].sort((a, b) => b.value - a.value).slice(0, 4)) {
        const other = link.source === node ? link.target : link.source;
        rows.push({
          id: link.id,
          name: `${link.source === node ? "→" : "←"} ${other.name}`,
          value: format(link.value),
          color: colorOf(other.id),
          note: pct(link.value / node.value),
        });
      }
      return rows;
    };
    const linkRows = (link: SankeyLink): TooltipRow[] => {
      const entry = diffById.get(link.id);
      if (entry) {
        const tone =
          entry.delta > 0
            ? "var(--chart-up)"
            : entry.delta < 0
              ? "var(--chart-down)"
              : "var(--ink-3)";
        return [
          { id: "before", name: text.before, value: format(entry.before), color: "var(--ink-3)" },
          { id: "after", name: text.after, value: format(entry.after), color: tone },
          {
            id: "change",
            name: text.change,
            value: signed(entry, format, locale) || "0",
            color: "transparent",
            emphasis: true,
          },
        ];
      }
      return [
        {
          id: "value",
          name: text.value,
          value: format(link.value),
          color: colorOf(link.source.id),
        },
        {
          id: "source",
          name: `${text.ofSource} ${link.source.name}`,
          value: pct(link.value / link.source.value),
          color: "transparent",
        },
        {
          id: "total",
          name: text.ofTotal,
          value: pct(total > 0 ? link.value / total : 0),
          color: "transparent",
        },
      ];
    };
    const labelOf = (index: number): string => {
      if (index < nodeCount) {
        const node = nodeOf(index);
        const parts = flowsOf(node).map(
          (link) =>
            `${(link.source === node ? link.target : link.source).name} ${format(link.value)}`,
        );
        return `${node.name}: ${format(node.value)}, ${text.ofTotal} ${pct(total > 0 ? node.value / total : 0)}. ${parts.join(", ")}`;
      }
      const link = linkOf(index);
      return `${link.source.name} → ${link.target.name}: ${format(link.value)}, ${pct(link.value / link.source.value)} ${text.ofSource} ${link.source.name}, ${pct(total > 0 ? link.value / total : 0)} ${text.ofTotal}`;
    };

    return {
      summary: text.summary
        .replace("{nodes}", `${nodeCount}`)
        .replace("{links}", `${graph.links.length}`)
        .replace("{total}", format(total)),
      marks: [...nodeEls, ...linkEls].map((el, index) => ({ el, label: labelOf(index) })),
      maxHoverRows: 7,
      hit,
      nav,
      hover: (index): HoverContent | null => {
        if (index < nodeCount) {
          const node = nodeOf(index);
          return {
            title: node.name,
            rows: nodeRows(node),
            x: node.column === lastColumn && lastColumn > 0 ? node.x0 : node.x1,
            y: top + (node.y0 + node.y1) / 2,
            side: node.column === lastColumn && lastColumn > 0 ? "left" : "right",
          };
        }
        const link = linkOf(index);
        if (!link) return null;
        return {
          title: `${link.source.name} → ${link.target.name}`,
          rows: linkRows(link),
          x: (link.source.x1 + link.target.x0) / 2,
          y: top + (link.y0 + link.y1) / 2,
        };
      },
      snapshot: () => {
        const rows = [
          ...ordered.map((node) => ({
            name: node.name,
            value: node.value,
            source: null as number | null,
            total: total > 0 ? node.value / total : 0,
            before: null,
            after: null,
            delta: null,
          })),
          ...graph.links.map((link) => {
            const entry = diffById.get(link.id);
            return {
              name: `${link.source.name} → ${link.target.name}`,
              value: link.value,
              source: link.value / link.source.value,
              total: total > 0 ? link.value / total : 0,
              before: entry?.before ?? null,
              after: entry?.after ?? null,
              delta: entry ? entry.delta : null,
            };
          }),
        ];
        const column = (
          id: string,
          name: string,
          pick: (row: (typeof rows)[number]) => number | null,
          show: (value: number) => string,
        ) => ({
          id,
          name,
          color: color(0),
          values: rows.map(pick),
          text: rows.map((row) => {
            const value = pick(row);
            return value == null ? "" : show(value);
          }),
        });
        return {
          title: this.getAttribute("label") ?? text.category,
          categoryHeader: text.category,
          categories: rows.map((row) => row.name),
          series: [
            ...(diff
              ? [
                  column("before", text.before, (row) => row.before, format),
                  column("after", text.after, (row) => row.after, format),
                  {
                    ...column("change", text.change, (row) => row.delta, format),
                    text: rows.map((row) =>
                      row.delta == null
                        ? ""
                        : signed({ before: row.before ?? 0, delta: row.delta }, format, locale),
                    ),
                  },
                ]
              : [column("value", text.value, (row) => row.value, format)]),
            column(
              "source",
              `${text.ofSource} ${text.source.toLowerCase()}`,
              (row) => row.source,
              pct,
            ),
            column("total", text.ofTotal, (row) => row.total, pct),
          ],
          legend:
            this.legendItems ??
            allNodes.map((node, index) => ({
              id: node.id,
              name: node.name,
              color: color(index, node.color),
            })),
        };
      },
    };
  }

  /** Fires `removed-links` when the set of links the layout dropped changes. */
  #reportRemoved(graph: SankeyGraph): void {
    const key = graph.removed
      .map(({ link, reason }) => `${reason}:${link.source}>${link.target}`)
      .join("|");
    if (key === this.#removed) return;
    this.#removed = key;
    if (!key) return;
    emit(this, "removed-links", graph.removed);
    const cycles = graph.removed.filter((entry) => entry.reason === "cycle");
    if (cycles.length > 0)
      devWarn(
        `ui-sankey-chart "${this.getAttribute("label") ?? ""}": ${cycles.length} link(s) closed a cycle and were left out: ${cycles.map(({ link }) => `${link.source} → ${link.target}`).join(", ")}`,
      );
  }
}

/** Registers `<ui-sankey-chart>` (or `<prefix>-sankey-chart`) and returns the tag. */
export function defineSankeyChart(options?: DefineOptions): string {
  return defineElement("sankey-chart", UiSankeyChart, options);
}
