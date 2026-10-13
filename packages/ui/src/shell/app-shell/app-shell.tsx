"use client";

import {
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { cn } from "../../utils/cn.js";
import { useComposedRefs } from "../../utils/compose.js";

/** Container width (px) below which the shell is compact: the sidebar becomes a drawer. */
export const APP_SHELL_BREAKPOINT = 900;

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Whether the measured width of `resolve(ref.current)` is under the breakpoint. Starts as
 * `false` (desktop) on the server and for the first client render, then measures before paint.
 */
export function useCompactContainer(
  ref: RefObject<HTMLElement | null>,
  resolve: (element: HTMLElement) => Element | null = (element) => element,
  enabled = true,
): boolean {
  const [compact, setCompact] = useState(false);

  useIsomorphicLayoutEffect(() => {
    const element = ref.current ? resolve(ref.current) : null;
    if (!enabled || !element) return;
    const measure = () => setCompact(element.getBoundingClientRect().width < APP_SHELL_BREAKPOINT);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, enabled]);

  return compact;
}

interface AppShellState {
  compact: boolean;
}

/** Measured compact flag of one `AppShell`, readable through `useSyncExternalStore`. */
export interface AppShellStore {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => boolean;
  /** Same value the first client render reads, so hydration never sees a different snapshot. */
  getServerSnapshot: () => boolean;
  /** Starts measuring `element`; returns the stop function. */
  observe: (element: HTMLElement) => () => void;
}

export function createAppShellStore(): AppShellStore {
  let compact = false;
  const listeners = new Set<() => void>();
  const set = (next: boolean) => {
    if (next === compact) return;
    compact = next;
    for (const listener of listeners) listener();
  };
  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    getSnapshot: () => compact,
    getServerSnapshot: () => false,
    observe(element) {
      const measure = () => set(element.getBoundingClientRect().width < APP_SHELL_BREAKPOINT);
      measure();
      if (typeof ResizeObserver === "undefined") return () => {};
      const observer = new ResizeObserver(measure);
      observer.observe(element);
      return () => observer.disconnect();
    },
  };
}

const noopSubscribe = () => () => {};
const alwaysFalse = () => false;

/** Not part of the public API; exported for the hydration test. */
export const AppShellContext = createContext<AppShellStore | null>(null);

/** `null` outside an `AppShell`; otherwise whether the shell is narrower than 900 px. */
export function useAppShell(): AppShellState | null {
  const store = useContext(AppShellContext);
  const compact = useSyncExternalStore(
    store?.subscribe ?? noopSubscribe,
    store?.getSnapshot ?? alwaysFalse,
    alwaysFalse,
  );
  return useMemo(() => (store ? { compact } : null), [store, compact]);
}

export interface AppShellProps extends ComponentPropsWithRef<"div"> {
  children: ReactNode;
}

/**
 * Root of the app frame (sidebar + topbar + page). It is the `app` container: the sidebar turns
 * into a drawer and the topbar shows its menu button when the SHELL is under 900 px wide,
 * whatever the viewport is, so the same shell works in a full page, a preview or a story.
 *
 * The context value is a store that never changes identity, and it reads `false` on the server
 * and on the first client render. Only components that call `useAppShell` update, and only once
 * the measure arrives, so nothing above a still-dehydrated Suspense boundary re-renders during
 * hydration (a provider value that changed there made Next.js client-render those boundaries).
 */
export function AppShell({ children, className, ref: forwardedRef, ...props }: AppShellProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [store] = useState(createAppShellStore);
  const composedRef = useComposedRefs(ref, forwardedRef);

  useEffect(() => (ref.current ? store.observe(ref.current) : undefined), [store]);

  return (
    <AppShellContext.Provider value={store}>
      <div ref={composedRef} {...props} className={cn("@container/app flex min-w-0", className)}>
        {children}
      </div>
    </AppShellContext.Provider>
  );
}
