/**
 * Provider/consumer context over DOM events (the Context Community Protocol shape): a consumer
 * dispatches a bubbling, composed request; the nearest provider answers with its value and keeps
 * the consumer subscribed to later changes. Works across shadow boundaries and with any framework.
 */
export const CONTEXT_REQUEST = "ui-context-request";

export interface ContextKey<T> {
  readonly name: string;
  /** Phantom: carries `T` for inference only. */
  readonly _type?: T;
}

export function createContextKey<T>(name: string): ContextKey<T> {
  return { name };
}

export interface ContextRequestDetail<T> {
  key: ContextKey<T>;
  /** Called with the current value and on every change. */
  callback: (value: T) => void;
  /** Provider hands back the unsubscribe function. */
  unsubscribe?: (() => void) | undefined;
}

export type ContextRequestEvent<T> = CustomEvent<ContextRequestDetail<T>>;

export interface ContextProvider<T> {
  get(): T;
  set(value: T): void;
  destroy(): void;
}

/** Makes `host` answer requests for `key`; `set` pushes the new value to every subscriber. */
export function provideContext<T>(
  host: EventTarget,
  key: ContextKey<T>,
  initial: T,
): ContextProvider<T> {
  let value = initial;
  const subscribers = new Set<(value: T) => void>();
  const listener = (event: Event) => {
    const detail = (event as ContextRequestEvent<T>).detail;
    if (detail.key.name !== key.name) return;
    event.stopPropagation();
    subscribers.add(detail.callback);
    detail.unsubscribe = () => subscribers.delete(detail.callback);
    detail.callback(value);
  };
  host.addEventListener(CONTEXT_REQUEST, listener);
  return {
    get: () => value,
    set(next) {
      if (Object.is(next, value)) return;
      value = next;
      for (const callback of [...subscribers]) callback(next);
    },
    destroy() {
      host.removeEventListener(CONTEXT_REQUEST, listener);
      subscribers.clear();
    },
  };
}

/**
 * Asks the nearest provider above `host` for `key`. Returns an unsubscribe function, or `null`
 * when no provider answered (the callback never fires, so the caller keeps its fallback).
 */
export function consumeContext<T>(
  host: EventTarget,
  key: ContextKey<T>,
  callback: (value: T) => void,
): (() => void) | null {
  const detail: ContextRequestDetail<T> = { key, callback };
  host.dispatchEvent(new CustomEvent(CONTEXT_REQUEST, { bubbles: true, composed: true, detail }));
  return detail.unsubscribe ?? null;
}
