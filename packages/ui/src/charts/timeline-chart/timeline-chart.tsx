"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AxisBottom, estimateTextWidth, GridLines } from "../core/axes.js";
import { ChartFrame } from "../core/chart-frame.js";
import { ChartDataTable } from "../core/data-table.js";
import { ChartLegend } from "../core/legend.js";
import { EASE_OUT, fadeIn, useEntryAnimation } from "../core/motion.js";
import { seriesColor } from "../core/palette.js";
import { PlotOverlay } from "../core/plot-overlay.js";
import { ChartTooltip } from "../core/tooltip.js";
import { type ChartLabels, resolveLabels } from "../core/types.js";
import { useSeriesState } from "../core/use-series-state.js";
import { assignLanes, clockTicks, fitLaneHeight, formatClock } from "./timeline-lanes.js";

export interface TimelineRow {
  id: string;
  /** Row title, e.g. the barber's name. */
  label: string;
}

export interface TimelineItem {
  id: string;
  rowId: string;
  start: Date | number;
  end: Date | number;
  /** Text inside the bar when it fits, e.g. the client's name. */
  label?: string;
  /** Group id (status); picks the color and the legend entry. */
  group?: string;
  /** Second line in the tooltip, e.g. the service. */
  detail?: string;
}

export interface TimelineGroup {
  id: string;
  name: string;
  /** CSS color; defaults to the palette slot. */
  color?: string;
}

export interface TimelineTexts {
  group: string;
  row: string;
  time: string;
  duration: string;
  now: string;
  /** Short unit for minutes, "min". */
  minutes: string;
  hours: string;
}

const DEFAULT_TEXTS: TimelineTexts = {
  group: "Status",
  row: "Row",
  time: "Time",
  duration: "Duration",
  now: "Now",
  minutes: "min",
  hours: "h",
};

export interface TimelineChartProps {
  rows: readonly TimelineRow[];
  items: readonly TimelineItem[];
  groups?: readonly TimelineGroup[];
  /** Accessible name of the chart. */
  title: string;
  description?: string;
  /** Visible time window; by default the items rounded out to whole hours. */
  domain?: readonly [Date | number, Date | number];
  /** A "now" marker. "auto" uses the current time; false hides it. */
  now?: Date | number | "auto" | false;
  /**
   * By default the height follows the lanes. `"fill"` stretches the lanes to
   * the height of the parent; `aspectRatio` does the same from the width.
   */
  height?: "fill";
  /** Width / height ratio; stretches the lanes to fit it. */
  aspectRatio?: number;
  /** Height of one lane (a bar) in pixels, 28 by default (the minimum when stretching is 14). */
  laneHeight?: number;
  grid?: boolean;
  legend?: boolean;
  tooltip?: boolean;
  loading?: boolean;
  animate?: boolean;
  initialHidden?: readonly string[];
  texts?: Partial<TimelineTexts>;
  labels?: Partial<ChartLabels>;
  className?: string;
}

const MARGIN = { top: 22, right: 12, bottom: 30 };
const ROW_PAD = 8;
const GAP = 3;
const HOUR = 3_600_000;
const FALLBACK_GROUP = "__none";

function duration(ms: number, texts: TimelineTexts): string {
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes} ${texts.minutes}`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} ${texts.hours} ${m} ${texts.minutes}` : `${h} ${texts.hours}`;
}

function fitText(text: string, room: number, size = 11): string {
  if (estimateTextWidth(text, size) <= room) return text;
  const chars = Math.floor(room / (size * 0.58)) - 1;
  return chars >= 3 ? `${text.slice(0, chars).trimEnd()}…` : "";
}

interface Placed {
  item: TimelineItem;
  start: number;
  end: number;
  row: number;
  lane: number;
  color: string;
  group: string;
}

