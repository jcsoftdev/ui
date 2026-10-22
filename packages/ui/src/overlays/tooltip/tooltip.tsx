"use client";

import {
  type FocusEvent,
  type PointerEvent,
  type ReactElement,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
} from "react";
import { Kbd } from "../../atoms/kbd/kbd.js";
import * as PopoverPrimitive from "../../primitives/popover/popover.js";
import type { Align, Side } from "../../primitives/popper/geometry.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { type Material, materialClass } from "../../utils/material.js";
import { Slot } from "../../utils/slot.js";
import { useControllableState } from "../../utils/use-controllable-state.js";
import { opensOnFocus, opensOnHover } from "./model.js";

export type TooltipPart = "content" | "shortcut";

export interface TooltipProps {
  /** The hint. It repeats or complements the trigger's name; never put information only here. */
  content: ReactNode;
  /** Keyboard shortcut shown next to the hint, rendered as a `Kbd`. */
  shortcut?: ReactNode;
  side?: Side;
  align?: Align;
  /** Gap between the trigger and the tooltip, in px. */
  sideOffset?: number;
  /** ms the pointer must rest on the trigger before the tooltip opens. Keyboard focus opens at once. */
  openDelay?: number;
  /** ms before closing after the pointer leaves, so it can travel onto the tooltip (WCAG 1.4.13). */
  closeDelay?: number;
  /** Controlled open state. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Never show the tooltip, e.g. when the label is already visible. */
  disabled?: boolean;
  /** Portal target. Defaults to `document.body`; pass an element to keep a scoped `data-style`. */
  container?: HTMLElement | null;
  /** Surface material; see `PopoverContent`. */
  material?: Material;
  className?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the content and is merged last. */
  classNames?: ClassNames<TooltipPart>;
  /** The element that gets the tooltip. It receives `aria-describedby` while the tooltip is open. */
  children: ReactElement;
}

function focusIsVisible(element: Element): boolean {
  try {
    return element.matches(":focus-visible");
  } catch {
    return true;
  }
}

/**
 * Short, non-interactive hint for a control. Opens on hover (after `openDelay`) and on keyboard
 * focus, closes on Escape, blur, press and pointer leave. Touch never opens it by hover, so a tap
 * always reaches the control. The trigger is described by it (`aria-describedby`), and the
 * tooltip never takes focus.
 */
export function Tooltip({
  content,
  shortcut,
  side = "top",
  align = "center",
  sideOffset = 6,
  openDelay = 300,
  closeDelay = 100,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  disabled = false,
  container,
  material,
  className,
  classNames,
  children,
}: TooltipProps) {
  const [openState, setOpen] = useControllableState({
    prop: openProp,
    defaultProp: defaultOpen,
    onChange: onOpenChange,
  });
  const open = openState && !disabled;
  const contentId = useId();
  const timer = useRef<number | undefined>(undefined);
  const pressed = useRef(false);

  const schedule = useCallback(
    (next: boolean, delay: number) => {
      window.clearTimeout(timer.current);
      if (delay <= 0) setOpen(next);
      else timer.current = window.setTimeout(() => setOpen(next), delay);
    },
    [setOpen],
  );

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const trigger = (
    <Slot
      aria-describedby={open ? contentId : undefined}
      onPointerEnter={(event: PointerEvent<HTMLElement>) => {
        if (opensOnHover(event.pointerType)) schedule(true, openDelay);
      }}
      onPointerLeave={(event: PointerEvent<HTMLElement>) => {
        if (opensOnHover(event.pointerType)) schedule(false, closeDelay);
      }}
      onPointerDown={() => {
        pressed.current = true;
        schedule(false, 0);
      }}
      onFocus={(event: FocusEvent<HTMLElement>) => {
        if (
          opensOnFocus({ pressed: pressed.current, focusVisible: focusIsVisible(event.target) })
        ) {
          schedule(true, 0);
        }
      }}
      onBlur={() => {
        pressed.current = false;
        schedule(false, 0);
      }}
    >
      {children}
    </Slot>
  );

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Anchor asChild>{trigger}</PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal container={container}>
        <PopoverPrimitive.Content
          id={contentId}
          role="tooltip"
          side={side}
          align={align}
          sideOffset={sideOffset}
          collisionPadding={8}
          // A hint: focus stays on the trigger, going in and out.
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onMouseEnter={() => schedule(true, 0)}
          onMouseLeave={() => schedule(false, closeDelay)}
          className={cn(
            "z-85 flex w-max max-w-[min(16rem,var(--ui-popper-available-width))] items-center gap-2 rounded-popover surface-overlay px-2.5 py-1.5 text-meta text-ink shadow-overlay",
            materialClass(material, "surface-solid"),
            classNames?.content,
            className,
          )}
        >
          <span className="min-w-0 break-words">{content}</span>
          {shortcut === undefined ? null : <Kbd className={classNames?.shortcut}>{shortcut}</Kbd>}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
