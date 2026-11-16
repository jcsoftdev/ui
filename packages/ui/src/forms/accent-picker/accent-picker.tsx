"use client";

import { useState } from "react";
import {
  RadioGroupItem,
  RadioGroupRoot,
  type RadioGroupRootProps,
} from "../../atoms/radio-group/radio-group-primitive.js";
import { intentAttributes } from "../../intent/attributes.js";
import type { IntentProps } from "../../intent/types.js";
import { useIntentTarget, useIntentTargets } from "../../intent/use-intent-target.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { useComposedRefs } from "../../utils/compose.js";

export interface AccentOption {
  value: string;
  label: string;
  /** Any CSS color value, typically a variable such as `var(--accent)`. */
  swatch: string;
  intent?: string | undefined;
  intentKey?: string | undefined;
}

export type AccentPickerPart = "root" | "option" | "swatch";

export interface AccentPickerProps
  extends Omit<RadioGroupRootProps, "value" | "defaultValue" | "onValueChange">,
    IntentProps {
  options: AccentOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<AccentPickerPart>;
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
  classNames,
  intent,
  intentKey,
  ref,
  ...props
}: AccentPickerProps) {
  const rootRef = useComposedRefs<HTMLDivElement>(
    ref,
    useIntentTarget({ intent, intentKey }, { role: "radiogroup" }),
  );
  const bindOption = useIntentTargets();
  const [internal, setInternal] = useState(() => defaultValue ?? options[0]?.value);
  const current = value ?? internal;

  return (
    <RadioGroupRoot
      {...intentAttributes({ intent, intentKey })}
      ref={rootRef}
      data-accent={current}
      value={current}
      onValueChange={(next) => {
        setInternal(next);
        onValueChange?.(next);
      }}
      className={cn("flex flex-wrap gap-2", classNames?.root, className)}
      {...props}
    >
      {options.map((option) => (
        <RadioGroupItem
          key={option.value}
          value={option.value}
          {...intentAttributes({
            intent: option.intent,
            intentKey: option.intentKey ?? option.value,
          })}
          ref={bindOption(
            { intent: option.intent, intentKey: option.intentKey ?? option.value },
            { role: "radio" },
          )}
          className={cn(
            "flex items-center gap-2 rounded-control border-divider px-2.5 py-1.75 font-semibold text-chip-text text-ink disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-accent-ink data-[state=checked]:shadow-selected",
            classNames?.option,
          )}
        >
          <span
            aria-hidden="true"
            className={cn("size-3.5 shrink-0 rounded-xs", classNames?.swatch)}
            style={{ background: option.swatch }}
          />
          {option.label}
        </RadioGroupItem>
      ))}
    </RadioGroupRoot>
  );
}
