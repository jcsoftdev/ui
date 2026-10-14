import { getRovingIntent } from "@jcsoftdev/ui-core/roving";
import { adoptStyles, emit, rootOf, uid } from "./base.js";
import type { DrawResult, NavIntent, VirtualMarks } from "./chart-base.js";
import { SR_ONLY } from "./chart-dom.js";
import css from "./chart-interact.css.js";
import { CHART_EVENT, type ChartHost, type HoverInfo, type HoverSource } from "./chart-protocol.js";

/**
 * The input side of a chart, loaded on the first `focusin` or `pointerenter` and never before:
 * pointer hover with scaled, gap-free hit testing; touch and pen taps that pin a mark (with a
 * slop so a scroll swipe selects nothing); mouse click and double click; the roving keyboard tab
 * stop over real marks or over a virtual-mark proxy; Escape; and the polite announcement of the
 * pinned selection. It also owns the hover and selection state (what the parts show, the
 * `data-active` and `data-selected` flags, `chart-hover`, `chart-select` and `chart-drill`), which
 * only exists once something interacted. It talks to the chart only through `InteractApi`.
 */
export interface InteractApi {
  host: ChartHost;
  /** Ids of the hidden series. */
  hidden: Set<string>;
  redraw(): void;
  drawing: HTMLElement;
  svg(): SVGSVGElement | undefined;
  result(): DrawResult | undefined;
  /** Drawing size in drawing units (the svg viewBox). */
  size(): [number, number];
  count(): number;
  markEl(index: number): Element | null;
  /** Index of the real mark `element` is, or -1. */
  indexOf(element: Element | null): number;
  virtual(): VirtualMarks | undefined;
  proxy(): HTMLElement | undefined;
  /** The roving tab stop. */
  active: number;
  /** True while the chart is redrawing: focus and blur events then mean nothing. */
  busy(): boolean;
}

export interface Interact {
  /** Handles an event the chart saw before this module loaded. */
  replay(event: Event): void;
  /** Called after a redraw: re-hits at the last pointer position and re-publishes the details. */
  refresh(): void;
  /** The chart lost its marks (loading, empty): nothing is hovered or selected any more. */
  reset(): void;
  /** A redraw replaced the focused mark: give focus to its successor, silently. */
  restoreFocus(index: number): void;
  info(): HoverInfo | null;
  selected(): number | null;
  select(index: number | null, source: HoverSource): void;
  drill(index: number): void;
  toggleSeries(id: string): void;
  highlight(id: string | null): void;
  detach(): void;
}

const NAV_KEYS: Record<string, NavIntent | undefined> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
  Home: "home",
  End: "end",
  Backspace: "parent",
};
const rtlSwap = (intent: NavIntent, rtl: boolean): NavIntent =>
  rtl ? (intent === "left" ? "right" : intent === "right" ? "left" : intent) : intent;

/** Pixels a finger may travel during a tap before it counts as a scroll or a drag. */
export const TAP_SLOP = 10;
/** Hit radius of a mouse, in pixels, for charts that snap to the nearest point. */
const MOUSE_RADIUS = 12;
const FALLBACK_TOUCH = 44;

