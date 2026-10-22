"use client";

import {
  type ChangeEvent,
  type ChangeEventHandler,
  type KeyboardEvent,
  useId,
  useRef,
  useState,
} from "react";
import { Minus, Plus } from "../../icons/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { snapToStep } from "../slider/model.js";
import { canStep, parseNumber, stepText } from "./model.js";

export type NumberStepperPart = "root" | "decrement" | "increment" | "input" | "unit";

interface NumberStepperBaseProps {
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  /** Text after the number, e.g. "min" or "unid."; read by screen readers through aria-valuetext. */
  unit?: string;
  name?: string;
  /** Id of the text input; `Field` sets it so the label points at the control. */
  id?: string;
  placeholder?: string;
  required?: boolean;
  invalid?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  className?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<NumberStepperPart>;
}

/** Numeric mode (default): the value is a finite number, typing is committed on blur or Enter and snapped to `step`. */
export interface NumberStepperNumberProps extends NumberStepperBaseProps {
  mode?: "number";
  value?: number;
  defaultValue?: number;
  onValueChange?: (value: number) => void;
  onChange?: never;
}

/**
 * String mode: the caller owns the text. Typing is never rewritten, the field may be empty, and every
 * change (typing, the buttons, ArrowUp/ArrowDown) reports both `onChange(event)` with the new text in
 * `event.target.value` and `onValueChange(text)`. `min`, `max` and `step` bound the stepping and the ARIA range.
 */
export interface NumberStepperStringProps extends NumberStepperBaseProps {
  mode: "string";
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  onChange?: ChangeEventHandler<HTMLInputElement>;
}

export type NumberStepperProps = NumberStepperNumberProps | NumberStepperStringProps;

/**
 * Counter with minus/plus buttons and a typeable value; ArrowUp/ArrowDown step it, Home/End jump.
 * Numeric by default; `mode="string"` hands the text to the caller (empty state, change event).
 */
export function NumberStepper(props: NumberStepperProps) {
  const {
    min = Number.NEGATIVE_INFINITY,
    max = Number.POSITIVE_INFINITY,
    step = 1,
    disabled,
    unit,
    name,
    id: idProp,
    placeholder,
    required,
    invalid,
    className,
    classNames,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
  } = props;
  const autoId = useId();
  const id = idProp ?? autoId;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isString = props.mode === "string";
  const [innerNumber, setInnerNumber] = useState(isString ? 0 : (props.defaultValue ?? 0));
  const [innerText, setInnerText] = useState(isString ? (props.defaultValue ?? "") : "");
  const [draft, setDraft] = useState<string | null>(null);
  const controlled = props.value !== undefined;
  const number = isString
    ? parseNumber(controlledText(props, innerText))
    : (props.value ?? innerNumber);
  const text = isString ? controlledText(props, innerText) : String(number);

  const apply = (raw: number) => {
    if (isString) return;
    const next = Number.isFinite(raw) ? snapToStep(raw, min, max, step) : number;
    if (!controlled) setInnerNumber(next);
    if (next !== number) props.onValueChange?.(next);
  };

  const commitDraft = () => {
    if (draft === null) return;
    const parsed = Number(draft.replace(",", "."));
    setDraft(null);
    if (draft.trim() !== "") apply(parsed);
  };

  // String mode reports through a real change event, so `onChange(e)` works for the buttons too.
  const setText = (next: string) => {
    const input = inputRef.current;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!input || !setter) return;
    setter.call(input, next);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const move = (direction: 1 | -1) => {
    if (isString) setText(stepText(text, direction, { min, max, step }));
    else apply(number + direction * step);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowUp") move(1);
    else if (event.key === "ArrowDown") move(-1);
    else if (event.key === "Home" && Number.isFinite(min)) {
      if (isString) setText(String(min));
      else apply(min);
    } else if (event.key === "End" && Number.isFinite(max)) {
      if (isString) setText(String(max));
      else apply(max);
    } else if (event.key === "Enter" && !isString) commitDraft();
    else return;
    if (event.key !== "Enter") event.preventDefault();
  };

  const onChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (props.mode !== "string") return setDraft(event.target.value);
    if (!controlled) setInnerText(event.target.value);
    props.onChange?.(event);
    props.onValueChange?.(event.target.value);
  };

  const button =
    "grid h-full w-9 shrink-0 place-items-center text-ink-2 outline-none hover:bg-surface-sunken hover:text-ink focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-40";
  const valid = !Number.isNaN(number);

  return (
    <div
      className={cn(
        "inline-flex h-input min-w-32 max-w-full items-stretch overflow-hidden rounded-input border-control bg-surface-control",
        disabled && "opacity-60",
        (invalid || ariaInvalid) && "border-danger",
        classNames?.root,
        className,
      )}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="Disminuir"
        aria-controls={id}
        disabled={disabled || !canStep(text, -1, { min, max })}
        onClick={() => move(-1)}
        className={cn(button, "pressable", classNames?.decrement)}
      >
        <Minus aria-hidden="true" className="size-3.5" />
      </button>
      <input
        ref={inputRef}
        id={id}
        name={name}
        role="spinbutton"
        inputMode="decimal"
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        aria-valuenow={valid ? number : undefined}
        aria-valuemin={Number.isFinite(min) ? min : undefined}
        aria-valuemax={Number.isFinite(max) ? max : undefined}
        aria-valuetext={unit && valid ? `${number} ${unit}` : undefined}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid ?? (invalid || undefined)}
        aria-required={required || undefined}
        value={draft ?? text}
        onChange={onChange}
        onBlur={commitDraft}
        onKeyDown={onKeyDown}
        className={cn(
          "w-14 min-w-0 flex-1 bg-transparent px-1 text-center text-control text-ink tabular-nums outline-none placeholder:text-ink-3 focus-visible:focus-ring",
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
        disabled={disabled || !canStep(text, 1, { min, max })}
        onClick={() => move(1)}
        className={cn(button, "pressable", classNames?.increment)}
      >
        <Plus aria-hidden="true" className="size-3.5" />
      </button>
    </div>
  );
}

function controlledText(props: NumberStepperProps, inner: string): string {
  return props.mode === "string" ? (props.value ?? inner) : inner;
}
