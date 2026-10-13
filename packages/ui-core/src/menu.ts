import { nextTypeaheadIndex } from "./typeahead.ts";

/**
 * Framework-free behaviour of a menu (WAI-ARIA menu button pattern), ported from the React kit's
 * `MenuPrimitive`. It owns what happens *inside* a menu: roving highlight, typeahead, selection,
 * checkbox and radio items, submenu triggers and the pointer grace area. Opening, positioning,
 * dismissing (`popper`, `dismiss`), focus trapping (`focus`) and exit animation stay with the
 * caller, which keeps the menu tree-shakeable and usable from any element.
 *
 * Markup contract (roles come from the caller):
 * - the content carries `role="menu"`; this module adds `data-ui-menu-content`;
 * - items are `menuitem`, `menuitemcheckbox` or `menuitemradio`; a submenu trigger is a
 *   `menuitem` with `aria-haspopup="menu"`;
 * - a disabled item has `data-disabled` or `aria-disabled="true"` and is skipped by arrows and
 *   typeahead;
 * - the highlighted item is the focused one and carries `data-highlighted`.
 */

export type MenuDirection = "ltr" | "rtl";
export type FocusIntent = "first" | "last" | "none";
export type MenuMove = "next" | "prev" | "first" | "last";
export type CheckedState = boolean | "indeterminate";

