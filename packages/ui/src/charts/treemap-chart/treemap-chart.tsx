"use client";

import { type KeyboardEvent, memo, type PointerEvent, useMemo, useRef, useState } from "react";
import { cn } from "../../utils/cn.js";
import { estimateTextWidth } from "../core/axes.js";
import { ChartFrame } from "../core/chart-frame.js";
import { inkOn, tint } from "../core/color-scale.js";
import { resolveFormat, type ValueFormat, type ValueFormatter } from "../core/format.js";
import type { HierarchyDatum, HierarchyNode, TreemapCell } from "../core/hierarchy.js";
import { treemapLayout } from "../core/hierarchy.js";
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
  nodePath,
  nodeTooltipRows,
  resolveHierarchyLabels,
} from "../core/hierarchy-chart.js";
import { EASE_OUT, useEntryAnimation } from "../core/motion.js";
import { ChartTooltip } from "../core/tooltip.js";
import { type DrillState, useDrill } from "../core/use-drill.js";

export interface TreemapChartProps {
  /** Accessible name of the drawing and caption of the data table. */
  title: string;
  /** Root of the tree; its name is the first breadcrumb item. */
  data: HierarchyDatum;
  /** Height of the drawing in pixels. */
  height?: number | "fill";
  /** Width / height ratio; sizes the drawing from the container width when `height` is not "fill". */
  aspectRatio?: number;
  valueFormat?: ValueFormat;
  /** Levels drawn at once below the open node; deeper ones appear after drilling. */
  depth?: number;
  /** Click (or Enter) on a group opens it. */
  drillDown?: boolean;
  /** Path of the open node above the drawing. */
  breadcrumb?: boolean;
  /** Read-only legend of the open level's branches. */
  legend?: boolean;
  tooltip?: boolean;
  /** Gap between cells in pixels. */
  gap?: number;
  /** Corner radius of the cells. */
  radius?: number;
  /** Largest first (default) or data order. */
  sort?: boolean;
  animate?: boolean;
  loading?: boolean;
  labels?: Partial<HierarchyLabels>;
  /** Called with the open node after drilling in or out. */
  onFocusChange?: (node: HierarchyNode) => void;
  /** Click on a cell that cannot be opened (a leaf). */
  onNodeClick?: (node: HierarchyNode) => void;
  className?: string;
}

/**
 * Squarified treemap: areas proportional to value, nested groups with a
 * header band, click a group to open it (breadcrumb to go back). Each branch
 * wears one palette hue; its children are spread over lighter and darker
 * tints of it. Labels only show where they fit.
 */
