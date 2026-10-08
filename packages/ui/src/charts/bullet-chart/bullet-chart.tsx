"use client";

import { useMemo, useRef, useState } from "react";
import { AxisBottom, AxisLeft, estimateTextWidth, GridLines } from "../core/axes.js";
import { ChartFrame } from "../core/chart-frame.js";
import { ChartDataTable } from "../core/data-table.js";
import { resolveAxisFormat, resolveFormat, type ValueFormat } from "../core/format.js";
import { ChartLegend, type LegendItem } from "../core/legend.js";
import { EASE_OUT, fadeIn, useEntryAnimation } from "../core/motion.js";
import { seriesColor } from "../core/palette.js";
import { PlotOverlay } from "../core/plot-overlay.js";
import { linearScale } from "../core/scales/linear.js";
import { ChartTooltip, type TooltipRow } from "../core/tooltip.js";
import { type ChartLabels, resolveLabels } from "../core/types.js";
import {
  type BulletBand,
  bandOpacity,
  bulletBands,
  bulletLevel,
  bulletMax,
} from "./bullet-layout.js";

export interface BulletItem {
  id?: string;
  label: string;
  /** The measured value: the thin bar. */
  actual: number;
  /** The goal: a tick across the bar. */
  target?: number;
  /** Upper bounds of the qualitative ranges, ascending (e.g. `[60, 85, 100]` for poor, fair, good). */
  ranges?: readonly number[];
  /** Overrides the chart `valueFormat` for this row. */
  format?: ValueFormat;
}

export interface BulletChartProps {
  items: readonly BulletItem[];
  /** Accessible name of the chart. */
  title: string;
  description?: string;
  /** Names of the qualitative ranges, lowest first (e.g. "Bajo", "Medio", "Alto"). */
  rangeLabels?: readonly string[];
  actualLabel?: string;
  targetLabel?: string;
  /** Color of the actual bar (default: the brand slot of the palette). */
  color?: string;
  orientation?: "horizontal" | "vertical";
  /** "row" gives every row its own 0-to-max scale (mixed units); "shared" draws one axis for all. */
  scale?: "row" | "shared";
  valueFormat?: ValueFormat;
  /** Height of every row in pixels (default 46), horizontal charts without `height`. */
  rowHeight?: number;
  /** Height in pixels, or `"fill"` for the parent height. */
  height?: number | "fill";
  aspectRatio?: number;
  /** Actual and target written at the end of each row (default true when there is room). */
  valueLabels?: boolean;
  legend?: boolean;
  tooltip?: boolean;
  loading?: boolean;
  animate?: boolean;
  labels?: Partial<ChartLabels>;
  className?: string;
}

const PAD = { top: 8, bottom: 8 };

const bandFill = (index: number, count: number) =>
  `color-mix(in srgb, var(--ink-3) ${Math.round(bandOpacity(index, count) * 100)}%, transparent)`;

