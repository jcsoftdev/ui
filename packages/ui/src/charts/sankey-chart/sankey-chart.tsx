"use client";

import {
  type KeyboardEvent,
  memo,
  type PointerEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { DECORATIVE } from "../core/a11y.js";
import { estimateTextWidth } from "../core/axes.js";
import { ChartFrame } from "../core/chart-frame.js";
import { tint } from "../core/color-scale.js";
import { ChartDataTable } from "../core/data-table.js";
import { resolveFormat, type ValueFormat, type ValueFormatter } from "../core/format.js";
import { fitLabel } from "../core/hierarchy-chart.js";
import { ChartLegend } from "../core/legend.js";
import { EASE_OUT, revealClip, useEntryAnimation } from "../core/motion.js";
import { seriesColor } from "../core/palette.js";
import {
  type SankeyGraph,
  type SankeyLink,
  type SankeyLinkInput,
  type SankeyNode,
  type SankeyNodeInput,
  sankeyFlowOf,
  sankeyLayout,
  sankeyLinkPath,
} from "../core/sankey.js";
import { ChartTooltip, type TooltipRow } from "../core/tooltip.js";
import { type ChartLabels, DEFAULT_LABELS } from "../core/types.js";

/** Visible strings of the sankey chart. */
export interface SankeyLabels extends ChartLabels {
  /** Data table header: where a flow starts. */
  source: string;
  /** Data table header: where a flow ends. */
  target: string;
  /** Tooltip row: share of the flow's source node. */
  ofSource: string;
  /** Tooltip row and table header: share of everything that enters the diagram. */
  ofTotal: string;
  incoming: string;
  outgoing: string;
}

export const DEFAULT_SANKEY_LABELS: SankeyLabels = {
  ...DEFAULT_LABELS,
  explore:
    "Flow diagram. Up and down move within a column, left and right between columns, Enter steps through the flows of a node, Escape clears.",
  category: "Flow",
  source: "From",
  target: "To",
  ofSource: "Share of",
  ofTotal: "Share of total",
  incoming: "In",
  outgoing: "Out",
};

export interface SankeyChartProps {
  /** Accessible name of the drawing and caption of the data table. */
  title: string;
  nodes: readonly SankeyNodeInput[];
  /** Flows between node ids. Links that close a cycle are left out (with a dev warning). */
  links: readonly SankeyLinkInput[];
  /** Titles drawn above the columns, left to right, e.g. ["Origen", "Servicio", "Pago"]. */
  columns?: readonly string[];
  height?: number | "fill";
  /** Width / height ratio of the drawing; ignored with `"fill"`. */
  aspectRatio?: number;
  valueFormat?: ValueFormat;
  /** Thickness of the node bars (wider by default with inside labels). */
  nodeWidth?: number;
  /** Vertical gap between nodes of a column. */
  nodePadding?: number;
  /** `justify` puts the final nodes in the last column; `left` keeps each at its depth. */
  align?: "justify" | "left";
  /** Relaxation sweeps of the layout; more untangles more, at a cost. */
  iterations?: number;
  /** `gradient` blends source into target; `source`/`target` use one end; `neutral` is grey. */
  linkColor?: "gradient" | "source" | "target" | "neutral";
  /** Resting opacity of the links (0-1). */
  linkOpacity?: number;
  /** Node labels beside the bars (`outside`) or on wide bars (`inside`). */
  labelPosition?: "outside" | "inside";
  /** Value after each node label. */
  showValues?: boolean;
  tooltip?: boolean;
  animate?: boolean;
  loading?: boolean;
  labels?: Partial<SankeyLabels>;
  onNodeClick?: (node: SankeyNode) => void;
  onLinkClick?: (link: SankeyLink) => void;
  /** Links the layout left out (cycles, self links, unknown ids, invalid values). */
  onRemovedLinks?: (removed: SankeyGraph["removed"]) => void;
  className?: string;
}

/**
 * Sankey diagram: flows between columns of nodes, band widths proportional to
 * the value. Hover (or keyboard) a node to follow its flows upstream and
 * downstream, or a link to isolate it; the tooltip gives value and share.
 */
export function SankeyChart({
  title,
  nodes,
  links,
  height = 380,
  aspectRatio,
  valueFormat,
  loading,
  labels: labelsProp,
  className,
  ...rest
}: SankeyChartProps) {
  const labels = useMemo(
    () => (labelsProp ? { ...DEFAULT_SANKEY_LABELS, ...labelsProp } : DEFAULT_SANKEY_LABELS),
    [labelsProp],
  );
  const format = useMemo(() => resolveFormat(valueFormat), [valueFormat]);
  // Unit-size layout just for colors, the legend, the table and the empty state.
  const shape = useMemo(() => sankeyLayout(nodes, links, { width: 1, height: 1 }), [nodes, links]);
  const colors = useMemo(() => nodeColors(nodes), [nodes]);
  const total = sourceTotal(shape);

  const { onRemovedLinks } = rest;
  useEffect(() => {
    if (shape.removed.length === 0) return;
    onRemovedLinks?.(shape.removed);
    const cycles = shape.removed.filter((entry) => entry.reason === "cycle");
    if (cycles.length > 0 && !isProduction()) {
      console.warn(
        `SankeyChart "${title}": ${cycles.length} link(s) closed a cycle and were left out:`,
        cycles.map(({ link }) => `${link.source} → ${link.target}`).join(", "),
      );
    }
  }, [shape, title, onRemovedLinks]);

  return (
    <ChartFrame
      height={height}
      aspectRatio={aspectRatio}
      labels={labels}
      loading={loading}
      empty={shape.nodes.length === 0}
      skeleton="bars"
      className={className}
      footer={
        <ChartLegend
          className="@lg/chart:hidden"
          items={shape.nodes.map((node) => ({
            id: node.id,
            name: node.name,
            color: colors.get(node.id) as string,
          }))}
        />
      }
      table={
        <ChartDataTable
          caption={title}
          categoryHeader={labels.category}
          categories={shape.links.map((link) => `${link.source.name} → ${link.target.name}`)}
          columns={[
            {
              id: "value",
              name: labels.value,
              values: shape.links.map((link) => format(link.value)),
            },
            {
              id: "source",
              name: `${labels.ofSource} ${labels.source.toLowerCase()}`,
              values: shape.links.map((link) => percent(link.value / link.source.value)),
            },
            {
              id: "total",
              name: labels.ofTotal,
              values: shape.links.map((link) => percent(total > 0 ? link.value / total : 0)),
            },
          ]}
        />
      }
    >
      {(width, drawingHeight) => (
        <SankeyPlot
          {...rest}
          title={title}
          nodes={nodes}
          links={links}
          colors={colors}
          format={format}
          labels={labels}
          width={width}
          height={drawingHeight}
        />
      )}
    </ChartFrame>
  );
}

function isProduction(): boolean {
  return typeof process !== "undefined" && process.env?.NODE_ENV === "production";
}

function nodeColors(nodes: readonly SankeyNodeInput[]): Map<string, string> {
  return new Map(nodes.map((node, index) => [node.id, seriesColor(index, node.color)]));
}

/** Everything that enters the diagram: the sum of the first-column nodes. */
function sourceTotal(graph: SankeyGraph): number {
  return graph.nodes
    .filter((node) => node.incoming.length === 0)
    .reduce((sum, node) => sum + node.value, 0);
}

function percent(value: number): string {
  return `${(value * 100).toFixed(value < 0.1 ? 1 : 0)}%`;
}

interface SankeyPlotProps
  extends Omit<
    SankeyChartProps,
    "height" | "aspectRatio" | "valueFormat" | "loading" | "labels" | "className"
  > {
  colors: Map<string, string>;
  format: ValueFormatter;
  labels: SankeyLabels;
  width: number;
  height: number;
}

type Focus = { kind: "node"; id: string } | { kind: "link"; id: string };

const LABEL_GAP = 6;
const HEADER = 22;

function SankeyPlot({
  title,
  nodes,
  links,
  columns: columnTitles,
  colors,
  format,
  labels,
  width,
  height,
  nodeWidth: nodeWidthProp,
  nodePadding = 14,
  align = "justify",
  iterations = 6,
  linkColor = "gradient",
  linkOpacity = 0.38,
  labelPosition = "outside",
  showValues = true,
  tooltip = true,
  animate = true,
  onNodeClick,
  onLinkClick,
}: SankeyPlotProps) {
  const uid = useId().replace(/:/g, "");
  const inside = labelPosition === "inside";
  const top = columnTitles && columnTitles.length > 0 ? HEADER : 0;
  const plotHeight = Math.max(40, height - top);
  const nodeWidth = nodeWidthProp ?? (inside ? Math.min(120, Math.max(56, width * 0.16)) : 12);
  const graph = useMemo(
    () =>
      sankeyLayout(nodes, links, {
        width,
        height: plotHeight,
        nodeWidth,
        nodePadding,
        iterations,
        align,
      }),
    [nodes, links, width, plotHeight, nodeWidth, nodePadding, iterations, align],
  );
  const total = sourceTotal(graph);
  const lastColumn = graph.columns - 1;
  const step = lastColumn > 0 ? (width - nodeWidth) / lastColumn : width;
  // Room for an outside label between two columns.
  const labelRoom = inside ? nodeWidth - 12 : step - nodeWidth - LABEL_GAP * 2;

  const [hover, setHover] = useState<{ focus: Focus; x: number; y: number } | null>(null);
  const [active, setActive] = useState<Focus | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEntryAnimation(
    svgRef,
    (root) => {
      const clip = root.querySelector("[data-reveal]");
      if (clip) revealClip(clip, 1100);
      root.querySelectorAll("[data-sankey-node]").forEach((element, index) => {
        element.animate(
          [
            { opacity: 0, transform: "scaleY(0.4)" },
            { opacity: 1, transform: "scaleY(1)" },
          ],
          { duration: 420, delay: Math.min(index * 30, 300), easing: EASE_OUT, fill: "backwards" },
        );
      });
    },
    { disabled: !animate, replayKey: graph.nodes.length * 1000 + graph.links.length },
  );

  const focus = hover?.focus ?? active;
  const lit = useMemo(() => {
    if (!focus) return null;
    if (focus.kind === "node") {
      const node = graph.nodes.find((candidate) => candidate.id === focus.id);
      return node ? sankeyFlowOf(node) : null;
    }
    const link = graph.links.find((candidate) => candidate.id === focus.id);
    return link
      ? { nodes: new Set([link.source.id, link.target.id]), links: new Set([link.id]) }
      : null;
  }, [focus, graph]);

  const pointer = (event: PointerEvent<Element>) => {
    const box = containerRef.current?.getBoundingClientRect();
    return box ? { x: event.clientX - box.left, y: event.clientY - box.top } : { x: 0, y: 0 };
  };

  // Keyboard order: column by column, top to bottom.
  const ordered = useMemo(
    () => [...graph.nodes].sort((a, b) => a.column - b.column || a.y0 - b.y0),
    [graph.nodes],
  );
  const activeNode =
    active?.kind === "node"
      ? graph.nodes.find((node) => node.id === active.id)
      : active?.kind === "link"
        ? graph.links.find((link) => link.id === active.id)?.source
        : undefined;
  const activeLink =
    active?.kind === "link" ? graph.links.find((link) => link.id === active.id) : undefined;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const current = activeNode ?? null;
    const column = (c: number) => ordered.filter((node) => node.column === c);
    let next: Focus | null | undefined;
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        if (!current) next = ordered[0] ? { kind: "node", id: ordered[0].id } : null;
        else {
          const siblings = column(current.column);
          const index = siblings.indexOf(current) + (event.key === "ArrowDown" ? 1 : -1);
          const target = siblings[Math.max(0, Math.min(siblings.length - 1, index))];
          next = target ? { kind: "node", id: target.id } : null;
        }
        break;
      }
      case "ArrowLeft":
      case "ArrowRight": {
        if (!current) {
          next = ordered[0] ? { kind: "node", id: ordered[0].id } : null;
          break;
        }
        const delta = event.key === "ArrowRight" ? 1 : -1;
        let c = current.column + delta;
        while (c >= 0 && c <= lastColumn && column(c).length === 0) c += delta;
        const candidates = column(c);
        if (candidates.length === 0) {
          next = { kind: "node", id: current.id };
          break;
        }
        const mid = (current.y0 + current.y1) / 2;
        const target = candidates.reduce((best, node) =>
          Math.abs((node.y0 + node.y1) / 2 - mid) < Math.abs((best.y0 + best.y1) / 2 - mid)
            ? node
            : best,
        );
        next = { kind: "node", id: target.id };
        break;
      }
      case "Home":
        next = ordered[0] ? { kind: "node", id: ordered[0].id } : null;
        break;
      case "End": {
        const last = ordered[ordered.length - 1];
        next = last ? { kind: "node", id: last.id } : null;
        break;
      }
      case "Enter":
      case " ": {
        if (!current) break;
        const flows = current.outgoing.length > 0 ? current.outgoing : current.incoming;
        if (flows.length === 0) break;
        const index = activeLink ? flows.indexOf(activeLink) + 1 : 0;
        const link = flows[index % flows.length] as SankeyLink;
        next = { kind: "link", id: link.id };
        break;
      }
      case "Escape":
        next = activeLink && current ? { kind: "node", id: current.id } : null;
        break;
      default:
        return;
    }
    if (next === undefined) return;
    event.preventDefault();
    setHover(null);
    setActive(next);
  };

  const shown = hover
    ? hover
    : active
      ? active.kind === "node" && activeNode
        ? {
            focus: active,
            x: activeNode.column === lastColumn ? activeNode.x0 : activeNode.x1,
            y: top + (activeNode.y0 + activeNode.y1) / 2,
          }
        : activeLink
          ? {
              focus: active,
              x: (activeLink.source.x1 + activeLink.target.x0) / 2,
              y: top + (activeLink.y0 + activeLink.y1) / 2,
            }
          : null
      : null;

  const tip = shown ? tooltipContent(shown.focus, graph, colors, format, labels, total) : null;
  const valueText = activeLink
    ? linkText(activeLink, format, labels, total)
    : activeNode
      ? nodeText(activeNode, format, labels, total)
      : title;

  return (
    <div ref={containerRef} className="relative h-full w-full" style={{ height }}>
      <svg
        ref={svgRef}
        role="img"
        aria-label={title}
        width={width}
        height={height}
        className="block overflow-visible"
      >
        <defs>
          <clipPath id={`${uid}-reveal`}>
            <rect
              data-reveal=""
              x={-2}
              y={-2}
              width={width + 4}
              height={plotHeight + 4}
              style={{ transformBox: "fill-box", transformOrigin: "left center" }}
            />
          </clipPath>
          {linkColor === "gradient"
            ? graph.links.map((link, index) => (
                <linearGradient
                  key={link.id}
                  id={`${uid}-g${index}`}
                  gradientUnits="userSpaceOnUse"
                  x1={link.source.x1}
                  x2={link.target.x0}
                  y1={0}
                  y2={0}
                >
                  <stop offset="0%" style={{ stopColor: colors.get(link.source.id) }} />
                  <stop offset="100%" style={{ stopColor: colors.get(link.target.id) }} />
                </linearGradient>
              ))
            : null}
        </defs>
        {columnTitles && top > 0 ? (
          <g {...DECORATIVE}>
            {columnTitles.slice(0, graph.columns).map((name, c) => {
              const x = c * step + (c === 0 ? 0 : c === lastColumn ? nodeWidth : nodeWidth / 2);
              const anchor = c === 0 ? "start" : c === lastColumn ? "end" : "middle";
              const text = fitLabel(name, Math.max(40, step - 8), 11);
              return text ? (
                <text
                  key={name}
                  x={x}
                  y={12}
                  textAnchor={anchor}
                  className="select-none font-bold text-[11px] uppercase tracking-wide"
                  style={{ fill: "var(--ink-3)" }}
                >
                  {text}
                </text>
              ) : null;
            })}
          </g>
        ) : null}
        <g transform={`translate(0,${top})`}>
          <g clipPath={`url(#${uid}-reveal)`}>
            <SankeyLinks
              graph={graph}
              colors={colors}
              uid={uid}
              linkColor={linkColor}
              opacity={linkOpacity}
              lit={lit?.links ?? null}
              onEnter={(link, event) =>
                setHover({ focus: { kind: "link", id: link.id }, ...pointer(event) })
              }
              onLeave={() => setHover(null)}
              onClick={onLinkClick}
            />
          </g>
          <SankeyNodes
            graph={graph}
            colors={colors}
            lit={lit?.nodes ?? null}
            active={activeNode && !activeLink ? activeNode.id : null}
            inside={inside}
            onEnter={(node, event) =>
              setHover({ focus: { kind: "node", id: node.id }, ...pointer(event) })
            }
            onLeave={() => setHover(null)}
            onClick={onNodeClick}
          />
          <SankeyNodeLabels
            graph={graph}
            format={format}
            inside={inside}
            showValues={showValues}
            room={labelRoom}
            lit={lit?.nodes ?? null}
          />
        </g>
      </svg>

      <div
        role="slider"
        tabIndex={0}
        aria-label={labels.explore}
        aria-valuemin={1}
        aria-valuemax={Math.max(1, ordered.length)}
        aria-valuenow={activeNode ? ordered.indexOf(activeNode) + 1 : 1}
        aria-valuetext={valueText}
        onKeyDown={onKeyDown}
        onFocus={(event) => {
          if (event.currentTarget.matches(":focus-visible") && ordered[0]) {
            const first = ordered[0];
            setActive((current) => current ?? { kind: "node", id: first.id });
          }
        }}
        onBlur={() => setActive(null)}
        className="pointer-events-none absolute inset-0 rounded-xs outline-none focus-visible:outline-2 focus-visible:outline-accent-ink focus-visible:outline-offset-4"
      />

      {tooltip && shown && tip ? (
        <ChartTooltip
          x={shown.x}
          y={shown.y}
          containerWidth={width}
          title={tip.title}
          rows={tip.rows}
        />
      ) : null}
    </div>
  );
}

