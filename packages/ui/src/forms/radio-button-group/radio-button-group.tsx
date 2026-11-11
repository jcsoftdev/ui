"use client";

import { useId, useState } from "react";
import { intentAttributes } from "../../intent/attributes.js";
import type { IntentProps } from "../../intent/types.js";
import { useIntentTarget, useIntentTargets } from "../../intent/use-intent-target.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import {
  type ButtonOption,
  type ButtonOptionPart,
  OptionShell,
  optionGridClass,
} from "../internal/button-option.js";

export type RadioButtonOption = ButtonOption;

export type RadioButtonGroupPart = "root" | ButtonOptionPart;

export interface RadioButtonGroupProps extends IntentProps {
  options: RadioButtonOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  disabled?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  className?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<RadioButtonGroupPart>;
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
  classNames,
  intent,
  intentKey,
  ...aria
}: RadioButtonGroupProps) {
  const generated = useId();
  const rootRef = useIntentTarget<HTMLDivElement>({ intent, intentKey }, { role: "radiogroup" });
  const bindOption = useIntentTargets();
  const [inner, setInner] = useState(defaultValue);
  const value = valueProp ?? inner;

  return (
    <div
      role="radiogroup"
      className={cn("@container/options", optionGridClass, classNames?.root, className)}
      {...intentAttributes({ intent, intentKey })}
      {...aria}
      ref={rootRef}
    >
      {options.map((option) => (
        <OptionShell
          key={option.value}
          option={option}
          classNames={classNames}
          input={
            <input
              {...intentAttributes({
                intent: option.intent,
                intentKey: option.intentKey ?? option.value,
              })}
              ref={bindOption({
                intent: option.intent,
                intentKey: option.intentKey ?? option.value,
              })}
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
