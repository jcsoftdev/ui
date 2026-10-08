"use client";

import { type KeyboardEvent, type PointerEvent, useMemo, useRef, useState } from "react";
import { cn } from "../../utils/cn.js";
import { estimateTextWidth } from "../core/axes.js";
import { ChartFrame } from "../core/chart-frame.js";
import { inkOn, tint } from "../core/color-scale.js";
import { resolveFormat, type ValueFormat, type ValueFormatter } from "../core/format.js";
import {
  descendants,
  type HierarchyDatum,
  type HierarchyNode,
  partitionLayout,
  projectSpan,
  sectorPath,
} from "../core/hierarchy.js";
import {
  branchColor,
  describeNode,
  HIERARCHY_FRAME_CLASS,
  HierarchyHeader,
  type HierarchyLabels,
  HierarchyLegend,
  HierarchyTable,
  hierarchyKey,
  levelStrength,
  nodePath,
  nodeTooltipRows,
  resolveHierarchyLabels,
} from "../core/hierarchy-chart.js";
import { EASE_OUT, useEntryAnimation } from "../core/motion.js";
import { ChartTooltip } from "../core/tooltip.js";
import { type DrillState, useAnimatedView, useDrill } from "../core/use-drill.js";

export interface SunburstChartProps {
  /** Accessible name of the drawing and caption of the data table. */
  title: string;
  /** Root of the tree; its name and total sit in the center. */
  data: HierarchyDatum;
  /** Height of the drawing; the disc takes the smaller of width and height. */
  height?: number | "fill";
  /** Width / height ratio; sizes the drawing from the container width when `height` is not "fill". */
  aspectRatio?: number;
  valueFormat?: ValueFormat;
  /** Rings shown around the open node. */
  levels?: number;
  /** Click a segment to zoom into it, the center to zoom out. */
  drillDown?: boolean;
  breadcrumb?: boolean;
  /** Read-only legend of the open level's branches. */
  legend?: boolean;
  tooltip?: boolean;
  /** Name and total of the open node in the center. */
  centerLabel?: boolean;
  /** Labels along the segments where they fit. */
  segmentLabels?: boolean;
  /** Gap between segments in pixels (measured at the inner ring). */
  gap?: number;
  sort?: boolean;
  animate?: boolean;
  loading?: boolean;
  labels?: Partial<HierarchyLabels>;
  onFocusChange?: (node: HierarchyNode) => void;
  /** Click on a segment that cannot be opened (a leaf). */
  onNodeClick?: (node: HierarchyNode) => void;
  className?: string;
}

/**
 * Radial partition: the open node in the center, its descendants in rings,
 * each slice proportional to value. Clicking a segment zooms into it with an
 * animated transition; the center or Escape zooms back out.
 */
export function SunburstChart({
  title,
  data,
  height = 360,
  aspectRatio,
  valueFormat,
  levels = 3,
  drillDown = true,
  breadcrumb = true,
  legend = true,
  tooltip = true,
  centerLabel = true,
  segmentLabels = true,
  gap = 1.5,
  sort = true,
  animate = true,
  loading,
  labels: labelsProp,
  onFocusChange,
  onNodeClick,
  className,
}: SunburstChartProps) {
  const labels = resolveHierarchyLabels(labelsProp);
  const format = useMemo(() => resolveFormat(valueFormat), [valueFormat]);
  const drill = useDrill(data, sort, onFocusChange);
  return (
    <ChartFrame
      height={height}
      aspectRatio={aspectRatio}
      labels={labels}
      loading={loading}
      empty={drill.root.value <= 0}
      skeleton="ring"
      className={cn(HIERARCHY_FRAME_CLASS, className)}
      legend={
        breadcrumb && drillDown ? (
          <HierarchyHeader path={drill.path} onSelect={drill.drill} labels={labels} />
        ) : null
      }
      footer={legend ? <HierarchyLegend focus={drill.focus} /> : null}
      table={<HierarchyTable root={drill.root} caption={title} format={format} labels={labels} />}
    >
      {(width, measuredHeight) => (
        <SunburstPlot
          width={width}
          height={measuredHeight}
          title={title}
          drill={drill}
          format={format}
          labels={labels}
          levels={Math.max(1, Math.round(levels))}
          drillDown={drillDown}
          tooltip={tooltip}
          centerLabel={centerLabel}
          segmentLabels={segmentLabels}
          gap={gap}
          animate={animate}
          onNodeClick={onNodeClick}
        />
      )}
    </ChartFrame>
  );
}

