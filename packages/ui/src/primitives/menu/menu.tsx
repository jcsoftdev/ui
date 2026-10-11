"use client";

import {
  type ComponentProps,
  createContext,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { composeHandlers, useComposedRefs } from "../../utils/compose.js";
import { Slot } from "../../utils/slot.js";
import { useControllableState } from "../../utils/use-controllable-state.js";
import { resolveTabOut } from "../focusable.js";
import { hideOthers } from "../hide-others.js";
import { blockOutsidePointerEvents } from "../pointer-events-lock.js";
import * as PopperPrimitive from "../popper/popper.js";
import { Portal } from "../portal.js";
import { lockBodyScroll } from "../scroll-lock.js";
import {
  type FocusOutsideEvent,
  type InteractOutsideEvent,
  type PointerDownOutsideEvent,
  useDismissableLayer,
} from "../use-dismissable-layer.js";
import { useFocusScope } from "../use-focus-scope.js";
import { useLayer } from "../use-layer.js";
import { usePresence } from "../use-presence.js";
import { graceArea, isPointInPolygon, type Point } from "./grace.js";
import { type MenuMove, moveIndex } from "./navigation.js";
import { nextTypeaheadIndex } from "./typeahead.js";

/**
 * In-house menu primitive (WAI-ARIA menu button pattern), same part names, callbacks and
 * data attributes as the Radix dropdown menu it replaced, on the in-house popper.
 * Unstyled. Parts: Root, Trigger, Anchor, Portal, Content, Item, CheckboxItem, RadioGroup,
 * RadioItem, ItemIndicator, Label, Separator, Group, Sub, SubTrigger, SubContent, Arrow.
 *
 * Highlight is DOM focus: the focused item carries `data-highlighted`. Items that
 * are disabled carry `data-disabled` and are skipped by arrows and typeahead.
 */

type Direction = "ltr" | "rtl";
type FocusIntent = "first" | "last" | "none";

const TYPEAHEAD_RESET_MS = 1000;
const SUB_OPEN_DELAY_MS = 100;
const GRACE_MS = 300;
const SUB_OPEN_KEYS: Record<Direction, string[]> = {
  ltr: ["Enter", " ", "ArrowRight"],
  rtl: ["Enter", " ", "ArrowLeft"],
};
const SUB_CLOSE_KEYS: Record<Direction, string[]> = { ltr: ["ArrowLeft"], rtl: ["ArrowRight"] };
const FIRST_KEYS = ["ArrowDown", "PageUp", "Home"];
const LAST_KEYS = ["ArrowUp", "PageDown", "End"];
const SELECT_KEYS = ["Enter", " "];

const stateOf = (open: boolean) => (open ? "open" : "closed");
const present = (value: boolean) => (value ? "" : undefined);

// --- contexts ---------------------------------------------------------------------------

interface MenuContextValue {
  open: boolean;
  modal: boolean;
  setOpen: (open: boolean) => void;
  getDir: () => Direction;
  triggerRef: RefObject<HTMLElement | null>;
  anchorRef: RefObject<HTMLElement | null>;
  contentId: string;
  triggerId: string;
  hasTrigger: boolean;
  setHasTrigger: (value: boolean) => void;
  hasCustomAnchor: boolean;
  setHasCustomAnchor: (value: boolean) => void;
  /** How the next opening should place focus; read and reset by the content. */
  focusIntent: RefObject<FocusIntent>;
  /** Every mounted content (root and submenus) of this menu. */
  contents: RefObject<Set<HTMLElement>>;
  /** Set when the menu was dismissed by interacting elsewhere: focus then stays where the user put it. */
  interactedOutside: RefObject<boolean>;
  /** Tab direction that closed the menu; the target is resolved after the page is un-hidden and the trap released. */
  exitTab: RefObject<"forward" | "backward" | null>;
}

const MenuContext = createContext<MenuContextValue | null>(null);

function useMenuContext(part: string): MenuContextValue {
  const context = useContext(MenuContext);
  if (!context) throw new Error(`<${part}> must be rendered inside <Menu.Root>`);
  return context;
}

interface ContentContextValue {
  searchRef: RefObject<string>;
  focusContent: () => void;
  onItemEnter: (event: ReactPointerEvent<HTMLElement>) => void;
  onItemLeave: (event: ReactPointerEvent<HTMLElement>) => void;
  graceIntent: RefObject<{ area: Point[]; side: "left" | "right" } | null>;
  isMovingToSubmenu: (event: ReactPointerEvent<HTMLElement>) => boolean;
}

const ContentContext = createContext<ContentContextValue | null>(null);

function useContentContext(part: string): ContentContextValue {
  const context = useContext(ContentContext);
  if (!context) throw new Error(`<${part}> must be rendered inside <Menu.Content>`);
  return context;
}

interface SubContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: RefObject<HTMLElement | null>;
  contentRef: RefObject<HTMLElement | null>;
  contentId: string;
  triggerId: string;
  focusIntent: RefObject<FocusIntent>;
}

