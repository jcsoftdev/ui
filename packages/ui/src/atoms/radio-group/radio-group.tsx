"use client";

import { useId } from "react";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import {
  RadioGroupIndicator,
  RadioGroupItem,
  RadioGroupRoot,
  type RadioGroupRootProps,
} from "./radio-group-primitive.js";

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export type RadioGroupPart =
  | "root"
  | "option"
  | "radio"
  | "indicator"
  | "text"
  | "label"
  | "description";

export interface RadioGroupProps extends RadioGroupRootProps {
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root. */
  classNames?: ClassNames<RadioGroupPart>;
  options: RadioOption[];
}

export function RadioGroup({ options, className, classNames, ...props }: RadioGroupProps) {
  const baseId = useId();

  return (
    <RadioGroupRoot
      className={cn(
        "grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(min(170px,100%),1fr))]",
        className,
        classNames?.root,
      )}
      {...props}
    >
      {options.map((option) => {
        const id = `${baseId}-${option.value}`;
        return (
          <label
            key={option.value}
            htmlFor={id}
            className={cn(
              "flex cursor-pointer items-start gap-2 rounded-control border-divider p-2.5 text-body in-data-[density=touch]:min-h-11 has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:shadow-[inset_0_0_0_1px_var(--accent)]",
              classNames?.option,
            )}
          >
            <RadioGroupItem
              id={id}
              value={option.value}
              disabled={option.disabled}
              className={cn(
                "mt-0.5 grid size-4 shrink-0 place-items-center rounded-pill border-[1.5px] border-line-strong data-[state=checked]:border-accent",
                classNames?.radio,
              )}
            >
              <RadioGroupIndicator
                className={cn("size-2 rounded-pill bg-accent", classNames?.indicator)}
              />
            </RadioGroupItem>
            <span
              className={cn("flex min-w-0 flex-col [overflow-wrap:anywhere]", classNames?.text)}
            >
              <b className={cn("font-semibold text-fs-130", classNames?.label)}>{option.label}</b>
              {option.description ? (
                <span className={cn("text-ink-3", classNames?.description)}>
                  {option.description}
                </span>
              ) : null}
            </span>
          </label>
        );
      })}
    </RadioGroupRoot>
  );
}
