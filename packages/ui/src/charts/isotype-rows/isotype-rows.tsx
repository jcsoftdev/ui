"use client";

import { useId, useMemo, useRef } from "react";
import { cn } from "../../utils/cn.js";
import { estimateTextWidth } from "../core/axes.js";
import { CategorySlider, useCategoryExplorer } from "../core/category-explorer.js";
import { ChartFrame } from "../core/chart-frame.js";
import { ChartDataTable } from "../core/data-table.js";
import { formatNumber, resolveFormat, type ValueFormat } from "../core/format.js";
import { useEntryAnimation } from "../core/motion.js";
import { seriesColor } from "../core/palette.js";
import { ChartTooltip } from "../core/tooltip.js";
import { type ChartLabels, resolveLabels } from "../core/types.js";
import { popUnits, UNIT_FRAME_CLASS, UnitGlyph } from "../core/unit-glyph.js";
import { resolveUnitShape, type UnitCategory, type UnitIcon } from "../core/unit-icons.js";
import { unitFractions } from "../core/units.js";

export interface IsotypeRowsProps {
  title: string;
  description?: string;
  /** One row per entry. */
  data: readonly UnitCategory[];
  /** Value one icon stands for; the last icon of a row is cut to its remainder. */
  perIcon?: number;
  icon?: UnitIcon;
  /** "single": every row in one color (classic isotype); "category": palette color per row. */
  colorMode?: "single" | "category";
  /** Color in "single" mode; the brand tone by default. */
  color?: string;
  /** Pads every row with empty icons up to the longest one. */
  track?: boolean;
  /** `"fill"` spreads the rows over the height of the parent instead of using `rowHeight`. */
  height?: "fill";
  /** Height of one row in pixels; the chart height follows the number of rows. */
  rowHeight?: number;
  /** Gap between icons, as a fraction of the icon size. */
  gap?: number;
  valueFormat?: ValueFormat;
  /** Value at the end of each row. */
  showValues?: boolean;
  /** What the values count, for the key and the tooltip ("servicios"). */
  unitLabel?: string;
  /** Shows "icon = N unitLabel" under the rows. Defaults to on when `perIcon` is not 1. */
  showKey?: boolean;
  tooltip?: boolean;
  animate?: boolean;
  loading?: boolean;
  labels?: Partial<ChartLabels>;
  className?: string;
}

const LABEL_GAP = 12;

/**
 * Classic isotype rows: a name, then the same icon repeated in proportion to
 * the value, then the value. Every row shares one icon size, so lengths are
 * comparable; icons shrink together when the container is narrow.
 */
export function IsotypeRows({
  title,
  description,
  data,
  perIcon = 1,
  icon = "scissors",
  colorMode = "single",
  color,
  track = false,
  height: heightMode,
  rowHeight = 34,
  gap = 0.18,
  valueFormat = "integer",
  showValues = true,
  unitLabel = "units",
  showKey,
  tooltip = true,
  animate = true,
  loading = false,
  labels: labelsProp,
  className,
}: IsotypeRowsProps) {
  const labels = resolveLabels(labelsProp);
  const format = resolveFormat(valueFormat);
  const colors = data.map((item, index) =>
    colorMode === "category"
      ? seriesColor(index, item.color)
      : (item.color ?? color ?? seriesColor(0)),
  );
  const height = heightMode === "fill" ? "fill" : Math.max(1, data.length) * rowHeight;
  const empty = data.length === 0 || data.every((item) => !(item.value > 0));
  const keyShape = resolveUnitShape(icon);
  const keyShown = showKey ?? perIcon !== 1;

  return (
    <ChartFrame
      height={height}
      labels={labels}
      loading={loading}
      empty={empty}
      skeleton="bars"
      footer={
        keyShown ? (
          <p className="m-0 flex items-center gap-1.5 text-fs-120 text-ink-3">
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24">
              <path
                d={keyShape.path}
                style={{ fill: "var(--ink-3)", fillRule: keyShape.fillRule }}
              />
            </svg>
            <span>
              = {formatNumber(perIcon)} {unitLabel}
            </span>
          </p>
        ) : null
      }
      table={
        <ChartDataTable
          caption={description ? `${title}. ${description}` : title}
          categoryHeader={labels.category}
          categories={data.map((item) => item.name)}
          columns={[
            { id: "value", name: unitLabel, values: data.map((item) => format(item.value)) },
          ]}
        />
      }
      className={cn(UNIT_FRAME_CLASS, className)}
    >
      {(width, measuredHeight) => (
        <IsotypePlot
          width={width}
          rowHeight={
            heightMode === "fill"
              ? Math.max(16, measuredHeight / Math.max(1, data.length))
              : rowHeight
          }
          title={title}
          data={data}
          colors={colors}
          perIcon={perIcon}
          icon={icon}
          track={track}
          gap={gap}
          format={format}
          showValues={showValues}
          unitLabel={unitLabel}
          tooltip={tooltip}
          animate={animate}
          labels={labels}
        />
      )}
    </ChartFrame>
  );
}