const SubContext = createContext<SubContextValue | null>(null);

// --- DOM helpers ------------------------------------------------------------------------

const CONTENT_ATTR = "data-ui-menu-content";

function enabledItems(content: HTMLElement): HTMLElement[] {
  return Array.from(
    content.querySelectorAll<HTMLElement>("[data-ui-menu-item]:not([data-disabled])"),
  ).filter((item) => item.closest(`[${CONTENT_ATTR}]`) === content);
}

function textOf(item: HTMLElement): string {
  return (item.getAttribute("data-text-value") ?? item.textContent ?? "").trim();
}

function focusItem(item: HTMLElement | undefined | null) {
  item?.focus({ preventScroll: true });
}

function focusEntry(content: HTMLElement, intent: FocusIntent) {
  const items = enabledItems(content);
  if (intent === "first" && items.length > 0) focusItem(items[0]);
  else if (intent === "last" && items.length > 0) focusItem(items[items.length - 1]);
  else content.focus({ preventScroll: true });
}

function isInsideContent(event: { target: EventTarget; currentTarget: EventTarget }): boolean {
  const target = event.target as Element | null;
  return target?.closest?.(`[${CONTENT_ATTR}]`) === event.currentTarget;
}

function whenMouse<E extends ReactPointerEvent<HTMLElement>>(handler: (event: E) => void) {
  return (event: E) => {
    if (event.pointerType === "mouse") handler(event);
  };
}

function readDirection(node: HTMLElement | null): Direction {
  return node && getComputedStyle(node).direction === "rtl" ? "rtl" : "ltr";
}

// --- Root, Trigger, Anchor ---------------------------------------------------------------

export interface MenuRootProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Blocks the page (pointer, scroll, assistive tech) while open. Defaults to true. */
  modal?: boolean;
  /** Reading direction for submenu keys; read from the trigger when omitted. */
  dir?: Direction;
  children?: ReactNode;
}

export function Root({
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  modal = true,
  dir,
  children,
}: MenuRootProps) {
  const [open, setOpen] = useControllableState({
    prop: openProp,
    defaultProp: defaultOpen,
    onChange: onOpenChange,
  });
  const triggerRef = useRef<HTMLElement | null>(null);
  const anchorRef = useRef<HTMLElement | null>(null);
  const focusIntent = useRef<FocusIntent>("none");
  const contents = useRef(new Set<HTMLElement>());
  const interactedOutside = useRef(false);
  const exitTab = useRef<"forward" | "backward" | null>(null);
  const contentId = useId();
  const triggerId = useId();
  const [hasTrigger, setHasTrigger] = useState(false);
  const [hasCustomAnchor, setHasCustomAnchor] = useState(false);
  const getDir = useCallback(
    () => dir ?? readDirection(anchorRef.current ?? triggerRef.current),
    [dir],
  );
  const value = useMemo<MenuContextValue>(
    () => ({
      open,
      modal,
      setOpen,
      getDir,
      triggerRef,
      anchorRef,
      contentId,
      triggerId,
      hasTrigger,
      setHasTrigger,
      hasCustomAnchor,
      setHasCustomAnchor,
      focusIntent,
      contents,
      interactedOutside,
      exitTab,
    }),
    [open, modal, setOpen, getDir, contentId, triggerId, hasTrigger, hasCustomAnchor],
  );
  return (
    <MenuContext.Provider value={value}>
      <PopperPrimitive.Root>{children}</PopperPrimitive.Root>
    </MenuContext.Provider>
  );
}

type ButtonProps = ComponentProps<"button"> & { asChild?: boolean };

/** Positions the content against this element instead of the trigger (a point, for a context menu). */
export function Anchor({ ref, ...props }: PopperPrimitive.PopperAnchorProps) {
  const { setHasCustomAnchor, anchorRef } = useMenuContext("MenuAnchor");
  const composed = useComposedRefs<HTMLDivElement>(ref, anchorRef as RefObject<HTMLDivElement>);
  useEffect(() => {
    setHasCustomAnchor(true);
    return () => setHasCustomAnchor(false);
  }, [setHasCustomAnchor]);
  return <PopperPrimitive.Anchor {...props} ref={composed} />;
}

export interface MenuTriggerProps extends ButtonProps {}