export interface Point {
  x: number;
  y: number;
}
export interface BoxEdges {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const SUB_OPEN_KEYS: Record<MenuDirection, string[]> = {
  ltr: ["Enter", " ", "ArrowRight"],
  rtl: ["Enter", " ", "ArrowLeft"],
};
const SUB_CLOSE_KEYS: Record<MenuDirection, string[]> = {
  ltr: ["ArrowLeft"],
  rtl: ["ArrowRight"],
};
const FIRST_KEYS = ["ArrowDown", "PageUp", "Home"];
const LAST_KEYS = ["ArrowUp", "PageDown", "End"];
const SELECT_KEYS = ["Enter", " "];

export const SUB_OPEN_DELAY_MS = 100;
export const GRACE_MS = 300;

/**
 * Index to focus after `move`, over `count` enabled items. `current` is -1 when focus sits on
 * the menu itself: `next` then enters at the start, `prev` at the end.
 */
export function moveIndex(count: number, current: number, move: MenuMove, loop = true): number {
  if (count === 0) return -1;
  if (move === "first") return 0;
  if (move === "last") return count - 1;
  if (current < 0) return move === "next" ? 0 : count - 1;
  const next = current + (move === "next" ? 1 : -1);
  if (next >= 0 && next < count) return next;
  return loop ? (next + count) % count : current;
}

/**
 * Area between the pointer leaving a submenu trigger and the submenu box, so the pointer can
 * cross other items on its way without closing the submenu.
 */
export function graceArea(exit: Point, side: "left" | "right", box: BoxEdges): Point[] {
  const rightSide = side === "right";
  const bleed = rightSide ? -5 : 5;
  const near = rightSide ? box.left : box.right;
  const far = rightSide ? box.right : box.left;
  return [
    { x: exit.x + bleed, y: exit.y },
    { x: near, y: box.top },
    { x: far, y: box.top },
    { x: far, y: box.bottom },
    { x: near, y: box.bottom },
  ];
}

/** Ray-casting point-in-polygon test. */
export function isPointInPolygon(point: Point, polygon: readonly Point[]): boolean {
  const { x, y } = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i] as Point;
    const b = polygon[j] as Point;
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Next state of a checkbox item once chosen: a mixed item becomes checked. */
export function toggleChecked(checked: CheckedState): boolean {
  return checked === "indeterminate" ? true : !checked;
}

/** `data-state` value of a checkbox or radio item. */
export function checkedStateOf(checked: CheckedState): "checked" | "unchecked" | "indeterminate" {
  return checked === "indeterminate" ? "indeterminate" : checked ? "checked" : "unchecked";
}

const ITEM_SELECTOR = '[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"]';
const CONTENT_ATTR = "data-ui-menu-content";

const isDisabledItem = (item: HTMLElement) =>
  item.hasAttribute("data-disabled") || item.getAttribute("aria-disabled") === "true";

const textOf = (item: HTMLElement) =>
  (item.getAttribute("data-text-value") ?? item.textContent ?? "").trim();

function focusItem(item: HTMLElement | undefined | null) {
  if (!item) return;
  if (!item.hasAttribute("tabindex")) item.tabIndex = -1;
  item.focus({ preventScroll: true });
}

function readDirection(node: Element): MenuDirection {
  return getComputedStyle(node).direction === "rtl" ? "rtl" : "ltr";
}

function ariaChecked(item: HTMLElement): CheckedState {
  const value = item.getAttribute("aria-checked");
  return value === "mixed" ? "indeterminate" : value === "true";
}

function writeChecked(item: HTMLElement, checked: CheckedState) {
  item.setAttribute("aria-checked", checked === "indeterminate" ? "mixed" : String(checked));
  item.setAttribute("data-state", checkedStateOf(checked));
}

/** Detail of the cancelable `ui.menu.itemSelect` event dispatched on a chosen item. */
export interface MenuSelectDetail {
  item: HTMLElement;
  /** The new state of a checkbox or radio item; `undefined` for a plain item. */
  checked?: boolean;
}

export interface MenuContentOptions {
  /** Reading direction for submenu keys. Default: the content's computed direction. */
  dir?: MenuDirection | (() => MenuDirection);
  /** Wraps arrow navigation around the ends. Default true. */
  loop?: boolean;
  /** Typeahead silence window in ms. Default 1000. */
  typeaheadTimeout?: number;
  /**
   * Called after an item was chosen. A listener of `ui.menu.itemSelect` that calls
   * `preventDefault()` keeps the menu open: `onSelect` then does not run.
   */
  onSelect?: (item: HTMLElement) => void;
  /** Tab leaves a menu: the caller closes it and resolves where focus goes. */
  onTab?: (backward: boolean) => void;
  /**
   * Set on a submenu's content. Its close key (ArrowLeft in ltr) calls `close` and returns focus
   * to `trigger`; moving the pointer inside it cancels the parent's grace area.
   */
  submenu?: { trigger: HTMLElement; close: () => void; parent: MenuContent };
}

export interface MenuContent {
  readonly element: HTMLElement;
  /** Enabled items of this content (not those of nested submenus), in DOM order. */
  items(): HTMLElement[];
  /** Places focus as a menu does on opening: the first or last item, or the content itself. */
  focusEntry(intent: FocusIntent): void;
  /** The typeahead search being accumulated ("" when idle). */
  readonly search: string;
  /** True while the pointer travels from a submenu trigger toward its submenu. */
  isMovingToSubmenu(point: Point): boolean;
  /** Pointer is heading to a submenu (set by `bindSubmenuTrigger`). */
  setGrace(intent: { area: Point[]; side: "left" | "right" } | null): void;
  destroy(): void;
}

/** Wires the behaviour of one menu content. Returns a handle; call `destroy()` to unbind. */
export function createMenuContent(
  element: HTMLElement,
  options: MenuContentOptions = {},
): MenuContent {
  const loop = options.loop ?? true;
  const dirOf = () =>
    typeof options.dir === "function" ? options.dir() : (options.dir ?? readDirection(element));
  let search = "";
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let grace: { area: Point[]; side: "left" | "right" } | null = null;
  let pointerDir: "left" | "right" = "right";
  let lastPointerX = 0;
  const pressed = new WeakSet<HTMLElement>();

  element.setAttribute(CONTENT_ATTR, "");
  if (!element.hasAttribute("tabindex")) element.tabIndex = -1;

  const ownedBy = (node: Element | null) => node?.closest(`[${CONTENT_ATTR}]`) === element;
  const itemOf = (target: EventTarget | null): HTMLElement | undefined => {
    const item = (target as Element | null)?.closest?.<HTMLElement>(ITEM_SELECTOR);
    return item && ownedBy(item) ? item : undefined;
  };
  const items = () =>
    Array.from(element.querySelectorAll<HTMLElement>(ITEM_SELECTOR)).filter(
      (item) => ownedBy(item) && !isDisabledItem(item),
    );

  const isMovingToSubmenu = (point: Point) =>
    grace !== null && pointerDir === grace.side && isPointInPolygon(point, grace.area);

  const typeahead = (key: string) => {
    search += key;
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      search = "";
    }, options.typeaheadTimeout ?? 1000);
    const enabled = items();
    const index = nextTypeaheadIndex(
      enabled.map(textOf),
      search,
      enabled.indexOf(document.activeElement as HTMLElement),
    );
    if (index >= 0) focusItem(enabled[index]);
  };

  const choose = (item: HTMLElement) => {
    const role = item.getAttribute("role");
    let checked: boolean | undefined;
    if (role === "menuitemcheckbox") {
      checked = toggleChecked(ariaChecked(item));
      writeChecked(item, checked);
    } else if (role === "menuitemradio") {
      checked = true;
      const group = item.closest('[role="group"]') ?? element;
      for (const radio of group.querySelectorAll<HTMLElement>('[role="menuitemradio"]'))
        if (ownedBy(radio)) writeChecked(radio, radio === item);
    }
    const event = new CustomEvent<MenuSelectDetail>("ui.menu.itemSelect", {
      bubbles: true,
      cancelable: true,
      detail: { item, checked },
    });
    item.dispatchEvent(event);
    if (!event.defaultPrevented) options.onSelect?.(item);
  };

  const onClick = (event: MouseEvent) => {
    const item = itemOf(event.target);
    if (!item || isDisabledItem(item) || item.getAttribute("aria-haspopup") === "menu") return;
    choose(item);
  };

  const onPointerDown = (event: PointerEvent) => {
    const item = itemOf(event.target);
    if (item) pressed.add(item);
  };

  // Released over an item after pressing on the trigger: choose it like a click.
  const onPointerUp = (event: PointerEvent) => {
    const item = itemOf(event.target);
    if (!item) return;
    if (!pressed.has(item)) item.click();
    pressed.delete(item);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    if (ownedBy(event.target as Element)) {
      if (lastPointerX !== event.clientX) {
        pointerDir = event.clientX > lastPointerX ? "right" : "left";
        lastPointerX = event.clientX;
      }
    }
    options.submenu?.parent.setGrace(null);
    const item = itemOf(event.target);
    if (!item) return;
    const point = { x: event.clientX, y: event.clientY };
    if (isDisabledItem(item)) {
      if (!isMovingToSubmenu(point)) focusContent();
      return;
    }
    if (!isMovingToSubmenu(point)) focusItem(item);
  };

  const focusContent = () => element.focus({ preventScroll: true });

  const onPointerOut = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    const item = itemOf(event.target);
    if (!item || item.contains(event.relatedTarget as Node | null)) return;
    if (!isMovingToSubmenu({ x: event.clientX, y: event.clientY })) focusContent();
  };

  const onFocusIn = (event: FocusEvent) =>
    itemOf(event.target)?.setAttribute("data-highlighted", "");
  const onFocusOut = (event: FocusEvent) =>
    itemOf(event.target)?.removeAttribute("data-highlighted");

  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (!ownedBy(target)) return;
    if (event.key === "Tab") {
      event.preventDefault();
      options.onTab?.(event.shiftKey);
      return;
    }
    const sub = options.submenu;
    if (sub && SUB_CLOSE_KEYS[dirOf()].includes(event.key)) {
      sub.close();
      sub.trigger.focus();
      event.preventDefault();
      return;
    }
    const onContent = target === element;
    const item = itemOf(target);
    const onItem = item === target;
    const modifier = event.ctrlKey || event.altKey || event.metaKey;
    if ((onContent || onItem) && !modifier && !event.shiftKey) {
      let move: MenuMove | undefined;
      if (FIRST_KEYS.includes(event.key))
        move = event.key === "ArrowDown" && !onContent ? "next" : "first";
      else if (LAST_KEYS.includes(event.key))
        move = event.key === "ArrowUp" && !onContent ? "prev" : "last";
      if (move) {
        event.preventDefault();
        const enabled = items();
        focusItem(enabled[moveIndex(enabled.length, enabled.indexOf(target), move, loop)]);
        return;
      }
    }
    if (onItem && item && event.target === item) {
      const typing = search !== "";
      if (
        SELECT_KEYS.includes(event.key) &&
        !isDisabledItem(item) &&
        !(typing && event.key === " ")
      ) {
        if (item.getAttribute("aria-haspopup") !== "menu") {
          item.click();
          event.preventDefault();
        }
        return;
      }
    }
    const editing =
      target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
    if (!modifier && !editing && event.key.length === 1) {
      if (event.key === " " && search !== "") event.preventDefault();
      if (event.key !== " " || search !== "") typeahead(event.key);
    }
  };

  element.addEventListener("click", onClick);
  element.addEventListener("pointerdown", onPointerDown);
  element.addEventListener("pointerup", onPointerUp);
  element.addEventListener("pointermove", onPointerMove);
  element.addEventListener("pointerout", onPointerOut);
  element.addEventListener("focusin", onFocusIn);
  element.addEventListener("focusout", onFocusOut);
  element.addEventListener("keydown", onKeyDown);

  return {
    element,
    items,
    focusEntry(intent) {
      const enabled = items();
      if (intent === "first" && enabled.length > 0) focusItem(enabled[0]);
      else if (intent === "last" && enabled.length > 0) focusItem(enabled[enabled.length - 1]);
      else focusContent();
    },
    get search() {
      return search;
    },
    isMovingToSubmenu,
    setGrace(intent) {
      grace = intent;
    },
    destroy() {
      clearTimeout(searchTimer);
      element.removeEventListener("click", onClick);
      element.removeEventListener("pointerdown", onPointerDown);
      element.removeEventListener("pointerup", onPointerUp);
      element.removeEventListener("pointermove", onPointerMove);
      element.removeEventListener("pointerout", onPointerOut);
      element.removeEventListener("focusin", onFocusIn);
      element.removeEventListener("focusout", onFocusOut);
      element.removeEventListener("keydown", onKeyDown);
      element.removeAttribute(CONTENT_ATTR);
    },
  };
}

