"use client";

import { useId, useState } from "react";
import { cn } from "../../utils/cn.js";
import { type ButtonOption, OptionShell, optionGridClass } from "../internal/button-option.js";

export type RadioButtonOption = ButtonOption;

export interface RadioButtonGroupProps {
  options: RadioButtonOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  disabled?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  className?: string;
}

/**
 * Exclusive choice where each option is a button-like card. Native radios underneath, so arrow
 * keys, form submission and the `radiogroup` semantics come from the browser. Distinct from
 * `RadioGroup` (dot indicator) and `Segmented` (2-4 compact options).
 */
export function RadioButtonGroup({
  options,
  value: valueProp,
  defaultValue,
  onValueChange,
  name,
  disabled,
  className,
  ...aria
}: RadioButtonGroupProps) {
  const generated = useId();
  const [inner, setInner] = useState(defaultValue);
  const value = valueProp ?? inner;

  return (
    <div
      role="radiogroup"
      className={cn("@container/options", optionGridClass, className)}
      {...aria}
    >
      {options.map((option) => (
        <OptionShell
          key={option.value}
          option={option}
          input={
            <input
              type="radio"
              name={name ?? generated}
              value={option.value}
              checked={value === option.value}
              disabled={disabled || option.disabled}
              onChange={() => {
                if (valueProp === undefined) setInner(option.value);
                onValueChange?.(option.value);
              }}
              className="sr-only"
            />
          }
        />
      ))}
    </div>
  );
}