export function Trigger({
  asChild,
  disabled = false,
  onPointerDown,
  onKeyDown,
  ref,
  ...props
}: MenuTriggerProps) {
  const context = useMenuContext("MenuTrigger");
  const { setHasTrigger } = context;
  useEffect(() => {
    setHasTrigger(true);
    return () => setHasTrigger(false);
  }, [setHasTrigger]);
  const composed = useComposedRefs<HTMLButtonElement>(
    ref,
    context.triggerRef as RefObject<HTMLButtonElement | null>,
  );
  const Comp = asChild ? Slot : "button";
  const trigger = (
    <Comp
      type={asChild ? undefined : "button"}
      id={context.triggerId}
      aria-haspopup="menu"
      aria-expanded={context.open}
      aria-controls={context.open ? context.contentId : undefined}
      data-state={stateOf(context.open)}
      data-disabled={present(disabled)}
      disabled={disabled}
      {...props}
      ref={composed as never}
      onPointerDown={composeHandlers(
        onPointerDown,
        (event: ReactPointerEvent<HTMLButtonElement>) => {
          if (disabled || event.button !== 0 || event.ctrlKey) return;
          context.focusIntent.current = "none";
          context.setOpen(!context.open);
          // Keep focus off the trigger so the opening menu is not stolen from.
          if (!context.open) event.preventDefault();
        },
      )}
      onKeyDown={composeHandlers(onKeyDown, (event: ReactKeyboardEvent<HTMLButtonElement>) => {
        if (disabled) return;
        if (event.key === "Enter" || event.key === " ") {
          context.focusIntent.current = "first";
          context.setOpen(!context.open);
        } else if (event.key === "ArrowDown") {
          context.focusIntent.current = "first";
          context.setOpen(true);
        } else if (event.key === "ArrowUp") {
          context.focusIntent.current = "last";
          context.setOpen(true);
        } else {
          return;
        }
        event.preventDefault();
      })}
    />
  );
  return context.hasCustomAnchor ? (
    trigger
  ) : (
    <PopperPrimitive.Anchor asChild>{trigger}</PopperPrimitive.Anchor>
  );
}

export { Portal };
export const Arrow = PopperPrimitive.Arrow;

// --- Content ------------------------------------------------------------------------------

type EventHooks = {
  onOpenAutoFocus?: (event: Event) => void;
  onCloseAutoFocus?: (event: Event) => void;
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
  onPointerDownOutside?: (event: PointerDownOutsideEvent) => void;
  onFocusOutside?: (event: FocusOutsideEvent) => void;
  onInteractOutside?: (event: InteractOutsideEvent) => void;
};

export interface MenuContentProps extends PopperPrimitive.PopperContentProps, EventHooks {
  /** Keep mounted while closed, for your own animation or measurement. */
  forceMount?: boolean;
}

interface ContentImplProps extends PopperPrimitive.PopperContentProps {
  nodeRef: RefObject<HTMLDivElement | null>;
  /** The layer is open and mounted for real (not a closed force-mounted content). */
  listening: boolean;
  engaged: boolean;
  trapped: boolean;
  /** Focus is placed here when the content opens. */
  onMountAutoFocus: (event: Event) => void;
  onUnmountAutoFocus: (event: Event) => void;
  onEscapeKeyDown: ((event: KeyboardEvent) => void) | undefined;
  onPointerDownOutside: ((event: PointerDownOutsideEvent) => void) | undefined;
  onFocusOutside: ((event: FocusOutsideEvent) => void) | undefined;
  onInteractOutside: ((event: InteractOutsideEvent) => void) | undefined;
  onDismiss: () => void;
  isSub: boolean;
}

