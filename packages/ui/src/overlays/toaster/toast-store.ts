import type { ReactNode } from "react";

/** `error` is the danger toast (kept under its original name); `info` and `warning` are neutral-status additions. */
export type ToastTone = "default" | "success" | "error" | "info" | "warning";

export interface ToastAction {
  label: ReactNode;
  onClick: (event: { preventDefault: () => void }) => void;
}

export interface ToastOptions {
  /** Reuse an id to update a toast in place instead of stacking a new one. */
  id?: string | number;
  description?: ReactNode;
  /** Milliseconds before auto dismiss; `Infinity` keeps it until dismissed. Defaults to the Toaster `duration`. */
  duration?: number;
  action?: ToastAction;
  /** Runs once when the toast is dismissed, by timer, action, swipe, Escape or `toast.dismiss`. */
  onDismiss?: (id: string | number) => void;
}

export interface ToastRecord extends Omit<ToastOptions, "id"> {
  id: string | number;
  message: ReactNode;
  tone: ToastTone;
  state: "open" | "closed";
  /** Bumped on every update so timers restart. */
  revision: number;
}

const EMPTY: readonly ToastRecord[] = [];
let toasts: readonly ToastRecord[] = EMPTY;
let counter = 0;
const listeners = new Set<() => void>();

function commit(next: readonly ToastRecord[]) {
  toasts = next;
  for (const listener of [...listeners]) listener();
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): readonly ToastRecord[] {
  return toasts;
}

export function getServerSnapshot(): readonly ToastRecord[] {
  return EMPTY;
}

/** Adds a toast, or updates and reopens the one sharing `options.id`. Returns its id. */
export function publish(
  message: ReactNode,
  tone: ToastTone,
  options: ToastOptions = {},
): string | number {
  const id = options.id ?? `toast-${++counter}`;
  const existing = toasts.find((t) => t.id === id);
  const record: ToastRecord = {
    ...options,
    id,
    message,
    tone,
    state: "open",
    revision: (existing?.revision ?? 0) + 1,
  };
  commit(existing ? toasts.map((t) => (t.id === id ? record : t)) : [...toasts, record]);
  return id;
}

/** Starts the exit of one toast, or of every open toast without an id. Idempotent. */
export function dismiss(id?: string | number) {
  const closing = toasts.filter((t) => t.state === "open" && (id === undefined || t.id === id));
  if (closing.length === 0) return;
  commit(toasts.map((t) => (closing.includes(t) ? { ...t, state: "closed" as const } : t)));
  for (const t of closing) t.onDismiss?.(t.id);
}

/** Drops a toast from the store once its exit finished. */
export function remove(id: string | number) {
  if (!toasts.some((t) => t.id === id)) return;
  commit(toasts.filter((t) => t.id !== id));
}

/** Open toasts that fit on screen: the newest `limit`. Older ones wait their turn. */
export function selectVisible(list: readonly ToastRecord[], limit: number): ToastRecord[] {
  const open = list.filter((t) => t.state === "open");
  const shown = new Set(open.slice(Math.max(0, open.length - limit)));
  return list.filter((t) => t.state === "closed" || shown.has(t));
}

/**
 * Test hook: empties the store and resets the id counter. Mounted toasters clear at once;
 * `onDismiss` callbacks do not run. Public as `resetToasts` from `@jcsoftdev/ui/overlays/testing`.
 */
export function reset() {
  counter = 0;
  commit(EMPTY);
}
