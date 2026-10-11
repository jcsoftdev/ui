import { type FocusEvent, type KeyboardEvent, useCallback, useRef, useState } from "react";
import { composeHandlers } from "./compose.js";

export type RovingOrientation = "horizontal" | "vertical";
export type RovingDirection = "ltr" | "rtl";
export type RovingIntent = "first" | "last" | "prev" | "next";

export interface RovingFocusOptions {
  /** Restricts arrows to one axis; both axes work when omitted. */
  orientation?: RovingOrientation | undefined;
  /** Flips ArrowLeft/ArrowRight in `rtl`. */
  dir?: RovingDirection | undefined;
  /** Wraps around at the ends. Defaults to `true`. */
  loop?: boolean | undefined;
  /** Item that owns the tab stop until focus moves (the selected one, if any). */
  activeId?: string | null | undefined;
}

const ITEM_ATTR = "data-roving-item";

export function getRovingIntent(
  key: string,
  { orientation, dir = "ltr" }: Pick<RovingFocusOptions, "orientation" | "dir">,
): RovingIntent | undefined {
  if (key === "Home" || key === "PageUp") return "first";
  if (key === "End" || key === "PageDown") return "last";
  const horizontal = key === "ArrowLeft" || key === "ArrowRight";
  const vertical = key === "ArrowUp" || key === "ArrowDown";
  if (!horizontal && !vertical) return undefined;
  if (orientation === "vertical" && horizontal) return undefined;
  if (orientation === "horizontal" && vertical) return undefined;
  const forward =
    key === "ArrowRight"
      ? dir === "ltr"
      : key === "ArrowLeft"
        ? dir === "rtl"
        : key === "ArrowDown";
  return forward ? "next" : "prev";
}

export function findRovingTarget(
  items: HTMLElement[],
  current: HTMLElement,
  intent: RovingIntent,
  loop: boolean,
): HTMLElement | undefined {
  if (intent === "first") return items[0];
  if (intent === "last") return items[items.length - 1];
  const index = items.indexOf(current);
  const step = intent === "next" ? 1 : -1;
  const next = index + step;
  if (next >= 0 && next < items.length) return items[next];
  return loop ? items[(next + items.length) % items.length] : undefined;
}

export interface RovingItemOptions<E extends HTMLElement = HTMLElement> {
  /** Disabled items leave the arrow order and the tab order. */
  disabled?: boolean | undefined;
  onKeyDown?: ((event: KeyboardEvent<E>) => void) | undefined;
  onFocus?: ((event: FocusEvent<E>) => void) | undefined;
  /** Called after focus moved to `target` through `key`. */
  onNavigate?: ((target: HTMLElement, key: string) => void) | undefined;
}

/**
 * Roving tabindex for composite widgets. Spread `rootProps` on the container
 * and `getItemProps(id, ...)` on each item; order comes from the DOM, so it
 * works for any children (radios, tabs, segmented controls, menu items).
 */
export function useRovingFocus(options: RovingFocusOptions = {}) {
  const { orientation, dir, loop = true, activeId } = options;
  const rootRef = useRef<HTMLElement | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const stopId = focusedId ?? activeId ?? null;

  const getItems = useCallback(
    () => Array.from(rootRef.current?.querySelectorAll<HTMLElement>(`[${ITEM_ATTR}]`) ?? []),
    [],
  );

  const setRoot = useCallback((node: HTMLElement | null) => {
    rootRef.current = node;
  }, []);

  const rootProps = {
    ref: setRoot,
    tabIndex: stopId === null ? 0 : -1,
    onFocus: (event: FocusEvent<HTMLElement>) => {
      if (event.target === event.currentTarget) getItems()[0]?.focus();
    },
  };

  function getItemProps<E extends HTMLElement = HTMLElement>(
    id: string,
    item: RovingItemOptions<E> = {},
  ) {
    const { disabled, onKeyDown, onFocus, onNavigate } = item;
    return {
      [ITEM_ATTR]: disabled ? undefined : "",
      tabIndex: !disabled && stopId === id ? 0 : -1,
      onFocus: composeHandlers(onFocus, () => setFocusedId(id)),
      onKeyDown: composeHandlers(onKeyDown, (event: KeyboardEvent<E>) => {
        if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
        const intent = getRovingIntent(event.key, { orientation, dir });
        if (!intent) return;
        event.preventDefault();
        const target = findRovingTarget(getItems(), event.currentTarget, intent, loop);
        if (!target) return;
        target.focus();
        onNavigate?.(target, event.key);
      }),
    };
  }

  return { rootProps, getItemProps };
}
