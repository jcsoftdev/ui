"use client";

import { useMemo, useState } from "react";
import { cn } from "../../utils/cn.js";
import { estimateTextWidth } from "../core/axes.js";
import { ChartFrame } from "../core/chart-frame.js";
import { inkOn, tint } from "../core/color-scale.js";
import { resolveFormat, type ValueFormat } from "../core/format.js";
import {
  buildHierarchy,
  type HierarchyDatum,
  type HierarchyNode,
  partitionLayout,
  treemapLayout,
} from "../core/hierarchy.js";
import {
  branchColor,
  describeNode,
  type HierarchyLabels,
  HierarchyTable,
  levelStrength,
  resolveHierarchyLabels,
} from "../core/hierarchy-chart.js";
import { useAnimatedNumber } from "../core/motion.js";
import {
  blendRings,
  type RingPoint,
  rectRing,
  ringCenter,
  ringPath,
  sectorRing,
} from "../core/shape-morph.js";
import { ChartTooltip } from "../core/tooltip.js";
import { useIndexNavigation } from "../core/use-index-navigation.js";

export type HierarchyMorphMode = "treemap" | "sunburst";

export interface HierarchyMorphLabels extends HierarchyLabels {
  /** Accessible name of the view switch. */
  view: string;
  /** Switch button: rectangles. */
  treemap: string;
  /** Switch button: rings. */
  sunburst: string;
}

export interface HierarchyMorphProps {
  /** Accessible name of the drawing and caption of the data table. */
  title: string;
  /** Root of the tree; its total is shown in the tooltip share. */
  data: HierarchyDatum;
  /** Controlled view. */
  mode?: HierarchyMorphMode;
  /** Initial view when uncontrolled. */
  defaultMode?: HierarchyMorphMode;
  onModeChange?: (mode: HierarchyMorphMode) => void;
  /** Levels drawn below the root (1 or 2). */
  levels?: 1 | 2;
  /** Hide the built-in switch (drive `mode` from outside). */
  showSwitch?: boolean;
  height?: number | "fill";
  /** Width / height ratio; sizes the drawing from the container width when `height` is not "fill". */
  aspectRatio?: number;
  valueFormat?: ValueFormat;
  /** Gap between shapes in pixels. */
  gap?: number;
  sort?: boolean;
  tooltip?: boolean;
  /** Morph duration in ms; 0 or `false` swaps instantly. */
  animate?: boolean;
  loading?: boolean;
  labels?: Partial<HierarchyMorphLabels>;
  className?: string;
}

const DEFAULT_LABELS: HierarchyMorphLabels = {
  ...resolveHierarchyLabels(),
  view: "Chart view",
  treemap: "Treemap",
  sunburst: "Sunburst",
};

const HEADER = 22;
const TAU = Math.PI * 2;

interface Shape {
  node: HierarchyNode;
  rect: RingPoint[];
  sector: RingPoint[];
  /** Present in the treemap layout; otherwise the shape grows out of its parent. */
  inTreemap: boolean;
  /** Room for a label in each layout: width and height. */
  rectRoom: [number, number];
  sectorRoom: [number, number];
  /** Middle of the ring segment, where the label sits in the sunburst. */
  sectorCenter: RingPoint;
}

/**
 * One hierarchy, two views. Switching between treemap rectangles and
 * sunburst rings morphs every shape: each is sampled as a polygon in both
 * layouts and the points glide from one to the other, so the eye follows a
 * branch instead of re-reading the chart.
 */
