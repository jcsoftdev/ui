"use client";

import * as PopoverPrimitive from "../../primitives/popover/popover.js";
import { cn } from "../../utils/cn.js";
import { type Material, materialClass } from "../../utils/material.js";

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;
export const PopoverClose = PopoverPrimitive.Close;
export const PopoverAnchor = PopoverPrimitive.Anchor;
export const PopoverArrow = PopoverPrimitive.Arrow;

export interface PopoverContentProps extends PopoverPrimitive.PopoverContentProps {
  /** Portal target. Defaults to `document.body`; pass an element to keep a scoped `data-style`. */
  container?: HTMLElement | null;
  /**
   * Surface material. Omitted keeps the default for this layer; `"glass"` and `"glass-clear"`
   * are frosted glass, `"liquid"` and `"liquid-clear"` Liquid Glass (with its fallbacks), `"solid"`
   * forces an opaque surface. Liquid options go in `style` (`liquidStyle()` from
   * `@jcsoftdev/ui/liquid`); the lens needs `<LiquidGlass />` mounted once.
   */
  material?: Material;
}

/** Positioned contextual panel; flips and shifts to stay inside the viewport. */
export function PopoverContent({
  className,
  sideOffset = 6,
  collisionPadding = 8,
  container,
  material,
  ...props
}: PopoverContentProps) {
  return (
    <PopoverPrimitive.Portal container={container}>
      <PopoverPrimitive.Content
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={cn(
          "z-85 min-w-[min(14.375rem,var(--ui-popper-available-width))] max-h-(--ui-popper-available-height) max-w-(--ui-popper-available-width) overflow-y-auto rounded-popover surface-overlay p-1.5 text-ink shadow-overlay",
          materialClass(material, "surface-solid"),
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
