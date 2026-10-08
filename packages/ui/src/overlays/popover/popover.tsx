"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../utils/cn.js";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverClose = PopoverPrimitive.Close;
export const PopoverAnchor = PopoverPrimitive.Anchor;

export interface PopoverContentProps
  extends ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> {}

/** Positioned contextual panel; viewport collision is handled by Radix (Floating UI). */
export function PopoverContent({
  className,
  sideOffset = 6,
  collisionPadding = 8,
  ...props
}: PopoverContentProps) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          "z-85 min-w-[min(14.375rem,var(--radix-popover-content-available-width))] max-h-(--radix-popover-content-available-height) max-w-(--radix-popover-content-available-width) overflow-y-auto rounded-card bg-float p-1.5 text-ink shadow-pop",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