interface SunburstPlotProps {
  width: number;
  height: number;
  title: string;
  drill: DrillState;
  format: ValueFormatter;
  labels: HierarchyLabels;
  levels: number;
  drillDown: boolean;
  tooltip: boolean;
  centerLabel: boolean;
  segmentLabels: boolean;
  gap: number;
  animate: boolean;
  onNodeClick?: (node: HierarchyNode) => void;
}

const TAU = Math.PI * 2;

const MIN_RING = 30;

interface Arc {
  node: HierarchyNode;
  r0: number;
  r1: number;
  a0: number;
  a1: number;
}

function truncate(text: string, maxWidth: number, fontSize: number): string {
  if (estimateTextWidth(text, fontSize) <= maxWidth) return text;
  const chars = Math.max(1, Math.floor(maxWidth / (fontSize * 0.58)) - 1);
  return `${text.slice(0, chars)}…`;
}

function SunburstPlot({
  width,
  height,
  title,
  drill,
  format,
  labels,
  levels,
  drillDown,
  tooltip,
  centerLabel,
  segmentLabels,
  gap,
  animate,
  onNodeClick,
}: SunburstPlotProps) {
  const { root, focus } = drill;
  const spans = useMemo(() => partitionLayout(root), [root]);
  const nodes = useMemo(() => descendants(root).slice(1), [root]);
  const focusSpan = spans.get(focus.id) ?? { x0: 0, x1: 1 };
  const view = useAnimatedView(
    { x0: focusSpan.x0, x1: focusSpan.x1, depth: focus.depth },
    { disabled: !animate },
  );

  const size = Math.max(0, Math.min(width, height));
  const cx = width / 2;
  const cy = height / 2;
  const outer = Math.max(0, size / 2 - 4);
  // Small discs drop the outer rings before they get too thin to read.
  const visibleLevels = Math.max(1, Math.min(levels, Math.floor((outer * 0.72) / MIN_RING)));
  const center = outer * (visibleLevels > 2 ? 0.26 : 0.32);
  const ring = (outer - center) / visibleLevels;
  const arcs = useMemo(() => {
    const radius = (level: number) =>
      level <= 1 ? center : Math.min(outer, center + (level - 1) * ring);
    const out: Arc[] = [];
    for (const node of nodes) {
      const span = spans.get(node.id);
      if (!span) continue;
      const projected = projectSpan(span, node.depth, view);
      const r0 = radius(projected.level);
      const r1 = radius(projected.level + 1);
      const a0 = Math.max(0, Math.min(1, projected.x0)) * TAU;
      const a1 = Math.max(0, Math.min(1, projected.x1)) * TAU;
      if (r1 - r0 < 0.5 || a1 - a0 < 1e-4) continue;
      out.push({ node, r0, r1, a0, a1 });
    }
    return out;
  }, [nodes, spans, view, center, ring, outer]);

  const [hover, setHover] = useState<{ arc: Arc; x: number; y: number } | null>(null);
  const [hoverCenter, setHoverCenter] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEntryAnimation(
    svgRef,
    (element) => {
      const group = element.querySelector("[data-rings]");
      group?.animate(
        [
          { opacity: 0, transform: "rotate(-24deg) scale(0.82)" },
          { opacity: 1, transform: "rotate(0deg) scale(1)" },
        ],
        { duration: 760, easing: EASE_OUT, fill: "backwards" },
      );
    },
    { disabled: !animate },
  );

  const children = focus.children;
  const hit = (x: number, y: number): Arc | "center" | null => {
    const dx = x - cx;
    const dy = y - cy;
    const r = Math.hypot(dx, dy);
    if (r <= center) return "center";
    const angle = (Math.atan2(dx, -dy) + TAU) % TAU;
    for (let i = arcs.length - 1; i >= 0; i--) {
      const arc = arcs[i] as Arc;
      if (r >= arc.r0 && r <= arc.r1 && angle >= arc.a0 && angle <= arc.a1) return arc;
    }
    return null;
  };

  const local = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  const open = (node: HierarchyNode) => {
    if (drillDown && node.children.length > 0) {
      drill.drill(node.id);
      setHover(null);
      setActive((current) => (current == null ? null : 0));
    } else {
      onNodeClick?.(node);
    }
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const { x, y } = local(event);
    const target = hit(x, y);
    setHoverCenter(target === "center");
    setHover(target && target !== "center" ? { arc: target, x, y } : null);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const { x, y } = local(event);
    const target = hit(x, y);
    if (target === "center") {
      if (drillDown) drill.up();
    } else if (target) {
      open(target.node);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = hierarchyKey(event.key, active, children.length);
    if (next === undefined) return;
    event.preventDefault();
    if (next === "up") {
      if (drillDown && drill.up()) setActive(0);
      else setActive(null);
    } else if (next === "drill") {
      const node = active != null ? children[active] : undefined;
      if (node) open(node);
    } else {
      setActive(next);
      setHover(null);
    }
  };

  const activeNode = active != null ? children[active] : undefined;
  const activeArc = activeNode ? arcs.find((arc) => arc.node === activeNode) : undefined;
  const lit = hover?.arc.node ?? activeNode ?? null;
  const litPath = useMemo(() => {
    const ids = new Set<string>();
    for (let current = lit; current; current = current.parent) ids.add(current.id);
    return ids;
  }, [lit]);

  const shown = hover
    ? { node: hover.arc.node, x: hover.x, y: hover.y }
    : activeArc
      ? (() => {
          const mid = (activeArc.a0 + activeArc.a1) / 2;
          const r = (activeArc.r0 + activeArc.r1) / 2;
          return { node: activeArc.node, x: cx + r * Math.sin(mid), y: cy - r * Math.cos(mid) };
        })()
      : null;
  const clickable =
    (hover && ((drillDown && hover.arc.node.children.length > 0) || onNodeClick)) ||
    (hoverCenter && drillDown && focus.parent);

  return (
    <div className="relative h-full w-full">
      <svg
        ref={svgRef}
        role="img"
        aria-label={title}
        width={width}
        height={height}
        className="block overflow-visible"
      >
        <g data-rings="" style={{ transformOrigin: `${cx}px ${cy}px` }}>
          {arcs.map((arc) => {
            const base = branchColor(arc.node, focus);
            const strength = levelStrength(arc.node, focus);
            const dimmed = lit != null && !litPath.has(arc.node.id) && arc.node.depth > focus.depth;
            const padAngle = gap / Math.max(arc.r0, 1);
            return (
              <path
                key={arc.node.id}
                d={sectorPath(cx, cy, arc.r0 + gap / 2, arc.r1 - gap / 2, arc.a0, arc.a1, padAngle)}
                style={{
                  fill: tint(base, strength),
                  opacity: dimmed ? 0.38 : 1,
                  transition: "opacity 150ms ease-out",
                }}
              />
            );
          })}
          {segmentLabels
            ? arcs.map((arc) => (
                <SegmentLabel
                  key={arc.node.id}
                  arc={arc}
                  cx={cx}
                  cy={cy}
                  ink={inkOn(levelStrength(arc.node, focus))}
                  dimmed={lit != null && !litPath.has(arc.node.id)}
                />
              ))
            : null}
        </g>
        {activeArc ? (
          <path
            d={sectorPath(cx, cy, activeArc.r0, activeArc.r1, activeArc.a0, activeArc.a1)}
            strokeWidth={2}
            className="pointer-events-none"
            style={{ fill: "none", stroke: "var(--ink)" }}
          />
        ) : null}
        <circle
          cx={cx}
          cy={cy}
          r={Math.max(0, center - gap - 2)}
          style={{
            fill: hoverCenter && focus.parent && drillDown ? "var(--surface-2)" : "var(--surface)",
            transition: "fill 150ms ease-out",
          }}
        />
        {centerLabel && center > 24 ? (
          <g className="pointer-events-none select-none" textAnchor="middle">
            {focus.parent && drillDown ? (
              <path
                d={`M${cx - 5},${cy - 22}l5,-5l5,5`}
                fill="none"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ stroke: "var(--ink-3)" }}
              />
            ) : null}
            <text
              x={cx}
              y={cy - 4}
              className="font-semibold text-[12px]"
              style={{ fill: "var(--ink-3)" }}
            >
              {truncate(focus.name, center * 1.7, 12)}
            </text>
            <text
              x={cx}
              y={cy + 16}
              className="font-bold text-[17px] tabular-nums"
              style={{ fill: "var(--ink)" }}
            >
              {truncate(format(focus.value), center * 1.8, 17)}
            </text>
          </g>
        ) : null}
      </svg>

      <div
        role="slider"
        tabIndex={0}
        aria-label={labels.explore}
        aria-valuemin={1}
        aria-valuemax={Math.max(1, children.length)}
        aria-valuenow={(active ?? 0) + 1}
        aria-valuetext={
          activeNode
            ? describeNode(activeNode, focus, format)
            : `${focus.name}: ${format(focus.value)}`
        }
        onKeyDown={onKeyDown}
        onFocus={(event) => {
          if (event.currentTarget.matches(":focus-visible")) setActive((current) => current ?? 0);
        }}
        onBlur={() => setActive(null)}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => {
          setHover(null);
          setHoverCenter(false);
        }}
        className={cn(
          "absolute inset-0 rounded-xs outline-none focus-visible:outline-2 focus-visible:outline-accent-ink focus-visible:outline-offset-4",
          clickable ? "cursor-pointer" : "cursor-default",
        )}
      />

      {tooltip && shown ? (
        <ChartTooltip
          x={shown.x}
          y={shown.y}
          containerWidth={width}
          title={
            shown.node.parent && shown.node.parent !== focus
              ? nodePath(shown.node.parent, focus)
              : focus.name
          }
          rows={nodeTooltipRows(shown.node, focus, format, labels, branchColor(shown.node, focus))}
        />
      ) : null}
    </div>
  );
}