export function attach(api: InteractApi): Interact {
  const { drawing, host } = api;
  adoptStyles(rootOf(host), css);
  const stop = new AbortController();
  const opts = { signal: stop.signal };
  let last: { x: number; y: number; type: string } | undefined;
  /** The gesture in progress was claimed by the chart (it called `preventDefault`): it is not a selection. */
  let claimed = false;
  let tap: { id: number; x: number; y: number; moved: boolean } | undefined;
  let live: HTMLElement | undefined;
  let option: HTMLElement | undefined;
  let quiet = false;
  let hoverIndex = -1;
  let hoverSource: HoverSource = "pointer";
  let selected: number | null = null;
  let selectSource: HoverSource = "pointer";
  let info: HoverInfo | null = null;
  let infoKey = "";
  let activeEl: Element | null = null;
  let selectedEl: Element | null = null;
  let dimmed: string | null = null;

  const dim = () => {
    for (const node of api.svg()?.querySelectorAll<SVGElement>("[data-series]") ?? [])
      node.toggleAttribute("data-dim", dimmed !== null && node.dataset.series !== dimmed);
  };

  /** What mark `index` shows, or null when the chart has no such mark (any more). */
  const content = (index: number, source: HoverSource) =>
    index >= 0 ? (api.result()?.hover?.(index, source) ?? null) : null;

  /**
   * Works out what to show now (the hovered mark, else the pinned one), flags the marks and tells
   * the parts, but only when the mark or its content changed: a redraw, or a pointer that stays on
   * one mark, emits nothing.
   */
  const publish = () => {
    let index = hoverIndex;
    let source = hoverSource;
    let shown = content(index, source);
    if (!shown) {
      // Nothing under the pointer or focus (any more): the pinned mark shows, if it still exists.
      hoverIndex = -1;
      index = selected ?? -1;
      source = selectSource;
      shown = content(index, source);
      if (!shown && selected !== null) {
        selected = null;
        emit(host, CHART_EVENT.select, null);
      }
    }
    const pinned = hoverIndex < 0;
    const active = shown ? api.markEl(index) : null;
    if (activeEl !== active) activeEl?.removeAttribute("data-active");
    activeEl = active;
    active?.setAttribute("data-active", "");
    const chosen = selected !== null ? api.markEl(selected) : null;
    if (selectedEl !== chosen) selectedEl?.removeAttribute("data-selected");
    selectedEl = chosen;
    chosen?.setAttribute("data-selected", "");
    if (!shown) {
      if (info) {
        info = null;
        infoKey = "";
        emit(host, CHART_EVENT.hover, null);
      }
      return;
    }
    const key = `${index}|${source}|${pinned}|${shown.title}|${shown.body}|${Math.round(shown.x)},${Math.round(shown.y)}|${shown.rows.map((row) => `${row.id}:${row.value}:${row.note}`).join(";")}`;
    if (key === infoKey) return;
    infoKey = key;
    info = { ...shown, index, category: shown.category ?? index, source, pinned };
    emit(host, CHART_EVENT.hover, info);
  };
  const setHover = (index: number, source: HoverSource) => {
    hoverIndex = index;
    hoverSource = source;
    publish();
  };
  const announce = () => {
    live ??= document.createElement("div");
    if (!live.isConnected) {
      live.dataset.uiPart = "live";
      live.style.cssText = SR_ONLY;
      live.setAttribute("role", "status");
      live.setAttribute("aria-live", "polite");
      drawing.append(live);
    }
    live.textContent =
      selected !== null && info?.pinned
        ? [info.title, ...info.rows.map((row) => `${row.name} ${row.value}`), info.body]
            .filter(Boolean)
            .join(", ")
        : "";
  };
  const select = (index: number | null, source: HoverSource = "pointer") => {
    const shown = index === null ? null : content(index, source);
    const next = shown ? index : null;
    if (next === selected) return;
    selected = next;
    selectSource = source;
    publish();
    emit(
      host,
      CHART_EVENT.select,
      next === null ? null : { index: next, category: shown?.category ?? next },
    );
    announce();
  };

  const radius = (type: string): number => {
    if (type === "mouse") return MOUSE_RADIUS;
    const token = Number.parseFloat(getComputedStyle(host).getPropertyValue("--touch-target"));
    return token > 0 ? token : FALLBACK_TOUCH;
  };

  /** The element at a viewport point, in the root the chart lives in (the document or a shadow root). */
  const under = (x: number, y: number): Element | null =>
    (drawing.getRootNode() as Document | ShadowRoot).elementFromPoint?.(x, y) ?? null;

  const hitAt = (clientX: number, clientY: number, target: Element | null, type: string) => {
    const svg = api.svg();
    const hit = api.result()?.hit;
    if (!svg || !hit) return -1;
    const box = svg.getBoundingClientRect();
    if (!box.width || !box.height) return -1;
    // The drawing may be scaled by a CSS transform or zoom: hit() works in drawing units.
    const [width, height] = api.size();
    const index = hit(
      (clientX - box.left) * (width / box.width),
      (clientY - box.top) * (height / box.height),
      target,
      radius(type),
    );
    return index >= 0 ? index : -1;
  };

  const markKey = (index: number) => {
    if (api.virtual()) renderOption(index);
    api.active = index;
    if (api.virtual()) return;
    for (let i = 0, n = api.count(); i < n; i += 1)
      api.markEl(i)?.setAttribute("tabindex", i === index ? "0" : "-1");
  };

  /** The one `role=option` the proxy points at, rendered for the active virtual mark only. */
  function renderOption(index: number): void {
    const proxy = api.proxy();
    const virtual = api.virtual();
    if (!proxy || !virtual) return;
    if (!option) {
      option = document.createElement("div");
      option.id = uid("mark");
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", "true");
      proxy.append(option);
    }
    option.textContent = virtual.label(index);
    option.setAttribute("aria-setsize", `${virtual.count}`);
    option.setAttribute("aria-posinset", `${index + 1}`);
    proxy.setAttribute("aria-activedescendant", option.id);
  }

  const drill = (index: number) => {
    const shown = content(index, "keyboard");
    if (shown) emit(host, CHART_EVENT.drill, { index, category: shown.category ?? index });
  };
  const toggle = (index: number, source: HoverSource) =>
    select(index >= 0 && index !== selected ? index : null, source);

  document.addEventListener(
    "pointerdown",
    (event) => {
      const target = event.target as Node;
      if (hoverIndex >= 0 && !drawing.contains(target)) setHover(-1, "pointer");
      if (selected !== null && !host.contains(target)) select(null, "touch");
    },
    { signal: stop.signal, capture: true },
  );

  /** Moves to mark `index` the way a keyboard does: focus (or the proxy's active option) and details. */
  const move = (index: number) => {
    if (api.virtual()) {
      markKey(index);
      setHover(index, "keyboard");
    } else (api.markEl(index) as SVGElement | null)?.focus();
  };
  /** Asks the chart where `intent` leads from `from`, and goes there when that is another mark. */
  const go = (from: number, intent: NavIntent) => {
    const to = api.result()?.nav?.(from, intent);
    if (typeof to === "number" && to >= 0 && to < api.count() && to !== from) move(to);
  };

  const focusIndex = (target: Element | null): number =>
    target === api.proxy() ? api.active : api.indexOf(target);

  const handlers: Record<string, (event: never) => void> = {
    pointermove(event: PointerEvent) {
      // A finger that travels past the slop is scrolling or dragging, not tapping.
      if (tap && tap.id === event.pointerId && !tap.moved)
        tap.moved = Math.hypot(event.clientX - tap.x, event.clientY - tap.y) > TAP_SLOP;
      if (event.pointerType === "touch") return;
      last = { x: event.clientX, y: event.clientY, type: event.pointerType };
      setHover(
        hitAt(event.clientX, event.clientY, event.target as Element, event.pointerType),
        "pointer",
      );
    },
    pointerdown(event: PointerEvent) {
      claimed = event.defaultPrevented;
      tap = undefined;
      if (event.pointerType === "mouse" || claimed) return;
      tap = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
    },
    pointerup(event: PointerEvent) {
      const down = tap;
      tap = undefined;
      if (event.defaultPrevented) claimed = true;
      if (
        claimed ||
        event.pointerType === "mouse" ||
        !down ||
        down.id !== event.pointerId ||
        down.moved
      )
        return;
      if (Math.hypot(event.clientX - down.x, event.clientY - down.y) > TAP_SLOP) return;
      toggle(
        hitAt(event.clientX, event.clientY, event.target as Element, event.pointerType),
        "touch",
      );
    },
    // The browser took the gesture over for a scroll: it is not a tap.
    pointercancel() {
      tap = undefined;
    },
    pointerleave(event: PointerEvent) {
      if (event.pointerType === "touch") return;
      last = undefined;
      if (hoverSource === "pointer") setHover(-1, "pointer");
    },
    click(event: MouseEvent) {
      if (event.defaultPrevented || claimed) return;
      if (event.detail === 0 || (event as PointerEvent).pointerType !== "mouse") return;
      toggle(hitAt(event.clientX, event.clientY, event.target as Element, "mouse"), "pointer");
    },
    dblclick(event: MouseEvent) {
      if (event.defaultPrevented || claimed) return;
      const index = hitAt(event.clientX, event.clientY, event.target as Element, "mouse");
      if (index >= 0) drill(index);
    },
    focusin(event: FocusEvent) {
      const index = focusIndex(event.target as Element);
      if (index < 0) return;
      markKey(index);
      if (!quiet && (event.target as Element).matches(":focus-visible"))
        setHover(index, "keyboard");
    },
    focusout(event: FocusEvent) {
      if (api.busy() || drawing.contains(event.relatedTarget as Node)) return;
      if (hoverSource === "keyboard") setHover(-1, "keyboard");
    },
    keydown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "Escape") {
        if (hoverIndex >= 0) setHover(-1, "keyboard");
        else if (selected !== null) select(null, "keyboard");
        return;
      }
      const current = focusIndex(event.target as Element);
      if (current < 0) return;
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (event.shiftKey && event.key === "Enter") {
          drill(current);
          go(current, "child");
        } else toggle(current, "keyboard");
        return;
      }
      const dir = getComputedStyle(host).direction === "rtl" ? "rtl" : "ltr";
      const intent2d = api.result()?.nav && NAV_KEYS[event.key];
      if (intent2d) {
        event.preventDefault();
        go(current, rtlSwap(intent2d, dir === "rtl"));
        return;
      }
      const intent = getRovingIntent(event.key, { dir });
      if (!intent) return;
      event.preventDefault();
      const end = api.count() - 1;
      const next =
        intent === "first"
          ? 0
          : intent === "last"
            ? end
            : Math.min(end, Math.max(0, current + (intent === "next" ? 1 : -1)));
      move(next);
    },
  };
  for (const [type, handler] of Object.entries(handlers))
    drawing.addEventListener(type, handler as EventListener, opts);

  return {
    replay(event) {
      // Pointer and focus events the chart saw while this module was loading; keys never replay.
      const type = event.type === "pointerenter" ? "pointermove" : event.type;
      (handlers[type] as ((event: Event) => void) | undefined)?.(event);
    },
    toggleSeries(id) {
      const snapshot = host.chartSnapshot;
      const visible = (snapshot?.legend ?? snapshot?.series ?? []).filter(
        (item) => !api.hidden.has(item.id),
      ).length;
      if (api.hidden.has(id)) api.hidden.delete(id);
      else if (visible > 1) api.hidden.add(id);
      else return;
      api.redraw();
      emit(host, CHART_EVENT.series, { id, hidden: api.hidden.has(id) });
    },
    highlight(id) {
      dimmed = id;
      dim();
      emit(host, CHART_EVENT.series, { highlight: id });
    },
    refresh() {
      dim();
      if (last && hoverSource === "pointer" && hoverIndex >= 0)
        hoverIndex = hitAt(last.x, last.y, under(last.x, last.y), last.type);
      publish();
      if (api.virtual() && api.proxy() === document.activeElement) renderOption(api.active);
    },
    reset() {
      hoverIndex = -1;
      if (selected !== null) {
        selected = null;
        emit(host, CHART_EVENT.select, null);
      }
      publish();
    },
    restoreFocus(index) {
      const target =
        api.proxy() ??
        api.markEl(Math.max(0, Math.min(index < 0 ? api.active : index, api.count() - 1)));
      quiet = true;
      if (target) (target as HTMLElement).focus({ preventScroll: true });
      else {
        drawing.tabIndex = -1;
        drawing.focus({ preventScroll: true });
      }
      quiet = false;
    },
    info: () => info,
    selected: () => selected,
    select,
    drill,
    detach() {
      stop.abort();
      live?.remove();
      // Leave nothing behind for the next attach: a reconnect must not find a stale option or flags.
      option?.remove();
      api.proxy()?.removeAttribute("aria-activedescendant");
      for (const node of api.svg()?.querySelectorAll("[data-active],[data-selected],[data-dim]") ??
        [])
        for (const flag of ["data-active", "data-selected", "data-dim"]) node.removeAttribute(flag);
    },
  };
}
