"use client";

import { memo, type ReactNode, useCallback, useId, useMemo, useRef } from "react";
import { cn } from "../../utils/cn.js";
import { DECORATIVE } from "../core/a11y.js";
import { ChartFrame } from "../core/chart-frame.js";
import { ChartDataTable } from "../core/data-table.js";
import { resolveFormat, type ValueFormat } from "../core/format.js";
import {
  EASE_OUT,
  fadeIn,
  fadeKeyframes,
  useAnimatedNumber,
  useEntryAnimation,
} from "../core/motion.js";
import { type ChartTone, TONE_COLORS } from "../core/palette.js";
import { arcLine, degToRad, polarPoint, radToDeg } from "../core/polar.js";
import { ChartTooltip } from "../core/tooltip.js";
import { type ChartLabels, resolveLabels } from "../core/types.js";
import { useIndexNavigation } from "../core/use-index-navigation.js";
import { layoutGauge, showEndLabels } from "./gauge-layout.js";

export interface GaugeRange {
  from: number;
  to: number;
  /** Name in the tooltip and data table, e.g. "Óptimo". */
  label?: string;
  /** Status color family; ignored when `color` is set. */
  tone?: ChartTone;
  /** Any CSS color. */
  color?: string;
}

export interface GaugeChartProps {
  title: string;
  description?: string;
  value: number;
  min?: number;
  max?: number;
  /** `semi` is a half circle, `three-quarter` a 270 degree arc. */
  variant?: "semi" | "three-quarter";
  /** Filled arc (`progress`) or a pointer over the bands (`needle`). */
  mode?: "progress" | "needle";
  /** Colored bands. With `progress` they sit behind the arc and the arc takes the color of the band it is in. */
  ranges?: readonly GaugeRange[];
  height?: number | "fill";
  /** Width / height ratio; sizes the drawing from the container width when `height` is not "fill". */
  aspectRatio?: number;
  /** Arc thickness in pixels. */
  thickness?: number;
  roundedCaps?: boolean;
  /** Value labels along the inside of the arc (count of divisions, 0 = none). */
  ticks?: number;
  /** Draws a tick line at every division (and at each minor step), like a dial. */
  tickMarks?: boolean;
  /** Minor tick lines between two divisions; only with `tickMarks`. */
  minorTicks?: number;
  /** Replaces the value and caption in the middle with your own content (HTML, sized to the arc). */
  centerContent?: (context: GaugeCenterContext) => ReactNode;
  /** Min and max under the ends of the arc. */
  minMaxLabels?: boolean;
  /** Caption under the value, e.g. "Ocupación de sillas". */
  label?: string;
  valueFormat?: ValueFormat;
  tooltip?: boolean;
  loading?: boolean;
  animate?: boolean;
  labels?: Partial<ChartLabels>;
  className?: string;
}

export interface GaugeCenterContext {
  /** Latest value. */
  value: number;
  /** Value being displayed while it animates. */
  shown: number;
  /** Formatted `shown`. */
  text: string;
  /** Color of the band the value is in. */
  color: string;
  /** Name of the band the value is in, if it has one. */
  band?: string;
  /** Caption passed as `label`. */
  caption?: string;
}

const BASE_TONE: ChartTone = "accent";

function rangeColor(range: GaugeRange): string {
  return range.color ?? TONE_COLORS[range.tone ?? BASE_TONE].ink;
}

/**
 * Gauge (semi or three-quarter arc). Colored range bands, a filled progress
 * arc or a needle, min/max labels, optional ticks and an animated value.
 * Bands are explorable with the keyboard and show a tooltip.
 */
export function GaugeChart({
  title,
  description,
  value,
  min = 0,
  max = 100,
  variant = "semi",
  mode = "progress",
  ranges,
  height,
  aspectRatio,
  thickness = 18,
  roundedCaps = true,
  ticks = 0,
  tickMarks = false,
  minorTicks = 4,
  centerContent,
  minMaxLabels = true,
  label,
  valueFormat,
  tooltip = true,
  loading = false,
  animate = true,
  labels: labelsProp,
  className,
}: GaugeChartProps) {
  const labels = resolveLabels(labelsProp);
  const format = useMemo(() => resolveFormat(valueFormat), [valueFormat]);
  const frameHeight = height ?? (variant === "semi" ? 230 : 290);
  const bands = ranges ?? [];
  const empty = !Number.isFinite(value) || !(max > min);

  const table = (
    <ChartDataTable
      caption={description ? `${title}. ${description}` : title}
      categoryHeader={labels.category}
      categories={[
        labels.value,
        ...bands.map((band) => band.label ?? `${format(band.from)} – ${format(band.to)}`),
      ]}
      columns={[
        {
          id: "value",
          name: labels.value,
          values: [
            format(value),
            ...bands.map((band) => `${format(band.from)} – ${format(band.to)}`),
          ],
        },
      ]}
    />
  );

  return (
    <ChartFrame
      height={frameHeight}
      aspectRatio={aspectRatio}
      labels={labels}
      loading={loading}
      empty={empty}
      skeleton="ring"
      table={table}
      className={className}
    >
      {(width, measuredHeight) => (
        <GaugePlot
          width={width}
          height={measuredHeight}
          title={title}
          value={value}
          min={min}
          max={max}
          variant={variant}
          mode={mode}
          bands={bands}
          thickness={thickness}
          roundedCaps={roundedCaps}
          ticks={ticks}
          tickMarks={tickMarks}
          minorTicks={Math.max(0, Math.round(minorTicks))}
          centerContent={centerContent}
          minMaxLabels={minMaxLabels}
          caption={label}
          format={format}
          tooltip={tooltip}
          animate={animate}
          labels={labels}
        />
      )}
    </ChartFrame>
  );
}

