"use client";

import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import type { ComponentPropsWithoutRef, HTMLAttributes } from "react";
import { cn } from "../../utils/cn.js";

export const DropdownMenu = DropdownMenuPrimitive.Root;
export const DropdownMenuTrigger = DropdownMenuPrimitive.Trigger;
export const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

export interface DropdownMenuContentProps
  extends ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content> {}

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  ...props
}: DropdownMenuContentProps) {
  return (
    <DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn("z-85 min-w-57.5 rounded-card bg-float p-1.5 shadow-pop", className)}
        {...props}
      />
    </DropdownMenuPrimitive.Portal>
  );
}

export interface DropdownMenuItemProps
  extends ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> {}

export function DropdownMenuItem({ className, ...props }: DropdownMenuItemProps) {
  return (
    <DropdownMenuPrimitive.Item
      className={cn(
        "flex w-full cursor-pointer items-center gap-2 rounded-event px-2.5 py-1.75 text-body text-ink outline-none data-highlighted:bg-surface-2 data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export interface DropdownMenuRadioItemProps
  extends ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem> {}

/** Radix sets `role="menuitemradio"` and `aria-checked`: use it for single-value filters. */
export function DropdownMenuRadioItem({ className, ...props }: DropdownMenuRadioItemProps) {
  return (
    <DropdownMenuPrimitive.RadioItem
      className={cn(
        "flex w-full cursor-pointer items-center gap-2 rounded-event px-2.5 py-1.75 text-body text-ink outline-none data-highlighted:bg-surface-2 data-[state=checked]:font-bold data-[state=checked]:text-accent-ink",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-2.5 pt-1.5 pb-1 text-overline text-ink-3", className)} {...props} />
  );
}

export interface DropdownMenuSeparatorProps
  extends ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator> {}

export function DropdownMenuSeparator({ className, ...props }: DropdownMenuSeparatorProps) {
  return (
    <DropdownMenuPrimitive.Separator
      className={cn("my-1.25 border-t border-line", className)}
      {...props}
    />
  );
}