function ContentImpl({
  nodeRef,
  listening,
  engaged,
  trapped,
  onMountAutoFocus,
  onUnmountAutoFocus,
  onEscapeKeyDown,
  onPointerDownOutside,
  onFocusOutside,
  onInteractOutside,
  onDismiss,
  isSub,
  onPointerDownCapture,
  onFocusCapture,
  onBlurCapture,
  onKeyDown,
  onPointerMove,
  style,
  ref,
  ...props
}: ContentImplProps) {
  const root = useMenuContext("MenuContent");
  const isTop = useLayer(listening);
  const focusInTree = useRef<() => boolean>(() => false);
  const searchRef = useRef("");
  const searchTimer = useRef<number | undefined>(undefined);
  const graceIntent = useRef<{ area: Point[]; side: "left" | "right" } | null>(null);
  const graceTimer = useRef<number | undefined>(undefined);
  const pointerDir = useRef<"left" | "right">("right");
  const lastPointerX = useRef(0);

  useEffect(() => {
    const node = nodeRef.current;
    if (!engaged || !node) return;
    root.contents.current.add(node);
    return () => {
      root.contents.current.delete(node);
    };
  }, [engaged, nodeRef, root.contents]);

  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (node) node.setAttribute("dir", root.getDir());
  });

  useEffect(
    () => () => {
      window.clearTimeout(searchTimer.current);
      window.clearTimeout(graceTimer.current);
    },
    [],
  );

  useFocusScope({
    ref: nodeRef,
    active: engaged,
    trapped,
    isTop,
    allowFocus: () => focusInTree.current(),
    onMountAutoFocus,
    onUnmountAutoFocus,
  });

  const layerProps = useDismissableLayer({
    ref: nodeRef,
    active: listening,
    isTop,
    onEscapeKeyDown,
    onPointerDownOutside,
    onFocusOutside,
    onInteractOutside,
    onDismiss,
  });
  focusInTree.current = layerProps.isFocusInTree;

  const isMovingToSubmenu = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const intent = graceIntent.current;
    if (!intent || pointerDir.current !== intent.side) return false;
    return isPointInPolygon({ x: event.clientX, y: event.clientY }, intent.area);
  }, []);

  const contentContext = useMemo<ContentContextValue>(
    () => ({
      searchRef,
      focusContent: () => nodeRef.current?.focus({ preventScroll: true }),
      onItemEnter: (event) => {
        if (isMovingToSubmenu(event)) event.preventDefault();
      },
      onItemLeave: (event) => {
        if (isMovingToSubmenu(event)) return;
        nodeRef.current?.focus({ preventScroll: true });
      },
      graceIntent,
      isMovingToSubmenu,
    }),
    [nodeRef, isMovingToSubmenu],
  );

  const typeahead = (content: HTMLElement, key: string) => {
    const search = searchRef.current + key;
    searchRef.current = search;
    window.clearTimeout(searchTimer.current);
    searchTimer.current = window.setTimeout(() => {
      searchRef.current = "";
    }, TYPEAHEAD_RESET_MS);
    const items = enabledItems(content);
    const index = nextTypeaheadIndex(
      items.map(textOf),
      search,
      items.indexOf(document.activeElement as HTMLElement),
    );
    if (index >= 0) focusItem(items[index]);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const content = nodeRef.current;
    if (!content || !isInsideContent(event)) return;
    const target = event.target as HTMLElement;
    if (event.key === "Tab") {
      event.preventDefault();
      root.interactedOutside.current = true;
      root.exitTab.current = event.shiftKey ? "backward" : "forward";
      root.setOpen(false);
      return;
    }
    const onContent = target === content;
    const onItem = target.closest("[data-ui-menu-item]") === target;
    const modifier = event.ctrlKey || event.altKey || event.metaKey;
    if ((onContent || onItem) && !modifier && !event.shiftKey) {
      let move: MenuMove | undefined;
      if (FIRST_KEYS.includes(event.key))
        move = event.key === "ArrowDown" && !onContent ? "next" : "first";
      else if (LAST_KEYS.includes(event.key))
        move = event.key === "ArrowUp" && !onContent ? "prev" : "last";
      if (move) {
        event.preventDefault();
        const items = enabledItems(content);
        const index = moveIndex(items.length, items.indexOf(target), move);
        focusItem(items[index]);
        return;
      }
    }
    const typing =
      target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
    if (!modifier && !typing && event.key.length === 1) {
      if (event.key === " " && searchRef.current !== "") event.preventDefault();
      if (event.key !== " " || searchRef.current !== "") typeahead(content, event.key);
    }
  };

  return (
    <ContentContext.Provider value={contentContext}>
      <PopperPrimitive.Content
        role="menu"
        aria-orientation="vertical"
        data-ui-menu-content=""
        data-state={stateOf(listening)}
        tabIndex={-1}
        {...props}
        ref={ref ?? nodeRef}
        style={{ outline: "none", ...(root.modal ? { pointerEvents: "auto" } : null), ...style }}
        onPointerDownCapture={composeHandlers(
          onPointerDownCapture,
          layerProps.onPointerDownCapture,
        )}
        onFocusCapture={composeHandlers(onFocusCapture, layerProps.onFocusCapture)}
        onBlurCapture={composeHandlers(onBlurCapture, layerProps.onBlurCapture)}
        onKeyDown={(event) => {
          // The focus scope may already have cancelled Tab natively; only the caller's cancel counts.
          const cancelledBefore = event.defaultPrevented;
          onKeyDown?.(event);
          if (event.defaultPrevented && !cancelledBefore) return;
          handleKeyDown(event);
        }}
        onPointerMove={composeHandlers(
          onPointerMove,
          whenMouse((event: ReactPointerEvent<HTMLDivElement>) => {
            if (!isInsideContent(event)) return;
            if (lastPointerX.current !== event.clientX) {
              pointerDir.current = event.clientX > lastPointerX.current ? "right" : "left";
              lastPointerX.current = event.clientX;
            }
          }),
        )}
      />
    </ContentContext.Provider>
  );
}

export function Content({ forceMount, ref, ...props }: MenuContentProps) {
  const root = useMenuContext("MenuContent");
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const composed = useComposedRefs<HTMLDivElement>(ref, nodeRef);
  const mounted = usePresence(forceMount || root.open, nodeRef);
  if (!mounted) return null;
  return (
    <RootContent {...props} ref={composed} nodeRef={nodeRef} engaged={root.open || !forceMount} />
  );
}

