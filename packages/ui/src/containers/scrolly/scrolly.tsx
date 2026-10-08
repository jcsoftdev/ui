"use client";

import {
  Children,
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "../../utils/cn.js";
import { usePrefersReducedMotion } from "../../utils/reduced-motion.js";
import { lineRootMargin, pickActiveStep, triggerLine } from "./scrolly-logic.js";

interface StepContext {
  index: number;
  active: boolean;
  register: (index: number, element: HTMLElement | null) => void;
}

const Step = createContext<StepContext | null>(null);

export interface ScrollyGraphicState {
  /** Index of the step the reader is on. */
  step: number;
  /** The step before it (the same at first), to animate from. */
  previous: number;
  /** True when the user asked for reduced motion: swap instead of animating. */
  reducedMotion: boolean;
}

export interface ScrollyProps {
  /** The sticky graphic: receives the active step, e.g. to change the data of a chart. */
  graphic: (state: ScrollyGraphicState) => ReactNode;
  /** `ScrollyStep` elements, in reading order. */
  children: ReactNode;
  /** Where the trigger line sits in the scroll area: 0 top, 0.5 middle (default), 1 bottom. */
  offset?: number;
  /** Scroll container the steps move in; the page by default. */
  root?: HTMLElement | null;
  /** Height of the sticky graphic, any CSS length. */
  graphicHeight?: string;
  /** Which side the graphic takes when the container is wide. */
  graphicSide?: "start" | "end";
  /** Controlled step; the scroll position decides when omitted. */
  step?: number;
  onStepChange?: (step: number) => void;
  /** Accessible name of the narrative. */
  "aria-label"?: string;
  className?: string;
}

/**
 * Scrollytelling: text steps scroll past while a graphic stays in view and follows the active
 * step. The active step is the one crossing a trigger line, found with an IntersectionObserver.
 * Wide containers put the graphic beside the steps, narrow ones pin it above them (container
 * queries, so it works inside a card or a dialog too). The text is real content in reading
 * order, so it works with a screen reader and without scrolling effects.
 */
export function Scrolly({
  graphic,
  children,
  offset = 0.5,
  root = null,
  graphicHeight = "min(55svh, 26rem)",
  graphicSide = "end",
  step: controlled,
  onStepChange,
  "aria-label": label,
  className,
}: ScrollyProps) {
  const reduced = usePrefersReducedMotion();
  const elements = useRef(new Map<number, HTMLElement>());
  const [observed, setObserved] = useState(0);
  const [previous, setPrevious] = useState(0);
  const step = controlled ?? observed;
  const stepRef = useRef(step);
  stepRef.current = step;
  const items = Children.toArray(children);
  const count = items.length;
  const observer = useRef<IntersectionObserver | null>(null);

  const measure = useCallback(() => {
    const list = [...elements.current.entries()].sort(([a], [b]) => a - b);
    if (list.length === 0) return;
    const area = root?.getBoundingClientRect();
    const top = area?.top ?? 0;
    const height = area?.height ?? window.innerHeight;
    const line = triggerLine(top, height, offset);
    const next = pickActiveStep(
      list.map(([, element]) => element.getBoundingClientRect()),
      line,
    );
    if (next >= 0 && next !== stepRef.current) {
      setPrevious(stepRef.current);
      setObserved(next);
      onStepChange?.(next);
    }
  }, [root, offset, onStepChange]);

  const register = useCallback((index: number, element: HTMLElement | null) => {
    const current = elements.current.get(index);
    if (current && current !== element) observer.current?.unobserve(current);
    if (element) {
      elements.current.set(index, element);
      observer.current?.observe(element);
    } else elements.current.delete(index);
  }, []);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(measure, { root, rootMargin: lineRootMargin(offset) });
    observer.current = io;
    for (const element of elements.current.values()) io.observe(element);
    measure();
    return () => {
      io.disconnect();
      observer.current = null;
    };
  }, [measure, root, offset]);

  const contexts = useMemo(
    () =>
      items.map((_, index) => ({ index, active: index === step, register }) satisfies StepContext),
    [items, step, register],
  );

  return (
    <section
      aria-label={label}
      className={cn(
        "@container/scrolly grid w-full min-w-0 grid-cols-1 gap-x-[var(--scrolly-gap,2rem)]",
        "@3xl/scrolly:grid-cols-2",
        className,
      )}
    >
      <div
        data-scrolly-graphic=""
        className={cn(
          "sticky top-0 z-10 min-w-0 self-start bg-bg pb-2",
          "@3xl/scrolly:top-4 @3xl/scrolly:row-start-1 @3xl/scrolly:pb-0",
          graphicSide === "end" ? "@3xl/scrolly:col-start-2" : "@3xl/scrolly:col-start-1",
        )}
        style={{ height: graphicHeight }}
      >
        {graphic({
          step: Math.min(step, Math.max(0, count - 1)),
          previous,
          reducedMotion: reduced,
        })}
      </div>
      <div
        className={cn(
          "flex min-w-0 flex-col @3xl/scrolly:row-start-1",
          graphicSide === "end" ? "@3xl/scrolly:col-start-1" : "@3xl/scrolly:col-start-2",
        )}
      >
        {items.map((child, index) => (
          <Step.Provider
            // biome-ignore lint/suspicious/noArrayIndexKey: steps are positional by definition.
            key={index}
            value={contexts[index] as StepContext}
          >
            {child}
          </Step.Provider>
        ))}
      </div>
    </section>
  );
}

export interface ScrollyStepProps {
  children: ReactNode;
  /** Minimum height of the step, any CSS length; a tall step gives the reader time with the graphic. */
  minHeight?: string;
  className?: string;
}

/** One block of the narrative. Marked `aria-current="step"` and `data-active` while it is the active one. */
export function ScrollyStep({ children, minHeight = "70svh", className }: ScrollyStepProps) {
  const context = useContext(Step);
  if (!context) throw new Error("ScrollyStep must be a direct child of Scrolly");
  const { index, active, register } = context;
  const ref = useCallback(
    (element: HTMLElement | null) => register(index, element),
    [register, index],
  );
  return (
    <article
      ref={ref}
      data-active={active || undefined}
      aria-current={active ? "step" : undefined}
      className={cn(
        "flex min-w-0 flex-col justify-center py-6 text-ink",
        "opacity-60 motion-safe:transition-opacity motion-safe:duration-300 data-[active]:opacity-100",
        className,
      )}
      style={{ minHeight }}
    >
      {children}
    </article>
  );
}
