import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ElementBase,
  rootOf,
} from "../internal/base.js";
import css from "./toast.css.js";

export type ToastTone = "default" | "success" | "error";
export type ToastId = string | number;

export interface ToastAction {
  label: string;
  /** Call `event.preventDefault()` to keep the toast open. */
  onClick: (event: MouseEvent) => void;
}

export interface ToastOptions {
  /** Reuse an id to update a toast in place instead of stacking a new one. */
  id?: ToastId;
  description?: string;
  /** Milliseconds before it dismisses itself; `Infinity` keeps it. Default: the toaster's. */
  duration?: number;
  action?: ToastAction;
  /** Runs once when the toast is dismissed (timer, action, swipe, Escape or `toast.dismiss`). */
  onDismiss?: (id: ToastId) => void;
}

interface ToastRecord extends Omit<ToastOptions, "id"> {
  id: ToastId;
  message: string;
  tone: ToastTone;
  state: "open" | "closed";
  revision: number;
}

// The store: one queue per page, shared by every toaster (the React kit's toast-store).
let records: readonly ToastRecord[] = [];
let counter = 0;
const listeners = new Set<() => void>();
const commit = (next: readonly ToastRecord[]) => {
  records = next;
  for (const listener of [...listeners]) listener();
};

function publish(message: string, tone: ToastTone, options: ToastOptions = {}): ToastId {
  const id = options.id ?? `toast-${++counter}`;
  const existing = records.find((record) => record.id === id);
  const record: ToastRecord = {
    ...options,
    id,
    message,
    tone,
    state: "open",
    revision: (existing?.revision ?? 0) + 1,
  };
  commit(existing ? records.map((r) => (r.id === id ? record : r)) : [...records, record]);
  return id;
}

function dismiss(id?: ToastId): void {
  const closing = records.filter((r) => r.state === "open" && (id === undefined || r.id === id));
  if (closing.length === 0) return;
  commit(records.map((r) => (closing.includes(r) ? { ...r, state: "closed" as const } : r)));
  for (const record of closing) record.onDismiss?.(record.id);
}

function remove(id: ToastId): void {
  if (records.some((r) => r.id === id)) commit(records.filter((r) => r.id !== id));
}

/** Open toasts that fit: the newest `limit`; older ones wait. Closing ones stay for their exit. */
export function selectVisible<T extends { state: string }>(list: readonly T[], limit: number): T[] {
  const open = list.filter((t) => t.state === "open");
  const shown = new Set(open.slice(Math.max(0, open.length - limit)));
  return list.filter((t) => t.state === "closed" || shown.has(t));
}

/**
 * Shows a toast in every connected `<ui-toaster>`; returns its id. `toast.success`,
 * `toast.error` set the tone (errors are announced assertively); `toast.dismiss(id?)` closes one
 * or all.
 */
export const toast = Object.assign(
  (message: string, options?: ToastOptions): ToastId => publish(message, "default", options),
  {
    success: (message: string, options?: ToastOptions) => publish(message, "success", options),
    error: (message: string, options?: ToastOptions) => publish(message, "error", options),
    dismiss: (id?: ToastId) => dismiss(id),
  },
);

const EXIT_MS = 200;
const SWIPE = 60;
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** One rendered toast with its timer (paused while hovered, focused or the page is hidden). */
class ToastView {
  readonly element = document.createElement("div");
  #record!: ToastRecord;
  #remaining = 0;
  #startedAt = 0;
  #timer: ReturnType<typeof setTimeout> | undefined;
  #hovered = false;
  #focused = false;
  #exit: ReturnType<typeof setTimeout> | undefined;
  #drag: { x: number } | null = null;

