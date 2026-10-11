"use client";

import { useId } from "react";
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

export interface RadioGroupProps extends RadioGroupRootProps {
  options: RadioOption[];
}

export function RadioGroup({ options, className, ...props }: RadioGroupProps) {
  const baseId = useId();

  return (
    <RadioGroupRoot
      className={cn(
        "grid gap-2 [grid-template-columns:repeat(auto-fill,minmax(min(170px,100%),1fr))]",
        className,
      )}
      {...props}
    >
      {options.map((option) => {
        const id = `${baseId}-${option.value}`;
        return (
          <label
            key={option.value}
            htmlFor={id}
            className="flex cursor-pointer items-start gap-2 rounded-control border-divider p-2.5 text-body in-data-[density=touch]:min-h-11 has-[[data-state=checked]]:border-accent has-[[data-state=checked]]:shadow-[inset_0_0_0_1px_var(--accent)]"
          >
            <RadioGroupItem
              id={id}
              value={option.value}
              disabled={option.disabled}
              className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-pill border-[1.5px] border-line-strong data-[state=checked]:border-accent"
            >
              <RadioGroupIndicator className="size-2 rounded-pill bg-accent" />
            </RadioGroupItem>
            <span className="flex min-w-0 flex-col [overflow-wrap:anywhere]">
              <b className="font-semibold text-[13px]">{option.label}</b>
              {option.description ? <span className="text-ink-3">{option.description}</span> : null}
            </span>
          </label>
        );
      })}
    </RadioGroupRoot>
  );
}
