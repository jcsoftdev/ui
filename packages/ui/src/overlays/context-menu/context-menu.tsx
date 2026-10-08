"use client";

import * as MenuPrimitive from "@radix-ui/react-dropdown-menu";
import { Check } from "lucide-react";
import {
  type ComponentPropsWithoutRef,
  createContext,
  type HTMLAttributes,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "../../utils/cn.js";

interface ContextMenuState {
  open: (x: number, y: number) => void;
}

const ContextMenuContext = createContext<ContextMenuState | null>(null);

const LONG_PRESS_MS = 600;

export interface ContextMenuProps {
  children: ReactNode;
  onOpenChange?: (open: boolean) => void;
}

/**
 * Menu opened by right-click, long-press or the keyboard (Menu key, Shift+F10) on its trigger
 * area. It reuses the dropdown-menu primitive anchored to the pointer, so roving focus,
 * typeahead, submenu keys, Escape and collision handling come for free.
 */
export function ContextMenu({ children, onOpenChange }: ContextMenuProps) {
  const [open, setOpen] = useState(false);
  const [point, setPoint] = useState({ x: 0, y: 0 });
  const returnFocus = useRef<HTMLElement | null>(null);

  const change = useCallback(
    (next: boolean) => {
      setOpen(next);
      onOpenChange?.(next);
      if (!next) returnFocus.current?.focus?.();
    },
    [onOpenChange],
  );

  const state = useMemo<ContextMenuState>(
    () => ({
      open: (x, y) => {
        returnFocus.current = document.activeElement as HTMLElement | null;
        setPoint({ x, y });
        change(true);
      },
    }),
    [change],
  );

  return (
    <ContextMenuContext.Provider value={state}>
      <MenuPrimitive.Root open={open} onOpenChange={change} modal={false}>
        <MenuPrimitive.Trigger asChild>
          <span
            aria-hidden="true"
            tabIndex={-1}
            style={{
              position: "fixed",
              left: point.x,
              top: point.y,
              width: 0,
              height: 0,
              pointerEvents: "none",
            }}
          />
        </MenuPrimitive.Trigger>
        {children}
      </MenuPrimitive.Root>
    </ContextMenuContext.Provider>
  );
}

export interface ContextMenuTriggerProps extends HTMLAttributes<HTMLDivElement> {
  disabled?: boolean;
}

/** The area that answers to right-click. Wrap a card, row or canvas. */
export function ContextMenuTrigger({
  disabled,
  onContextMenu,
  onKeyDown,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  ...props
}: ContextMenuTriggerProps) {
  const menu = useContext(ContextMenuContext);
  if (!menu) throw new Error("ContextMenuTrigger must be inside ContextMenu");
  const press = useRef<number | undefined>(undefined);
  const clearPress = () => window.clearTimeout(press.current);
  useEffect(() => () => window.clearTimeout(press.current), []);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: contextmenu area; keyboard users press the Menu key
    <div
      onContextMenu={(event) => {
        onContextMenu?.(event);
        if (disabled || event.defaultPrevented) return;
        event.preventDefault();
        menu.open(event.clientX, event.clientY);
      }}
      onKeyDown={(event: KeyboardEvent<HTMLDivElement>) => {
        onKeyDown?.(event);
        if (disabled || event.defaultPrevented) return;
        if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          menu.open(rect.left + 16, rect.top + Math.min(rect.height, 32));
        }
      }}
      onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
        onPointerDown?.(event);
        if (disabled || event.pointerType !== "touch") return;
        const { clientX, clientY } = event;
        clearPress();
        press.current = window.setTimeout(() => menu.open(clientX, clientY), LONG_PRESS_MS);
      }}
      onPointerMove={(event) => {
        onPointerMove?.(event);
        clearPress();
      }}
      onPointerUp={(event) => {
        onPointerUp?.(event);
        clearPress();
      }}
      onPointerCancel={(event) => {
        onPointerCancel?.(event);
        clearPress();
      }}
      {...props}
    />
  );
}

export interface ContextMenuContentProps
  extends Omit<ComponentPropsWithoutRef<typeof MenuPrimitive.Content>, "side" | "align"> {
  /** Portal target. Defaults to `document.body`; pass an element to keep a scoped `data-style`. */
  container?: HTMLElement | null;
}

export function ContextMenuContent({
  className,
  container,
  collisionPadding = 8,
  onCloseAutoFocus,
  ...props
}: ContextMenuContentProps) {
  return (
    <MenuPrimitive.Portal container={container}>
      <MenuPrimitive.Content
        side="bottom"
        align="start"
        sideOffset={2}
        collisionPadding={collisionPadding}
        // Focus returns to where it was when the menu opened (handled by ContextMenu).
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          event.preventDefault();
        }}
        className={cn(
          "z-85 max-h-(--radix-dropdown-menu-content-available-height) min-w-48 max-w-(--radix-dropdown-menu-content-available-width) overflow-y-auto rounded-popover border-card surface-overlay bg-surface-overlay p-1.5 text-ink shadow-overlay",
          className,
        )}
        {...props}
      />
    </MenuPrimitive.Portal>
  );
}

const itemBase =
  "relative flex min-h-control-sm w-full cursor-pointer select-none items-center gap-density-sm rounded-button px-control-x text-body outline-none data-disabled:pointer-events-none data-disabled:opacity-50 data-highlighted:bg-surface-2 [&_svg]:size-4 [&_svg]:shrink-0";

export interface ContextMenuItemProps extends ComponentPropsWithoutRef<typeof MenuPrimitive.Item> {
  /** Destructive action styling. */
  tone?: "default" | "danger";
}

export function ContextMenuItem({ className, tone = "default", ...props }: ContextMenuItemProps) {
  return (
    <MenuPrimitive.Item
      className={cn(itemBase, tone === "danger" ? "text-danger" : "text-ink", className)}
      {...props}
    />
  );
}

export type ContextMenuCheckboxItemProps = ComponentPropsWithoutRef<
  typeof MenuPrimitive.CheckboxItem
>;

export function ContextMenuCheckboxItem({
  className,
  children,
  ...props
}: ContextMenuCheckboxItemProps) {
  return (
    <MenuPrimitive.CheckboxItem className={cn(itemBase, "ps-8 text-ink", className)} {...props}>
      <span className="absolute inset-s-2 flex size-4 items-center justify-center">
        <MenuPrimitive.ItemIndicator>
          <Check aria-hidden="true" />
        </MenuPrimitive.ItemIndicator>
      </span>
      {children}
    </MenuPrimitive.CheckboxItem>
  );
}

export function ContextMenuLabel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("px-control-x pt-1.5 pb-1 text-ink-3 text-overline uppercase", className)}
      {...props}
    />
  );
}

export function ContextMenuSeparator({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof MenuPrimitive.Separator>) {
  return <MenuPrimitive.Separator className={cn("my-1 h-px bg-divider", className)} {...props} />;
}

/** Right-aligned hint such as "Ctrl+D"; purely visual. */
export function ContextMenuShortcut({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn("ms-auto ps-density text-ink-3 text-meta tracking-wide", className)}
      {...props}
    />
  );
}
