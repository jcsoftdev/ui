"use client";

import { useEffect, useId, useMemo, useRef } from "react";
import { cn } from "../../utils/cn.js";
import { ChartFrame } from "../core/chart-frame.js";
import { ChartDataTable } from "../core/data-table.js";
import { formatPercent, resolveFormat, type ValueFormat } from "../core/format.js";
import { EASE_OUT, useEntryAnimation, useReducedMotion } from "../core/motion.js";
import { seriesColor } from "../core/palette.js";
import { type ChartLabels, resolveLabels } from "../core/types.js";
import { UNIT_FRAME_CLASS } from "../core/unit-glyph.js";
import { type ResolvedUnitShape, resolveUnitShape, type UnitIcon } from "../core/unit-icons.js";

export interface FillGaugeItem {
  id: string;
  name: string;
  value: number;
  /** Value of a full shape; the chart `max` by default. */
  max?: number;
  color?: string;
  /** Shape of this gauge; the chart `shape` by default. */
  shape?: UnitIcon;
}

export interface FillGaugeChartProps {
  title: string;
  description?: string;
  data: readonly FillGaugeItem[];
  /** Built-in shape ("battery", "droplet", "bottle", "person", "target", "shield", ...) or your own. */
  shape?: UnitIcon;
  /** Value of a full shape (1 for fractions, 100 for percentages, 24 for a box of 24 bottles). */
  max?: number;
  /** "wave": a moving liquid surface; "flat": a still level. Shapes that fill sideways are always flat. */
  level?: "wave" | "flat";
  /** Format of the label inside the shape. By default the fill share ("75%"). */
  valueFormat?: ValueFormat;
  /** Smallest width of one gauge; more gauges than fit wrap to new rows. */
  minItemWidth?: number;
  height?: number | "fill";
  /** Width / height ratio; sizes the gauges from the container width. */
  aspectRatio?: number;
  animate?: boolean;
  loading?: boolean;
  labels?: Partial<ChartLabels>;
  className?: string;
}

const NAME_SPACE = 24;

/**
 * Silhouettes filled to a level: stock left in a bottle, a battery of
 * capacity, a droplet of water, a target reached. Several gauges sit side by
 * side for comparisons and wrap to new rows in narrow containers. The value
 * inside switches color where the liquid crosses it, so it reads on both.
 */
export function FillGaugeChart({
  title,
  description,
  data,
  shape = "droplet",
  max = 1,
  level = "wave",
  valueFormat,
  minItemWidth = 104,
  height = 200,
  aspectRatio,
  animate = true,
  loading = false,
  labels: labelsProp,
  className,
}: FillGaugeChartProps) {
  const labels = resolveLabels(labelsProp);
  const raw = resolveFormat(valueFormat);
  const ratioOf = (item: FillGaugeItem) => {
    const full = item.max ?? max;
    if (!(full > 0) || !Number.isFinite(item.value)) return 0;
    return Math.min(1, Math.max(0, item.value / full));
  };
  const labelOf = (item: FillGaugeItem) =>
    valueFormat ? raw(item.value) : formatPercent(ratioOf(item), { decimals: 0 });

  return (
    <ChartFrame
      height={height}
      aspectRatio={aspectRatio}
      labels={labels}
      loading={loading}
      empty={data.length === 0}
      skeleton="ring"
      table={
        <ChartDataTable
          caption={description ? `${title}. ${description}` : title}
          categoryHeader={labels.category}
          categories={data.map((item) => item.name)}
          columns={[
            { id: "value", name: title, values: data.map((item) => raw(item.value)) },
            { id: "max", name: "Max", values: data.map((item) => raw(item.max ?? max)) },
            {
              id: "share",
              name: "%",
              values: data.map((item) => formatPercent(ratioOf(item))),
            },
          ]}
        />
      }
      className={cn(UNIT_FRAME_CLASS, className)}
    >
      {(width, measuredHeight) => {
        const columns = Math.max(1, Math.min(data.length, Math.floor(width / minItemWidth)));
        const rows = Math.ceil(data.length / columns);
        const cellWidth = width / columns;
        const cellHeight = measuredHeight / rows;
        const size = Math.max(16, Math.min(cellWidth * 0.8, cellHeight - NAME_SPACE - 6));
        const blockTop = (row: number) => row * cellHeight + (cellHeight - NAME_SPACE - size) / 2;
        return (
          <div className="relative" style={{ width, height: measuredHeight }}>
            <svg
              role="img"
              aria-label={title}
              width={width}
              height={measuredHeight}
              className="block"
            >
              {data.map((item, index) => {
                const column = index % columns;
                const row = Math.floor(index / columns);
                return (
                  <Gauge
                    key={item.id}
                    shape={resolveUnitShape(item.shape ?? shape)}
                    x={column * cellWidth + (cellWidth - size) / 2}
                    y={blockTop(row)}
                    size={size}
                    ratio={ratioOf(item)}
                    color={seriesColor(index, item.color)}
                    label={labelOf(item)}
                    wave={level === "wave"}
                    animate={animate}
                  />
                );
              })}
            </svg>
            {data.map((item, index) => {
              const column = index % columns;
              const row = Math.floor(index / columns);
              return (
                <div
                  key={item.id}
                  aria-hidden="true"
                  className="absolute truncate px-1 text-center font-semibold text-fs-120 text-ink-2"
                  style={{
                    left: column * cellWidth,
                    top: blockTop(row) + size + 2,
                    width: cellWidth,
                    lineHeight: `${NAME_SPACE}px`,
                  }}
                >
                  {item.name}
                </div>
              );
            })}
          </div>
        );
      }}
    </ChartFrame>
  );
}