export function HierarchyMorph({
  title,
  data,
  mode,
  defaultMode = "treemap",
  onModeChange,
  levels = 2,
  showSwitch = true,
  height = 380,
  aspectRatio,
  valueFormat,
  gap = 2,
  sort = true,
  tooltip = true,
  animate = true,
  loading,
  labels: labelsProp,
  className,
}: HierarchyMorphProps) {
  const labels: HierarchyMorphLabels = labelsProp
    ? { ...DEFAULT_LABELS, ...labelsProp }
    : DEFAULT_LABELS;
  const format = useMemo(() => resolveFormat(valueFormat), [valueFormat]);
  const root = useMemo(() => buildHierarchy(data, { sort }), [data, sort]);
  const [inner, setInner] = useState<HierarchyMorphMode>(defaultMode);
  const current = mode ?? inner;
  const choose = (next: HierarchyMorphMode) => {
    setInner(next);
    onModeChange?.(next);
  };

  const switcher = showSwitch ? (
    <fieldset className="m-0 flex min-w-0 gap-1 border-0 p-0">
      <legend className="sr-only">{labels.view}</legend>
      {(["treemap", "sunburst"] as const).map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={current === option}
          onClick={() => choose(option)}
          className={cn(
            "cursor-pointer rounded-full border px-3 py-1 text-[12px] font-semibold outline-none focus-visible:outline-2 focus-visible:outline-accent-ink focus-visible:outline-offset-2",
            current === option
              ? "border-transparent bg-accent-soft text-accent-ink"
              : "border-line bg-transparent text-ink-3 hover:text-ink",
          )}
        >
          {labels[option]}
        </button>
      ))}
    </fieldset>
  ) : undefined;

  return (
    <ChartFrame
      height={height}
      aspectRatio={aspectRatio}
      labels={labels}
      loading={loading}
      empty={root.value <= 0}
      skeleton="ring"
      legend={switcher}
      legendPosition="top"
      table={<HierarchyTable root={root} caption={title} format={format} labels={labels} />}
      className={className}
    >
      {(width, measuredHeight) => (
        <MorphPlot
          width={width}
          height={measuredHeight}
          title={title}
          root={root}
          mode={current}
          levels={levels}
          gap={gap}
          format={format}
          labels={labels}
          tooltip={tooltip}
          animate={animate}
        />
      )}
    </ChartFrame>
  );
}

interface PlotProps {
  width: number;
  height: number;
  title: string;
  root: HierarchyNode;
  mode: HierarchyMorphMode;
  levels: 1 | 2;
  gap: number;
  format: (value: number) => string;
  labels: HierarchyMorphLabels;
  tooltip: boolean;
  animate: boolean;
}

/** Strength (0-100) of the branch hue, blended between the treemap and sunburst looks. */
function shapeStrength(shape: Shape, root: HierarchyNode, progress: number): number {
  const siblings = shape.node.parent?.children.length ?? 1;
  const spread = siblings > 1 ? shape.node.index / (siblings - 1) : 0;
  const treemap = shape.node.children.length > 0 && shape.inTreemap ? 16 : 56 - spread * 22;
  const sunburst = levelStrength(shape.node, root);
  return treemap + (sunburst - treemap) * progress;
}

