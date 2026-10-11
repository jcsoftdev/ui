"use client";

import { useState } from "react";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import {
  type ButtonOption,
  type ButtonOptionPart,
  OptionShell,
  optionGridClass,
} from "../internal/button-option.js";

export type CheckboxButtonOption = ButtonOption;

export type CheckboxButtonGroupPart = "root" | ButtonOptionPart;

export interface CheckboxButtonGroupProps {
  options: CheckboxButtonOption[];
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (value: string[]) => void;
  /** Form field name shared by the checkboxes. */
  name?: string;
  disabled?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  className?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<CheckboxButtonGroupPart>;
}

/** Multi-select where each option is a button-like card; native checkboxes underneath. */
export function CheckboxButtonGroup({
  options,
  value: valueProp,
  defaultValue = [],
  onValueChange,
  name,
  disabled,
  className,
  classNames,
  ...aria
}: CheckboxButtonGroupProps) {
  const [inner, setInner] = useState(defaultValue);
  const value = valueProp ?? inner;

  const toggle = (optionValue: string, checked: boolean) => {
    const next = checked ? [...value, optionValue] : value.filter((v) => v !== optionValue);
    if (valueProp === undefined) setInner(next);
    onValueChange?.(next);
  };

  return (
    <fieldset
      className={cn(
        "@container/options m-0 min-w-0 border-0 p-0",
        optionGridClass,
        classNames?.root,
        className,
      )}
      {...aria}
    >
      {options.map((option) => (
        <OptionShell
          key={option.value}
          option={option}
          classNames={classNames}
          input={
            <input
              type="checkbox"
              name={name}
              value={option.value}
              checked={value.includes(option.value)}
              disabled={disabled || option.disabled}
              onChange={(event) => toggle(option.value, event.target.checked)}
              className="sr-only"
            />
          }
        />
      ))}
    </fieldset>
  );
}