function tooltipContent(
  focus: Focus,
  graph: SankeyGraph,
  colors: Map<string, string>,
  format: ValueFormatter,
  labels: SankeyLabels,
  total: number,
): { title: string; rows: TooltipRow[] } | null {
  if (focus.kind === "link") {
    const link = graph.links.find((candidate) => candidate.id === focus.id);
    if (!link) return null;
    return {
      title: `${link.source.name} → ${link.target.name}`,
      rows: [
        {
          id: "value",
          name: labels.value,
          value: format(link.value),
          color: colors.get(link.source.id) as string,
        },
        {
          id: "source",
          name: `${labels.ofSource} ${link.source.name}`,
          value: percent(link.value / link.source.value),
          color: "transparent",
        },
        {
          id: "total",
          name: labels.ofTotal,
          value: percent(total > 0 ? link.value / total : 0),
          color: "transparent",
        },
      ],
    };
  }
  const node = graph.nodes.find((candidate) => candidate.id === focus.id);
  if (!node) return null;
  const color = colors.get(node.id) as string;
  const rows: TooltipRow[] = [
    {
      id: "value",
      name: labels.value,
      value: format(node.value),
      color,
      note: percent(total > 0 ? node.value / total : 0),
    },
  ];
  if (node.incoming.length > 0 && node.outgoing.length > 0 && node.inValue !== node.outValue) {
    rows.push(
      { id: "in", name: labels.incoming, value: format(node.inValue), color: "transparent" },
      { id: "out", name: labels.outgoing, value: format(node.outValue), color: "transparent" },
    );
  }
  const flows = node.outgoing.length > 0 ? node.outgoing : node.incoming;
  for (const link of [...flows].sort((a, b) => b.value - a.value).slice(0, 4)) {
    const other = link.source === node ? link.target : link.source;
    rows.push({
      id: link.id,
      name: `${link.source === node ? "→" : "←"} ${other.name}`,
      value: format(link.value),
      color: colors.get(other.id) as string,
      note: percent(link.value / node.value),
    });
  }
  return { title: node.name, rows };
}