interface IsotypePlotProps {
  width: number;
  rowHeight: number;
  title: string;
  data: readonly UnitCategory[];
  colors: readonly string[];
  perIcon: number;
  icon: UnitIcon;
  track: boolean;
  gap: number;
  format: (value: number) => string;
  showValues: boolean;
  unitLabel: string;
  tooltip: boolean;
  animate: boolean;
  labels: ChartLabels;
}

function IsotypePlot({
  width,
  rowHeight,
  title,
  data,
  colors,
  perIcon,
  icon,
  track,
  gap,
  format,
  showValues,
  unitLabel,
  tooltip,
  animate,
  labels,
}: IsotypePlotProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const height = data.length * rowHeight;

  const geometry = useMemo(() => {
    const runs = data.map((item) => unitFractions(item.value, perIcon));
    const longest = Math.max(1, ...runs.map((run) => run.length));
    const longestName = Math.max(...data.map((item) => estimateTextWidth(item.name, 12)), 0);
    const labelWidth = Math.min(Math.ceil(longestName) + 4, Math.max(64, width * 0.3));
    const valueWidth = showValues
      ? Math.ceil(Math.max(...data.map((item) => estimateTextWidth(format(item.value), 12)), 0)) +
        10
      : 0;
    const area = Math.max(10, width - labelWidth - LABEL_GAP - valueWidth);
    const size = Math.max(4, Math.min(rowHeight * 0.72, area / (longest + (longest - 1) * gap)));
    const pitch = size * (1 + gap);
    const left = labelWidth + LABEL_GAP;
    const rows = runs.map((run, index) => {
      const shape = resolveUnitShape(data[index]?.icon ?? icon);
      const top = index * rowHeight + (rowHeight - size) / 2;
      const slots = track ? longest : run.length;
      const units = Array.from({ length: slots }, (_, unit) => ({
        key: `${index}-${unit}`,
        x: left + unit * pitch,
        y: top,
        fill: run[unit] ?? 0,
      }));
      const end = left + (run.length ? (run.length - 1) * pitch + size : 0);
      return { shape, units, end, center: index * rowHeight + rowHeight / 2 };
    });
    const trackEnd = left + (longest - 1) * pitch + size;
    return { rows, size, labelWidth, trackEnd };
  }, [data, perIcon, icon, track, gap, width, rowHeight, showValues, format]);

  const explorer = useCategoryExplorer({
    count: data.length,
    anchor: (index) => {
      const row = geometry.rows[index];
      return row ? { x: row.end, y: row.center } : null;
    },
  });

  useEntryAnimation(svgRef, (root) => popUnits(root), {
    disabled: !animate,
    replayKey: `${data.length}-${perIcon}`,
  });

  const activeItem = explorer.active == null ? null : data[explorer.active];

  return (
    <div className="relative" style={{ width, height }}>
      {data.map((item, index) => (
        <div
          key={item.id}
          aria-hidden="true"
          className={cn(
            "absolute left-0 truncate font-semibold text-fs-120 text-ink-2 transition-opacity duration-150",
            activeItem && activeItem.id !== item.id && "opacity-40",
          )}
          style={{
            top: index * rowHeight,
            width: geometry.labelWidth,
            lineHeight: `${rowHeight}px`,
          }}
          title={item.name}
        >
          {item.name}
        </div>
      ))}
      <svg
        ref={svgRef}
        role="img"
        aria-label={title}
        width={width}
        height={height}
        className="absolute inset-0 block overflow-visible"
        {...explorer.pointerProps}
      >
        {geometry.rows.map((row, index) => {
          const item = data[index] as UnitCategory;
          const dimmed = activeItem != null && activeItem.id !== item.id;
          return (
            <g
              key={item.id}
              data-category={index}
              style={{ opacity: dimmed ? 0.3 : 1, transition: "opacity 160ms ease-out" }}
            >
              <rect
                x={geometry.labelWidth}
                y={index * rowHeight}
                width={Math.max(0, width - geometry.labelWidth)}
                height={rowHeight}
                style={{ fill: "transparent" }}
              />
              {row.units.map((unit) => (
                <UnitGlyph
                  key={unit.key}
                  shape={row.shape}
                  x={unit.x}
                  y={unit.y}
                  size={geometry.size}
                  fill={unit.fill}
                  track={track || unit.fill > 0}
                  color={colors[index] as string}
                  clipId={`${uid}-${unit.key}`}
                />
              ))}
              {showValues ? (
                <text
                  x={(track ? geometry.trackEnd : row.end) + 8}
                  y={row.center}
                  dominantBaseline="central"
                  className="fill-ink font-bold text-fs-120 tabular-nums"
                >
                  {format(item.value)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
      <CategorySlider
        explorer={explorer}
        label={labels.explore}
        count={data.length}
        valueText={
          activeItem ? `${activeItem.name}: ${format(activeItem.value)} ${unitLabel}` : title
        }
      />
      {tooltip && activeItem && explorer.position ? (
        <ChartTooltip
          x={explorer.position.x}
          y={explorer.position.y}
          containerWidth={width}
          title={activeItem.name}
          rows={[
            {
              id: activeItem.id,
              name: unitLabel,
              value: format(activeItem.value),
              color: colors[explorer.active as number] as string,
            },
          ]}
        />
      ) : null}
    </div>
  );
}
