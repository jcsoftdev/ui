import { createPointerDrag, type PointerDrag } from "@jcsoftdev/ui-core/pointer-drag";
import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ElementBase,
  emit,
  ensureId,
  isPart,
  rootOf,
} from "../internal/base.js";
import {
  isRtl,
  keyboardDelta,
  normalizeSizes,
  type PanelConstraint,
  pairRange,
  resizePair,
} from "../internal/e11.js";
import css from "./resizable.css.js";

const number = (element: Element, name: string): number | undefined => {
  const value = element.getAttribute(name);
  return value === null || value === "" || Number.isNaN(Number(value)) ? undefined : Number(value);
};

/** Tells the owning group to lay out again (and again when it leaves). */
class ResizablePart extends ElementBase {
  #owner: Element | null = null;
  protected notify(): void {
    this.#owner = this.closest("[data-ui='resizable']") ?? this.#owner;
    this.#owner?.dispatchEvent(new Event("ui-resizable-change"));
  }
  connectedCallback(): void {
    this.notify();
  }
  disconnectedCallback(): void {
    this.#owner?.dispatchEvent(new Event("ui-resizable-change"));
    this.#owner = null;
  }
  attributeChangedCallback(): void {
    this.notify();
  }
}

/**
 * `<ui-resizable-panel>`: a panel of a `<ui-resizable>`; its size is a percentage of the group.
 * Attributes: `default-size` (panels without one share what is left), `min-size` (default 0),
 * `max-size` (default 100), `collapsible` (Enter on the handle before it folds it to 0 and back).
 */
export class UiResizablePanel extends ResizablePart {
  static observedAttributes = ["default-size", "min-size", "max-size", "collapsible"];
}

/**
 * `<ui-resizable-handle>`: the draggable, keyboard-operable separator between two panels
 * (`role="separator"`, one tab stop, `aria-valuenow/min/max` in percent of the group). Attribute:
 * `label` (default "Resize panels").
 */
export class UiResizableHandle extends ResizablePart {
  static observedAttributes = ["label"];
}

/**
 * `<ui-resizable direction="horizontal | vertical">`: a row or column of resizable panels (the
 * WAI-ARIA window splitter). Put a `<ui-resizable-handle>` between every two `<ui-resizable-panel>`.
 * Pointer: drag a handle (the pointer is captured, so the drag survives leaving it). Keyboard:
 * arrows move the boundary 5% (10% with Shift) and mirror in right-to-left, Home/End go to the
 * minimum/maximum of the panel before the handle, Enter collapses or restores a `collapsible`
 * panel. Events: `layout` with `{ sizes }` after every change (percentages summing to 100), and
 * `collapse` with `{ index, collapsed }`. Members: `sizes` (get/set).
 */
export class UiResizable extends ElementBase {
  static observedAttributes = ["direction"];
  #sizes: number[] = [];
  #count = -1;
  #drags: PointerDrag[] = [];
  #collapsed = new Map<number, number>();
  #observer: MutationObserver | undefined;