export function TreemapChart({
  title,
  data,
  height = 360,
  aspectRatio,
  valueFormat,
  depth = 2,
  drillDown = true,
  breadcrumb = true,
  legend = true,
  tooltip = true,
  gap = 3,
  radius = 6,
  sort = true,
  animate = true,
  loading,
  labels: labelsProp,
  onFocusChange,
  onNodeClick,
  className,
}: TreemapChartProps) {
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
      {(width, measuredHeight) => (
        <TreemapPlot
          width={width}
          height={measuredHeight}
          title={title}
          drill={drill}
          format={format}
          labels={labels}
          depth={depth}
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

interface TreemapPlotProps {
  width: number;
  height: number;
  title: string;
  drill: DrillState;
  format: ValueFormatter;
  labels: HierarchyLabels;
  depth: number;
  drillDown: boolean;
  tooltip: boolean;
  gap: number;
  radius: number;
  animate: boolean;
  onNodeClick?: (node: HierarchyNode) => void;
}

const HEADER = 24;

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

function TreemapPlot({
  width,
  height,
  title,
  drill,
  format,
  labels,
  depth,
  drillDown,
  tooltip,
  gap,
  radius,
  animate,
  onNodeClick,
}: TreemapPlotProps) {
  const { focus } = drill;
  const cells = useMemo(
    () =>
      treemapLayout(
        focus,
        { x0: 0, y0: 0, x1: width, y1: height },
        { maxDepth: depth, gap, headerHeight: HEADER, padding: 4 },
      ),
    [focus, width, height, depth, gap],
  );
  const [hover, setHover] = useState<{ cell: TreemapCell; x: number; y: number } | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEntryAnimation(
    svgRef,
    (root) => {
      root.querySelectorAll("[data-cell]").forEach((element, index) => {
        element.animate(
          [
            { opacity: 0, transform: "scale(0.94)" },
            { opacity: 1, transform: "scale(1)" },
          ],
          { duration: 460, delay: Math.min(index * 14, 280), easing: EASE_OUT, fill: "backwards" },
        );
      });
    },
    { disabled: !animate, replayKey: focus.id },
  );

  const hit = (x: number, y: number): TreemapCell | null => {
    for (let i = cells.length - 1; i >= 0; i--) {
      const cell = cells[i] as TreemapCell;
      if (x >= cell.x0 && x <= cell.x1 && y >= cell.y0 && y <= cell.y1) return cell;
    }
    return null;
  };

  const local = (event: PointerEvent<HTMLDivElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  const open = (node: HierarchyNode) => {
    const target = topLevel(node, focus);
    if (drillDown && target.children.length > 0) {
      drill.drill(target.id);
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

  const children = focus.children;
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = hierarchyKey(event.key, active, children.length);
    if (next === undefined) return;
    event.preventDefault();
    if (next === "up") {
      if (drill.up()) setActive(0);
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
  const shown = hover
    ? { node: hover.cell.node, x: hover.x, y: hover.y }
    : activeCell
      ? {
          node: activeCell.node,
          x: (activeCell.x0 + activeCell.x1) / 2,
          y: (activeCell.y0 + activeCell.y1) / 2,
        }
      : null;
  const hoverTop = hover ? topLevel(hover.cell.node, focus) : null;
  const drillable = drillDown && hoverTop != null && hoverTop.children.length > 0;

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
        <TreemapCells cells={cells} focus={focus} radius={radius} format={format} />
        {hover ? (
          <rect
            x={hover.cell.x0 + 0.75}
            y={hover.cell.y0 + 0.75}
            width={Math.max(0, hover.cell.x1 - hover.cell.x0 - 1.5)}
            height={Math.max(0, hover.cell.y1 - hover.cell.y0 - 1.5)}
            rx={Math.max(0, radius - 1)}
            strokeWidth={1.5}
            className="pointer-events-none"
            style={{ fill: "none", stroke: branchColor(hover.cell.node, focus) }}
          />
        ) : null}
        {activeCell ? (
          <rect
            x={activeCell.x0 - 1}
            y={activeCell.y0 - 1}
            width={activeCell.x1 - activeCell.x0 + 2}
            height={activeCell.y1 - activeCell.y0 + 2}
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
        aria-valuetext={activeNode ? describeNode(activeNode, focus, format) : focus.name}
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
          drillable || (hover && onNodeClick) ? "cursor-pointer" : "cursor-default",
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

interface TreemapCellsProps {
  cells: readonly TreemapCell[];
  focus: HierarchyNode;
  radius: number;
  format: ValueFormatter;
}

/** Static cells; hover and keyboard state are drawn on top, so this only re-renders on layout changes. */
const TreemapCells = memo(function TreemapCells({
  cells,
  focus,
  radius,
  format,
}: TreemapCellsProps) {
  return (
    <g>
      {cells.map((cell) => {
        const width = cell.x1 - cell.x0;
        const height = cell.y1 - cell.y0;
        const base = branchColor(cell.node, focus);
        const strength = cellStrength(cell);
        const ink = inkOn(strength);
        const name = cell.node.name;
        const value = format(cell.node.value);
        const label = height >= 24 ? fitLabel(name, width - 16) : null;
        const nameFits = label != null;
        const valueFits = cell.group
          ? label === name && width >= estimateTextWidth(`${name}${value}`, 12) + 30
          : nameFits && height >= 44 && width >= estimateTextWidth(value, 11) + 16;
        return (
          <g
            key={cell.node.id}
            data-cell=""
            style={{ transformBox: "fill-box", transformOrigin: "center" }}
          >
            <rect
              x={cell.x0}
              y={cell.y0}
              width={width}
              height={height}
              rx={Math.min(radius, width / 2, height / 2)}
              style={{ fill: tint(base, strength) }}
            />
            {cell.group ? (
              <text
                x={cell.x0 + 8}
                y={cell.y0 + 16}
                className="pointer-events-none select-none font-bold text-fs-120"
                style={{ fill: "var(--ink)" }}
              >
                {label}
                {valueFits ? (
                  <tspan dx={6} className="font-semibold" style={{ fill: "var(--ink-3)" }}>
                    {value}
                  </tspan>
                ) : null}
              </text>
            ) : nameFits ? (
              <text
                x={cell.x0 + 8}
                y={cell.y0 + 18}
                className="pointer-events-none select-none font-semibold text-fs-120"
                style={{ fill: ink }}
              >
                {label}
                {valueFits ? (
                  <tspan
                    x={cell.x0 + 8}
                    dy={17}
                    className="font-bold text-fs-110 tabular-nums"
                    style={{ fill: ink, opacity: 0.78 }}
                  >
                    {value}
                  </tspan>
                ) : null}
              </text>
            ) : null}
          </g>
        );
      })}
    </g>
  );
});
