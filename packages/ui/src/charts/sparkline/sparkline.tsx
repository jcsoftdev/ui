"use client";

import { type PointerEvent, useId, useMemo, useRef, useState } from "react";
import { cn } from "../../utils/cn.js";
import { resolveFormat, type ValueFormat } from "../core/format.js";
import { EASE_OUT, revealClip, useEntryAnimation } from "../core/motion.js";
import { seriesColor } from "../core/palette.js";
import { areaPath, barPath, linePath, type Point } from "../core/path.js";
import { bandScale, pointScale } from "../core/scales/band.js";
import { extent } from "../core/scales/linear.js";
import { useChartSize } from "../core/use-chart-size.js";

export type SparklineType = "line" | "area" | "bar";

export interface SparklineProps {
  data: ReadonlyArray<number | null>;
  /** Accessible description, e.g. "Ventas de los últimos 14 días". */
  label: string;
  type?: SparklineType;
  /** CSS color; the brand tone (`accent-word`) by default. */
  color?: string;
  /** Pixels, or "fill" to take the full height of the parent. */
  height?: number | "fill";
  /** Fixed width; fills the container when omitted. */
  width?: number;
  /** Dot on the last value (lines and areas). */
  showLast?: boolean;
  /** Format of the hovered value and the summary for screen readers. */
  valueFormat?: ValueFormat;
  /** Optional names of the points, shown next to the hovered value. */
  categories?: readonly string[];
  /** Index of a bar drawn in full color while the others are muted (bars only). */
  highlightIndex?: number;
  animate?: boolean;
  className?: string;
}

const PAD = 3;

/**
 * Word-sized chart for KPI tiles: no axes, no legend. Hovering shows the
 * point's value; screen readers get a one-sentence summary (first, last,
 * minimum and maximum).
 */
