"use client";

import { memo, useMemo, useRef } from "react";
import { cn } from "../../utils/cn.js";
import { DECORATIVE } from "../core/a11y.js";
import { ChartFrame } from "../core/chart-frame.js";
import { ChartDataTable } from "../core/data-table.js";
import { formatPercent, resolveFormat, type ValueFormat } from "../core/format.js";
import { EASE_OUT, fadeIn, useEntryAnimation } from "../core/motion.js";
import { seriesColor } from "../core/palette.js";
import { type FunnelStage, funnelStages } from "../core/polar.js";
import { ChartTooltip, type TooltipRow } from "../core/tooltip.js";
import { type ChartLabels, resolveLabels } from "../core/types.js";
import { useIndexNavigation } from "../core/use-index-navigation.js";

export interface FunnelDatum {
  id: string;
  name: string;
  value: number;
  /** CSS color; defaults to the palette (or the accent ramp). */
  color?: string;
}

export interface FunnelLabels extends ChartLabels {
  /** Tooltip and table header of the step-to-step conversion. */
  conversion: string;
}

export interface FunnelChartProps {
  title: string;
  description?: string;
  /** Stages in order: widest first. */
  stages: readonly FunnelDatum[];
  /** `funnel` narrows towards the last stage; `pyramid` tapers it to a point with the first stage as the base. */
  variant?: "funnel" | "pyramid";
  orientation?: "vertical" | "horizontal";
  /** Conversion % between consecutive stages. */
  showConversion?: boolean;
  /** `categorical` colors each stage; `accent` fades one brand color. */
  tone?: "categorical" | "accent";
  /** Space between stages, in pixels. */
  gap?: number;
  height?: number | "fill";
  /** Width / height ratio; sizes the drawing from the container width when `height` is not "fill". */
  aspectRatio?: number;
  valueFormat?: ValueFormat;
  tooltip?: boolean;
  loading?: boolean;
  animate?: boolean;
  labels?: Partial<FunnelLabels>;
  className?: string;
}

const DEFAULT_CONVERSION = "Conversion";

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
}

/**
 * Funnel and pyramid: stage widths follow the value, the outline stays
 * continuous between stages, and the conversion rate between consecutive
 * stages sits on the joint. Vertical or horizontal, adapts to narrow
 * containers (labels shrink and truncate, tooltip carries the detail).
 */