function fitLabel(text: string, room: number): string {
  const max = Math.max(3, Math.floor(room / 6.8));
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Bullet graph: one measured bar against a target tick, on qualitative bands
 * (poor, fair, good). Many rows compare KPIs in little space; each row has its
 * own scale unless `scale="shared"`.
 */
export function BulletChart({
  items,
  title,
  description,
  rangeLabels = [],
  actualLabel = "Actual",
  targetLabel = "Target",
  color,
  orientation = "horizontal",
  scale = "row",
  valueFormat,
  rowHeight = 46,
  height,
  aspectRatio,
  valueLabels = true,
  legend = true,
  tooltip = true,
  loading,
  animate = true,
  labels: labelOverrides,
  className,
}: BulletChartProps) {
  const labels = resolveLabels(labelOverrides);
  const vertical = orientation === "vertical";
  const fill = color ?? seriesColor(0);
  const fmtOf = (item: BulletItem) => resolveFormat(item.format ?? valueFormat);
  const bandCount = Math.max(0, ...items.map((item) => bulletBands(item.ranges).length));
  const autoHeight = Math.max(
    100,
    items.length * rowHeight + PAD.top + (scale === "shared" ? 30 : PAD.bottom),
  );
  const fixed = height != null || aspectRatio != null || vertical;
  const frameHeight =
    height === "fill" ? "fill" : typeof height === "number" ? height : vertical ? 300 : autoHeight;

  const legendItems: LegendItem[] = [
    { id: "actual", name: actualLabel, color: fill, shape: "square" },
    { id: "target", name: targetLabel, color: "var(--ink)", shape: "line" },
    ...Array.from({ length: bandCount }, (_, index) => ({
      id: `range-${index}`,
      name: rangeLabels[index] ?? `#${index + 1}`,
      color: bandFill(index, bandCount),
      shape: "square" as const,
    })),
  ];

  return (
    <ChartFrame
      height={frameHeight}
      aspectRatio={aspectRatio}
      labels={labels}
      loading={loading}
      empty={items.length === 0}
      skeleton="bars"
      legend={legend ? <ChartLegend items={legendItems} /> : null}
      className={className}
      table={
        <ChartDataTable
          caption={description ? `${title}. ${description}` : title}
          categoryHeader={labels.category}
          categories={items.map((item) => item.label)}
          columns={[
            {
              id: "actual",
              name: actualLabel,
              values: items.map((item) => fmtOf(item)(item.actual)),
            },
            {
              id: "target",
              name: targetLabel,
              values: items.map((item) => (item.target == null ? "" : fmtOf(item)(item.target))),
            },
            ...Array.from({ length: bandCount }, (_, index) => ({
              id: `range-${index}`,
              name: rangeLabels[index] ?? `#${index + 1}`,
              values: items.map((item) => {
                const band = bulletBands(item.ranges)[index];
                return band ? fmtOf(item)(band.to) : "";
              }),
            })),
          ]}
        />
      }
    >
      {(width, measuredHeight) => (
        <BulletPlot
          width={width}
          height={fixed ? measuredHeight : autoHeight}
          items={items}
          rangeLabels={rangeLabels}
          actualLabel={actualLabel}
          targetLabel={targetLabel}
          color={fill}
          vertical={vertical}
          shared={scale === "shared"}
          valueFormat={valueFormat}
          valueLabels={valueLabels}
          tooltip={tooltip}
          animate={animate}
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
  items: readonly BulletItem[];
  rangeLabels: readonly string[];
  actualLabel: string;
  targetLabel: string;
  color: string;
  vertical: boolean;
  shared: boolean;
  valueFormat?: ValueFormat;
  valueLabels: boolean;
  tooltip: boolean;
  animate: boolean;
  labels: ChartLabels;
  title: string;
}

function BulletPlot({
  width,
  height,
  items,
  rangeLabels,
  actualLabel,
  targetLabel,
  color,
  vertical,
  shared,
  valueFormat,
  valueLabels,
  tooltip,
  animate,
  labels,
  title,
}: PlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const count = items.length;
  const bandCount = Math.max(0, ...items.map((item) => bulletBands(item.ranges).length));
  const fmtOf = (item: BulletItem) => resolveFormat(item.format ?? valueFormat);

  const model = useMemo(() => {
    const fmtOf = (item: BulletItem) => resolveFormat(item.format ?? valueFormat);
    const sharedMax = Math.max(...items.map((item) => bulletMax(item)));
    const maxOf = (item: BulletItem) => (shared ? sharedMax : bulletMax(item));
    const axisFormat = resolveAxisFormat(valueFormat);
    if (vertical) {
      const top = valueLabels ? 22 : PAD.top;
      const bottom = 28;
      const innerHeight = Math.max(40, height - top - bottom);
      const ticksScale = linearScale({
        domain: [0, sharedMax],
        range: [innerHeight, 0],
        tickCount: Math.max(2, Math.round(innerHeight / 52)),
      });
      const ticks = shared
        ? ticksScale.ticks().map((tick) => ({
            key: tick,
            position: ticksScale.map(tick),
            label: axisFormat(tick),
          }))
        : [];
      const left = shared
        ? Math.max(...ticks.map((tick) => estimateTextWidth(tick.label)), 16) + 14
        : 4;
      const innerWidth = Math.max(40, width - left - 8);
      const slot = innerWidth / Math.max(1, count);
      const thick = Math.min(56, slot * 0.62);
      const toPx = (item: BulletItem, value: number) =>
        innerHeight - (value / maxOf(item)) * innerHeight;
      return {
        top,
        left,
        innerWidth,
        innerHeight,
        slot,
        thick,
        ticks,
        toPx,
        labelWidth: 0,
        valueColumn: 0,
      };
    }
    const wideLabels = Math.max(...items.map((item) => estimateTextWidth(item.label, 12)), 40) + 14;
    const left = Math.min(width * 0.34, wideLabels);
    const showValues = valueLabels && width >= 380;
    const valueColumn = showValues
      ? Math.min(
          120,
          Math.max(
            ...items.map((item) => {
              const fmt = fmtOf(item);
              return estimateTextWidth(
                item.target == null
                  ? fmt(item.actual)
                  : `${fmt(item.actual)} / ${fmt(item.target)}`,
                11,
              );
            }),
            40,
          ) + 14,
        )
      : 8;
    const innerWidth = Math.max(40, width - left - valueColumn);
    const bottom = shared ? 30 : PAD.bottom;
    const innerHeight = Math.max(40, height - PAD.top - bottom);
    const slot = innerHeight / Math.max(1, count);
    const thick = Math.min(30, slot * 0.7);
    const ticksScale = linearScale({
      domain: [0, sharedMax],
      range: [0, innerWidth],
      tickCount: Math.max(2, Math.round(innerWidth / 100)),
    });
    const ticks = shared
      ? ticksScale.ticks().map((tick) => ({
          key: tick,
          position: ticksScale.map(tick),
          label: axisFormat(tick),
        }))
      : [];
    const toPx = (item: BulletItem, value: number) => (value / maxOf(item)) * innerWidth;
    return {
      top: PAD.top,
      left,
      innerWidth,
      innerHeight,
      slot,
      thick,
      ticks,
      toPx,
      labelWidth: left,
      valueColumn,
    };
  }, [items, shared, valueFormat, vertical, width, height, valueLabels, count]);
  const { top, left, innerWidth, innerHeight, slot, thick, ticks, toPx, labelWidth, valueColumn } =
    model;

  useEntryAnimation(
    svgRef,
    (root) => {
      const bars = root.querySelectorAll("[data-bar]");
      const per = Math.min(60, 420 / Math.max(1, bars.length));
      const [from, to] = vertical ? ["scaleY(0)", "scaleY(1)"] : ["scaleX(0)", "scaleX(1)"];
      bars.forEach((bar, i) => {
        bar.animate([{ transform: from }, { transform: to }], {
          duration: 620,
          delay: i * per,
          easing: EASE_OUT,
          fill: "backwards",
        });
      });
      for (const node of root.querySelectorAll("[data-fade]")) fadeIn(node, 360, 520);
    },
    { disabled: !animate },
  );

  const rangeName = (item: BulletItem) => {
    const level = bulletLevel(item.actual, item.ranges);
    return level < 0 ? undefined : (rangeLabels[level] ?? `#${level + 1}`);
  };
  const describe = (item: BulletItem) => {
    const fmt = fmtOf(item);
    const level = rangeName(item);
    return `${item.label}: ${actualLabel} ${fmt(item.actual)}${
      item.target == null ? "" : `, ${targetLabel} ${fmt(item.target)}`
    }${level ? `, ${level}` : ""}`;
  };
  const current = active != null ? (items[active] as BulletItem) : null;
  const valueText = current ? describe(current) : labels.explore;

  const tooltipRows = (item: BulletItem): TooltipRow[] => {
    const fmt = fmtOf(item);
    const level = rangeName(item);
    return [
      { id: "actual", name: actualLabel, value: fmt(item.actual), color: color, shape: "square" },
      ...(item.target == null
        ? []
        : [
            {
              id: "target",
              name: targetLabel,
              value: fmt(item.target),
              color: "var(--ink)",
              shape: "line" as const,
            },
          ]),
      ...(level
        ? [
            {
              id: "range",
              name: level,
              value: "",
              color: bandFill(bulletLevel(item.actual, item.ranges), bandCount),
              shape: "square" as const,
              emphasis: true,
            },
          ]
        : []),
    ];
  };

  const bandRects = (
    item: BulletItem,
    index: number,
  ): Array<{ band: BulletBand; x: number; y: number; w: number; h: number }> =>
    bulletBands(item.ranges).map((band) => {
      const a = toPx(item, band.from);
      const b = toPx(item, band.to);
      return vertical
        ? {
            band,
            x: index * slot + (slot - thick) / 2,
            y: Math.min(a, b),
            w: thick,
            h: Math.abs(a - b),
          }
        : {
            band,
            x: Math.min(a, b),
            y: index * slot + (slot - thick) / 2,
            w: Math.abs(a - b),
            h: thick,
          };
    });

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
        <g transform={`translate(${left},${top})`}>
          {shared ? (
            vertical ? (
              <>
                <GridLines ticks={ticks} direction="horizontal" length={innerWidth} />
                <AxisLeft ticks={ticks} offset={0} />
              </>
            ) : (
              <>
                <GridLines ticks={ticks} direction="vertical" length={innerHeight} />
                <AxisBottom ticks={ticks} offset={innerHeight} />
              </>
            )
          ) : null}
          {vertical ? (
            <AxisBottom
              ticks={items.map((item, i) => ({
                key: item.id ?? item.label,
                position: i * slot + slot / 2,
                label: fitLabel(item.label, slot - 4),
              }))}
              offset={innerHeight}
            />
          ) : (
            <AxisLeft
              ticks={items.map((item, i) => ({
                key: item.id ?? item.label,
                position: i * slot + slot / 2,
                label: fitLabel(item.label, labelWidth - 14),
              }))}
              offset={0}
            />
          )}
          {items.map((item, i) => {
            const dimmed = active != null && active !== i;
            const fmt = fmtOf(item);
            const centre = i * slot + slot / 2;
            const actualPx = toPx(item, item.actual);
            const targetPx = item.target == null ? null : toPx(item, item.target);
            const barThick = thick * 0.34;
            return (
              <g
                key={item.id ?? item.label}
                className="motion-safe:transition-opacity motion-safe:duration-150"
                style={{ opacity: dimmed ? 0.45 : 1 }}
              >
                {bandRects(item, i).map(({ band, x, y, w, h }) => (
                  <rect
                    key={band.index}
                    x={x}
                    y={y}
                    width={Math.max(0, w)}
                    height={Math.max(0, h)}
                    style={{ fill: bandFill(band.index, bandCount) }}
                  />
                ))}
                {vertical ? (
                  <rect
                    data-bar=""
                    x={centre - barThick / 2}
                    y={actualPx}
                    width={barThick}
                    height={Math.max(1, innerHeight - actualPx)}
                    rx={2}
                    style={{
                      fill: color,
                      transformBox: "fill-box",
                      transformOrigin: "center bottom",
                    }}
                  />
                ) : (
                  <rect
                    data-bar=""
                    x={0}
                    y={centre - barThick / 2}
                    width={Math.max(1, actualPx)}
                    height={barThick}
                    rx={2}
                    style={{
                      fill: color,
                      transformBox: "fill-box",
                      transformOrigin: "left center",
                    }}
                  />
                )}
                {targetPx != null ? (
                  <line
                    data-fade=""
                    x1={vertical ? centre - thick * 0.36 : targetPx}
                    x2={vertical ? centre + thick * 0.36 : targetPx}
                    y1={vertical ? targetPx : centre - thick * 0.36}
                    y2={vertical ? targetPx : centre + thick * 0.36}
                    strokeWidth={3}
                    strokeLinecap="round"
                    style={{ stroke: "var(--ink)" }}
                  />
                ) : null}
                {valueLabels && vertical ? (
                  <text
                    data-fade=""
                    x={centre}
                    y={-8}
                    textAnchor="middle"
                    className="font-bold text-[11px] tabular-nums"
                    style={{ fill: "var(--ink-2)" }}
                  >
                    {fmt(item.actual)}
                  </text>
                ) : null}
                {!vertical && valueColumn > 20 ? (
                  <text
                    data-fade=""
                    x={innerWidth + 10}
                    y={centre}
                    dy="0.34em"
                    className="font-bold text-[11px] tabular-nums"
                    style={{ fill: "var(--ink-2)" }}
                  >
                    {item.target == null
                      ? fmt(item.actual)
                      : `${fmt(item.actual)} / ${fmt(item.target)}`}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>
      <PlotOverlay
        left={vertical ? left : 0}
        top={top}
        width={vertical ? innerWidth : width}
        height={innerHeight}
        label={labels.explore}
        count={count}
        active={active}
        valueText={valueText}
        onActiveChange={setActive}
        keys={vertical ? "horizontal" : "vertical"}
        indexAt={({ x, y }) =>
          count ? Math.min(count - 1, Math.max(0, Math.floor((vertical ? x : y) / slot))) : null
        }
      />
      {tooltip && current && active != null ? (
        <ChartTooltip
          x={vertical ? left + active * slot + slot / 2 : left + toPx(current, current.actual)}
          y={vertical ? top + toPx(current, current.actual) : top + active * slot + slot / 2}
          containerWidth={width}
          title={current.label}
          rows={tooltipRows(current)}
        />
      ) : null}
    </div>
  );
}
