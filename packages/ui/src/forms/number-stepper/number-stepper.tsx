"use client";

import { type ChangeEvent, type KeyboardEvent, useId, useState } from "react";
import { Minus, Plus } from "../../icons/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { snapToStep } from "../slider/model.js";

export type NumberStepperPart = "root" | "decrement" | "increment" | "input" | "unit";

export interface NumberStepperProps {
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  /** Text after the number, e.g. "min" or "unid."; read by screen readers through aria-valuetext. */
  unit?: string;
  name?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  className?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root. */
  classNames?: ClassNames<NumberStepperPart>;
}

/** Counter with minus/plus buttons and a typeable value; ArrowUp/ArrowDown step it, Home/End jump. */
export function NumberStepper({
  value: valueProp,
  defaultValue = 0,
  onValueChange,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  disabled,
  unit,
  name,
  className,
  classNames,
  ...aria
}: NumberStepperProps) {
  const id = useId();
  const [inner, setInner] = useState(defaultValue);
  const value = valueProp ?? inner;
  const [draft, setDraft] = useState<string | null>(null);

  const apply = (raw: number) => {
    const next = Number.isFinite(raw) ? snapToStep(raw, min, max, step) : value;
    if (valueProp === undefined) setInner(next);
    if (next !== value) onValueChange?.(next);
  };

  const commitDraft = () => {
    if (draft === null) return;
    const parsed = Number(draft.replace(",", "."));
    setDraft(null);
    if (draft.trim() !== "") apply(parsed);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowUp") apply(value + step);
    else if (event.key === "ArrowDown") apply(value - step);
    else if (event.key === "Home" && Number.isFinite(min)) apply(min);
    else if (event.key === "End" && Number.isFinite(max)) apply(max);
    else if (event.key === "Enter") commitDraft();
    else return;
    if (event.key !== "Enter") event.preventDefault();
  };

  const button =
    "grid h-full w-9 shrink-0 place-items-center text-ink-2 outline-none hover:bg-surface-sunken hover:text-ink focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-40";

  return (
    <div
      className={cn(
        "inline-flex h-input min-w-32 max-w-full items-stretch overflow-hidden rounded-input border-control bg-surface-control",
        disabled && "opacity-60",
        className,
        classNames?.root,
      )}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="Disminuir"
        aria-controls={id}
        disabled={disabled || value <= min}
        onClick={() => apply(value - step)}
        className={cn(button, "pressable", classNames?.decrement)}
      >
        <Minus aria-hidden="true" className="size-3.5" />
      </button>
      <input
        id={id}
        name={name}
        role="spinbutton"
        inputMode="decimal"
        disabled={disabled}
        aria-valuenow={value}
        aria-valuemin={Number.isFinite(min) ? min : undefined}
        aria-valuemax={Number.isFinite(max) ? max : undefined}
        aria-valuetext={unit ? `${value} ${unit}` : undefined}
        aria-label={aria["aria-label"]}
        aria-labelledby={aria["aria-labelledby"]}
        value={draft ?? String(value)}
        onChange={(event: ChangeEvent<HTMLInputElement>) => setDraft(event.target.value)}
        onBlur={commitDraft}
        onKeyDown={onKeyDown}
        className={cn(
          "w-14 min-w-0 flex-1 bg-transparent px-1 text-center text-control text-ink tabular-nums outline-none focus-visible:focus-ring",
          classNames?.input,
        )}
      />
      {unit ? (
        <span
          aria-hidden="true"
          className={cn("flex items-center pr-2 text-ink-3 text-meta", classNames?.unit)}
        >
          {unit}
        </span>
      ) : null}
      <button
        type="button"
        tabIndex={-1}
        aria-label="Aumentar"
        aria-controls={id}
        disabled={disabled || value >= max}
        onClick={() => apply(value + step)}
        className={cn(button, "pressable", classNames?.increment)}
      >
        <Plus aria-hidden="true" className="size-3.5" />
      </button>
    </div>
  );
}
