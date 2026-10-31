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
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<RadioGroupPart>;
  options: RadioOption[];
}

export function RadioGroup({ options, className, classNames, ...props }: RadioGroupProps) {
  const baseId = useId();

  return (
    <RadioGroupRoot
      className={cn(
        "grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(min(170px,100%),1fr))]",
        classNames?.root,
        className,
      )}
      {...props}
    >
      {options.map((option) => {
        const id = `${baseId}-${option.value}`;
        const labelId = `${id}-label`;
        const descriptionId = `${id}-description`;
        return (
          <label
            key={option.value}
            htmlFor={id}
            className={cn(
              "flex cursor-pointer items-start gap-2 rounded-control border-divider p-2.5 text-body min-h-(--touch-target) has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:shadow-[inset_0_0_0_1px_var(--accent)]",
              classNames?.option,
            )}
          >
            <RadioGroupItem
              id={id}
              value={option.value}
              disabled={option.disabled}
              aria-labelledby={labelId}
              aria-describedby={option.description ? descriptionId : undefined}
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
              <b id={labelId} className={cn("font-semibold text-fs-130", classNames?.label)}>
                {option.label}
              </b>
              {option.description ? (
                <span id={descriptionId} className={cn("text-ink-3", classNames?.description)}>
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
