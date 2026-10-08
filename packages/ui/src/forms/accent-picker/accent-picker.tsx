"use client";

import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { type ComponentPropsWithoutRef, useState } from "react";
import { cn } from "../../utils/cn.js";

export interface AccentOption {
  value: string;
  label: string;
  /** Any CSS color value, typically a variable such as `var(--accent)`. */
  swatch: string;
}

export interface AccentPickerProps
  extends Omit<
    ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>,
    "value" | "defaultValue" | "onValueChange"
  > {
  options: AccentOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
}

/**
 * Exclusive swatch picker. Controlled or uncontrolled; the root exposes
 * `data-accent` with the active option so consumers can read it. Applying the
 * value to the document is the consumer's responsibility.
 */
export function AccentPicker({
  options,
  value,
  defaultValue,
  onValueChange,
  className,
  ...props
}: AccentPickerProps) {
  const [internal, setInternal] = useState(() => defaultValue ?? options[0]?.value);
  const current = value ?? internal;

  return (
    <RadioGroupPrimitive.Root
      data-accent={current}
      value={current}
      onValueChange={(next) => {
        setInternal(next);
        onValueChange?.(next);
      }}
      className={cn("flex flex-wrap gap-2", className)}
      {...props}
    >
      {options.map((option) => (
        <RadioGroupPrimitive.Item
          key={option.value}
          value={option.value}
          className="flex items-center gap-2 rounded-control border border-line px-2.5 py-1.75 font-semibold text-chip-text text-ink data-[state=checked]:border-accent-ink data-[state=checked]:shadow-sel"
        >
          <span
            aria-hidden="true"
            className="size-3.5 shrink-0 rounded-xs"
            style={{ background: option.swatch }}
          />
          {option.label}
        </RadioGroupPrimitive.Item>
      ))}
    </RadioGroupPrimitive.Root>
  );
}
