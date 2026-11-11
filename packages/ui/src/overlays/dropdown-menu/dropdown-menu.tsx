"use client";

import type { ComponentPropsWithRef } from "react";
import { Check, ChevronRight } from "../../icons/index.js";
import { type IntentProps, intentAttributes, useIntentTarget } from "../../intent/index.js";
import * as MenuPrimitive from "../../primitives/menu/menu.js";
import { cn } from "../../utils/cn.js";
import { useComposedRefs } from "../../utils/compose.js";
import { type Material, materialClass } from "../../utils/material.js";
import { ITEM_MOTION, POPPER_MOTION } from "../../utils/overlay-motion.js";

export const DropdownMenu = MenuPrimitive.Root;
export const DropdownMenuTrigger = MenuPrimitive.Trigger;
export const DropdownMenuRadioGroup = MenuPrimitive.RadioGroup;
export const DropdownMenuGroup = MenuPrimitive.Group;
export const DropdownMenuSub = MenuPrimitive.Sub;
export const DropdownMenuArrow = MenuPrimitive.Arrow;
/**
 * Positions the menu against an element other than the trigger, e.g. the whole user card of a
 * sidebar footer while a nested button opens it. Without a trigger, drive the menu with `open`.
 */
export const DropdownMenuAnchor = MenuPrimitive.Anchor;

/** Layering and size limits every menu surface needs; the look is `dropdownMenuSurfaceClasses`. */
const placement =
  "z-85 min-w-[min(14.375rem,var(--ui-popper-available-width))] max-h-(--ui-popper-available-height) max-w-(--ui-popper-available-width) overflow-y-auto";

/** The default look of a menu panel: radius, surface, padding and shadow. */
export const dropdownMenuSurfaceClasses = "rounded-popover surface-overlay p-1.5 shadow-overlay";

/** The default look of a menu item, for your own `DropdownMenuItem asChild` or `MenuPrimitive.Item`. */
export const dropdownMenuItemClasses =
  "flex min-h-(--touch-target) w-full cursor-pointer items-center gap-2 rounded-event px-2.5 py-1.75 text-body text-ink outline-none data-highlighted:bg-surface-2";

const surface = `${placement} ${POPPER_MOTION} ${dropdownMenuSurfaceClasses}`;
const itemBase = `${dropdownMenuItemClasses} ${ITEM_MOTION}`;

export interface DropdownMenuContentProps extends MenuPrimitive.MenuContentProps, IntentProps {
  /** Portal target. Defaults to `document.body`; pass an element to keep a scoped `data-style`. */
  container?: HTMLElement | null;
  /**
   * Surface material. Omitted keeps the default for this layer; `"glass"` and `"glass-clear"`
   * are frosted glass, `"liquid"` and `"liquid-clear"` Liquid Glass (with its fallbacks), `"solid"`
   * forces an opaque surface. Liquid options go in `style` (`liquidStyle()` from
   * `@jcsoftdev/ui/liquid`); the lens needs `<LiquidGlass />` mounted once.
   */
  material?: Material;
  /**
   * Leaves out the panel look (radius, surface, padding, shadow) and keeps only the layering and
   * size limits, so a custom menu (a user card with its own header, say) draws its own surface
   * with `className`. Positioning, focus handling and keyboard navigation are unchanged, and the
   * items inside are the same `DropdownMenuItem`s.
   */
  bare?: boolean;
}

export function DropdownMenuContent({
  className,
  sideOffset = 6,
  collisionPadding = 8,
  container,
  material,
  bare = false,
  intent,
  intentKey,
  ref,
  ...props
}: DropdownMenuContentProps) {
  const composedRef = useComposedRefs<HTMLDivElement>(
    ref,
    useIntentTarget<HTMLDivElement>({ intent, intentKey }, { role: "menu" }),
  );
  return (
    <MenuPrimitive.Portal container={container}>
      <MenuPrimitive.Content
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        className={
          bare
            ? cn(placement, POPPER_MOTION, className)
            : cn(surface, materialClass(material, "surface-solid"), className)
        }
        {...intentAttributes({ intent, intentKey })}
        {...props}
        ref={composedRef}
      />
    </MenuPrimitive.Portal>
  );
}

export interface DropdownMenuItemProps extends MenuPrimitive.MenuItemProps, IntentProps {}

