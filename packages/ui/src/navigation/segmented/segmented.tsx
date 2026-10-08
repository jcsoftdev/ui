"use client";

import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../utils/cn.js";

export interface SegmentedProps extends Omit<ToggleGroupPrimitive.ToggleGroupSingleProps, "type"> {}

/** Exclusive selector for 2-4 options. `type="single"` gives Radix the `radiogroup` role. */
export function Segmented({ className, ...props }: SegmentedProps) {
  return (
    <ToggleGroupPrimitive.Root
      type="single"
      className={cn("inline-flex rounded-pill bg-seg-track p-0.75", className)}
      {...props}
    />
  );
}

export interface SegmentedItemProps
  extends ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item> {}

export function SegmentedItem({ className, ...props }: SegmentedItemProps) {
  return (
    <ToggleGroupPrimitive.Item
      className={cn(
        "inline-flex h-7.5 cursor-pointer items-center gap-1.5 rounded-pill px-3.5 text-control text-ink-2 hover:text-ink data-[state=on]:bg-seg-on data-[state=on]:text-ink data-[state=on]:shadow-sel",
        className,
      )}
      {...props}
    />
  );
}
