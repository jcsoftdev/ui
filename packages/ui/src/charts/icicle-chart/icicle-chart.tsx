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
} from "../core/hierarchy.js";
import {
  branchColor,
  describeNode,
  fitLabel,
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

export interface IcicleChartProps {
  /** Accessible name of the drawing and caption of the data table. */
  title: string;
  /** Root of the tree; it fills the first band. */
  data: HierarchyDatum;
  /** Height of the drawing in pixels. */
  height?: number;
  /** "horizontal": levels run left to right; "vertical": top to bottom. */
  orientation?: "horizontal" | "vertical";
  valueFormat?: ValueFormat;
  /** Bands shown after the open node. */
  levels?: number;
  /** Click a cell to zoom into it, the first band (or Escape) to zoom out. */
  drillDown?: boolean;
  breadcrumb?: boolean;
  /** Read-only legend of the open level's branches. */
  legend?: boolean;
  tooltip?: boolean;
  /** Gap between cells in pixels. */
  gap?: number;
  radius?: number;
  sort?: boolean;
  animate?: boolean;
  loading?: boolean;
  labels?: Partial<HierarchyLabels>;
  onFocusChange?: (node: HierarchyNode) => void;
  /** Click on a cell that cannot be opened (a leaf). */
  onNodeClick?: (node: HierarchyNode) => void;
  className?: string;
}

/**
 * Rectangular partition: the open node fills the first band and each band
 * after it splits its parent by value. Drill-down zooms the clicked cell to the
 * full extent with an animated transition, like the sunburst.
 */
export function IcicleChart({
  title,
  data,
  height = 340,
  orientation = "horizontal",
  valueFormat,
  levels = 3,
  drillDown = true,
  breadcrumb = true,
  legend = true,
  tooltip = true,
  gap = 2,
  radius = 4,
  sort = true,
  animate = true,
  loading,
  labels: labelsProp,
  onFocusChange,
  onNodeClick,
  className,
}: IcicleChartProps) {
  const labels = resolveHierarchyLabels(labelsProp);
  const format = useMemo(() => resolveFormat(valueFormat), [valueFormat]);
  const drill = useDrill(data, sort, onFocusChange);
  return (
    <ChartFrame
      height={height}
      labels={labels}
      loading={loading}
      empty={drill.root.value <= 0}
      skeleton="bars"
      className={cn(HIERARCHY_FRAME_CLASS, className)}
      legend={
        breadcrumb && drillDown ? (
          <HierarchyHeader path={drill.path} onSelect={drill.drill} labels={labels} />
        ) : null
      }
      footer={legend ? <HierarchyLegend focus={drill.focus} /> : null}
      table={<HierarchyTable root={drill.root} caption={title} format={format} labels={labels} />}
    >
      {(width) => (
        <IciclePlot
          width={width}
          height={height}
          title={title}
          drill={drill}
          format={format}
          labels={labels}
          levels={Math.max(1, Math.round(levels))}
          horizontal={orientation === "horizontal"}
          drillDown={drillDown}
          tooltip={tooltip}
          gap={gap}
          radius={radius}
          animate={animate}
          onNodeClick={onNodeClick}
        />
      )}
    </ChartFrame>
  );
}

interface IciclePlotProps {
  width: number;
  height: number;
  title: string;
  drill: DrillState;
  format: ValueFormatter;
  labels: HierarchyLabels;
  levels: number;
  horizontal: boolean;
  drillDown: boolean;
  tooltip: boolean;
  gap: number;
  radius: number;
  animate: boolean;
  onNodeClick?: (node: HierarchyNode) => void;
}

const MIN_BAND = 84;

interface Cell {
  node: HierarchyNode;
  x: number;
  y: number;
  width: number;
  height: number;
}

function IciclePlot({
  width,
  height,
  title,
  drill,
  format,
  labels,
  levels,
  horizontal,
  drillDown,
  tooltip,
  gap,
  radius,
  animate,
  onNodeClick,
}: IciclePlotProps) {
  const { root, focus } = drill;
  const spans = useMemo(() => partitionLayout(root), [root]);
  const nodes = useMemo(() => descendants(root), [root]);
  const focusSpan = spans.get(focus.id) ?? { x0: 0, x1: 1 };
  const view = useAnimatedView(
    { x0: focusSpan.x0, x1: focusSpan.x1, depth: focus.depth },
    { disabled: !animate },
  );

  const depthExtent = horizontal ? width : height;
  const breadthExtent = horizontal ? height : width;
  // Narrow containers drop the deepest bands before they get too thin to read.
  const visibleLevels = Math.max(1, Math.min(levels, Math.floor(depthExtent / MIN_BAND) - 1));
  const bands = visibleLevels + 1;
  const band = depthExtent / bands;

  const cells = useMemo(() => {
    const out: Cell[] = [];
    for (const node of nodes) {
      const span = spans.get(node.id);
      if (!span) continue;
      const projected = projectSpan(span, node.depth, view);
      const d0 = Math.max(0, Math.min(depthExtent, projected.level * band));
      const d1 = Math.max(0, Math.min(depthExtent, (projected.level + 1) * band));
      const b0 = Math.max(0, Math.min(1, projected.x0)) * breadthExtent;
      const b1 = Math.max(0, Math.min(1, projected.x1)) * breadthExtent;
      const depthSize = d1 - d0 - gap;
      const breadthSize = b1 - b0 - gap;
      if (depthSize < 0.5 || breadthSize < 0.5) continue;
      out.push(
        horizontal
          ? { node, x: d0 + gap / 2, y: b0 + gap / 2, width: depthSize, height: breadthSize }
          : { node, x: b0 + gap / 2, y: d0 + gap / 2, width: breadthSize, height: depthSize },
      );
    }
    return out;
  }, [nodes, spans, view, depthExtent, breadthExtent, band, gap, horizontal]);

  const [hover, setHover] = useState<{ cell: Cell; x: number; y: number } | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEntryAnimation(
    svgRef,
    (element) => {
      element.querySelectorAll("[data-band]").forEach((group, index) => {
        group.animate(
          [
            { opacity: 0, transform: horizontal ? "translateX(-12px)" : "translateY(-12px)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 520, delay: index * 90, easing: EASE_OUT, fill: "backwards" },
        );
      });
    },
    { disabled: !animate },
  );

  const children = focus.children;
  const hit = (x: number, y: number): Cell | null => {
    for (let i = cells.length - 1; i >= 0; i--) {
      const cell = cells[i] as Cell;
      if (x >= cell.x && x <= cell.x + cell.width && y >= cell.y && y <= cell.y + cell.height) {
        return cell;
      }
    }
    return null;
  };

  const local = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  const open = (node: HierarchyNode) => {
    if (node.id === focus.id) {
      if (drillDown) drill.up();
      return;
    }
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
    const cell = hit(x, y);
    setHover(cell ? { cell, x, y } : null);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const { x, y } = local(event);
    const cell = hit(x, y);
    if (cell) open(cell.node);
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
  const activeCell = activeNode ? cells.find((cell) => cell.node === activeNode) : undefined;
  const lit = hover?.cell.node ?? activeNode ?? null;
  const litPath = useMemo(() => {
    const ids = new Set<string>();
    for (let current = lit; current; current = current.parent) ids.add(current.id);
    return ids;
  }, [lit]);

  const shown = hover
    ? { node: hover.cell.node, x: hover.x, y: hover.y }
    : activeCell
      ? {
          node: activeCell.node,
          x: activeCell.x + activeCell.width / 2,
          y: activeCell.y + activeCell.height / 2,
        }
      : null;
  const hoverNode = hover?.cell.node;
  const clickable =
    hoverNode != null &&
    ((drillDown && (hoverNode.children.length > 0 || (hoverNode === focus && focus.parent))) ||
      (onNodeClick != null && hoverNode.children.length === 0));

  const byLevel = new Map<number, Cell[]>();
  for (const cell of cells) {
    const level = Math.round(cell.node.depth - view.depth);
    const list = byLevel.get(level) ?? [];
    list.push(cell);
    byLevel.set(level, list);
  }

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
        {[...byLevel.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([level, list]) => (
            <g key={level} data-band="">
              {list.map((cell) => (
                <IcicleCell
                  key={cell.node.id}
                  cell={cell}
                  focus={focus}
                  radius={radius}
                  format={format}
                  dimmed={lit != null && !litPath.has(cell.node.id) && cell.node !== focus}
                />
              ))}
            </g>
          ))}
        {activeCell ? (
          <rect
            x={activeCell.x - 1}
            y={activeCell.y - 1}
            width={activeCell.width + 2}
            height={activeCell.height + 2}
            rx={radius + 1}
            strokeWidth={2}
            className="pointer-events-none"
            style={{ fill: "none", stroke: "var(--ink)" }}
          />
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
        onPointerLeave={() => setHover(null)}
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
            shown.node.parent && shown.node.parent !== focus && shown.node !== focus
              ? nodePath(shown.node.parent, focus)
              : focus.name
          }
          rows={nodeTooltipRows(shown.node, focus, format, labels, branchColor(shown.node, focus))}
        />
      ) : null}
    </div>
  );
}

function IcicleCell({
  cell,
  focus,
  radius,
  format,
  dimmed,
}: {
  cell: Cell;
  focus: HierarchyNode;
  radius: number;
  format: ValueFormatter;
  dimmed: boolean;
}) {
  const isFocus = cell.node.depth <= focus.depth;
  const strength = isFocus ? 0 : levelStrength(cell.node, focus);
  const fill = isFocus ? "var(--surface-2)" : tint(branchColor(cell.node, focus), strength);
  const ink = isFocus ? "var(--ink)" : inkOn(strength);
  const name = cell.node.name;
  const value = format(cell.node.value);
  const label = cell.height >= 20 ? fitLabel(name, cell.width - 14) : null;
  const nameFits = label != null;
  const valueFits =
    nameFits && cell.height >= 38 && cell.width >= estimateTextWidth(value, 11) + 14;
  return (
    <g style={{ opacity: dimmed ? 0.4 : 1, transition: "opacity 150ms ease-out" }}>
      <rect
        x={cell.x}
        y={cell.y}
        width={cell.width}
        height={cell.height}
        rx={Math.min(radius, cell.width / 2, cell.height / 2)}
        style={{ fill }}
      />
      {nameFits ? (
        <text
          x={cell.x + 7}
          y={cell.y + 16}
          className="pointer-events-none select-none font-semibold text-[12px]"
          style={{ fill: ink }}
        >
          {label}
          {valueFits ? (
            <tspan
              x={cell.x + 7}
              dy={16}
              className="font-bold text-[11px] tabular-nums"
              style={{ fill: ink, opacity: 0.78 }}
            >
              {value}
            </tspan>
          ) : null}
        </text>
      ) : null}
    </g>
  );
}