export interface MenuTriggerOptions {
  isOpen: () => boolean;
  /** Opens or closes the menu; `intent` says where focus goes once it is open. */
  setOpen: (open: boolean, intent: FocusIntent) => void;
  disabled?: () => boolean;
}

/**
 * Menu button behaviour: pointer down toggles (and keeps focus off the trigger while opening),
 * Enter/Space toggle and focus the first item, ArrowDown/ArrowUp open at the first/last item.
 */
export function bindMenuTrigger(trigger: HTMLElement, options: MenuTriggerOptions): () => void {
  const onPointerDown = (event: PointerEvent) => {
    if (options.disabled?.() || event.button !== 0 || event.ctrlKey) return;
    const open = options.isOpen();
    options.setOpen(!open, "none");
    if (!open) event.preventDefault();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (options.disabled?.()) return;
    if (event.key === "Enter" || event.key === " ") options.setOpen(!options.isOpen(), "first");
    else if (event.key === "ArrowDown") options.setOpen(true, "first");
    else if (event.key === "ArrowUp") options.setOpen(true, "last");
    else return;
    event.preventDefault();
  };
  trigger.addEventListener("pointerdown", onPointerDown);
  trigger.addEventListener("keydown", onKeyDown);
  return () => {
    trigger.removeEventListener("pointerdown", onPointerDown);
    trigger.removeEventListener("keydown", onKeyDown);
  };
}

