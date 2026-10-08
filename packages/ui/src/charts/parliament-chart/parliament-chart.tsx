"use client";

import { memo, useMemo, useRef } from "react";
import { cn } from "../../utils/cn.js";
import { CategorySlider, useCategoryExplorer } from "../core/category-explorer.js";
import { ChartFrame } from "../core/chart-frame.js";
import { ChartDataTable } from "../core/data-table.js";
import { formatNumber, formatPercent } from "../core/format.js";
import { ChartLegend, type LegendItem } from "../core/legend.js";
import { useEntryAnimation } from "../core/motion.js";
import { seriesColor } from "../core/palette.js";
import { ChartTooltip } from "../core/tooltip.js";
import { type ChartLabels, resolveLabels } from "../core/types.js";
import { popUnits, UNIT_FRAME_CLASS, UNIT_LEGEND_CLASS } from "../core/unit-glyph.js";
import type { UnitCategory } from "../core/unit-icons.js";
import { assignUnits, parliamentLayout } from "../core/units.js";
import { useSeriesState } from "../core/use-series-state.js";

export interface ParliamentChartProps {
  title: string;
  description?: string;
  /** One group per entry; `value` is its number of seats (whole numbers). */
  data: readonly Omit<UnitCategory, "icon">[];
  /** Number of arcs; computed from the seat count by default. */
  rows?: number;
  /** Radius of the innermost arc as a fraction of the outer one. */
  innerRatio?: number;
  seatShape?: "circle" | "square";
  /**
   * Draws the majority mark at the top of the arc: `true` for half the seats
   * plus one, or an explicit number of seats.
   */
  majority?: boolean | number;
  /** Text before the majority figure. */
  majorityLabel?: string;
  /** Word under the seat total in the middle ("escaños", "sillas"). Omit to hide the total. */
  centerLabel?: string;
  /** Name of the counted thing in the tooltip and data table. */
  seatLabel?: string;
  height?: number;
  legend?: boolean | "top" | "bottom";
  tooltip?: boolean;
  animate?: boolean;
  loading?: boolean;
  initialHidden?: readonly string[];
  labels?: Partial<ChartLabels>;
  className?: string;
}

/**
 * Hemicycle of seats: the arcs are worked out for the total, every arc gets
 * seats in proportion to its length, and groups are laid left to right so
 * each one reads as a wedge. Optional majority mark and seat total.
 */
export function ParliamentChart({
  title,
  description,
  data,
  rows,
  innerRatio = 0.4,
  seatShape = "circle",
  majority = false,
  majorityLabel = "Majority",
  centerLabel,
  seatLabel = "Seats",
  height = 260,
  legend = true,
  tooltip = true,
  animate = true,
  loading = false,
  initialHidden,
  labels: labelsProp,
  className,
}: ParliamentChartProps) {
  const labels = resolveLabels(labelsProp);
  const state = useSeriesState(initialHidden);
  const colors = data.map((item, index) => seriesColor(index, item.color));
  const seats = data.map((item) =>
    Number.isFinite(item.value) ? Math.max(0, Math.round(item.value)) : 0,
  );
  const total = seats.reduce((acc, count) => acc + count, 0);
  const majorityAt =
    majority === false ? null : majority === true ? Math.floor(total / 2) + 1 : majority;
  const legendPlacement = legend === false ? null : legend === true ? "top" : legend;

  const legendItems: LegendItem[] = data.map((item, index) => ({
    id: item.id,
    name: item.name,
    color: colors[index] as string,
    shape: seatShape === "circle" ? "dot" : "square",
    hidden: state.isHidden(item.id),
  }));

  return (
    <ChartFrame
      height={height}
      labels={labels}
      loading={loading}
      empty={total === 0}
      skeleton="ring"
      legendPosition={legendPlacement ?? "top"}
      legend={
        legendPlacement ? (
          <ChartLegend
            items={legendItems}
            onToggle={state.toggle}
            onHighlight={state.setHighlighted}
            className={UNIT_LEGEND_CLASS}
          />
        ) : null
      }
      table={
        <ChartDataTable
          caption={[
            title,
            description,
            majorityAt != null ? `${majorityLabel}: ${majorityAt}` : null,
          ]
            .filter(Boolean)
            .join(". ")}
          categoryHeader={labels.category}
          categories={data.map((item) => item.name)}
          columns={[
            { id: "seats", name: seatLabel, values: seats.map((count) => formatNumber(count)) },
            {
              id: "share",
              name: "%",
              values: seats.map((count) => formatPercent(total ? count / total : 0)),
            },
          ]}
        />
      }
      className={cn(UNIT_FRAME_CLASS, className)}
    >
      {(width) => (
        <ParliamentPlot
          width={width}
          height={height}
          title={title}
          data={data}
          seats={seats}
          total={total}
          colors={colors}
          rows={rows}
          innerRatio={innerRatio}
          seatShape={seatShape}
          majorityAt={majorityAt}
          majorityLabel={majorityLabel}
          centerLabel={centerLabel}
          seatLabel={seatLabel}
          hidden={state.hidden}
          highlighted={state.highlighted}
          tooltip={tooltip}
          animate={animate}
          labels={labels}
        />
      )}
    </ChartFrame>
  );
}

