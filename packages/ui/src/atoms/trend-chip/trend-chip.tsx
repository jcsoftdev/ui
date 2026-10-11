import type { ComponentPropsWithoutRef } from "react";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "../../icons/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import {
  formatTrend,
  type TrendDirection,
  type TrendTone,
  trendDirection,
  trendTone,
} from "./trend.js";

const toneClasses: Record<TrendTone, string> = {
  positive: "bg-success-soft text-success",
  negative: "bg-danger-soft text-danger",
  neutral: "bg-surface-2 text-ink-2",
};

const toneWords: Record<TrendTone, string> = {
  positive: "favorable",
  negative: "desfavorable",
  neutral: "sin cambio",
};

const directionWords: Record<TrendDirection, string> = {
  up: "sube",
  down: "baja",
  flat: "estable",
};

const directionIcons = { up: ArrowUpRight, down: ArrowDownRight, flat: ArrowRight };

export type TrendChipPart = "root" | "arrow" | "value" | "label";

export interface TrendChipProps extends Omit<ComponentPropsWithoutRef<"span">, "children"> {
  /** Change in percent, e.g. 12.5 for +12.5%. */
  value: number;
  /** Lower is better (cancelaciones, mermas): a drop reads as favorable. */
  invert?: boolean;
  /** Changes whose absolute value is within this stay "flat". */
  epsilon?: number;
  /** Text after the number, e.g. "vs. semana pasada". */
  label?: string;
  locale?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<TrendChipPart>;
}

/** Compact change indicator: arrow, signed percent and a good/bad tone, never color alone. */
export function TrendChip({
  value,
  invert = false,
  epsilon = 0,
  label,
  locale,
  className,
  classNames,
  ...props
}: TrendChipProps) {
  const direction = trendDirection(value, epsilon);
  const tone = trendTone(direction, invert);
  const Arrow = directionIcons[direction];
  const text = formatTrend(value, locale);
  return (
    <span
      className={cn(
        "inline-flex h-6 max-w-full items-center gap-1 whitespace-nowrap rounded-badge px-2 font-[650] text-chip-text tabular-nums",
        toneClasses[tone],
        classNames?.root,
        className,
      )}
      {...props}
    >
      <Arrow
        className={cn("size-3 shrink-0", classNames?.arrow)}
        aria-hidden="true"
        strokeWidth={2.2}
      />
      <span className="sr-only">{`${directionWords[direction]}, ${toneWords[tone]}: `}</span>
      <span className={classNames?.value}>{text}</span>
      {label ? (
        <span className={cn("min-w-0 truncate font-normal", classNames?.label)}>{label}</span>
      ) : null}
    </span>
  );
}
