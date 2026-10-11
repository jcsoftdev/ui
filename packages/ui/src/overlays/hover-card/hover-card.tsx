"use client";

import * as PopoverPrimitive from "@radix-ui/react-popover";
import {
  type ComponentPropsWithoutRef,
  createContext,
  type FocusEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "../../utils/cn.js";
import { Slot } from "../../utils/slot.js";

interface HoverCardContextValue {
  contentId: string;
  open: boolean;
  schedule: (open: boolean, delay: number) => void;
  openDelay: number;
  closeDelay: number;
}

const HoverCardContext = createContext<HoverCardContextValue | null>(null);

function useHoverCard(): HoverCardContextValue {
  const value = useContext(HoverCardContext);
  if (!value) throw new Error("HoverCardTrigger and HoverCardContent must be inside HoverCard");
  return value;
}

export interface HoverCardProps {
  children: ReactNode;
  /** Controlled open state. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** ms before opening on hover (focus opens at once). */
  openDelay?: number;
  /** ms before closing, so the pointer can travel into the card. */
  closeDelay?: number;
}

/**
 * Preview card shown on hover or keyboard focus of its trigger. Built on the popover
 * primitive for placement and collision handling; it never takes focus and closes on Escape.
 */
export function HoverCard({
  children,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  openDelay = 300,
  closeDelay = 150,
}: HoverCardProps) {
  const [state, setState] = useState(defaultOpen);
  const open = openProp ?? state;
  const timer = useRef<number | undefined>(undefined);
  const contentId = useId();

  const setOpen = useCallback(
    (next: boolean) => {
      if (openProp === undefined) setState(next);
      onOpenChange?.(next);
    },
    [openProp, onOpenChange],
  );

  const schedule = useCallback(
    (next: boolean, delay: number) => {
      window.clearTimeout(timer.current);
      if (delay <= 0) setOpen(next);
      else timer.current = window.setTimeout(() => setOpen(next), delay);
    },
    [setOpen],
  );

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const value = useMemo(
    () => ({ contentId, open, schedule, openDelay, closeDelay }),
    [contentId, open, schedule, openDelay, closeDelay],
  );

  return (
    <HoverCardContext.Provider value={value}>
      <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
        {children}
      </PopoverPrimitive.Root>
    </HoverCardContext.Provider>
  );
}

export interface HoverCardTriggerProps extends ComponentPropsWithoutRef<"span"> {
  /** Use the child element as the trigger instead of wrapping it in a span. */
  asChild?: boolean;
}

export function HoverCardTrigger({
  asChild,
  onPointerEnter,
  onPointerLeave,
  onFocus,
  onBlur,
  ...props
}: HoverCardTriggerProps) {
  const card = useHoverCard();
  const Comp = asChild ? Slot : "span";
  return (
    <PopoverPrimitive.Anchor asChild>
      <Comp
        aria-describedby={card.open ? card.contentId : undefined}
        onPointerEnter={(event: PointerEvent<HTMLSpanElement>) => {
          onPointerEnter?.(event);
          if (event.pointerType !== "touch") card.schedule(true, card.openDelay);
        }}
        onPointerLeave={(event: PointerEvent<HTMLSpanElement>) => {
          onPointerLeave?.(event);
          if (event.pointerType !== "touch") card.schedule(false, card.closeDelay);
        }}
        onFocus={(event: FocusEvent<HTMLSpanElement>) => {
          onFocus?.(event);
          card.schedule(true, 0);
        }}
        onBlur={(event: FocusEvent<HTMLSpanElement>) => {
          onBlur?.(event);
          card.schedule(false, 0);
        }}
        {...props}
      />
    </PopoverPrimitive.Anchor>
  );
}

export interface HoverCardContentProps
  extends Omit<ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>, "onOpenAutoFocus"> {
  /** Portal target. Defaults to `document.body`; pass an element to keep a scoped `data-style`. */
  container?: HTMLElement | null;
}

export function HoverCardContent({
  className,
  sideOffset = 8,
  collisionPadding = 8,
  onMouseEnter,
  onMouseLeave,
  onCloseAutoFocus,
  container,
  ...props
}: HoverCardContentProps) {
  const card = useHoverCard();
  return (
    <PopoverPrimitive.Portal container={container}>
      <PopoverPrimitive.Content
        id={card.contentId}
        role="tooltip"
        sideOffset={sideOffset}
        collisionPadding={collisionPadding}
        // The card is a preview: focus stays on the trigger.
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          event.preventDefault();
        }}
        onMouseEnter={(event) => {
          onMouseEnter?.(event);
          card.schedule(true, 0);
        }}
        onMouseLeave={(event) => {
          onMouseLeave?.(event);
          card.schedule(false, card.closeDelay);
        }}
        className={cn(
          "z-85 w-72 max-w-(--radix-popover-content-available-width) rounded-popover border-card surface-overlay bg-surface-overlay p-card text-body text-ink shadow-overlay",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  );
}
