"use client";

import * as ProgressPrimitive from "@radix-ui/react-progress";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../utils/cn.js";

export interface ProgressProps
  extends Omit<ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>, "value"> {
  value: number;
  max?: number;
}

export function Progress({ value, max = 100, className, ...props }: ProgressProps) {
  return (
    <ProgressPrimitive.Root
      value={value}
      max={max}
      className={cn("h-1.5 overflow-hidden rounded-pill bg-track", className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="block h-full bg-accent transition-transform"
        style={{ transform: `translateX(-${100 - (value / max) * 100}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}

/** Thinner progress bar. */
export function Meter({ className, ...props }: ProgressProps) {
  return <Progress className={cn("h-[5px]", className)} {...props} />;
}
