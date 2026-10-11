"use client";

import type { ComponentPropsWithoutRef } from "react";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";

const DEFAULT_MAX = 100;

export type ProgressPart = "root" | "indicator";

export interface ProgressProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  value: number;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root. */
  classNames?: ClassNames<ProgressPart>;
  max?: number;
  /** Text announced as `aria-valuetext`; defaults to the rounded percentage. */
  getValueLabel?: (value: number, max: number) => string;
}

function isValidMax(max: unknown): max is number {
  return typeof max === "number" && !Number.isNaN(max) && max > 0;
}

function isValidValue(value: unknown, max: number): value is number {
  return typeof value === "number" && !Number.isNaN(value) && value >= 0 && value <= max;
}

function defaultGetValueLabel(value: number, max: number): string {
  return `${Math.round((value / max) * 100)}%`;
}

export function Progress({
  value,
  max: maxProp = DEFAULT_MAX,
  getValueLabel = defaultGetValueLabel,
  className,
  classNames,
  ...props
}: ProgressProps) {
  const max = isValidMax(maxProp) ? maxProp : DEFAULT_MAX;
  const current = isValidValue(value, max) ? value : null;
  const state = current === null ? "indeterminate" : current === max ? "complete" : "loading";

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={current ?? undefined}
      aria-valuetext={current === null ? undefined : getValueLabel(current, max)}
      data-state={state}
      data-value={current ?? undefined}
      data-max={max}
      className={cn("h-1.5 overflow-hidden rounded-pill bg-track", className, classNames?.root)}
      {...props}
    >
      <div
        data-state={state}
        data-value={current ?? undefined}
        data-max={max}
        className={cn("block h-full bg-accent transition-transform", classNames?.indicator)}
        style={{ transform: `translateX(-${100 - ((current ?? 0) / max) * 100}%)` }}
      />
    </div>
  );
}

/** Thinner progress bar. */
export function Meter({ className, ...props }: ProgressProps) {
  return <Progress className={cn("h-1.25", className)} {...props} />;
}