const BarMark = memo(function BarMark({
  x,
  y,
  width,
  height,
  color,
  active,
  muted,
  text,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  active: boolean;
  muted: boolean;
  text: string;
}) {
  return (
    <g
      data-bar=""
      className="motion-safe:transition-opacity motion-safe:duration-150"
      style={{
        opacity: muted ? 0.35 : 1,
        transformBox: "fill-box",
        transformOrigin: "left center",
      }}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={7}
        strokeWidth={active ? 2 : 0}
        style={{ fill: color, fillOpacity: active ? 1 : 0.88, stroke: "var(--ink)" }}
      />
      {text ? (
        <text
          x={x + 8}
          y={y + height / 2}
          dy="0.34em"
          className="pointer-events-none font-bold text-fs-110"
          style={{ fill: "var(--surface)" }}
        >
          {text}
        </text>
      ) : null}
    </g>
  );
});

/**
 * Gantt-style time ranges: one row per resource, one bar per item. Bars that
 * overlap inside a row are stacked into lanes, so nothing is hidden. Colors
 * come from groups (statuses), and an optional marker shows the current time.
 */
export function TimelineChart({
  rows,
  items,
  groups = [],
  title,
  description,
  domain,
  now = false,
  height: heightMode,
  aspectRatio,
  laneHeight = 28,
  grid = true,
  legend,
  tooltip = true,
  loading,
  animate = true,
  initialHidden,
  texts: textOverrides,
  labels: labelOverrides,
  className,
}: TimelineChartProps) {
  const labels = resolveLabels(labelOverrides);
  const texts = { ...DEFAULT_TEXTS, ...textOverrides };
  const state = useSeriesState(initialHidden);
  const [clock, setClock] = useState<number | null>(null);
  useEffect(() => {
    if (now === "auto") setClock(Date.now());
    else setClock(null);
  }, [now]);
  const nowValue = now === false ? null : now === "auto" ? clock : +now;

  const colorOf = useMemo(() => {
    const map = new Map(groups.map((group, i) => [group.id, seriesColor(i, group.color)]));
    return (id: string | undefined) => map.get(id ?? "") ?? "var(--accent-word)";
  }, [groups]);

  const layout = useMemo(() => {
    const visibleItems = items.filter((item) => !state.isHidden(item.group ?? FALLBACK_GROUP));
    const rowLayouts = rows.map((row, rowIndex) => {
      const own = visibleItems.filter((item) => item.rowId === row.id);
      const { lanes, count } = assignLanes(
        own.map((item) => ({ start: +item.start, end: +item.end })),
      );
      return { row, rowIndex, own, lanes, count: Math.max(1, count) };
    });
    let t0 = Number.POSITIVE_INFINITY;
    let t1 = Number.NEGATIVE_INFINITY;
    for (const item of items) {
      t0 = Math.min(t0, +item.start);
      t1 = Math.max(t1, +item.end);
    }
    const start = domain ? +domain[0] : Number.isFinite(t0) ? Math.floor(t0 / HOUR) * HOUR : 0;
    const end = domain ? +domain[1] : Number.isFinite(t1) ? Math.ceil(t1 / HOUR) * HOUR : HOUR;
    let top = MARGIN.top;
    const placed: Placed[] = [];
    const bands = rowLayouts.map((entry) => {
      const height = entry.count * (laneHeight + GAP) - GAP + ROW_PAD * 2;
      const band = { ...entry, top: top - MARGIN.top, height };
      entry.own.forEach((item, i) => {
        placed.push({
          item,
          start: +item.start,
          end: +item.end,
          row: entry.rowIndex,
          lane: entry.lanes[i] as number,
          color: colorOf(item.group),
          group: item.group ?? FALLBACK_GROUP,
        });
      });
      top += height;
      return band;
    });
    placed.sort((a, b) => a.row - b.row || a.start - b.start || a.lane - b.lane);
    return { bands, placed, start, end, plotHeight: top - MARGIN.top };
  }, [rows, items, domain, laneHeight, colorOf, state]);

  const totalHeight = layout.plotHeight + MARGIN.top + MARGIN.bottom;
  const legendItems = groups.length
    ? groups.map((group, i) => ({
        id: group.id,
        name: group.name,
        color: seriesColor(i, group.color),
        shape: "square" as const,
        hidden: state.isHidden(group.id),
      }))
    : [];

  const sortedAll = [...items].sort((a, b) => +a.start - +b.start);
  const rowName = (id: string) => rows.find((row) => row.id === id)?.label ?? id;
  const groupName = (id: string | undefined) => groups.find((group) => group.id === id)?.name ?? "";

  return (
    <ChartFrame
      height={heightMode === "fill" ? "fill" : Math.max(totalHeight, 120)}
      aspectRatio={aspectRatio}
      labels={labels}
      loading={loading}
      empty={items.length === 0 || rows.length === 0}
      skeleton="bars"
      legend={
        (legend ?? groups.length > 1) && legendItems.length ? (
          <ChartLegend
            items={legendItems}
            onToggle={state.toggle}
            onHighlight={state.setHighlighted}
          />
        ) : null
      }
      className={className}
      table={
        <ChartDataTable
          caption={description ? `${title}. ${description}` : title}
          categoryHeader={labels.category}
          categories={sortedAll.map((item) => item.label ?? item.id)}
          columns={[
            { id: "row", name: texts.row, values: sortedAll.map((item) => rowName(item.rowId)) },
            {
              id: "group",
              name: texts.group,
              values: sortedAll.map((item) => groupName(item.group)),
            },
            {
              id: "time",
              name: texts.time,
              values: sortedAll.map(
                (item) => `${formatClock(item.start)} - ${formatClock(item.end)}`,
              ),
            },
            {
              id: "duration",
              name: texts.duration,
              values: sortedAll.map((item) => duration(+item.end - +item.start, texts)),
            },
          ]}
        />
      }
    >
      {(width, measuredHeight) => (
        <TimelinePlot
          width={width}
          height={heightMode === "fill" || aspectRatio ? measuredHeight : totalHeight}
          stretch={heightMode === "fill" || aspectRatio != null}
          rows={rows}
          layout={layout}
          nowValue={nowValue}
          laneHeight={laneHeight}
          grid={grid}
          tooltip={tooltip}
          animate={animate}
          highlighted={state.highlighted}
          texts={texts}
          groupName={groupName}
          rowName={rowName}
          labels={labels}
          title={title}
        />
      )}
    </ChartFrame>
  );
}