function nodeText(
  node: SankeyNode,
  format: ValueFormatter,
  labels: SankeyLabels,
  total: number,
): string {
  const flows = node.outgoing.length > 0 ? node.outgoing : node.incoming;
  const parts = flows.map((link) => {
    const other = link.source === node ? link.target : link.source;
    return `${other.name} ${format(link.value)}`;
  });
  return `${node.name}: ${format(node.value)}, ${labels.ofTotal} ${percent(
    total > 0 ? node.value / total : 0,
  )}. ${parts.join(", ")}`;
}

function linkText(
  link: SankeyLink,
  format: ValueFormatter,
  labels: SankeyLabels,
  total: number,
): string {
  return `${link.source.name} → ${link.target.name}: ${format(link.value)}, ${percent(
    link.value / link.source.value,
  )} ${labels.ofSource} ${link.source.name}, ${percent(total > 0 ? link.value / total : 0)} ${labels.ofTotal}`;
}

interface SankeyLinksProps {
  graph: SankeyGraph;
  colors: Map<string, string>;
  uid: string;
  linkColor: NonNullable<SankeyChartProps["linkColor"]>;
  opacity: number;
  lit: ReadonlySet<string> | null;
  onEnter: (link: SankeyLink, event: PointerEvent<SVGPathElement>) => void;
  onLeave: () => void;
  onClick?: (link: SankeyLink) => void;
}

