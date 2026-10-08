"use client";

import { type KeyboardEvent, type PointerEvent, useCallback, useRef, useState } from "react";
import { cn } from "../../utils/cn.js";
import {
  clampValue,
  keyboardValue,
  nearestThumb,
  type RangeValue,
  ratioOf,
  setRangeThumb,
  snapToStep,
  valueFromRatio,
} from "./model.js";

export interface SliderMark {
  value: number;
  label?: string;
}

interface SliderBaseProps {
  min?: number;
  max?: number;
  step?: number;
  /** Step used by PageUp/PageDown. Defaults to 10 steps. */
  pageStep?: number;
  /** Minimum distance between the two thumbs of a range. */
  minGap?: number;
  disabled?: boolean;
  /** Ticks on the track; a `label` renders as a caption under it. */
  marks?: SliderMark[];
  /** Shows the current value above each thumb; it is emphasized while dragged or focused. */
  showValue?: boolean;
  formatValue?: (value: number) => string;
  /** Accessible name; thumbs of a range get "mínimo"/"máximo" appended. */
  "aria-label"?: string;
  "aria-labelledby"?: string;
  /** Form field name; a range submits `${name}-min` and `${name}-max`. */
  name?: string;
  className?: string;
}

export interface SingleSliderProps extends SliderBaseProps {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
}

export interface RangeSliderProps extends SliderBaseProps {
  value?: RangeValue;
  defaultValue?: RangeValue;
  onValueChange?: (value: RangeValue) => void;
}

export type SliderProps = SingleSliderProps | RangeSliderProps;

/**
 * Single or range slider. The value shape decides the mode: a number gives one thumb and a
 * `[from, to]` tuple gives two. Each thumb is a `role="slider"` with arrow, Page and Home/End keys.
 */