function MorphPlot({
  width,
  height,
  title,
  root,
  mode,
  levels,
  gap,
  format,
  labels,
  tooltip,
  animate,
}: PlotProps) {
  const progress = useAnimatedNumber(mode === "sunburst" ? 1 : 0, {
    from: mode === "sunburst" ? 1 : 0,
    duration: 900,
    disabled: !animate,
  });
  const maxDepth = levels;

  const shapes = useMemo<Shape[]>(() => {
    const cells = treemapLayout(
      root,
      { x0: 0, y0: 0, x1: width, y1: height },
      { maxDepth, gap, headerHeight: HEADER, padding: 3 },
    );
    const cellOf = new Map(cells.map((cell) => [cell.node.id, cell]));
    const spans = partitionLayout(root);

    const size = Math.max(0, Math.min(width, height));
    const cx = width / 2;
    const cy = height / 2;
    const outer = Math.max(0, size / 2 - 4);
    const hole = outer * 0.2;
    const ring = (outer - hole) / maxDepth;
    const pad = gap / 2;

    const out: Shape[] = [];
    const visit = (node: HierarchyNode) => {
      for (const child of node.children) {
        if (child.depth <= maxDepth) {
          const span = spans.get(child.id);
          if (span) {
            const r0 = hole + (child.depth - 1) * ring + pad;
            const r1 = hole + child.depth * ring - pad;
            const mid = (r0 + r1) / 2;
            const padAngle = Math.min((span.x1 - span.x0) * TAU * 0.4, pad / Math.max(mid, 1));
            const a0 = span.x0 * TAU + padAngle;
            const a1 = span.x1 * TAU - padAngle;
            const sector = sectorRing(cx, cy, r0, r1, a0, Math.max(a0 + 1e-3, a1));
            const cell = cellOf.get(child.id);
            let rect: RingPoint[];
            let rectRoom: [number, number] = [0, 0];
            if (cell) {
              rect = rectRing(cell.x0, cell.y0, cell.x1, cell.y1);
              rectRoom = [cell.x1 - cell.x0, cell.group ? HEADER : cell.y1 - cell.y0];
            } else {
              const parent = cellOf.get(child.parent?.id ?? "");
              const px = parent ? (parent.x0 + parent.x1) / 2 : cx;
              const py = parent ? (parent.y0 + parent.y1) / 2 : cy;
              rect = rectRing(px, py, px, py);
            }
            out.push({
              node: child,
              rect,
              sector,
              inTreemap: cell != null,
              rectRoom,
              sectorRoom: [(a1 - a0) * mid, r1 - r0],
              sectorCenter: {
                x: cx + mid * Math.sin((a0 + a1) / 2),
                y: cy - mid * Math.cos((a0 + a1) / 2),
              },
            });
          }
        }
        visit(child);
      }
    };
    visit(root);
    return out.sort((a, b) => a.node.depth - b.node.depth);
  }, [root, width, height, maxDepth, gap]);

  const nav = useIndexNavigation(shapes.length, { wrap: true });
  const active = nav.active != null ? shapes[nav.active] : undefined;

  const drawn = shapes.map((shape) => {
    const points = blendRings(shape.rect, shape.sector, progress);
    const from = ringCenter(shape.rect);
    const to = shape.sectorCenter;
    const center = {
      x: from.x + (to.x - from.x) * progress,
      y: from.y + (to.y - from.y) * progress,
    };
    return { shape, points, path: ringPath(points), center };
  });
  const activeDrawn = active ? drawn.find((item) => item.shape === active) : undefined;

  return (
    <div ref={nav.ref} className="relative" style={{ width, height }}>
      <svg
        role="img"
        aria-label={title}
        width={width}
        height={height}
        className="block overflow-visible"
      >
        {drawn.map(({ shape, path }, index) => {
          const base = branchColor(shape.node, root);
          const strength = shapeStrength(shape, root, progress);
          const faded = !shape.inTreemap ? progress : 1;
          const dimmed = active != null && active.node.id !== shape.node.id;
          return (
            <path
              key={shape.node.id}
              d={path}
              onPointerEnter={(event) => nav.hover(index, event)}
              onPointerMove={(event) => nav.hover(index, event)}
              onPointerLeave={nav.leave}
              style={{
                fill: tint(base, strength),
                opacity: faded * (dimmed ? 0.45 : 1),
                transition: "opacity 150ms ease-out",
              }}
            />
          );
        })}
        {drawn.map(({ shape, center }) => {
          if (shape.node.depth !== 1) return null;
          const roomW = shape.rectRoom[0] + (shape.sectorRoom[0] - shape.rectRoom[0]) * progress;
          const roomH = shape.rectRoom[1] + (shape.sectorRoom[1] - shape.rectRoom[1]) * progress;
          const text = shape.node.name;
          const fits = roomH >= 14 && roomW >= estimateTextWidth(text, 11) + 10;
          if (!fits) return null;
          const strength = shapeStrength(shape, root, progress);
          return (
            <text
              key={shape.node.id}
              x={center.x}
              y={center.y}
              textAnchor="middle"
              dominantBaseline="central"
              className="pointer-events-none select-none font-semibold text-[11px]"
              style={{ fill: inkOn(strength) }}
            >
              {text}
            </text>
          );
        })}
        {activeDrawn ? (
          <path
            d={activeDrawn.path}
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
        aria-valuemax={Math.max(1, shapes.length)}
        aria-valuenow={(nav.active ?? 0) + 1}
        aria-valuetext={active ? describeNode(active.node, root, format) : title}
        {...nav.sliderProps}
        className="pointer-events-none absolute inset-0 rounded-xs outline-none focus-visible:outline-2 focus-visible:outline-accent-ink focus-visible:outline-offset-4"
      />

      {tooltip && active ? (
        <ChartTooltip
          x={nav.pointer?.x ?? activeDrawn?.center.x ?? 0}
          y={nav.pointer?.y ?? activeDrawn?.center.y ?? 0}
          containerWidth={width}
          title={
            active.node.parent && active.node.parent !== root ? active.node.parent.name : root.name
          }
          rows={[
            {
              id: "value",
              name: active.node.name,
              value: format(active.node.value),
              color: branchColor(active.node, root),
            },
            {
              id: "share",
              name: `${labels.share} · ${root.name}`,
              value: `${((active.node.value / Math.max(1, root.value)) * 100).toFixed(1)}%`,
              color: "transparent",
            },
          ]}
        />
      ) : null}
    </div>
  );
}