const SankeyLinks = memo(function SankeyLinks({
  graph,
  colors,
  uid,
  linkColor,
  opacity,
  lit,
  onEnter,
  onLeave,
  onClick,
}: SankeyLinksProps) {
  return (
    <g fill="none">
      {graph.links.map((link, index) => {
        const stroke =
          linkColor === "gradient"
            ? `url(#${uid}-g${index})`
            : linkColor === "source"
              ? colors.get(link.source.id)
              : linkColor === "target"
                ? colors.get(link.target.id)
                : "var(--ink-3)";
        const on = lit ? lit.has(link.id) : null;
        return (
          // biome-ignore lint/a11y/noStaticElementInteractions: pointer shortcut; keyboard users explore through the slider.
          <path
            key={link.id}
            d={sankeyLinkPath(link)}
            strokeWidth={Math.max(1, link.width)}
            className="cursor-pointer motion-safe:transition-[stroke-opacity] motion-safe:duration-150"
            style={{
              stroke,
              strokeOpacity: on === null ? opacity : on ? Math.min(1, opacity + 0.3) : 0.07,
            }}
            onPointerEnter={(event) => onEnter(link, event)}
            onPointerMove={(event) => onEnter(link, event)}
            onPointerLeave={onLeave}
            onClick={() => onClick?.(link)}
          />
        );
      })}
    </g>
  );
});