interface GaugeProps {
  shape: ResolvedUnitShape;
  x: number;
  y: number;
  size: number;
  ratio: number;
  color: string;
  label: string;
  wave: boolean;
  animate: boolean;
}

/**
 * Liquid surface from one wavelength before the shape to one after it, so
 * sliding it left by one wavelength loops without a seam.
 */
function wavePath(width: number, height: number, top: number, amplitude: number): string {
  const wavelength = width / 2;
  const half = wavelength / 2;
  const halves = Math.ceil((width + 2 * wavelength) / half);
  let d = `M${-wavelength} ${top}`;
  for (let i = 0; i < halves; i += 1) {
    const x0 = -wavelength + i * half;
    const crest = i % 2 === 0 ? top - amplitude : top + amplitude;
    d += `Q${x0 + half / 2} ${crest} ${x0 + half} ${top}`;
  }
  return `${d}V${height + 2}H${-wavelength}Z`;
}

function Gauge({ shape, x, y, size, ratio, color, label, wave, animate }: GaugeProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const groupRef = useRef<SVGGElement>(null);
  const reduced = useReducedMotion();
  const sideways = shape.fill === "right";
  const waving = wave && !sideways && ratio > 0 && ratio < 1;
  const scale = size / Math.max(shape.width, shape.height);
  const dx = x + (size - shape.width * scale) / 2;
  const dy = y + (size - shape.height * scale) / 2;
  const top = shape.height * (1 - ratio);
  const amplitude = shape.height * 0.025;
  const fontSize = Math.max(12, Math.min(28, size * 0.2)) / scale;

  const liquid = useMemo(() => {
    if (sideways) return { kind: "rect" as const, width: shape.width * ratio };
    return { kind: waving ? ("wave" as const) : ("rect" as const), width: shape.width };
  }, [sideways, waving, shape.width, ratio]);

  useEntryAnimation(
    groupRef,
    (root) => {
      const rise = root.querySelector("[data-liquid]");
      if (!rise) return;
      const from = sideways ? "scaleX(0)" : `translateY(${shape.height * ratio}px)`;
      rise.animate([{ transform: from }, { transform: "none" }], {
        duration: 1100,
        easing: EASE_OUT,
        fill: "backwards",
      });
    },
    { disabled: !animate, replayKey: ratio },
  );

  useEffect(() => {
    const surface = groupRef.current?.querySelector("[data-wave]");
    if (!waving || !animate || reduced || !surface || typeof surface.animate !== "function") return;
    const motion = surface.animate(
      [{ transform: "translateX(0)" }, { transform: `translateX(${-shape.width / 2}px)` }],
      { duration: 1800, iterations: Number.POSITIVE_INFINITY, easing: "linear" },
    );
    return () => motion.cancel();
  }, [waving, animate, reduced, shape.width]);

  const textY = shape.labelY;
  const levelClip = sideways ? (
    <rect x={0} y={0} width={shape.width * ratio} height={shape.height} />
  ) : (
    <rect x={0} y={top} width={shape.width} height={shape.height - top} />
  );

  return (
    <g ref={groupRef} transform={`translate(${dx} ${dy}) scale(${scale})`}>
      <defs>
        <clipPath id={`${uid}-shape`}>
          <path d={shape.path} style={{ fillRule: shape.fillRule }} />
        </clipPath>
        <clipPath id={`${uid}-level`}>{levelClip}</clipPath>
      </defs>
      <path d={shape.path} style={{ fill: "var(--track)", fillRule: shape.fillRule }} />
      <g clipPath={`url(#${uid}-shape)`}>
        <g
          data-liquid=""
          style={{
            transformBox: "fill-box",
            transformOrigin: sideways ? "left center" : "center bottom",
          }}
        >
          {liquid.kind === "wave" ? (
            <path
              data-wave=""
              d={wavePath(shape.width, shape.height, top, amplitude)}
              style={{ fill: color }}
            />
          ) : (
            <rect
              x={0}
              y={sideways ? 0 : top}
              width={liquid.width}
              height={sideways ? shape.height : shape.height - top}
              style={{ fill: color }}
            />
          )}
        </g>
      </g>
      {shape.detail ? (
        <path
          d={shape.detail}
          vectorEffect="non-scaling-stroke"
          strokeWidth={1.5}
          style={{ fill: "none", stroke: "var(--surface)", strokeOpacity: 0.7 }}
        />
      ) : null}
      <path
        d={shape.path}
        vectorEffect="non-scaling-stroke"
        strokeWidth={1.25}
        style={{ fill: "none", stroke: "var(--line-strong)", fillRule: shape.fillRule }}
      />
      <text
        x={shape.width / 2}
        y={textY}
        dominantBaseline="central"
        textAnchor="middle"
        className="fill-ink font-bold tabular-nums"
        style={{ fontSize }}
      >
        {label}
      </text>
      <text
        x={shape.width / 2}
        y={textY}
        dominantBaseline="central"
        textAnchor="middle"
        clipPath={`url(#${uid}-level)`}
        className="font-bold tabular-nums"
        style={{ fontSize, fill: "var(--surface)" }}
      >
        {label}
      </text>
    </g>
  );
}