interface PlotProps {
  width: number;
  height: number;
  title: string;
  value: number;
  min: number;
  max: number;
  variant: "semi" | "three-quarter";
  mode: "progress" | "needle";
  bands: readonly GaugeRange[];
  thickness: number;
  roundedCaps: boolean;
  ticks: number;
  tickMarks: boolean;
  minorTicks: number;
  centerContent?: (context: GaugeCenterContext) => ReactNode;
  minMaxLabels: boolean;
  caption?: string;
  format: (value: number) => string;
  tooltip: boolean;
  animate: boolean;
  labels: ChartLabels;
}

function GaugePlot({
  width,
  height,
  title,
  value,
  min,
  max,
  variant,
  mode,
  bands,
  thickness,
  roundedCaps,
  ticks,
  tickMarks,
  minorTicks,
  centerContent,
  minMaxLabels,
  caption,
  format,
  tooltip,
  animate,
  labels,
}: PlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const shown = useAnimatedNumber(value, { from: min, disabled: !animate });
  const items = bands.length > 0 ? bands.length : 1;
  const nav = useIndexNavigation(items, { wrap: false });

  const half = variant === "semi" ? 90 : 135;
  const a0 = degToRad(-half);
  const a1 = degToRad(half);
  const span = a1 - a0;
  const needle = mode === "needle";
  const endLabels = showEndLabels(minMaxLabels, ticks);
  const uid = useId();
  const valueChars = Math.max(format(min).length, format(max).length, format(value).length);
  const layout = layoutGauge({
    width,
    height,
    variant,
    mode,
    thickness,
    endLabels,
    customCenter: Boolean(centerContent),
    caption: Boolean(caption),
    bandLabel: bands.length > 0,
    valueChars,
  });
  const { radius, band, cx, cy, mid, valueSize } = layout;

  const toFraction = (v: number) => Math.min(1, Math.max(0, (v - min) / (max - min)));
  const angleFor = useCallback(
    (v: number) => a0 + span * Math.min(1, Math.max(0, (v - min) / (max - min))),
    [a0, span, min, max],
  );
  const capAngle = roundedCaps ? band / 2 / mid : 0;

  const fraction = toFraction(shown);
  // Colour and label follow the target value, so they do not flip band by band
  // while the arc or needle sweeps towards it.
  const active = bands.find((item) => value >= item.from && value <= item.to);
  const valueColor = active ? rangeColor(active) : "var(--accent-word)";
  const progressEnd = a0 + capAngle + (span - 2 * capAngle) * fraction;

  const bandPaths = useMemo(
    () =>
      bands.map((item) => {
        const from = angleFor(Math.min(item.from, item.to)) + 0.006;
        const to = angleFor(Math.max(item.from, item.to)) - 0.006;
        return arcLine(cx, cy, mid, from, Math.max(from + 0.002, to));
      }),
    [bands, cx, cy, mid, angleFor],
  );

  const tickLabels = useMemo(() => {
    if (ticks < 1) return [];
    return Array.from({ length: ticks + 1 }, (_, i) => {
      const v = min + ((max - min) * i) / ticks;
      const point = polarPoint(cx, cy, radius - band - (tickMarks ? 20 : 12), angleFor(v));
      return { v, ...point };
    });
  }, [ticks, tickMarks, min, max, cx, cy, radius, band, angleFor]);

  const tickLines = useMemo(() => {
    if (!tickMarks) return "";
    const divisions = Math.max(1, ticks);
    const steps = divisions * (minorTicks + 1);
    const inner = radius - band - 3;
    let d = "";
    for (let i = 0; i <= steps; i++) {
      const major = i % (minorTicks + 1) === 0;
      const angle = angleFor(min + ((max - min) * i) / steps);
      const from = polarPoint(cx, cy, inner, angle);
      const to = polarPoint(cx, cy, inner - (major ? 8 : 4), angle);
      d += `M${from.x.toFixed(2)} ${from.y.toFixed(2)}L${to.x.toFixed(2)} ${to.y.toFixed(2)}`;
    }
    return d;
  }, [tickMarks, ticks, minorTicks, min, max, cx, cy, radius, band, angleFor]);

  useEntryAnimation(
    svgRef,
    (root) => {
      root.querySelectorAll("[data-band]").forEach((node, i) => {
        node.animate(fadeKeyframes(node), {
          duration: 500,
          delay: i * 90,
          easing: EASE_OUT,
          fill: "backwards",
        });
      });
      root.querySelectorAll("[data-fade]").forEach((node) => {
        fadeIn(node, 420, 200);
      });
    },
    { disabled: !animate },
  );

  // Value text ---------------------------------------------------------------
  const captionSize = 12;
  const valueY = cy + layout.valueDy;
  const captionY = cy + layout.captionDy;
  const labelY = cy + layout.labelDy;

  // Tooltip -----------------------------------------------------------------
  const focused = nav.active != null ? nav.active : null;
  const focusedBand = bands.length > 0 && focused != null ? bands[focused] : undefined;
  const rows = focusedBand
    ? [
        {
          id: `${focused}`,
          name: focusedBand.label ?? `${format(focusedBand.from)} – ${format(focusedBand.to)}`,
          value: `${format(focusedBand.from)} – ${format(focusedBand.to)}`,
          color: rangeColor(focusedBand),
          shape: "square" as const,
          note: value >= focusedBand.from && value <= focusedBand.to ? labels.value : undefined,
        },
      ]
    : focused != null
      ? [
          {
            id: "value",
            name: caption ?? title,
            value: format(value),
            color: valueColor,
            shape: "dot" as const,
          },
        ]
      : [];
  const anchor =
    nav.pointer ??
    (focused != null
      ? focusedBand
        ? polarPoint(cx, cy, mid, angleFor((focusedBand.from + focusedBand.to) / 2))
        : polarPoint(cx, cy, mid, progressEnd)
      : null);
  const valueText = focusedBand
    ? `${focusedBand.label ?? ""} ${format(focusedBand.from)} – ${format(focusedBand.to)}`.trim()
    : `${caption ?? title}: ${format(value)}${active?.label ? `, ${active.label}` : ""}`;

  const endPoint = (angle: number) => polarPoint(cx, cy, mid, angle);
  const minPoint = endPoint(a0);
  const maxPoint = endPoint(a1);

  return (
    <div ref={nav.ref} className="relative" style={{ width, height }}>
      <svg
        ref={svgRef}
        role="img"
        aria-label={`${title}: ${format(value)}`}
        width={width}
        height={height}
        className="block overflow-visible"
      >
        {roundedCaps && bands.length > 0 ? (
          <defs>
            <mask
              id={`${uid}-track`}
              maskUnits="userSpaceOnUse"
              x={0}
              y={0}
              width={width}
              height={height}
            >
              <path
                d={arcLine(cx, cy, mid, a0 + capAngle, a1 - capAngle)}
                fill="none"
                stroke="white"
                strokeWidth={band}
                strokeLinecap="round"
              />
            </mask>
          </defs>
        ) : null}

        {bands.length === 0 ? (
          <path
            d={arcLine(cx, cy, mid, a0 + capAngle, a1 - capAngle)}
            fill="none"
            strokeWidth={band}
            strokeLinecap={roundedCaps ? "round" : "butt"}
            style={{ stroke: "var(--chart-grid)" }}
          />
        ) : (
          <g mask={roundedCaps ? `url(#${uid}-track)` : undefined}>
            {bandPaths.map((path, index) => {
              const item = bands[index];
              if (!item || !path) return null;
              return (
                <BandMark
                  // biome-ignore lint/suspicious/noArrayIndexKey: bands are positional and static.
                  key={index}
                  d={path}
                  width={band}
                  color={rangeColor(item)}
                  opacity={needle ? 0.92 : 0.26}
                  dimmed={focused != null && focused !== index}
                  onEnter={(event) => nav.hover(index, event)}
                  onLeave={nav.leave}
                />
              );
            })}
          </g>
        )}

        {!needle && fraction > 0 ? (
          <path
            d={arcLine(cx, cy, mid, a0 + capAngle, Math.max(progressEnd, a0 + capAngle + 1e-3))}
            fill="none"
            strokeWidth={band}
            strokeLinecap={roundedCaps ? "round" : "butt"}
            className="pointer-events-none"
            style={{ stroke: valueColor }}
          />
        ) : null}

        {tickLines ? (
          <path
            d={tickLines}
            fill="none"
            strokeWidth={1.4}
            strokeLinecap="round"
            {...DECORATIVE}
            className="pointer-events-none"
            style={{ stroke: "var(--ink-3)", strokeOpacity: 0.7 }}
          />
        ) : null}

        {tickLabels.map((tick) => (
          <text
            key={tick.v}
            data-fade=""
            x={tick.x}
            y={tick.y}
            textAnchor="middle"
            dominantBaseline="central"
            {...DECORATIVE}
            className="fill-ink-3 font-medium text-[10px] tabular-nums"
          >
            {format(tick.v)}
          </text>
        ))}

        {needle ? (
          <g
            className="pointer-events-none"
            style={{
              transform: `rotate(${Math.round(radToDeg(angleFor(shown)) * 100) / 100}deg)`,
              transformOrigin: `${cx}px ${cy}px`,
            }}
          >
            <path
              d={`M${cx - 4} ${cy} L${cx} ${cy - layout.needleLength} L${cx + 4} ${cy} Z`}
              style={{ fill: "var(--ink)" }}
            />
            <circle cx={cx} cy={cy} r={8} style={{ fill: "var(--ink)" }} />
            <circle cx={cx} cy={cy} r={3} style={{ fill: "var(--surface)" }} />
          </g>
        ) : null}

        {endLabels ? (
          <g {...DECORATIVE} className="pointer-events-none">
            <text
              x={minPoint.x}
              y={minPoint.y + band / 2 + 15}
              textAnchor="middle"
              className="fill-ink-3 font-semibold text-[11px] tabular-nums"
            >
              {format(min)}
            </text>
            <text
              x={maxPoint.x}
              y={maxPoint.y + band / 2 + 15}
              textAnchor="middle"
              className="fill-ink-3 font-semibold text-[11px] tabular-nums"
            >
              {format(max)}
            </text>
          </g>
        ) : null}

        {centerContent ? null : (
          <g data-fade="" {...DECORATIVE} textAnchor="middle" className="pointer-events-none">
            <text
              x={cx}
              y={valueY}
              className="fill-ink font-bold tabular-nums"
              style={{ fontSize: valueSize }}
            >
              {format(shown)}
            </text>
            {caption ? (
              <text
                x={cx}
                y={captionY}
                className="fill-ink-3 font-semibold"
                style={{ fontSize: captionSize }}
              >
                {caption}
              </text>
            ) : null}
            {active?.label && bands.length > 0 ? (
              <text
                x={cx}
                y={labelY}
                className="font-bold text-[11px]"
                style={{ fill: valueColor }}
              >
                {active.label}
              </text>
            ) : null}
          </g>
        )}
      </svg>

      {centerContent ? (
        <div
          className="pointer-events-none absolute flex flex-col items-center text-center"
          style={{
            left: cx,
            top: cy + layout.customDy,
            width: layout.customWidth,
            transform:
              layout.customAnchor === "above"
                ? "translate(-50%, -100%)"
                : layout.customAnchor === "middle"
                  ? "translate(-50%, -50%)"
                  : "translate(-50%, 0)",
          }}
        >
          {centerContent({
            value,
            shown,
            text: format(shown),
            color: valueColor,
            band: active?.label,
            caption,
          })}
        </div>
      ) : null}

      <div
        role="slider"
        aria-label={labels.explore}
        aria-valuemin={1}
        aria-valuemax={items}
        aria-valuenow={(nav.active ?? 0) + 1}
        aria-valuetext={valueText}
        tabIndex={0}
        {...nav.sliderProps}
        className="pointer-events-none absolute inset-0 rounded-xs outline-none focus-visible:outline-2 focus-visible:outline-accent-ink focus-visible:outline-offset-2"
      />

      {tooltip && anchor && rows.length ? (
        <ChartTooltip x={anchor.x} y={anchor.y} containerWidth={width} rows={rows} />
      ) : null}
    </div>
  );
}

interface BandMarkProps {
  d: string;
  width: number;
  color: string;
  opacity: number;
  dimmed: boolean;
  onEnter: (event: { clientX: number; clientY: number }) => void;
  onLeave: () => void;
}

const BandMark = memo(function BandMark({
  d,
  width,
  color,
  opacity,
  dimmed,
  onEnter,
  onLeave,
}: BandMarkProps) {
  return (
    <path
      data-band=""
      d={d}
      fill="none"
      strokeWidth={width}
      strokeLinecap="butt"
      onPointerEnter={onEnter}
      onPointerMove={onEnter}
      onPointerLeave={onLeave}
      className={cn("motion-safe:transition-opacity motion-safe:duration-150")}
      style={{ stroke: color, opacity: dimmed ? opacity * 0.5 : opacity }}
    />
  );
});