function RootContent({
  nodeRef,
  engaged,
  onOpenAutoFocus,
  onCloseAutoFocus,
  onEscapeKeyDown,
  onPointerDownOutside,
  onFocusOutside,
  onInteractOutside,
  ...props
}: Omit<MenuContentProps, "forceMount"> & {
  nodeRef: RefObject<HTMLDivElement | null>;
  engaged: boolean;
}) {
  const root = useMenuContext("MenuContent");
  const { open, modal, setOpen, triggerRef, interactedOutside } = root;
  const listening = open && engaged;

  useEffect(() => {
    if (listening) interactedOutside.current = false;
  }, [listening, interactedOutside]);

  useEffect(() => {
    if (!listening || !modal) return;
    const unlock = lockBodyScroll();
    const show = hideOthers([nodeRef.current]);
    const unblock = blockOutsidePointerEvents();
    return () => {
      unblock();
      show();
      unlock();
    };
  }, [listening, modal, nodeRef]);

  return (
    <ContentImpl
      id={root.contentId}
      aria-labelledby={root.hasTrigger ? root.triggerId : undefined}
      {...props}
      nodeRef={nodeRef}
      listening={listening}
      engaged={engaged}
      trapped={modal && open}
      isSub={false}
      onMountAutoFocus={(event) => {
        onOpenAutoFocus?.(event);
        if (event.defaultPrevented) return;
        event.preventDefault();
        const intent = root.focusIntent.current;
        root.focusIntent.current = "none";
        if (nodeRef.current) focusEntry(nodeRef.current, intent);
      }}
      onUnmountAutoFocus={(event) => {
        onCloseAutoFocus?.(event);
        if (event.defaultPrevented) return;
        event.preventDefault();
        const trigger = triggerRef.current;
        const tabbed = root.exitTab.current;
        root.exitTab.current = null;
        if (tabbed && trigger && document.contains(trigger)) {
          const next = resolveTabOut(trigger, nodeRef.current, tabbed === "backward");
          (next ?? trigger).focus({ preventScroll: true });
          return;
        }
        if (interactedOutside.current) return;
        const active = document.activeElement;
        // Do not steal focus from something that took it meanwhile (a dialog opened by an item).
        const free =
          !active ||
          active === document.body ||
          active === document.documentElement ||
          Boolean(nodeRef.current?.contains(active));
        if (trigger && document.contains(trigger) && free) trigger.focus({ preventScroll: true });
      }}
      onEscapeKeyDown={onEscapeKeyDown}
      onPointerDownOutside={(event) => {
        onPointerDownOutside?.(event);
        const original = event.detail.originalEvent;
        const contextClick = original.button === 2 || (original.button === 0 && original.ctrlKey);
        // A modal menu hands focus back to the trigger, except after a context click.
        if (!modal || contextClick) interactedOutside.current = true;
      }}
      onFocusOutside={(event) => {
        onFocusOutside?.(event);
        // Focus is moved by the menu itself; only pointer and keys dismiss it.
        event.preventDefault();
      }}
      onInteractOutside={(event) => {
        onInteractOutside?.(event);
        const target = event.detail.originalEvent.target as Node | null;
        // The trigger toggles on its own pointerdown; dismissing here too would reopen it.
        if (target && triggerRef.current?.contains(target)) event.preventDefault();
      }}
      onDismiss={() => setOpen(false)}
    />
  );
}

// --- Items --------------------------------------------------------------------------------

export interface MenuItemImplProps extends Omit<ComponentProps<"div">, "onSelect"> {
  asChild?: boolean;
  disabled?: boolean;
  /** Text used by typeahead. Defaults to the item's text content. */
  textValue?: string;
}

function ItemImpl({
  asChild,
  disabled = false,
  textValue,
  onPointerMove,
  onPointerLeave,
  onFocus,
  onBlur,
  ...props
}: MenuItemImplProps) {
  const content = useContentContext("MenuItem");
  const [focused, setFocused] = useState(false);
  const Comp = asChild ? Slot : "div";
  return (
    <Comp
      role="menuitem"
      tabIndex={-1}
      data-ui-menu-item=""
      data-text-value={textValue}
      aria-disabled={disabled || undefined}
      data-disabled={present(disabled)}
      data-highlighted={present(focused)}
      {...props}
      onPointerMove={composeHandlers(
        onPointerMove,
        whenMouse((event: ReactPointerEvent<HTMLDivElement>) => {
          if (disabled) {
            content.onItemLeave(event);
            return;
          }
          content.onItemEnter(event);
          if (!event.defaultPrevented) focusItem(event.currentTarget);
        }),
      )}
      onPointerLeave={composeHandlers(onPointerLeave, whenMouse(content.onItemLeave))}
      onFocus={composeHandlers(onFocus, () => setFocused(true))}
      onBlur={composeHandlers(onBlur, () => setFocused(false))}
    />
  );
}

