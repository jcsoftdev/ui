"use client";

import { useId, useRef } from "react";
import { cn } from "../../utils/cn.js";
import { estimateTextWidth } from "../core/axes.js";
import { ChartFrame } from "../core/chart-frame.js";
import { ChartDataTable } from "../core/data-table.js";
import { formatNumber, resolveFormat, type ValueFormat } from "../core/format.js";
import { useEntryAnimation } from "../core/motion.js";
import { type ChartTone, seriesColor, TONE_COLORS } from "../core/palette.js";
import { type ChartLabels, resolveLabels } from "../core/types.js";
import { popUnits, UNIT_FRAME_CLASS, UnitGlyph } from "../core/unit-glyph.js";
import { type ResolvedUnitShape, resolveUnitShape, type UnitIcon } from "../core/unit-icons.js";
import { progressFractions, roundToStep } from "../core/units.js";

export interface ProgressUnitsProps {
  /** Accessible name and data table caption, e.g. "Calificación de Kevin". */
  label: string;
  value: number;
  /** Value of a full row of units (5 for a five star rating, 100 for a percentage). */
  max?: number;
  /** Number of units drawn. */
  count?: number;
  /** Rounds the value before drawing, e.g. 0.5 for half stars. Exact partial units by default. */
  step?: number;
  /** "icons": repeated icons (stars, chairs...); "segments": rounded cells like a battery or steps. */
  variant?: "icons" | "segments";
  icon?: UnitIcon;
  /** CSS color; overrides `tone`. */
  color?: string;
  /** Status color family; the brand tone by default. */
  tone?: ChartTone;
  /** Largest unit side in pixels (the height of the component). */
  size?: number;
  /** Gap between units, as a fraction of the unit size. */
  gap?: number;
  /** Shows the value after the units ("4.5 / 5"). */
  showValue?: boolean;
  valueFormat?: ValueFormat;
  animate?: boolean;
  loading?: boolean;
  labels?: Partial<ChartLabels>;
  className?: string;
}

function segmentShape(width: number, height: number): ResolvedUnitShape {
  const r = height / 2;
  return {
    path: `M${r} 0H${width - r}A${r} ${r} 0 0 1 ${width - r} ${height}H${r}A${r} ${r} 0 0 1 ${r} 0Z`,
    width,
    height,
    fillRule: "nonzero",
    fill: "right",
    labelY: height / 2,
  };
}

/**
 * Segmented progress: a rating of 4.5 of 5 stars with a half star, the steps
 * of a booking, the cells of a battery. Partial units are clipped exactly;
 * the row shrinks to fit narrow containers.
 */
export function ProgressUnits({
  label,
  value,
  max = 5,
  count = 5,
  step,
  variant = "icons",
  icon = "star",
  color,
  tone,
  size = 24,
  gap = 0.18,
  showValue = true,
  valueFormat,
  animate = true,
  loading = false,
  labels: labelsProp,
  className,
}: ProgressUnitsProps) {
  const labels = resolveLabels(labelsProp);
  const format = resolveFormat(
    valueFormat ?? ((n: number) => formatNumber(n, { maximumFractionDigits: 1 })),
  );
  const shown = Math.min(max, Math.max(0, roundToStep(value, step)));
  const text = `${format(shown)} / ${format(max)}`;
  const fill = color ?? (tone ? TONE_COLORS[tone].ink : seriesColor(0));

  return (
    <ChartFrame
      height={size}
      labels={labels}
      loading={loading}
      empty={!Number.isFinite(value) || !(max > 0) || count < 1}
      table={
        <ChartDataTable
          caption={label}
          categoryHeader={labels.category}
          categories={[label]}
          columns={[{ id: "value", name: "", values: [text] }]}
        />
      }
      className={cn(UNIT_FRAME_CLASS, className)}
    >
      {(width) => (
        <ProgressRow
          width={width}
          height={size}
          label={label}
          text={text}
          fractions={progressFractions(value, max, count, step)}
          variant={variant}
          icon={icon}
          color={fill}
          gap={gap}
          showValue={showValue}
          animate={animate}
        />
      )}
    </ChartFrame>
  );
}

interface ProgressRowProps {
  width: number;
  height: number;
  label: string;
  text: string;
  fractions: number[];
  variant: "icons" | "segments";
  icon: UnitIcon;
  color: string;
  gap: number;
  showValue: boolean;
  animate: boolean;
}

function ProgressRow({
  width,
  height,
  label,
  text,
  fractions,
  variant,
  icon,
  color,
  gap,
  showValue,
  animate,
}: ProgressRowProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const svgRef = useRef<SVGSVGElement>(null);
  const count = fractions.length;
  const valueWidth = showValue ? Math.ceil(estimateTextWidth(text, 13) * 1.15) + 12 : 0;
  const area = Math.max(8, width - valueWidth);

  let unitWidth: number;
  let spacing = gap;
  let shape: ResolvedUnitShape;
  if (variant === "segments") {
    const pitchGap = Math.max(3, height * 0.18);
    unitWidth = Math.max(4, Math.min(height * 2, (area - (count - 1) * pitchGap) / count));
    shape = segmentShape(unitWidth, Math.max(4, Math.min(height * 0.42, unitWidth)));
    spacing = pitchGap / unitWidth;
  } else {
    unitWidth = Math.max(4, Math.min(height, area / (count + (count - 1) * spacing)));
    shape = resolveUnitShape(icon);
  }
  const pitch = unitWidth * (1 + spacing);
  const used = count ? (count - 1) * pitch + unitWidth : 0;

  useEntryAnimation(svgRef, (root) => popUnits(root, { duration: 360, budget: 420 }), {
    disabled: !animate,
    replayKey: count,
  });

  return (
    <div className="flex items-center gap-2.5" style={{ width, height }}>
      <svg
        ref={svgRef}
        role="img"
        aria-label={`${label}: ${text}`}
        width={used}
        height={height}
        className="block shrink-0 overflow-visible"
      >
        {fractions.map((amount, index) => (
          <UnitGlyph
            // biome-ignore lint/suspicious/noArrayIndexKey: units are positional.
            key={index}
            shape={shape}
            x={index * pitch}
            y={(height - unitWidth) / 2}
            size={unitWidth}
            fill={amount}
            color={color}
            clipId={`${uid}-${index}`}
          />
        ))}
      </svg>
      {showValue ? (
        <span aria-hidden="true" className="truncate font-bold text-[13px] text-ink tabular-nums">
          {text}
        </span>
      ) : null}
    </div>
  );
}