export function DropdownMenuItem({
  className,
  intent,
  intentKey,
  ref,
  ...props
}: DropdownMenuItemProps) {
  const composedRef = useComposedRefs<HTMLDivElement>(
    ref,
    useIntentTarget<HTMLDivElement>({ intent, intentKey }, { role: "menuitem" }),
  );
  return (
    <MenuPrimitive.Item
      className={cn(
        itemBase,
        "data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
      {...intentAttributes({ intent, intentKey })}
      {...props}
      ref={composedRef}
    />
  );
}

export interface DropdownMenuCheckboxItemProps
  extends MenuPrimitive.MenuCheckboxItemProps,
    IntentProps {}

export function DropdownMenuCheckboxItem({
  className,
  children,
  intent,
  intentKey,
  ref,
  ...props
}: DropdownMenuCheckboxItemProps) {
  const composedRef = useComposedRefs<HTMLDivElement>(
    ref,
    useIntentTarget<HTMLDivElement>({ intent, intentKey }, { role: "menuitemcheckbox" }),
  );
  return (
    <MenuPrimitive.CheckboxItem
      className={cn(
        itemBase,
        "relative ps-8 data-disabled:pointer-events-none data-disabled:opacity-50",
        className,
      )}
      {...intentAttributes({ intent, intentKey })}
      {...props}
      ref={composedRef}
    >
      <span className="absolute inset-s-2 flex size-4 items-center justify-center">
        <MenuPrimitive.ItemIndicator>
          <Check aria-hidden="true" className="size-4" />
        </MenuPrimitive.ItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  );
}

export interface DropdownMenuRadioItemProps extends MenuPrimitive.MenuRadioItemProps, IntentProps {}

/** Exposes `role="menuitemradio"` and `aria-checked`: use it for single-value filters. */
export function DropdownMenuRadioItem({
  className,
  intent,
  intentKey,
  ref,
  ...props
}: DropdownMenuRadioItemProps) {
  const composedRef = useComposedRefs<HTMLDivElement>(
    ref,
    useIntentTarget<HTMLDivElement>({ intent, intentKey }, { role: "menuitemradio" }),
  );
  return (
    <MenuPrimitive.RadioItem
      className={cn(
        itemBase,
        "data-[state=checked]:font-bold data-[state=checked]:text-accent-ink",
        className,
      )}
      {...intentAttributes({ intent, intentKey })}
      {...props}
      ref={composedRef}
    />
  );
}

export function DropdownMenuLabel({ className, ...props }: ComponentPropsWithRef<"div">) {
  return (
    <MenuPrimitive.Label
      className={cn("px-2.5 pt-1.5 pb-1 text-overline text-ink-3", className)}
      {...props}
    />
  );
}

export interface DropdownMenuSeparatorProps extends ComponentPropsWithRef<"div"> {}

export function DropdownMenuSeparator({ className, ...props }: DropdownMenuSeparatorProps) {
  return (
    <MenuPrimitive.Separator className={cn("my-1.25 border-t-divider", className)} {...props} />
  );
}

export interface DropdownMenuSubTriggerProps
  extends MenuPrimitive.MenuSubTriggerProps,
    IntentProps {}

/** Item that opens a nested menu; the chevron is added after the children. */
export function DropdownMenuSubTrigger({
  className,
  children,
  intent,
  intentKey,
  ref,
  ...props
}: DropdownMenuSubTriggerProps) {
  const composedRef = useComposedRefs<HTMLDivElement>(
    ref,
    useIntentTarget<HTMLDivElement>({ intent, intentKey }, { role: "menuitem" }),
  );
  return (
    <MenuPrimitive.SubTrigger
      className={cn(
        itemBase,
        "data-disabled:pointer-events-none data-disabled:opacity-50 data-[state=open]:bg-surface-2",
        className,
      )}
      {...intentAttributes({ intent, intentKey })}
      {...props}
      ref={composedRef}
    >
      {children}
      <ChevronRight aria-hidden="true" className="ms-auto size-4 rtl:rotate-180" />
    </MenuPrimitive.SubTrigger>
  );
}

export interface DropdownMenuSubContentProps extends MenuPrimitive.MenuSubContentProps {
  container?: HTMLElement | null;
}

export function DropdownMenuSubContent({
  className,
  collisionPadding = 8,
  container,
  ...props
}: DropdownMenuSubContentProps) {
  return (
    <MenuPrimitive.Portal container={container}>
      <MenuPrimitive.SubContent
        collisionPadding={collisionPadding}
        className={cn(surface, className)}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}
