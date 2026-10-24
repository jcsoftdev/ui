"use client";

import {
  type AnimationEvent,
  type HTMLAttributes,
  type Key,
  type ReactNode,
  type Ref,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { usePrefersReducedMotion } from "../utils/reduced-motion.js";
import { MotionStyles } from "./motion-styles.js";

interface Leaving {
  key: Key;
  node: ReactNode;
}

interface SwapState {
  key: Key;
  entering: Key | null;
  leaving: Leaving[];
  /** Bumped each time focus was inside the content that left, so it moves to the new content. */
  refocus: number;
}

/** Leaving layers are dropped on `animationend`; this bounds them when no animation runs. */
const LEAVE_TIMEOUT_MS = 1000;

export interface CrossFadeProps extends HTMLAttributes<HTMLDivElement> {
  /** Identity of the content. A new key fades the old content out and the new one in. */
  contentKey: Key;
  children?: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Swaps keyed content (a list-detail pane, a tab panel) with a cross-fade and a 4px rise. The old
 * content stays mounted on top of the new one until it has faded, out of the layout (so nothing
 * jumps), hidden from assistive tech and inert. If focus was inside the old content it moves to
 * the new content. The first render (also server HTML) never animates; reduced motion swaps
 * without any fade.
 */
export function CrossFade({ contentKey, children, ref, ...props }: CrossFadeProps) {
  const reduced = usePrefersReducedMotion();
  const current = useRef<HTMLDivElement>(null);
  const committed = useRef<ReactNode>(children);
  const [state, setState] = useState<SwapState>({
    key: contentKey,
    entering: null,
    leaving: [],
    refocus: 0,
  });

  if (state.key !== contentKey) {
    const animate = !reduced;
    const focused = typeof document !== "undefined" && document.activeElement;
    setState({
      key: contentKey,
      entering: animate ? contentKey : null,
      leaving: animate
        ? [
            ...state.leaving.filter((layer) => layer.key !== contentKey),
            { key: state.key, node: committed.current },
          ]
        : [],
      refocus: focused && current.current?.contains(focused) ? state.refocus + 1 : state.refocus,
    });
  }

  useLayoutEffect(() => {
    committed.current = children;
  });

  useLayoutEffect(() => {
    if (state.refocus === 0 || !current.current) return;
    current.current.tabIndex = -1;
    current.current.focus({ preventScroll: true });
  }, [state.refocus]);

  const leavingCount = state.leaving.length;
  useEffect(() => {
    if (leavingCount === 0) return;
    const timer = setTimeout(() => setState((s) => ({ ...s, leaving: [] })), LEAVE_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [leavingCount]);

  const drop = (key: Key) => (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    setState((s) => ({ ...s, leaving: s.leaving.filter((layer) => layer.key !== key) }));
  };

  const layers = [
    ...state.leaving.map((layer) => (
      <div
        key={`k:${String(layer.key)}`}
        data-motion-leave=""
        aria-hidden="true"
        inert
        onAnimationEnd={drop(layer.key)}
      >
        {layer.node}
      </div>
    )),
    <div
      key={`k:${String(contentKey)}`}
      ref={current}
      data-motion={state.entering === contentKey ? "enter" : undefined}
    >
      {children}
    </div>,
  ];

  return (
    <>
      <MotionStyles />
      <div ref={ref} data-motion-swap="" {...props}>
        {layers}
      </div>
    </>
  );
}

export interface PresenceProps extends Omit<CrossFadeProps, "contentKey"> {
  /** Shows the children when true; changes fade them in and out. */
  present: boolean;
}

/** `CrossFade` between the children and nothing: shows or hides content with a fade. */
export function Presence({ present, children, ...props }: PresenceProps) {
  return (
    <CrossFade contentKey={present ? "present" : "absent"} {...props}>
      {present ? children : null}
    </CrossFade>
  );
}
