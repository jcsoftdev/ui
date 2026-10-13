export type RovingOrientation = "horizontal" | "vertical";
export type RovingDirection = "ltr" | "rtl";
export type RovingIntent = "first" | "last" | "prev" | "next";

/** What a key means for a roving group, or `undefined` when it is not a navigation key. */
export function getRovingIntent(
  key: string,
  { orientation, dir = "ltr" }: { orientation?: RovingOrientation; dir?: RovingDirection } = {},
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

export function findRovingTarget<T>(
  items: readonly T[],
  current: T,
  intent: RovingIntent,
  loop: boolean,
): T | undefined {
  if (intent === "first") return items[0];
  if (intent === "last") return items[items.length - 1];
  const index = items.indexOf(current);
  const step = intent === "next" ? 1 : -1;
  const next = index + step;
  if (next >= 0 && next < items.length) return items[next];
  return loop ? items[(next + items.length) % items.length] : undefined;
}

export interface RovingFocusOptions {
  /** The items, in order. Default: `[data-roving-item]` descendants of the root. */
  items?: () => HTMLElement[];
  /** Restricts arrows to one axis; both axes work when omitted. */
  orientation?: RovingOrientation;
  /** Flips ArrowLeft/ArrowRight in `rtl`. Default: the root's computed direction. */
  dir?: RovingDirection;
  /** Wraps around at the ends. Default true. */
  loop?: boolean;
  /** Disabled items leave the arrow order and the tab order. Default: `disabled` or `aria-disabled="true"`. */
  isDisabled?: (item: HTMLElement) => boolean;
  /** Called after focus moved to `target` through `key`. */
  onNavigate?: (target: HTMLElement, key: string) => void;
}

export interface RovingFocus {
  /** Gives `item` the tab stop (without focusing it). */
  setActive(item: HTMLElement | undefined): void;
  /** Re-applies the tab stops after items were added or removed. */
  update(): void;
  destroy(): void;
}

const disabledByDefault = (item: HTMLElement) =>
  item.hasAttribute("disabled") || item.getAttribute("aria-disabled") === "true";

/**
 * Roving tabindex for a composite widget (radios, tabs, toolbars): one tab stop, arrows move
 * between items in DOM order. Mirrors the React kit's `useRovingFocus`.
 */
export function createRovingFocus(
  root: HTMLElement,
  options: RovingFocusOptions = {},
): RovingFocus {
  const isDisabled = options.isDisabled ?? disabledByDefault;
  const all = () =>
    options.items?.() ?? Array.from(root.querySelectorAll<HTMLElement>("[data-roving-item]"));
  const enabled = () => all().filter((item) => !isDisabled(item));
  let active: HTMLElement | undefined;

  const update = () => {
    const items = enabled();
    if (!active || !items.includes(active)) active = items[0];
    for (const item of all()) item.tabIndex = item === active ? 0 : -1;
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    const items = enabled();
    const current = items.find(
      (item) => item === event.target || item.contains(event.target as Node),
    );
    if (!current) return;
    const dir = options.dir ?? (getComputedStyle(root).direction === "rtl" ? "rtl" : "ltr");
    const intent = getRovingIntent(event.key, { orientation: options.orientation, dir });
    if (!intent) return;
    event.preventDefault();
    const target = findRovingTarget(items, current, intent, options.loop ?? true);
    if (!target) return;
    active = target;
    update();
    target.focus();
    options.onNavigate?.(target, event.key);
  };

  const onFocusIn = (event: FocusEvent) => {
    const item = enabled().find((candidate) => candidate.contains(event.target as Node));
    if (item && item !== active) {
      active = item;
      update();
    }
  };

  root.addEventListener("keydown", onKeyDown);
  root.addEventListener("focusin", onFocusIn);
  update();
  return {
    setActive(item) {
      active = item;
      update();
    },
    update,
    destroy() {
      root.removeEventListener("keydown", onKeyDown);
      root.removeEventListener("focusin", onFocusIn);
    },
  };
}