export interface SubmenuTriggerOptions {
  /** The content this trigger belongs to. */
  parent: MenuContent;
  /** The submenu's content element while mounted (read for its box and `data-side`). */
  getContent: () => HTMLElement | null | undefined;
  isOpen: () => boolean;
  setOpen: (open: boolean, intent: FocusIntent) => void;
  dir?: MenuDirection | (() => MenuDirection);
  disabled?: () => boolean;
  openDelay?: number;
  graceMs?: number;
}

/**
 * Submenu trigger behaviour: opens on hover after a short delay, on click and on the direction
 * key; on leaving toward the submenu it arms a grace area so crossing other items does not close it.
 */
export function bindSubmenuTrigger(
  trigger: HTMLElement,
  options: SubmenuTriggerOptions,
): () => void {
  const { parent } = options;
  if (!trigger.hasAttribute("tabindex")) trigger.tabIndex = -1;
  let openTimer: ReturnType<typeof setTimeout> | undefined;
  let graceTimer: ReturnType<typeof setTimeout> | undefined;
  const disabled = () => options.disabled?.() ?? isDisabledItem(trigger);
  const clearOpenTimer = () => {
    clearTimeout(openTimer);
    openTimer = undefined;
  };
  const dirOf = () =>
    typeof options.dir === "function"
      ? options.dir()
      : (options.dir ?? readDirection(parent.element));

  const onClick = () => {
    if (disabled()) return;
    trigger.focus();
    if (!options.isOpen()) options.setOpen(true, "none");
  };
  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || disabled()) return;
    // Moving across this trigger toward an open submenu keeps that submenu alive.
    if (parent.isMovingToSubmenu({ x: event.clientX, y: event.clientY })) return;
    if (options.isOpen() || openTimer !== undefined) return;
    parent.setGrace(null);
    openTimer = setTimeout(() => {
      options.setOpen(true, "none");
      clearOpenTimer();
    }, options.openDelay ?? SUB_OPEN_DELAY_MS);
  };
  const onPointerLeave = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    clearOpenTimer();
    const content = options.getContent();
    const rect = content?.getBoundingClientRect();
    if (!content || !rect) {
      // A sibling's open submenu may still be the destination of this crossing.
      if (!parent.isMovingToSubmenu({ x: event.clientX, y: event.clientY })) parent.setGrace(null);
      return;
    }
    const side = content.getAttribute("data-side") === "left" ? "left" : "right";
    parent.setGrace({ area: graceArea({ x: event.clientX, y: event.clientY }, side, rect), side });
    clearTimeout(graceTimer);
    graceTimer = setTimeout(() => parent.setGrace(null), options.graceMs ?? GRACE_MS);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.target !== trigger || disabled()) return;
    if (parent.search !== "" && event.key === " ") return;
    if (SUB_OPEN_KEYS[dirOf()].includes(event.key)) {
      options.setOpen(true, "first");
      event.preventDefault();
    }
  };

  trigger.addEventListener("click", onClick);
  trigger.addEventListener("pointermove", onPointerMove);
  trigger.addEventListener("pointerleave", onPointerLeave);
  trigger.addEventListener("keydown", onKeyDown);
  return () => {
    clearOpenTimer();
    clearTimeout(graceTimer);
    trigger.removeEventListener("click", onClick);
    trigger.removeEventListener("pointermove", onPointerMove);
    trigger.removeEventListener("pointerleave", onPointerLeave);
    trigger.removeEventListener("keydown", onKeyDown);
  };
}
