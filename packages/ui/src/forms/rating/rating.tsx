"use client";

import { Star } from "lucide-react";
import { type KeyboardEvent, type PointerEvent, useState } from "react";
import { cn } from "../../utils/cn.js";
import { ratingFromPointer, ratingKey, roundRating, starFill } from "./model.js";

export interface RatingProps {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  max?: number;
  /** 0.5 allows half stars. */
  precision?: 0.5 | 1;
  readOnly?: boolean;
  disabled?: boolean;
  size?: "sm" | "md" | "lg";
  /** Shows the numeric value after the stars. */
  showValue?: boolean;
  "aria-label"?: string;
  className?: string;
}

const sizes = { sm: "size-4", md: "size-5", lg: "size-7" } as const;

/**
 * Star rating. Editable ratings are a single `role="slider"` (arrows, Home/End); read-only ones
 * are an `img` with the value as its label. Half values render as a half-filled star.
 */
export function Rating({
  value: valueProp,
  defaultValue = 0,
  onValueChange,
  max = 5,
  precision = 1,
  readOnly,
  disabled,
  size = "md",
  showValue,
  className,
  ...aria
}: RatingProps) {
  const [inner, setInner] = useState(defaultValue);
  const [hover, setHover] = useState<number | null>(null);
  const value = roundRating(valueProp ?? inner, max, precision);
  const shown = hover ?? value;
  const interactive = !readOnly && !disabled;
  const label = aria["aria-label"] ?? "Valoración";

  const set = (next: number) => {
    if (valueProp === undefined) setInner(next);
    if (next !== value) onValueChange?.(next);
  };

  const pointerValue = (event: PointerEvent<HTMLSpanElement>, index: number) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return ratingFromPointer(
      index,
      (event.clientX - rect.left) / (rect.width || 1),
      max,
      precision,
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const next = ratingKey(event.key, value, max, precision);
    if (next === null) return;
    event.preventDefault();
    set(next);
  };

  const stars = Array.from({ length: max }, (_, index) => {
    const fill = starFill(index, shown);
    return (
      <span
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length list
        key={index}
        className={cn("relative inline-flex", interactive && "pressable cursor-pointer")}
        onPointerMove={interactive ? (event) => setHover(pointerValue(event, index)) : undefined}
        onPointerUp={
          interactive
            ? (event) => {
                const next = pointerValue(event, index);
                // Pressing the current value again clears it.
                set(next === value ? 0 : next);
              }
            : undefined
        }
      >
        <Star aria-hidden="true" className={cn(sizes[size], "text-line-strong")} />
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 overflow-hidden"
          style={{ width: `${fill * 100}%` }}
        >
          <Star className={cn(sizes[size], "fill-warning text-warning")} />
        </span>
      </span>
    );
  });

  const text = `${value} de ${max}`;

  return (
    <div
      className={cn(
        "@container/rating inline-flex max-w-full items-center gap-density-sm",
        className,
      )}
    >
      {interactive ? (
        <div
          role="slider"
          tabIndex={0}
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={max}
          aria-valuenow={value}
          aria-valuetext={text}
          onKeyDown={onKeyDown}
          onPointerLeave={() => setHover(null)}
          className="inline-flex gap-0.5 rounded-chip outline-none focus-visible:focus-ring"
        >
          {stars}
        </div>
      ) : (
        <div
          role="img"
          aria-label={`${label}: ${text}`}
          aria-disabled={disabled || undefined}
          className={cn("inline-flex gap-0.5", disabled && "opacity-50")}
        >
          {stars}
        </div>
      )}
      {showValue ? <span className="text-ink-2 text-meta tabular-nums">{value}</span> : null}
    </div>
  );
}
