"use client";

import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { type ComponentPropsWithoutRef, useId } from "react";
import { cn } from "../../utils/cn.js";

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
}

export interface RadioGroupProps extends ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root> {
  options: RadioOption[];
}

export function RadioGroup({ options, className, ...props }: RadioGroupProps) {
  const baseId = useId();

  return (
    <RadioGroupPrimitive.Root
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
            <RadioGroupPrimitive.Item
              id={id}
              value={option.value}
              className="mt-0.5 grid size-4 shrink-0 place-items-center rounded-pill border-[1.5px] border-line-strong data-[state=checked]:border-accent"
            >
              <RadioGroupPrimitive.Indicator className="size-2 rounded-pill bg-accent" />
            </RadioGroupPrimitive.Item>
            <span className="flex min-w-0 flex-col [overflow-wrap:anywhere]">
              <b className="font-semibold text-[13px]">{option.label}</b>
              {option.description ? <span className="text-ink-3">{option.description}</span> : null}
            </span>
          </label>
        );
      })}
    </RadioGroupPrimitive.Root>
  );
}