  constructor(
    record: ToastRecord,
    private readonly duration: () => number,
  ) {
    const el = this.element;
    el.dataset.uiPart = "toast";
    el.setAttribute("aria-atomic", "true");
    el.addEventListener("pointerenter", () => this.#pause(() => (this.#hovered = true)));
    el.addEventListener("pointerleave", () => this.#pause(() => (this.#hovered = false)));
    el.addEventListener("focusin", () => this.#pause(() => (this.#focused = true)));
    el.addEventListener("focusout", (event) => {
      if (!el.contains(event.relatedTarget as Node | null))
        this.#pause(() => (this.#focused = false));
    });
    el.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      dismiss(this.#record.id);
    });
    el.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "touch") return;
      this.#drag = { x: event.clientX };
      el.setPointerCapture?.(event.pointerId);
    });
    el.addEventListener("pointermove", (event) => {
      if (!this.#drag) return;
      const dx = event.clientX - this.#drag.x;
      el.style.transform = `translateX(${dx}px)`;
      el.style.opacity = String(1 - Math.abs(dx) / 200);
    });
    const end = (event: PointerEvent) => {
      if (!this.#drag) return;
      const dx = event.clientX - this.#drag.x;
      this.#drag = null;
      el.style.transform = "";
      el.style.opacity = "";
      if (Math.abs(dx) >= SWIPE) dismiss(this.#record.id);
    };
    el.addEventListener("pointerup", end);
    el.addEventListener("pointercancel", end);
    this.update(record);
    requestAnimationFrame(() => el.setAttribute("data-entered", ""));
  }

  get record(): ToastRecord {
    return this.#record;
  }

  update(record: ToastRecord): void {
    const previous = this.#record;
    this.#record = record;
    if (previous?.revision !== record.revision) {
      this.#stop();
      this.#render();
      this.#remaining = record.duration ?? this.duration();
    }
    this.element.dataset.state = record.state;
    if (record.state === "closed") {
      this.#stop();
      if (this.#exit === undefined)
        this.#exit = setTimeout(() => remove(record.id), reducedMotion() ? 0 : EXIT_MS);
    } else {
      clearTimeout(this.#exit);
      this.#exit = undefined;
      this.#run();
    }
  }

  /** Recomputes the timer around a change of the pause inputs. */
  #pause(change: () => void): void {
    this.#stop();
    change();
    this.#run();
  }

  paused(): boolean {
    return this.#hovered || this.#focused || document.visibilityState === "hidden";
  }

  sync(): void {
    this.#stop();
    this.#run();
  }

  #run(): void {
    if (this.#timer || this.#record.state !== "open" || this.paused()) return;
    if (!Number.isFinite(this.#remaining)) return;
    this.#startedAt = Date.now();
    this.#timer = setTimeout(() => dismiss(this.#record.id), Math.max(0, this.#remaining));
  }

  #stop(): void {
    if (!this.#timer) return;
    clearTimeout(this.#timer);
    this.#timer = undefined;
    this.#remaining -= Date.now() - this.#startedAt;
  }

  destroy(): void {
    this.#stop();
    clearTimeout(this.#exit);
  }

  #render(): void {
    const { tone, message, description, action, id } = this.#record;
    const el = this.element;
    const error = tone === "error";
    el.setAttribute("role", error ? "alert" : "status");
    el.setAttribute("aria-live", error ? "assertive" : "polite");
    el.dataset.type = tone;
    const text = document.createElement("div");
    text.dataset.uiPart = "text";
    const title = document.createElement("div");
    title.dataset.uiPart = "title";
    title.textContent = message;
    text.append(title);
    if (description) {
      const body = document.createElement("div");
      body.dataset.uiPart = "description";
      body.textContent = description;
      text.append(body);
    }
    el.replaceChildren(text);
    if (action) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.uiPart = "action";
      button.textContent = action.label;
      button.addEventListener("click", (event) => {
        action.onClick(event);
        if (!event.defaultPrevented) dismiss(id);
      });
      el.append(button);
    }
  }
}

const POSITIONS = new Set([
  "top-left",
  "top-center",
  "top-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
]);

/**
 * `<ui-toaster>`: the live region `toast()` renders into (place one per page). Ephemeral,
 * non-critical confirmations; critical messages belong in a banner. Alt+T moves focus to it,
 * Escape on a toast dismisses it, touch swipe dismisses, hover and focus pause the timer.
 * Attributes: `position` (bottom-center default; top-left ... bottom-right), `duration` (ms,
 * default 6000), `visible-toasts` (default 2), `label` (region name, default "Notifications").
 */
export class UiToaster extends ElementBase {
  static observedAttributes = ["position", "label", "visible-toasts"];
  #views = new Map<ToastId, ToastView>();
  #list: HTMLElement | undefined;

  connectedCallback(): void {
    this.dataset.ui = "toaster";
    adoptStyles(rootOf(this), css);
    this.setAttribute("role", "region");
    this.tabIndex = -1;
    this.setAttribute("data-ui-overlay-ignore", "");
    this.setAttribute("data-ui-layer-branch", "");
    this.#attrs();
    if (!this.#list) {
      this.#list = document.createElement("div");
      this.#list.dataset.uiPart = "list";
      this.append(this.#list);
    }
    listeners.add(this.#render);
    document.addEventListener("keydown", this.#onKey);
    document.addEventListener("visibilitychange", this.#onVisibility);
    this.#render();
  }

  disconnectedCallback(): void {
    listeners.delete(this.#render);
    document.removeEventListener("keydown", this.#onKey);
    document.removeEventListener("visibilitychange", this.#onVisibility);
    for (const view of this.#views.values()) view.destroy();
    this.#views.clear();
    this.#list?.replaceChildren();
  }

  attributeChangedCallback(): void {
    if (!this.isConnected) return;
    this.#attrs();
    this.#render();
  }

  #attrs(): void {
    const position = this.getAttribute("position") ?? "";
    this.dataset.position = POSITIONS.has(position) ? position : "bottom-center";
    this.setAttribute("aria-label", this.getAttribute("label") ?? "Notifications");
  }

  #duration = () => {
    const value = Number.parseFloat(this.getAttribute("duration") ?? "");
    return Number.isNaN(value) ? 6000 : value;
  };

  #render = () => {
    const list = this.#list;
    if (!list) return;
    const limit = Number.parseInt(this.getAttribute("visible-toasts") ?? "", 10);
    const shown = selectVisible(records, Number.isFinite(limit) && limit > 0 ? limit : 2);
    const keep = new Set(shown.map((record) => record.id));
    for (const [id, view] of this.#views)
      if (!keep.has(id)) {
        view.destroy();
        view.element.remove();
        this.#views.delete(id);
      }
    shown.forEach((record, index) => {
      let view = this.#views.get(record.id);
      if (view) view.update(record);
      else if (record.state === "closed") {
        // Closed while no toaster showed it: nothing to animate.
        queueMicrotask(() => remove(record.id));
        return;
      } else {
        view = new ToastView(record, this.#duration);
        this.#views.set(record.id, view);
      }
      // Move only what is out of place: re-inserting a node would drop focus inside it.
      const at = list.children[index];
      if (at !== view.element) list.insertBefore(view.element, at ?? null);
    });
  };

  #onKey = (event: KeyboardEvent) => {
    if (event.altKey && event.code === "KeyT") this.focus();
  };
  #onVisibility = () => {
    for (const view of this.#views.values()) view.sync();
  };
}

/** Registers `<ui-toaster>` (or `<prefix-toaster>`) and returns the tag. The entry is `toast`. */
export function defineToast(options?: DefineOptions): string {
  return defineElement("toaster", UiToaster, options);
}
