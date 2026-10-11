"use client";

import {
  type ComponentPropsWithRef,
  createContext,
  type ReactNode,
  type RefObject,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
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

const AppShellContext = createContext<AppShellState | null>(null);

/** `null` outside an `AppShell`; otherwise whether the shell is narrower than 900 px. */
export function useAppShell(): AppShellState | null {
  return useContext(AppShellContext);
}

export interface AppShellProps extends ComponentPropsWithRef<"div"> {
  children: ReactNode;
}

/**
 * Root of the app frame (sidebar + topbar + page). It is the `app` container: the sidebar turns
 * into a drawer and the topbar shows its menu button when the SHELL is under 900 px wide,
 * whatever the viewport is, so the same shell works in a full page, a preview or a story.
 */
export function AppShell({ children, className, ref: forwardedRef, ...props }: AppShellProps) {
  const ref = useRef<HTMLDivElement>(null);
  const compact = useCompactContainer(ref);
  const composedRef = useComposedRefs(ref, forwardedRef);
  return (
    <AppShellContext.Provider value={{ compact }}>
      <div ref={composedRef} {...props} className={cn("@container/app flex min-w-0", className)}>
        {children}
      </div>
    </AppShellContext.Provider>
  );
}