export interface MenuItemProps extends MenuItemImplProps {
  /** Runs when the item is chosen. `preventDefault()` keeps the menu open. */
  onSelect?: (event: Event) => void;
}

export function Item({
  disabled = false,
  onSelect,
  onClick,
  onPointerDown,
  onPointerUp,
  onKeyDown,
  ...props
}: MenuItemProps) {
  const root = useMenuContext("MenuItem");
  const content = useContentContext("MenuItem");
  const pointerDown = useRef(false);
  const select = () => {
    if (disabled) return;
    const event = new Event("ui.menu.itemSelect", { bubbles: true, cancelable: true });
    onSelect?.(event);
    if (event.defaultPrevented) pointerDown.current = false;
    else root.setOpen(false);
  };
  return (
    <ItemImpl
      {...props}
      disabled={disabled}
      onClick={composeHandlers(onClick, select)}
      onPointerDown={composeHandlers(onPointerDown, () => {
        pointerDown.current = true;
      })}
      // Released over the item after pressing on the trigger: select like a click.
      onPointerUp={composeHandlers(onPointerUp, (event: ReactPointerEvent<HTMLDivElement>) => {
        if (!pointerDown.current) event.currentTarget.click();
      })}
      onKeyDown={composeHandlers(onKeyDown, (event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (event.target !== event.currentTarget) return;
        const typing = content.searchRef.current !== "";
        if (disabled || (typing && event.key === " ")) return;
        if (SELECT_KEYS.includes(event.key)) {
          event.currentTarget.click();
          event.preventDefault();
        }
      })}
    />
  );
}

type CheckedState = boolean | "indeterminate";
const ItemIndicatorContext = createContext<CheckedState>(false);
const checkedState = (checked: CheckedState) =>
  checked === "indeterminate" ? "indeterminate" : checked ? "checked" : "unchecked";

export interface MenuCheckboxItemProps extends MenuItemProps {
  checked?: CheckedState;
  onCheckedChange?: (checked: boolean) => void;
}

export function CheckboxItem({
  checked = false,
  onCheckedChange,
  onSelect,
  ...props
}: MenuCheckboxItemProps) {
  return (
    <ItemIndicatorContext.Provider value={checked}>
      <Item
        role="menuitemcheckbox"
        aria-checked={checked === "indeterminate" ? "mixed" : checked}
        data-state={checkedState(checked)}
        {...props}
        onSelect={(event) => {
          onSelect?.(event);
          onCheckedChange?.(checked === "indeterminate" ? true : !checked);
        }}
      />
    </ItemIndicatorContext.Provider>
  );
}

interface RadioGroupContextValue {
  value: string | undefined;
  onValueChange: ((value: string) => void) | undefined;
}
const RadioGroupContext = createContext<RadioGroupContextValue>({
  value: undefined,
  onValueChange: undefined,
});

export interface MenuRadioGroupProps extends ComponentProps<"div"> {
  value?: string;
  onValueChange?: (value: string) => void;
}

export function RadioGroup({ value, onValueChange, ...props }: MenuRadioGroupProps) {
  const context = useMemo(() => ({ value, onValueChange }), [value, onValueChange]);
  return (
    <RadioGroupContext.Provider value={context}>
      {/* biome-ignore lint/a11y/useSemanticElements: menu groups are divs by the ARIA menu pattern */}
      <div role="group" {...props} />
    </RadioGroupContext.Provider>
  );
}

export interface MenuRadioItemProps extends MenuItemProps {
  value: string;
}

export function RadioItem({ value, onSelect, ...props }: MenuRadioItemProps) {
  const group = useContext(RadioGroupContext);
  const checked = group.value === value;
  return (
    <ItemIndicatorContext.Provider value={checked}>
      <Item
        role="menuitemradio"
        aria-checked={checked}
        data-state={checkedState(checked)}
        {...props}
        onSelect={(event) => {
          onSelect?.(event);
          group.onValueChange?.(value);
        }}
      />
    </ItemIndicatorContext.Provider>
  );
}

export interface MenuItemIndicatorProps extends ComponentProps<"span"> {
  asChild?: boolean;
  /** Render even when unchecked, for your own transition. */
  forceMount?: boolean;
}

/** Renders only while its checkbox or radio item is checked. */
export function ItemIndicator({ asChild, forceMount, ...props }: MenuItemIndicatorProps) {
  const checked = useContext(ItemIndicatorContext);
  if (!forceMount && checked === false) return null;
  const Comp = asChild ? Slot : "span";
  return <Comp data-state={checkedState(checked)} {...props} />;
}

export function Label(props: ComponentProps<"div">) {
  return <div {...props} />;
}

