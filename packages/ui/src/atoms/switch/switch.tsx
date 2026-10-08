"use client";

import * as SwitchPrimitive from "@radix-ui/react-switch";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../utils/cn.js";

export interface SwitchProps extends ComponentPropsWithoutRef<typeof SwitchPrimitive.Root> {}

export function Switch({ className, ...props }: SwitchProps) {
  return (
    <SwitchPrimitive.Root
      className={cn("inline-flex size-10 shrink-0 items-center justify-center", className)}
      {...props}
    >
      <span className="relative block h-5 w-[34px] rounded-pill bg-line-strong transition-colors data-[state=checked]:bg-accent">
        <SwitchPrimitive.Thumb className="absolute top-[3px] left-[3px] block size-3.5 rounded-pill bg-surface transition-transform data-[state=checked]:translate-x-3.5" />
      </span>
    </SwitchPrimitive.Root>
  );
}