interface SankeyNodesProps {
  graph: SankeyGraph;
  colors: Map<string, string>;
  lit: ReadonlySet<string> | null;
  active: string | null;
  /** Labels sit on the bars: a soft fill keeps them readable. */
  inside: boolean;
  onEnter: (node: SankeyNode, event: PointerEvent<SVGRectElement>) => void;
  onLeave: () => void;
  onClick?: (node: SankeyNode) => void;
}

function SankeyNodes({
  graph,
  colors,
  lit,
  active,
  inside,
  onEnter,
  onLeave,
  onClick,
}: SankeyNodesProps) {
  return (
    <g>
      {graph.nodes.map((node) => (
        // biome-ignore lint/a11y/noStaticElementInteractions: pointer shortcut; keyboard users explore through the slider.
        <rect
          key={node.id}
          data-sankey-node=""
          x={node.x0}
          y={node.y0}
          width={node.x1 - node.x0}
          height={Math.max(1, node.y1 - node.y0)}
          rx={Math.min(3, (node.x1 - node.x0) / 2)}
          className="cursor-pointer motion-safe:transition-opacity motion-safe:duration-150"
          style={{
            fill: inside ? tint(colors.get(node.id) as string, 30) : colors.get(node.id),
            opacity: lit && !lit.has(node.id) ? 0.35 : 1,
            stroke: active === node.id ? "var(--ink)" : inside ? colors.get(node.id) : "none",
            strokeWidth: active === node.id ? 2 : 1,
            transformBox: "fill-box",
            transformOrigin: "center",
          }}
          onPointerEnter={(event) => onEnter(node, event)}
          onPointerMove={(event) => onEnter(node, event)}
          onPointerLeave={onLeave}
          onClick={() => onClick?.(node)}
        />
      ))}
    </g>
  );
}