  constructor() {
    super();
    this.addEventListener("ui-resizable-change", () => this.#layout());
    this.addEventListener("keydown", (event) => this.#onKey(event));
  }

  get direction(): "horizontal" | "vertical" {
    return this.getAttribute("direction") === "vertical" ? "vertical" : "horizontal";
  }
  get sizes(): number[] {
    return [...this.#sizes];
  }
  set sizes(value: number[]) {
    if (value.length !== this.#panels().length) return;
    this.#sizes = normalizeSizes(value, this.#constraints());
    this.#paint();
  }

  connectedCallback(): void {
    this.dataset.ui = "resizable";
    adoptStyles(rootOf(this), css);
    this.#observer = new MutationObserver(() => this.#layout());
    this.#observer.observe(this, { childList: true });
    this.#layout();
  }

  disconnectedCallback(): void {
    this.#observer?.disconnect();
    for (const drag of this.#drags) drag.destroy();
    this.#drags = [];
    this.#count = -1;
  }

  attributeChangedCallback(): void {
    if (this.isConnected) this.#paint();
  }

  #panels(): HTMLElement[] {
    return [...this.children].filter((c) => isPart(c, "resizable-panel")) as HTMLElement[];
  }
  #handles(): HTMLElement[] {
    return [...this.children].filter((c) => isPart(c, "resizable-handle")) as HTMLElement[];
  }
  #constraints(): PanelConstraint[] {
    return this.#panels().map((p) => ({
      min: number(p, "min-size") ?? 0,
      max: number(p, "max-size") ?? 100,
    }));
  }

  /** Panels came or went: start over from the declared defaults and rebind the handles. */
  #layout(): void {
    const panels = this.#panels();
    if (panels.length !== this.#count) {
      this.#count = panels.length;
      this.#collapsed.clear();
      this.#sizes = normalizeSizes(
        panels.map((p) => number(p, "default-size")),
        this.#constraints(),
      );
    }
    for (const drag of this.#drags) drag.destroy();
    this.#drags = this.#handles().map((handle, index) => this.#bind(handle, index));
    this.#paint();
  }

  #bind(handle: HTMLElement, index: number): PointerDrag {
    let start: number[] = [];
    let available = 1;
    let origin = 0;
    return createPointerDrag(handle, {
      onStart: (point) => {
        const rect = this.getBoundingClientRect();
        const horizontal = this.direction === "horizontal";
        const space = this.#handles().reduce((sum, h) => {
          const r = h.getBoundingClientRect();
          return sum + (horizontal ? r.width : r.height);
        }, 0);
        available = Math.max(1, (horizontal ? rect.width : rect.height) - space);
        start = this.#sizes;
        origin = horizontal ? point.clientX : point.clientY;
        handle.setAttribute("data-dragging", "");
        return true;
      },
      onMove: (point) => {
        const horizontal = this.direction === "horizontal";
        const travelled = ((horizontal ? point.clientX : point.clientY) - origin) / available;
        const sign = horizontal && isRtl(this) ? -1 : 1;
        this.#apply(resizePair(start, this.#constraints(), index, travelled * 100 * sign));
      },
      onEnd: () => handle.removeAttribute("data-dragging"),
    });
  }

  #apply(next: number[]): void {
    if (next === this.#sizes) return;
    this.#sizes = next;
    this.#paint();
    emit(this, "layout", { sizes: [...next] });
  }

  #onKey(event: KeyboardEvent): void {
    const handle = event.target as HTMLElement;
    if (!isPart(handle, "resizable-handle") || handle.parentElement !== this) return;
    const index = this.#handles().indexOf(handle);
    if (index < 0) return;
    const delta = keyboardDelta(
      event.key,
      this.direction,
      event.shiftKey,
      5,
      isRtl(this) ? "rtl" : "ltr",
    );
    if (delta !== null) {
      event.preventDefault();
      this.#apply(resizePair(this.#sizes, this.#constraints(), index, delta));
      return;
    }
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const range = pairRange(this.#sizes, this.#constraints(), index);
      const current = this.#sizes[index];
      if (!range || current === undefined) return;
      const target = event.key === "Home" ? range.low : range.high;
      this.#apply(resizePair(this.#sizes, this.#constraints(), index, target - current));
    } else if (event.key === "Enter") {
      this.#toggleCollapse(index, event);
    }
  }

  #toggleCollapse(index: number, event: KeyboardEvent): void {
    const panel = this.#panels()[index];
    const current = this.#sizes[index];
    const neighbour = this.#sizes[index + 1];
    if (!panel?.hasAttribute("collapsible") || current === undefined || neighbour === undefined)
      return;
    event.preventDefault();
    const restore = this.#collapsed.get(index);
    const total = current + neighbour;
    const nextA = restore === undefined ? 0 : Math.min(restore, total);
    if (restore === undefined) this.#collapsed.set(index, current);
    else this.#collapsed.delete(index);
    const next = this.#sizes.slice();
    next[index] = nextA;
    next[index + 1] = total - nextA;
    this.#apply(next);
    emit(this, "collapse", { index, collapsed: restore === undefined });
  }

  #paint(): void {
    const horizontal = this.direction === "horizontal";
    const panels = this.#panels();
    const constraints = this.#constraints();
    this.setAttribute("data-direction", this.direction);
    panels.forEach((panel, i) => {
      const size = this.#sizes[i] ?? 0;
      panel.style.flex = `${size} 1 0%`;
      panel.toggleAttribute("data-collapsed", this.#collapsed.has(i));
      ensureId(panel, "resizable-panel");
    });
    this.#handles().forEach((handle, i) => {
      const range = pairRange(this.#sizes, constraints, i);
      handle.setAttribute("role", "separator");
      handle.tabIndex = 0;
      handle.setAttribute("aria-orientation", horizontal ? "vertical" : "horizontal");
      handle.setAttribute("aria-label", handle.getAttribute("label") ?? "Resize panels");
      const panel = panels[i];
      if (panel) handle.setAttribute("aria-controls", panel.id);
      handle.setAttribute("aria-valuenow", String(Math.round(this.#sizes[i] ?? 0)));
      handle.setAttribute("aria-valuemin", String(Math.round(range?.low ?? 0)));
      handle.setAttribute("aria-valuemax", String(Math.round(range?.high ?? 100)));
    });
  }
}

/** Registers `<ui-resizable>`, `<ui-resizable-panel>` and `<ui-resizable-handle>`; returns the group tag. */
export function defineResizable(options?: DefineOptions): string {
  defineElement("resizable-panel", UiResizablePanel, options);
  defineElement("resizable-handle", UiResizableHandle, options);
  return defineElement("resizable", UiResizable, options);
}