function SegmentLabel({
  arc,
  cx,
  cy,
  ink,
  dimmed,
}: {
  arc: Arc;
  cx: number;
  cy: number;
  ink: string;
  dimmed: boolean;
}) {
  const thickness = arc.r1 - arc.r0;
  const mid = (arc.a0 + arc.a1) / 2;
  const r = (arc.r0 + arc.r1) / 2;
  const arcLength = (arc.a1 - arc.a0) * r;
  const name = arc.node.name;
  const textWidth = estimateTextWidth(name, 11);
  // Radial (along the radius) when the ring is thick enough, otherwise
  // tangential (along the arc, upright) when the slice is wide enough.
  const radial = arcLength >= 14 && thickness >= textWidth + 10;
  const tangential = !radial && thickness >= 15 && arcLength >= textWidth + 12;
  if (!radial && !tangential) return null;
  const degrees = (mid * 180) / Math.PI;
  const rotate = radial
    ? degrees < 180
      ? degrees - 90
      : degrees + 90
    : degrees > 90 && degrees < 270
      ? degrees - 180
      : degrees;
  const x = cx + r * Math.sin(mid);
  const y = cy - r * Math.cos(mid);
  return (
    <text
      x={x}
      y={y}
      transform={`rotate(${rotate.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)})`}
      textAnchor="middle"
      dominantBaseline="central"
      className="pointer-events-none select-none font-semibold text-[11px]"
      style={{ fill: ink, opacity: dimmed ? 0.4 : 1, transition: "opacity 150ms ease-out" }}
    >
      {name}
    </text>
  );
}