export function FunnelChart({
  title,
  description,
  stages,
  variant = "funnel",
  orientation = "vertical",
  showConversion = true,
  tone = "categorical",
  gap = 4,
  height,
  aspectRatio,
  valueFormat,
  tooltip = true,
  loading = false,
  animate = true,
  labels: labelsProp,
  className,
}: FunnelChartProps) {
  const labels: FunnelLabels = {
    ...resolveLabels(labelsProp),
    conversion: labelsProp?.conversion ?? DEFAULT_CONVERSION,
  };
  const format = useMemo(() => resolveFormat(valueFormat), [valueFormat]);
  const frameHeight = height ?? (orientation === "vertical" ? 360 : 280);
  const values = useMemo(() => stages.map((stage) => stage.value), [stages]);
  const empty = stages.length === 0 || values.every((value) => !(value > 0));

  const metrics = useMemo(() => funnelStages(values, { length: 100, thickness: 100 }), [values]);
  const table = (
    <ChartDataTable
      caption={description ? `${title}. ${description}` : title}
      categoryHeader={labels.category}
      categories={stages.map((stage) => stage.name)}
      columns={[
        { id: "value", name: labels.value, values: stages.map((stage) => format(stage.value)) },
        {
          id: "share",
          name: labels.share,
          values: metrics.map((stage) => formatPercent(stage.ofFirst, { decimals: 1 })),
        },
        {
          id: "conversion",
          name: labels.conversion,
          values: metrics.map((stage) =>
            stage.conversion == null ? "" : formatPercent(stage.conversion, { decimals: 1 }),
          ),
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
      skeleton="bars"
      table={table}
      className={className}
    >
      {(width, measuredHeight) => (
        <FunnelPlot
          width={width}
          height={measuredHeight}
          title={title}
          stages={stages}
          variant={variant}
          orientation={orientation}
          showConversion={showConversion}
          tone={tone}
          gap={gap}
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
  stages: readonly FunnelDatum[];
  variant: "funnel" | "pyramid";
  orientation: "vertical" | "horizontal";
  showConversion: boolean;
  tone: "categorical" | "accent";
  gap: number;
  format: (value: number) => string;
  tooltip: boolean;
  animate: boolean;
  labels: FunnelLabels;
}

interface Shape {
  stage: FunnelStage;
  points: string;
  color: string;
  opacity: number;
  /** Centre of the stage. */
  cx: number;
  cy: number;
  /** Joint with the previous stage (for the conversion pill). */
  joint: { x: number; y: number } | null;
}

function FunnelPlot({
  width,
  height,
  title,
  stages,
  variant,
  orientation,
  showConversion,
  tone,
  gap,
  format,
  tooltip,
  animate,
  labels,
}: PlotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const nav = useIndexNavigation(stages.length, { wrap: false });
  const vertical = orientation === "vertical";
  const pyramid = variant === "pyramid";

  const side = vertical ? Math.round(Math.min(200, Math.max(96, width * 0.36))) : 0;
  const head = vertical ? 0 : 42;
  const pad = 4;
  const area = {
    x: pad,
    y: head + pad,
    w: vertical ? Math.max(60, width - side - 12 - pad * 2) : width - pad * 2,
    h: height - head - pad * 2,
  };
  const length = vertical ? area.h : area.w;
  const thickness = vertical ? area.w : area.h;

  const layout = useMemo(
    () =>
      funnelStages(
        stages.map((stage) => stage.value),
        { length, thickness, gap, variant },
      ),
    [stages, length, thickness, gap, variant],
  );

  const shapes = useMemo<Shape[]>(() => {
    const count = stages.length;
    const centerCross = vertical ? area.x + area.w / 2 : area.y + area.h / 2;
    const place = (t: number, c: number): [number, number] => {
      if (vertical) return [centerCross + c, area.y + (pyramid ? length - t : t)];
      return [area.x + t, centerCross + c];
    };
    return layout.map((stage, i) => {
      const datum = stages[i] as FunnelDatum;
      const corners = [
        place(stage.from, -stage.widthFrom / 2),
        place(stage.from, stage.widthFrom / 2),
        place(stage.to, stage.widthTo / 2),
        place(stage.to, -stage.widthTo / 2),
      ];
      const [mx, my] = place((stage.from + stage.to) / 2, 0);
      const jointT = stage.from - gap / 2;
      const [jx, jy] = place(jointT, 0);
      const color =
        tone === "accent" ? (datum.color ?? "var(--accent-word)") : seriesColor(i, datum.color);
      return {
        stage,
        points: corners
          .map(([x, y]) => `${Math.round(x * 100) / 100},${Math.round(y * 100) / 100}`)
          .join(" "),
        color,
        opacity: tone === "accent" && count > 1 ? 1 - (0.55 * i) / (count - 1) : 1,
        cx: mx,
        cy: my,
        joint: i > 0 ? { x: jx, y: jy } : null,
      };
    });
  }, [layout, stages, vertical, pyramid, area.x, area.y, area.w, area.h, length, gap, tone]);

  useEntryAnimation(
    svgRef,
    (root) => {
      root.querySelectorAll("[data-stage]").forEach((node, i) => {
        const dir = vertical ? "translateY(-10px)" : "translateX(-10px)";
        node.animate(
          [
            { opacity: 0, transform: dir },
            { opacity: 1, transform: "translate(0,0)" },
          ],
          { duration: 600, delay: i * 90, easing: EASE_OUT, fill: "backwards" },
        );
      });
      root.querySelectorAll("[data-fade]").forEach((node) => {
        fadeIn(node, 400, 350);
      });
    },
    { disabled: !animate, replayKey: stages.length },
  );

  const active = nav.active;
  const activeShape = active != null ? shapes[active] : undefined;
  const activeStage = active != null ? layout[active] : undefined;
  const activeDatum = active != null ? stages[active] : undefined;
  const anchor = nav.pointer ?? (activeShape ? { x: activeShape.cx, y: activeShape.cy } : null);
  const rows: TooltipRow[] =
    activeDatum && activeStage && activeShape
      ? [
          {
            id: "value",
            name: labels.value,
            value: format(activeDatum.value),
            color: activeShape.color,
            shape: "square",
          },
          {
            id: "share",
            name: labels.share,
            value: formatPercent(activeStage.ofFirst, { decimals: 1 }),
            color: activeShape.color,
            shape: "square",
          },
          ...(activeStage.conversion != null
            ? [
                {
                  id: "conversion",
                  name: labels.conversion,
                  value: formatPercent(activeStage.conversion, { decimals: 1 }),
                  color: activeShape.color,
                  shape: "square" as const,
                },
              ]
            : []),
        ]
      : [];
  const valueText =
    activeDatum && activeStage
      ? `${activeDatum.name}: ${format(activeDatum.value)}, ${formatPercent(activeStage.ofFirst, { decimals: 1 })}${
          activeStage.conversion != null
            ? `, ${labels.conversion} ${formatPercent(activeStage.conversion, { decimals: 1 })}`
            : ""
        }`
      : title;

  const stageSize = layout[0] ? layout[0].to - layout[0].from : 0;
  const pillWidth = 44;

  return (
    <div ref={nav.ref} className="relative" style={{ width, height }}>
      <svg
        ref={svgRef}
        role="img"
        aria-label={title}
        width={width}
        height={height}
        className="block overflow-visible"
      >
        {shapes.map((shape, i) => (
          <StageMark
            key={stages[i]?.id ?? i}
            points={shape.points}
            color={shape.color}
            opacity={shape.opacity}
            dimmed={active != null && active !== i}
            onEnter={(event) => nav.hover(i, event)}
            onLeave={nav.leave}
          />
        ))}

        {shapes.map((shape, i) => {
          const datum = stages[i];
          if (!datum) return null;
          const dimmed = active != null && active !== i;
          if (vertical) {
            const x = width - side;
            const maxChars = Math.max(5, Math.floor((side - 4) / 6.2));
            return (
              <g
                data-fade=""
                key={datum.id}
                {...DECORATIVE}
                className="pointer-events-none motion-safe:transition-opacity motion-safe:duration-150"
                style={{ opacity: dimmed ? 0.4 : 1 }}
              >
                <line
                  x1={Math.min(x - 8, shape.cx + shape.stage.widthFrom / 2 + 6)}
                  x2={x - 6}
                  y1={shape.cy}
                  y2={shape.cy}
                  strokeWidth={1}
                  strokeDasharray="2 3"
                  style={{ stroke: "var(--ink-3)", strokeOpacity: 0.5 }}
                />
                <text x={x} y={shape.cy - 3} className="fill-ink-2 font-medium text-[11px]">
                  {truncate(datum.name, maxChars)}
                </text>
                <text x={x} y={shape.cy + 12} className="text-[12px]">
                  <tspan className="fill-ink font-bold tabular-nums">{format(datum.value)}</tspan>
                  <tspan className="fill-ink-3 text-[11px] tabular-nums">
                    {" "}
                    {formatPercent(shape.stage.ofFirst, { decimals: 0 })}
                  </tspan>
                </text>
              </g>
            );
          }
          const maxChars = Math.max(3, Math.floor((stageSize - 6) / 6.2));
          return (
            <g
              data-fade=""
              key={datum.id}
              {...DECORATIVE}
              className="pointer-events-none motion-safe:transition-opacity motion-safe:duration-150"
              style={{ opacity: dimmed ? 0.4 : 1 }}
            >
              <text
                x={shape.cx}
                y={16}
                textAnchor="middle"
                className="fill-ink-2 font-medium text-[11px]"
              >
                {truncate(datum.name, maxChars)}
              </text>
              <text
                x={shape.cx}
                y={32}
                textAnchor="middle"
                className="fill-ink font-bold text-[12px] tabular-nums"
              >
                {truncate(format(datum.value), maxChars + 2)}
              </text>
            </g>
          );
        })}

        {showConversion
          ? shapes.map((shape, i) => {
              const conversion = shape.stage.conversion;
              if (!shape.joint || conversion == null) return null;
              if (vertical && stageSize < 30) return null;
              const { x, y } = shape.joint;
              return (
                <g
                  data-fade=""
                  key={stages[i]?.id ?? i}
                  {...DECORATIVE}
                  className="pointer-events-none"
                >
                  <rect
                    x={x - pillWidth / 2}
                    y={y - 9}
                    width={pillWidth}
                    height={18}
                    rx={9}
                    strokeWidth={1}
                    style={{ fill: "var(--surface)", stroke: "var(--line)" }}
                  />
                  <text
                    x={x}
                    y={y + 4}
                    textAnchor="middle"
                    className={cn("fill-ink-2 font-bold text-[10.5px] tabular-nums")}
                  >
                    {formatPercent(conversion, { decimals: 0 })}
                  </text>
                </g>
              );
            })
          : null}
      </svg>

      <div
        role="slider"
        aria-label={labels.explore}
        aria-valuemin={1}
        aria-valuemax={Math.max(1, stages.length)}
        aria-valuenow={(active ?? 0) + 1}
        aria-valuetext={valueText}
        tabIndex={0}
        {...nav.sliderProps}
        className="pointer-events-none absolute inset-0 rounded-xs outline-none focus-visible:outline-2 focus-visible:outline-accent-ink focus-visible:outline-offset-2"
      />

      {tooltip && anchor && rows.length ? (
        <ChartTooltip
          x={anchor.x}
          y={anchor.y}
          containerWidth={width}
          title={activeDatum?.name}
          rows={rows}
        />
      ) : null}
    </div>
  );
}

interface StageMarkProps {
  points: string;
  color: string;
  opacity: number;
  dimmed: boolean;
  onEnter: (event: { clientX: number; clientY: number }) => void;
  onLeave: () => void;
}

const StageMark = memo(function StageMark({
  points,
  color,
  opacity,
  dimmed,
  onEnter,
  onLeave,
}: StageMarkProps) {
  return (
    <polygon
      data-stage=""
      points={points}
      strokeWidth={2}
      strokeLinejoin="round"
      onPointerEnter={onEnter}
      onPointerMove={onEnter}
      onPointerLeave={onLeave}
      className="motion-safe:transition-opacity motion-safe:duration-150"
      style={{
        fill: color,
        stroke: color,
        fillOpacity: opacity,
        strokeOpacity: opacity,
        opacity: dimmed ? 0.4 : 1,
      }}
    />
  );
});
