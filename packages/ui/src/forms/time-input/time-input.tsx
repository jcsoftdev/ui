"use client";

import {
  type ChangeEvent,
  type ComponentPropsWithoutRef,
  type FocusEvent,
  type KeyboardEvent,
  useState,
} from "react";
import { cn } from "../../utils/cn.js";

export interface TimeInputProps
  extends Omit<
    ComponentPropsWithoutRef<"input">,
    "type" | "value" | "defaultValue" | "onChange" | "step" | "inputMode" | "maxLength"
  > {
  /** 24h "HH:MM" (controlled). */
  value?: string;
  defaultValue?: string;
  /** Called with a valid "HH:MM" string, or "" when the field is cleared. */
  onValueChange?: (value: string) => void;
  /** Minutes added or removed by ArrowUp / ArrowDown on the minutes segment. */
  step?: number;
}

const VALID = /^([01]\d|2[0-3]):([0-5]\d)$/;
const pad = (n: number) => String(n).padStart(2, "0");

/** "930" / "9:30" / "0930" / "09:30" to "09:30"; null when it is not a 24h time. */
function normalize(text: string): string | null {
  const digits = text.replace(/\D/g, "");
  if (digits.length < 3 || digits.length > 4) return null;
  const padded = digits.padStart(4, "0");
  const candidate = `${padded.slice(0, 2)}:${padded.slice(2)}`;
  return VALID.test(candidate) ? candidate : null;
}

/** Keeps digits only and inserts the colon once the hour is complete. */
function mask(text: string): string {
  const digits = text.replace(/\D/g, "").slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}

/**
 * 24h time field. A masked text input, so it renders "15:30" whatever the browser
 * locale is. ArrowUp / ArrowDown change the segment under the caret (minutes move by `step`).
 */
export function TimeInput({
  value,
  defaultValue = "",
  onValueChange,
  step = 5,
  className,
  onBlur,
  onKeyDown,
  placeholder = "HH:MM",
  ...props
}: TimeInputProps) {
  const [inner, setInner] = useState(defaultValue);
  const committed = value ?? inner;
  const [draft, setDraft] = useState<string | null>(null);

  const commit = (next: string) => {
    if (value === undefined) setInner(next);
    onValueChange?.(next);
  };

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const masked = mask(e.target.value);
    setDraft(masked);
    if (masked === "") commit("");
    else if (masked.length === 5) {
      const valid = normalize(masked);
      if (valid) commit(valid);
    }
  };

  const handleBlur = (e: FocusEvent<HTMLInputElement>) => {
    const valid = draft === null ? null : normalize(draft);
    if (valid) commit(valid);
    setDraft(null);
    onBlur?.(e);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented || (e.key !== "ArrowUp" && e.key !== "ArrowDown")) return;
    e.preventDefault();
    const base = normalize(draft ?? committed) ?? "00:00";
    const [h = 0, m = 0] = base.split(":").map(Number);
    const dir = e.key === "ArrowUp" ? 1 : -1;
    const onHours = (e.currentTarget.selectionStart ?? 0) <= 2;
    const total = (h * 60 + m + dir * (onHours ? 60 : step) + 1440) % 1440;
    setDraft(null);
    commit(`${pad(Math.floor(total / 60))}:${pad(total % 60)}`);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      maxLength={5}
      placeholder={placeholder}
      className={cn(
        "h-input w-full min-w-0 rounded-input border-control bg-surface-control px-3 font-mono text-control text-ink tabular-nums placeholder:text-ink-3 focus:border-transparent focus:outline-2 focus:outline-accent-ink focus:-outline-offset-1 aria-[invalid=true]:border-danger",
        className,
      )}
      {...props}
      value={draft ?? committed}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
    />
  );
}