interface ParliamentPlotProps {
  width: number;
  height: number;
  title: string;
  data: readonly Omit<UnitCategory, "icon">[];
  seats: readonly number[];
  total: number;
  colors: readonly string[];
  rows?: number;
  innerRatio: number;
  seatShape: "circle" | "square";
  majorityAt: number | null;
  majorityLabel: string;
  centerLabel?: string;
  seatLabel: string;
  hidden: ReadonlySet<string>;
  highlighted: string | null;
  tooltip: boolean;
  animate: boolean;
  labels: ChartLabels;
}

interface SeatProps {
  x: number;
  y: number;
  r: number;
  shape: "circle" | "square";
  color: string;
}

const SeatMark = memo(function SeatMark({ x, y, r, shape, color }: SeatProps) {
  return (
    <g data-unit="" style={{ transformBox: "fill-box", transformOrigin: "center" }}>
      {shape === "circle" ? (
        <circle cx={x} cy={y} r={r} style={{ fill: color }} />
      ) : (
        <rect
          x={x - r * 0.9}
          y={y - r * 0.9}
          width={r * 1.8}
          height={r * 1.8}
          rx={r * 0.35}
          style={{ fill: color }}
        />
      )}
    </g>
  );
});

const MAJORITY_SPACE = 20;

function ParliamentPlot({
  width,
  height,
  title,
  data,
  seats,
  total,
  colors,
  rows,
  innerRatio,
  seatShape,
  majorityAt,
  majorityLabel,
  centerLabel,
  seatLabel,
  hidden,
  highlighted,
  tooltip,
  animate,
  labels,
}: ParliamentPlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const geometry = useMemo(() => {
    const layout = parliamentLayout(total, { rows, innerRatio });
    const sr = layout.seatRadius;
    const top = majorityAt != null ? MAJORITY_SPACE : 2;
    const radius = Math.max(
      8,
      Math.min((width - 4) / (2 * (1 + sr)), (height - top - 2) / (1 + 2 * sr)),
    );
    const cx = width / 2;
    const cy = top + radius * (1 + sr);
    const owners = assignUnits(seats);
    const placed = layout.seats.map((seat, index) => ({
      index,
      owner: owners[index] ?? -1,
      x: cx + seat.x * radius,
      y: cy + seat.y * radius,
    }));
    const anchors = seats.map((_, category) => {
      const own = placed.filter((seat) => seat.owner === category);
      return own.length ? (own[Math.floor(own.length / 2)] as { x: number; y: number }) : null;
    });
    const innerEdge = (layout.radii[0] ?? innerRatio) - sr;
    return { placed, anchors, radius, cx, cy, seatRadius: sr * radius, sr, innerEdge };
  }, [total, rows, innerRatio, majorityAt, width, height, seats]);

  const explorer = useCategoryExplorer({
    count: data.length,
    isAvailable: (index) => {
      const item = data[index];
      return item != null && (seats[index] ?? 0) > 0 && !hidden.has(item.id);
    },
    anchor: (index) => geometry.anchors[index] ?? null,
  });

  useEntryAnimation(svgRef, (root) => popUnits(root, { duration: 380, budget: 800 }), {
    disabled: !animate,
    replayKey: `${total}-${data.length}`,
  });

  const activeItem = explorer.active == null ? null : data[explorer.active];
  const focusId = highlighted ?? activeItem?.id ?? null;
  const share = (count: number) => formatPercent(total ? count / total : 0);
  const { radius, cx, cy } = geometry;
  const holeRadius = Math.max(0, geometry.innerEdge * radius);
  const totalSize = Math.max(14, Math.min(34, holeRadius * 0.62));
  const showCenter = centerLabel != null && holeRadius > 28;

  return (
    <div className="relative" style={{ width, height }}>
      <svg
        ref={svgRef}
        role="img"
        aria-label={title}
        width={width}
        height={height}
        className="block overflow-visible"
        {...explorer.pointerProps}
      >
        <g>
          {geometry.placed
            .filter((seat) => hidden.has(data[seat.owner]?.id ?? ""))
            .map((seat) => (
              <SeatMark
                key={seat.index}
                x={seat.x}
                y={seat.y}
                r={geometry.seatRadius}
                shape={seatShape}
                color="var(--track)"
              />
            ))}
        </g>
        {data.map((item, category) => {
          if (hidden.has(item.id)) return null;
          const dimmed = focusId != null && focusId !== item.id;
          return (
            <g
              key={item.id}
              data-category={category}
              style={{ opacity: dimmed ? 0.2 : 1, transition: "opacity 160ms ease-out" }}
            >
              {geometry.placed
                .filter((seat) => seat.owner === category)
                .map((seat) => (
                  <SeatMark
                    key={seat.index}
                    x={seat.x}
                    y={seat.y}
                    r={geometry.seatRadius}
                    shape={seatShape}
                    color={colors[category] as string}
                  />
                ))}
            </g>
          );
        })}
        {majorityAt != null ? (
          <g>
            <line
              x1={cx}
              x2={cx}
              y1={cy - holeRadius + 2}
              y2={cy - radius * (1 + geometry.sr) - 4}
              strokeWidth={1.25}
              strokeDasharray="3 3"
              style={{ stroke: "var(--ink-3)" }}
            />
            <text
              x={cx}
              y={cy - radius * (1 + geometry.sr) - 8}
              textAnchor="middle"
              className="fill-ink-2 font-semibold text-[11px]"
            >
              {majorityLabel}: {formatNumber(majorityAt)}
            </text>
          </g>
        ) : null}
        {showCenter ? (
          <g>
            <text
              x={cx}
              y={cy - 16}
              textAnchor="middle"
              className="fill-ink font-bold tabular-nums"
              style={{ fontSize: totalSize }}
            >
              {formatNumber(total)}
            </text>
            <text x={cx} y={cy - 1} textAnchor="middle" className="fill-ink-3 text-[11px]">
              {centerLabel}
            </text>
          </g>
        ) : null}
      </svg>
      <CategorySlider
        explorer={explorer}
        label={labels.explore}
        count={data.length}
        valueText={
          activeItem && explorer.active != null
            ? `${activeItem.name}: ${formatNumber(seats[explorer.active] ?? 0)} ${seatLabel} (${share(
                seats[explorer.active] ?? 0,
              )})`
            : title
        }
      />
      {tooltip && activeItem && explorer.position && explorer.active != null ? (
        <ChartTooltip
          x={explorer.position.x}
          y={explorer.position.y}
          containerWidth={width}
          title={activeItem.name}
          rows={[
            {
              id: activeItem.id,
              name: seatLabel,
              value: formatNumber(seats[explorer.active] ?? 0),
              color: colors[explorer.active] as string,
              shape: seatShape === "circle" ? "dot" : "square",
              note: share(seats[explorer.active] ?? 0),
            },
          ]}
        />
      ) : null}
    </div>
  );
}