interface SankeyNodeLabelsProps {
  graph: SankeyGraph;
  format: ValueFormatter;
  inside: boolean;
  showValues: boolean;
  /** Horizontal room for a label. */
  room: number;
  lit: ReadonlySet<string> | null;
}

/** Names (and values) beside or on the bars; hidden where they do not fit. */
function SankeyNodeLabels({ graph, format, inside, showValues, room, lit }: SankeyNodeLabelsProps) {
  if (room < 40) return null;
  const last = graph.columns - 1;
  return (
    <g {...DECORATIVE} className="pointer-events-none select-none">
      {graph.nodes.map((node) => {
        const tall = node.y1 - node.y0;
        if (tall < 10) return null;
        const end = !inside && node.column === last && last > 0;
        const x = inside ? node.x0 + 6 : end ? node.x0 - LABEL_GAP : node.x1 + LABEL_GAP;
        const name = fitLabel(node.name, room, 12);
        if (!name) return null;
        const value = format(node.value);
        const twoLines = showValues && tall >= 32;
        const oneLine =
          showValues &&
          !twoLines &&
          name === node.name &&
          estimateTextWidth(`${node.name}  ${value}`, 12) <= room;
        const y = (node.y0 + node.y1) / 2;
        return (
          <text
            key={node.id}
            x={x}
            y={twoLines ? y - 7 : y}
            dominantBaseline="middle"
            textAnchor={end ? "end" : "start"}
            className="font-semibold text-[12px] motion-safe:transition-opacity motion-safe:duration-150"
            style={{
              fill: "var(--ink)",
              opacity: lit && !lit.has(node.id) ? 0.4 : 1,
            }}
          >
            {name}
            {oneLine ? (
              <tspan dx={6} className="font-bold tabular-nums" style={{ fill: "var(--ink-3)" }}>
                {value}
              </tspan>
            ) : null}
            {twoLines ? (
              <tspan
                x={x}
                dy={15}
                className="font-bold text-[11px] tabular-nums"
                style={{ fill: inside ? "var(--ink-2)" : "var(--ink-3)" }}
              >
                {value}
              </tspan>
            ) : null}
          </text>
        );
      })}
    </g>
  );
}