export function Group(props: ComponentProps<"div">) {
  // biome-ignore lint/a11y/useSemanticElements: menu groups and separators are divs by the ARIA menu pattern
  return <div role="group" {...props} />;
}

export function Separator(props: ComponentProps<"div">) {
  // biome-ignore lint/a11y/useSemanticElements: menu groups and separators are divs by the ARIA menu pattern
  return <div role="separator" aria-orientation="horizontal" {...props} />;
}

// --- Submenus -----------------------------------------------------------------------------

export interface MenuSubProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
}

export function Sub({ open: openProp, defaultOpen = false, onOpenChange, children }: MenuSubProps) {
  const root = useMenuContext("MenuSub");
  const [open, setOpen] = useControllableState({
    prop: openProp,
    defaultProp: defaultOpen,
    onChange: onOpenChange,
  });
  const triggerRef = useRef<HTMLElement | null>(null);
  const contentRef = useRef<HTMLElement | null>(null);
  const focusIntent = useRef<FocusIntent>("none");
  const contentId = useId();
  const triggerId = useId();
  useEffect(() => {
    if (!root.open) setOpen(false);
  }, [root.open, setOpen]);
  const value = useMemo<SubContextValue>(
    () => ({ open, setOpen, triggerRef, contentRef, contentId, triggerId, focusIntent }),
    [open, setOpen, contentId, triggerId],
  );
  return (
    <SubContext.Provider value={value}>
      <PopperPrimitive.Root>{children}</PopperPrimitive.Root>
    </SubContext.Provider>
  );
}

function useSubContext(part: string): SubContextValue {
  const context = useContext(SubContext);
  if (!context) throw new Error(`<${part}> must be rendered inside <Menu.Sub>`);
  return context;
}

export type MenuSubTriggerProps = MenuItemImplProps;

export function SubTrigger({
  disabled = false,
  onClick,
  onKeyDown,
  onPointerMove,
  onPointerLeave,
  ref,
  ...props
}: MenuSubTriggerProps) {
  const root = useMenuContext("MenuSubTrigger");
  const sub = useSubContext("MenuSubTrigger");
  const content = useContentContext("MenuSubTrigger");
  const composed = useComposedRefs<HTMLDivElement>(
    ref,
    sub.triggerRef as RefObject<HTMLDivElement | null>,
  );
  const openTimer = useRef<number | undefined>(undefined);
  const graceTimer = useRef<number | undefined>(undefined);
  useEffect(
    () => () => {
      window.clearTimeout(openTimer.current);
      window.clearTimeout(graceTimer.current);
    },
    [],
  );
  const clearOpenTimer = () => {
    window.clearTimeout(openTimer.current);
    openTimer.current = undefined;
  };

  return (
    <PopperPrimitive.Anchor asChild>
      <ItemImpl
        id={sub.triggerId}
        aria-haspopup="menu"
        aria-expanded={sub.open}
        aria-controls={sub.open ? sub.contentId : undefined}
        data-state={stateOf(sub.open)}
        {...props}
        ref={composed}
        disabled={disabled}
        onClick={composeHandlers(onClick, (event: ReactMouseEvent<HTMLDivElement>) => {
          if (disabled) return;
          event.currentTarget.focus();
          sub.focusIntent.current = "none";
          if (!sub.open) sub.setOpen(true);
        })}
        onPointerMove={composeHandlers(
          onPointerMove,
          whenMouse((event: ReactPointerEvent<HTMLDivElement>) => {
            if (disabled) return;
            // Moving across this trigger toward an open submenu keeps that submenu alive.
            content.onItemEnter(event);
            if (event.defaultPrevented) return;
            if (sub.open || openTimer.current !== undefined) return;
            content.graceIntent.current = null;
            openTimer.current = window.setTimeout(() => {
              sub.focusIntent.current = "none";
              sub.setOpen(true);
              clearOpenTimer();
            }, SUB_OPEN_DELAY_MS);
          }),
        )}
        onPointerLeave={composeHandlers(
          onPointerLeave,
          whenMouse((event: ReactPointerEvent<HTMLDivElement>) => {
            clearOpenTimer();
            const rect = sub.contentRef.current?.getBoundingClientRect();
            if (!rect) {
              content.graceIntent.current = null;
              return;
            }
            const side =
              sub.contentRef.current?.getAttribute("data-side") === "left" ? "left" : "right";
            content.graceIntent.current = {
              area: graceArea({ x: event.clientX, y: event.clientY }, side, rect),
              side,
            };
            window.clearTimeout(graceTimer.current);
            graceTimer.current = window.setTimeout(() => {
              content.graceIntent.current = null;
            }, GRACE_MS);
          }),
        )}
        onKeyDown={composeHandlers(onKeyDown, (event: ReactKeyboardEvent<HTMLDivElement>) => {
          if (event.target !== event.currentTarget) return;
          const typing = content.searchRef.current !== "";
          if (disabled || (typing && event.key === " ")) return;
          if (SUB_OPEN_KEYS[root.getDir()].includes(event.key)) {
            sub.focusIntent.current = "first";
            sub.setOpen(true);
            event.preventDefault();
          }
        })}
      />
    </PopperPrimitive.Anchor>
  );
}