export function Slider(props: SliderProps) {
  const {
    min = 0,
    max = 100,
    step = 1,
    pageStep,
    minGap = 0,
    disabled,
    marks,
    showValue,
    formatValue = String,
    name,
    className,
  } = props;
  const seed = props.value ?? props.defaultValue;
  const range = Array.isArray(seed);
  const page = pageStep ?? step * 10;
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef<0 | 1 | null>(null);
  const [active, setActive] = useState<0 | 1 | null>(null);

  const toPair = (v: number | RangeValue | undefined): RangeValue =>
    Array.isArray(v)
      ? [snapToStep(v[0], min, max, step), snapToStep(v[1], min, max, step)]
      : [min, snapToStep(v ?? min, min, max, step)];

  const [inner, setInner] = useState<RangeValue>(() => toPair(props.defaultValue));
  const controlled = props.value !== undefined;
  const current: RangeValue = controlled ? toPair(props.value) : inner;

  const onValueChange = props.onValueChange;
  const commit = useCallback(
    (next: RangeValue) => {
      if (!controlled) setInner(next);
      if (range) (onValueChange as ((v: RangeValue) => void) | undefined)?.(next);
      else (onValueChange as ((v: number) => void) | undefined)?.(next[1]);
    },
    [controlled, range, onValueChange],
  );

  const move = (index: 0 | 1, raw: number) => {
    const next = range
      ? setRangeThumb(current, index, raw, min, max, step, minGap)
      : ([min, snapToStep(raw, min, max, step)] as RangeValue);
    if (next[0] !== current[0] || next[1] !== current[1]) commit(next);
  };

  const valueAt = (clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return current[1];
    return valueFromRatio((clientX - rect.left) / rect.width, min, max, step);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0) return;
    const target = valueAt(event.clientX);
    const index: 0 | 1 = range ? nearestThumb(current, target) : 1;
    dragging.current = index;
    setActive(index);
    event.currentTarget.setPointerCapture(event.pointerId);
    move(index, target);
    trackRef.current?.querySelector<HTMLElement>(`[data-thumb="${index}"]`)?.focus();
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragging.current !== null) move(dragging.current, valueAt(event.clientX));
  };

  const endDrag = () => {
    dragging.current = null;
    setActive(null);
  };

  const onKeyDown = (index: 0 | 1) => (event: KeyboardEvent<HTMLSpanElement>) => {
    if (disabled) return;
    const next = keyboardValue(event.key, current[index], min, max, step, page);
    if (next === null) return;
    event.preventDefault();
    move(index, clampValue(next, min, max));
  };

  const start = range ? ratioOf(current[0], min, max) : 0;
  const end = ratioOf(current[1], min, max);
  const baseLabel = props["aria-label"];

  const thumb = (index: 0 | 1) => {
    const label =
      range && baseLabel ? `${baseLabel} (${index === 0 ? "mínimo" : "máximo"})` : baseLabel;
    const lo = range && index === 1 ? current[0] + minGap : min;
    const hi = range && index === 0 ? current[1] - minGap : max;
    return (
      <span
        key={index}
        data-thumb={index}
        data-active={active === index}
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={label}
        aria-labelledby={baseLabel ? undefined : props["aria-labelledby"]}
        aria-valuemin={lo}
        aria-valuemax={hi}
        aria-valuenow={current[index]}
        aria-valuetext={formatValue(current[index])}
        aria-orientation="horizontal"
        aria-disabled={disabled || undefined}
        onKeyDown={onKeyDown(index)}
        onFocus={() => setActive(index)}
        onBlur={() => {
          if (dragging.current === null) setActive(null);
        }}
        style={{ left: `${ratioOf(current[index], min, max) * 100}%` }}
        className="group/thumb -translate-x-1/2 -translate-y-1/2 absolute top-1/2 size-5 touch-none rounded-pill border-control bg-surface-control shadow-control outline-none focus-visible:focus-ring data-[active=true]:shadow-selected"
      >
        {showValue ? (
          <span
            aria-hidden="true"
            className="-translate-x-1/2 pointer-events-none absolute bottom-full left-1/2 mb-1.5 whitespace-nowrap rounded-badge bg-surface-sunken px-1.5 py-0.5 text-chip-text text-ink-2 tabular-nums group-data-[active=true]/thumb:bg-ink group-data-[active=true]/thumb:text-surface"
          >
            {formatValue(current[index])}
          </span>
        ) : null}
      </span>
    );
  };

  return (
    <div
      className={cn(
        "@container/slider w-full min-w-0 py-2",
        showValue && "pt-8",
        marks?.some((m) => m.label) && "pb-7",
        disabled && "opacity-50",
        className,
      )}
    >
      <div
        ref={trackRef}
        className={cn(
          "relative h-5 w-full touch-none select-none",
          disabled ? "cursor-not-allowed" : "cursor-pointer",
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className="-translate-y-1/2 absolute inset-x-0 top-1/2 h-1.5 rounded-pill bg-line-strong" />
        <div
          className="-translate-y-1/2 absolute top-1/2 h-1.5 rounded-pill bg-accent"
          style={{ left: `${start * 100}%`, width: `${(end - start) * 100}%` }}
        />
        {marks?.map((mark) => (
          <span
            key={mark.value}
            aria-hidden="true"
            className="absolute top-1/2"
            style={{ left: `${ratioOf(mark.value, min, max) * 100}%` }}
          >
            <span className="-translate-x-1/2 -translate-y-1/2 absolute size-1 rounded-pill bg-surface" />
            {mark.label ? (
              <span className="-translate-x-1/2 absolute top-3.5 whitespace-nowrap text-ink-3 text-meta">
                {mark.label}
              </span>
            ) : null}
          </span>
        ))}
        {range ? [thumb(0), thumb(1)] : thumb(1)}
      </div>
      {name ? (
        range ? (
          <>
            <input type="hidden" name={`${name}-min`} value={current[0]} />
            <input type="hidden" name={`${name}-max`} value={current[1]} />
          </>
        ) : (
          <input type="hidden" name={name} value={current[1]} />
        )
      ) : null}
    </div>
  );
}
