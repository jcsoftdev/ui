"use client";

import type { ComponentPropsWithoutRef } from "react";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { customToneStyle, isCustomTone } from "../../utils/tone.js";

export type ProgressBuiltinTone = "accent" | "neutral" | "success" | "warning" | "danger" | "info";

/** A built-in tone, or the name of a tone declared in `tonePalettes`. */
export type ProgressTone = ProgressBuiltinTone | (string & {});

const toneClasses: Record<ProgressBuiltinTone, string> = {
  accent: "bg-accent",
  neutral: "bg-ink-3",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
};

const builtinTones = new Set<string>(Object.keys(toneClasses));

const DEFAULT_MAX = 100;

export type ProgressPart = "root" | "indicator";

export interface ProgressProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  value: number;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<ProgressPart>;
  max?: number;
  /** Colour of the indicator. Defaults to `"accent"`. The value is always exposed through the progressbar semantics, never by colour alone. */
  tone?: ProgressTone;
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
  tone = "accent",
  className,
  classNames,
  style,
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
      data-tone={tone === "accent" ? undefined : tone}
      style={customToneStyle(tone, builtinTones, style)}
      className={cn("h-1.5 overflow-hidden rounded-pill bg-track", classNames?.root, className)}
      {...props}
    >
      <div
        data-state={state}
        data-value={current ?? undefined}
        data-max={max}
        className={cn(
          "block h-full transition-transform",
          isCustomTone(tone, builtinTones)
            ? "bg-(--tone-c)"
            : (toneClasses[tone as ProgressBuiltinTone] ?? toneClasses.accent),
          classNames?.indicator,
        )}
        style={{ transform: `translateX(-${100 - ((current ?? 0) / max) * 100}%)` }}
      />
    </div>
  );
}

/** Thinner progress bar. */
export function Meter({ className, ...props }: ProgressProps) {
  return <Progress className={cn("h-1.25", className)} {...props} />;
}