export function Sparkline({
  data,
  label,
  type = "line",
  color,
  height: heightProp = 36,
  width: fixedWidth,
  showLast = true,
  valueFormat,
  categories,
  highlightIndex,
  animate = true,
  className,
}: SparklineProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const fill = heightProp === "fill";
  const [ref, size] = useChartSize<HTMLDivElement>({ width: fixedWidth ?? 120, height: 36 });
  const width = fixedWidth ?? size.width;
  const height = fill ? size.height : heightProp;
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const stroke = color ?? seriesColor(0);
  const format = resolveFormat(valueFormat);

  const shape = useMemo(() => {
    const [lo0, hi0] = extent(data) ?? [0, 1];
    const lo = type === "bar" ? Math.min(0, lo0) : lo0;
    const hi = type === "bar" ? Math.max(0, hi0) : hi0;
    const span = hi - lo || 1;
    const y = (value: number) => PAD + (1 - (value - lo) / span) * (height - PAD * 2);
    if (type === "bar") {
      const band = bandScale({
        count: data.length,
        range: [0, width],
        paddingInner: 0.28,
        paddingOuter: 0,
      });
      const zero = y(0);
      const bars = data.map((value, index) => {
        if (value == null) return null;
        const top = Math.min(y(value), zero);
        const size = Math.max(1, Math.abs(y(value) - zero));
        return {
          index,
          d: barPath(
            band.start(index),
            top,
            band.bandwidth,
            size,
            2,
            value >= 0 ? "top" : "bottom",
          ),
          point: { x: band.center(index), y: y(value) },
        };
      });
      return { kind: "bar" as const, bars, indexAt: band.indexAt };
    }
    const scale = pointScale({ count: data.length, range: [PAD, width - PAD] });
    const points: Array<Point | null> = data.map((value, index) =>
      value == null ? null : { x: scale.center(index), y: y(value) },
    );
    const bottom = points.map((point, index) => ({
      x: point?.x ?? scale.center(index),
      y: height,
    }));
    return {
      kind: "line" as const,
      points,
      line: linePath(points, "smooth"),
      area: type === "area" ? areaPath(points, bottom, "smooth") : undefined,
      indexAt: scale.indexAt,
    };
  }, [data, type, width, height]);

  useEntryAnimation(
    svgRef,
    (root) => {
      const clip = root.querySelector("[data-reveal]");
      if (clip) revealClip(clip, 700);
      root.querySelectorAll("[data-bar]").forEach((bar, index) => {
        bar.animate([{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }], {
          duration: 480,
          delay: index * 18,
          easing: EASE_OUT,
          fill: "backwards",
        });
      });
    },
    { disabled: !animate },
  );

  const values = data.filter((value): value is number => value != null);
  const summary = values.length
    ? `${label}: ${format(values[0] as number)} → ${format(values[values.length - 1] as number)} (min ${format(
        Math.min(...values),
      )}, max ${format(Math.max(...values))})`
    : label;

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setActive(shape.indexAt(event.clientX - rect.left));
  };

  const lastIndex = (() => {
    for (let i = data.length - 1; i >= 0; i -= 1) if (data[i] != null) return i;
    return -1;
  })();
  const activePoint =
    active == null
      ? null
      : shape.kind === "bar"
        ? (shape.bars[active]?.point ?? null)
        : (shape.points[active] ?? null);
  const activeValue = active != null ? data[active] : null;

  return (
    <div
      ref={ref}
      className={cn(
        "relative min-w-0",
        fixedWidth == null && "w-full",
        fill && "h-full",
        className,
      )}
      style={{ height: fill ? undefined : height, width: fixedWidth }}
    >
      <svg
        ref={svgRef}
        role="img"
        aria-label={summary}
        width={width}
        height={height}
        className="block overflow-visible"
        onPointerMove={onPointerMove}
        onPointerLeave={() => setActive(null)}
      >
        <defs>
          <clipPath id={`${uid}-reveal`}>
            <rect
              data-reveal=""
              x={-4}
              y={-4}
              width={width + 8}
              height={height + 8}
              style={{ transformBox: "fill-box", transformOrigin: "left center" }}
            />
          </clipPath>
          <linearGradient id={`${uid}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: stroke, stopOpacity: 0.32 }} />
            <stop offset="100%" style={{ stopColor: stroke, stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        {shape.kind === "bar" ? (
          <g>
            {shape.bars.map((bar) =>
              bar ? (
                <path
                  key={bar.index}
                  d={bar.d}
                  data-bar=""
                  className="transition-opacity duration-150"
                  style={{
                    fill: stroke,
                    opacity:
                      (highlightIndex != null && highlightIndex !== bar.index) ||
                      (active != null && active !== bar.index)
                        ? 0.38
                        : 1,
                    transformBox: "fill-box",
                    transformOrigin: "center bottom",
                  }}
                />
              ) : null,
            )}
          </g>
        ) : (
          <g clipPath={`url(#${uid}-reveal)`}>
            {shape.area ? <path d={shape.area} style={{ fill: `url(#${uid}-fill)` }} /> : null}
            <path
              d={shape.line}
              fill="none"
              strokeWidth={1.75}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ stroke }}
            />
            {showLast && lastIndex >= 0 && active == null ? (
              <circle
                cx={(shape.points[lastIndex] as Point).x}
                cy={(shape.points[lastIndex] as Point).y}
                r={2.75}
                strokeWidth={1.5}
                style={{ fill: stroke, stroke: "var(--surface)" }}
              />
            ) : null}
          </g>
        )}
        {activePoint && shape.kind === "line" ? (
          <circle
            cx={activePoint.x}
            cy={activePoint.y}
            r={3.5}
            strokeWidth={2}
            style={{ fill: stroke, stroke: "var(--surface)" }}
          />
        ) : null}
      </svg>
      {activePoint && activeValue != null ? (
        <div
          aria-hidden="true"
          className="-translate-x-1/2 pointer-events-none absolute bottom-full z-10 mb-1.5 whitespace-nowrap rounded-[8px] bg-float px-2 py-1 font-bold text-[11px] text-ink tabular-nums shadow-pop"
          style={{ left: Math.min(Math.max(activePoint.x, 24), width - 24) }}
        >
          {categories?.[active as number] ? (
            <span className="mr-1.5 font-semibold text-ink-3">{categories[active as number]}</span>
          ) : null}
          {format(activeValue)}
        </div>
      ) : null}
    </div>
  );
}