export interface MenuSubContentProps extends PopperPrimitive.PopperContentProps, EventHooks {
  forceMount?: boolean;
}

export function SubContent({ forceMount, ref, ...props }: MenuSubContentProps) {
  const root = useMenuContext("MenuSubContent");
  const sub = useSubContext("MenuSubContent");
  const nodeRef = useRef<HTMLDivElement | null>(null);
  const composed = useComposedRefs<HTMLDivElement>(
    ref,
    nodeRef,
    sub.contentRef as RefObject<HTMLDivElement | null>,
  );
  const mounted = usePresence(forceMount || (sub.open && root.open), nodeRef);
  if (!mounted) return null;
  return (
    <SubContentImpl
      {...props}
      ref={composed}
      nodeRef={nodeRef}
      engaged={(sub.open && root.open) || !forceMount}
    />
  );
}

function SubContentImpl({
  nodeRef,
  engaged,
  onOpenAutoFocus,
  onEscapeKeyDown,
  onPointerDownOutside,
  onFocusOutside,
  onKeyDown,
  onPointerMove,
  side,
  align = "start",
  ...props
}: Omit<MenuSubContentProps, "forceMount" | "onCloseAutoFocus" | "onInteractOutside"> & {
  nodeRef: RefObject<HTMLDivElement | null>;
  engaged: boolean;
}) {
  const root = useMenuContext("MenuSubContent");
  const sub = useSubContext("MenuSubContent");
  const parent = useContentContext("MenuSubContent");
  const listening = sub.open && root.open && engaged;
  const dir = root.getDir();

  const insideMenu = (target: Node | null) =>
    target !== null && Array.from(root.contents.current).some((node) => node.contains(target));

  return (
    <ContentImpl
      id={sub.contentId}
      aria-labelledby={sub.triggerId}
      side={side ?? (dir === "rtl" ? "left" : "right")}
      align={align}
      {...props}
      nodeRef={nodeRef}
      listening={listening}
      engaged={engaged}
      trapped={false}
      isSub
      onMountAutoFocus={(event) => {
        onOpenAutoFocus?.(event);
        if (event.defaultPrevented) return;
        event.preventDefault();
        const intent = sub.focusIntent.current;
        sub.focusIntent.current = "none";
        // Opened by pointer: focus stays on the trigger until the pointer or keys move it.
        if (intent !== "none" && nodeRef.current) focusEntry(nodeRef.current, intent);
      }}
      // Closing is always explicit about where focus goes (trigger, or the item the pointer chose).
      onUnmountAutoFocus={(event) => event.preventDefault()}
      onEscapeKeyDown={(event) => {
        onEscapeKeyDown?.(event);
        if (!event.defaultPrevented) sub.triggerRef.current?.focus({ preventScroll: true });
      }}
      onPointerDownOutside={(event) => {
        onPointerDownOutside?.(event);
        if (event.defaultPrevented) return;
        const original = event.detail.originalEvent;
        const target = original.target as Node | null;
        if (target && sub.triggerRef.current?.contains(target)) {
          event.preventDefault();
        } else if (target && root.triggerRef.current?.contains(target)) {
          // The root trigger toggles (closes) the whole menu itself.
          event.preventDefault();
        } else if (!insideMenu(target)) {
          event.preventDefault();
          root.interactedOutside.current =
            !root.modal || original.button === 2 || (original.button === 0 && original.ctrlKey);
          root.setOpen(false);
        }
      }}
      onFocusOutside={(event) => {
        onFocusOutside?.(event);
        if (event.defaultPrevented) return;
        const target = event.detail.originalEvent.target as Node | null;
        // Moving to another item of a parent menu closes the submenu; nothing else does.
        if ((target && sub.triggerRef.current?.contains(target)) || !insideMenu(target)) {
          event.preventDefault();
        }
      }}
      onInteractOutside={undefined}
      onDismiss={() => sub.setOpen(false)}
      onKeyDown={composeHandlers(onKeyDown, (event: ReactKeyboardEvent<HTMLDivElement>) => {
        if (!isInsideContent(event)) return;
        if (SUB_CLOSE_KEYS[dir].includes(event.key)) {
          sub.setOpen(false);
          sub.triggerRef.current?.focus();
          event.preventDefault();
        }
      })}
      onPointerMove={composeHandlers(
        onPointerMove,
        whenMouse(() => {
          parent.graceIntent.current = null;
        }),
      )}
    />
  );
}
