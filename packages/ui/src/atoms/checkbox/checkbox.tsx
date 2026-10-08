"use client";

import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../utils/cn.js";

export interface CheckboxProps extends ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {}

export function Checkbox({ className, ...props }: CheckboxProps) {
  return (
    <CheckboxPrimitive.Root
      className={cn("inline-flex size-10 shrink-0 items-center justify-center", className)}
      {...props}
    >
      <span className="grid size-[18px] place-items-center rounded-pill border-[1.5px] border-line-strong data-[state=checked]:border-success data-[state=checked]:bg-success">
        <CheckboxPrimitive.Indicator>
          <Check aria-hidden="true" className="size-[11px] stroke-[3] text-on-accent" />
        </CheckboxPrimitive.Indicator>
      </span>
    </CheckboxPrimitive.Root>
  );
}