interface PlotProps {
  width: number;
  height: number;
  rows: readonly TimelineRow[];
  layout: {
    bands: Array<{ row: TimelineRow; top: number; height: number; count: number }>;
    placed: Placed[];
    start: number;
    end: number;
    plotHeight: number;
  };
  nowValue: number | null;
  laneHeight: number;
  /** Stretch the lanes so the rows fill `height`. */
  stretch: boolean;
  grid: boolean;
  tooltip: boolean;
  animate: boolean;
  highlighted: string | null;
  texts: TimelineTexts;
  groupName: (id: string | undefined) => string;
  rowName: (id: string) => string;
  labels: ChartLabels;
  title: string;
}

function TimelinePlot({
  width,
  height,
  rows,
  layout,
  nowValue,
  laneHeight: baseLaneHeight,
  stretch,
  grid,
  tooltip,
  animate,
  highlighted,
  texts,
  groupName,
  rowName,
  labels,
  title,
}: PlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const { placed, start, end } = layout;
  const laneHeight = stretch
    ? fitLaneHeight({
        counts: layout.bands.map((band) => band.count),
        available: height - MARGIN.top - MARGIN.bottom,
        gap: GAP,
        rowPad: ROW_PAD,
      })
    : baseLaneHeight;
  const { bands, plotHeight } = useMemo(() => {
    if (!stretch) return { bands: layout.bands, plotHeight: layout.plotHeight };
    let top = 0;
    const next = layout.bands.map((band) => {
      const bandHeight = band.count * (laneHeight + GAP) - GAP + ROW_PAD * 2;
      const placedBand = { ...band, top, height: bandHeight };
      top += bandHeight;
      return placedBand;
    });
    return { bands: next, plotHeight: top };
  }, [layout.bands, layout.plotHeight, laneHeight, stretch]);
  const narrow = width < 440;
  const left = Math.min(
    narrow ? 78 : 132,
    Math.max(64, Math.max(...rows.map((r) => estimateTextWidth(r.label, 12)), 0) + 18),
  );
  const innerWidth = Math.max(60, width - left - MARGIN.right);
  const x = useCallback(
    (t: number) => ((t - start) / (end - start || 1)) * innerWidth,
    [start, end, innerWidth],
  );

  const ticks = useMemo(
    () =>
      clockTicks(start, end, Math.max(2, Math.floor(innerWidth / 62))).map((tick) => ({
        key: tick.value,
        position: x(tick.value),
        label: tick.label,
      })),
    [start, end, x, innerWidth],
  );

  useEntryAnimation(
    svgRef,
    (root) => {
      const list = root.querySelectorAll("[data-bar]");
      const per = Math.min(24, 500 / Math.max(1, list.length));
      list.forEach((bar, i) => {
        bar.animate(
          [
            { transform: "scaleX(0)", opacity: 0 },
            { transform: "scaleX(1)", opacity: 1 },
          ],
          {
            duration: 520,
            delay: i * per,
            easing: EASE_OUT,
            fill: "backwards",
          },
        );
      });
      for (const node of root.querySelectorAll("[data-fade]")) fadeIn(node, 360, 400);
    },
    { disabled: !animate },
  );

  const geometry = useMemo(
    () =>
      placed.map((entry) => {
        const band = bands[entry.row] as { top: number };
        const x0 = x(entry.start);
        const x1 = x(entry.end);
        return {
          entry,
          x: x0,
          y: band.top + ROW_PAD + entry.lane * (laneHeight + GAP),
          w: Math.max(3, x1 - x0),
        };
      }),
    [placed, bands, laneHeight, x],
  );

  const current = active != null ? geometry[active] : undefined;
  const valueText = current
    ? `${current.entry.item.label ?? current.entry.item.id}. ${rowName(current.entry.item.rowId)}. ${formatClock(
        current.entry.start,
      )} - ${formatClock(current.entry.end)}${
        groupName(current.entry.item.group) ? `. ${groupName(current.entry.item.group)}` : ""
      }`
    : labels.explore;

  const rowOf = (index: number) => (geometry[index] as { entry: Placed }).entry.row;
  const stepRow = (delta: number): boolean => {
    if (active == null) return false;
    const from = geometry[active] as (typeof geometry)[number];
    let best = -1;
    let bestGap = Number.POSITIVE_INFINITY;
    let target = rowOf(active) + delta;
    while (best < 0 && target >= 0 && target < bands.length) {
      geometry.forEach((g, i) => {
        if (g.entry.row !== target) return;
        const gap = Math.abs(g.entry.start - from.entry.start);
        if (gap < bestGap) {
          best = i;
          bestGap = gap;
        }
      });
      target += delta;
    }
    if (best >= 0) setActive(best);
    return true;
  };

  return (
    <div className="relative" style={{ width }}>
      <svg
        ref={svgRef}
        role="img"
        aria-label={title}
        width={width}
        height={height}
        className="block overflow-visible"
      >
        <g transform={`translate(${left},${MARGIN.top})`}>
          {grid ? <GridLines ticks={ticks} direction="vertical" length={plotHeight} /> : null}
          {bands.map((band, i) => (
            <g key={band.row.id}>
              {i % 2 === 0 ? (
                <rect
                  x={-left + 4}
                  y={band.top}
                  width={left + innerWidth + MARGIN.right - 8}
                  height={band.height}
                  rx={10}
                  style={{ fill: "var(--surface-2)", fillOpacity: 0.45 }}
                />
              ) : null}
              <text
                x={-10}
                y={band.top + band.height / 2}
                dy="0.34em"
                textAnchor="end"
                className="font-semibold text-fs-120"
                style={{ fill: "var(--ink-2)" }}
              >
                {fitText(band.row.label, left - 18, 12)}
              </text>
            </g>
          ))}
          <AxisBottom ticks={ticks} offset={plotHeight} />
          {geometry.map((g, i) => (
            <BarMark
              key={g.entry.item.id}
              x={g.x}
              y={g.y}
              width={g.w}
              height={laneHeight}
              color={g.entry.color}
              active={active === i}
              muted={
                (active != null && active !== i) ||
                (highlighted != null && highlighted !== g.entry.group)
              }
              text={g.w > 44 ? fitText(g.entry.item.label ?? "", g.w - 14) : ""}
            />
          ))}
          {nowValue != null && nowValue >= start && nowValue <= end ? (
            <g data-fade="" className="pointer-events-none">
              <line
                x1={x(nowValue)}
                x2={x(nowValue)}
                y1={-6}
                y2={plotHeight}
                strokeWidth={1.5}
                style={{ stroke: "var(--danger)" }}
              />
              <rect
                x={x(nowValue) - 20}
                y={-MARGIN.top + 2}
                width={40}
                height={16}
                rx={8}
                style={{ fill: "var(--danger)" }}
              />
              <text
                x={x(nowValue)}
                y={-MARGIN.top + 10}
                dy="0.34em"
                textAnchor="middle"
                className="font-bold text-fs-100"
                style={{ fill: "var(--surface)" }}
              >
                {texts.now}
              </text>
            </g>
          ) : null}
        </g>
      </svg>
      <PlotOverlay
        left={left}
        top={MARGIN.top}
        width={innerWidth}
        height={plotHeight}
        label={labels.explore}
        count={geometry.length}
        active={active}
        valueText={valueText}
        onActiveChange={setActive}
        keys="horizontal"
        indexAt={({ x: px, y: py }) => {
          const hit = geometry.findIndex(
            (g) => px >= g.x && px <= g.x + g.w && py >= g.y && py <= g.y + laneHeight,
          );
          return hit >= 0 ? hit : null;
        }}
        onKey={(event) => {
          if (event.key === "ArrowUp") return stepRow(-1);
          if (event.key === "ArrowDown") return stepRow(1);
          return false;
        }}
      />
      {tooltip && current ? (
        <ChartTooltip
          x={left + current.x + current.w / 2}
          y={MARGIN.top + current.y + laneHeight / 2}
          containerWidth={width}
          title={current.entry.item.label ?? current.entry.item.id}
          rows={[
            ...(groupName(current.entry.item.group)
              ? [
                  {
                    id: "group",
                    name: texts.group,
                    value: groupName(current.entry.item.group),
                    color: current.entry.color,
                    shape: "square" as const,
                  },
                ]
              : []),
            {
              id: "row",
              name: texts.row,
              value: rowName(current.entry.item.rowId),
              color: "var(--ink-3)",
              shape: "dot",
            },
            {
              id: "time",
              name: texts.time,
              value: `${formatClock(current.entry.start)} - ${formatClock(current.entry.end)}`,
              color: "var(--ink-3)",
              shape: "dot",
            },
            {
              id: "duration",
              name: texts.duration,
              value: duration(current.entry.end - current.entry.start, texts),
              color: "var(--ink-3)",
              shape: "dot",
            },
            ...(current.entry.item.detail
              ? [{ id: "detail", name: current.entry.item.detail, value: "", color: "transparent" }]
              : []),
          ]}
        />
      ) : null}
    </div>
  );
}
