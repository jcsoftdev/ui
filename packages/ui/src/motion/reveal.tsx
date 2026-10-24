"use client";

import {
  Children,
  type CSSProperties,
  type HTMLAttributes,
  isValidElement,
  type ReactNode,
  type Ref,
} from "react";
import { composeRefs, Slot } from "../utils/slot.js";
import { MotionStyles } from "./motion-styles.js";
import { type EnterPhase, useEnterPhase } from "./use-enter-phase.js";

type MotionVars = CSSProperties & Record<`--ui-motion-${string}`, string | number>;

function phaseProps(phase: EnterPhase, vars: MotionVars, style?: CSSProperties) {
  if (phase === "static") return { style };
  return { "data-motion": phase, style: { ...vars, ...style } };
}

export interface RevealProps extends HTMLAttributes<HTMLElement> {
  /** Extra wait before entering, in ms. */
  delay?: number;
  /** Enter when the element first scrolls into view instead of on mount. */
  inView?: boolean;
  /** Animate the single child element instead of rendering a `div`. */
  asChild?: boolean;
  ref?: Ref<HTMLElement>;
}

/**
 * Fades its content in with a small rise when it mounts on the client, or first scrolls into view
 * with `inView`. Server-rendered content and reduced motion show the end state at once. The
 * content stays in the accessibility tree the whole time: hiding uses `opacity` only.
 */
export function Reveal({ delay, inView = false, asChild, style, ref, ...props }: RevealProps) {
  const [phaseRef, phase] = useEnterPhase(inView);
  const Comp = asChild ? Slot : "div";
  const vars: MotionVars = { "--ui-motion-i": 0 };
  if (delay) vars["--ui-motion-delay"] = `${delay}ms`;
  return (
    <>
      <MotionStyles />
      <Comp
        ref={composeRefs<HTMLElement>(ref, phaseRef) as Ref<HTMLDivElement>}
        {...phaseProps(phase, vars, style)}
        {...props}
      />
    </>
  );
}

export interface StaggerProps extends HTMLAttributes<HTMLElement> {
  /** Extra wait before the first child enters, in ms. */
  delay?: number;
  /** Start when the group first scrolls into view instead of on mount. */
  inView?: boolean;
  /**
   * Longest gap between the first and the last child's start, in ms. Each step is a quarter of
   * `--motion-duration`, shortened so long lists still fit in this span (default 1.5 durations).
   */
  maxStagger?: number;
  /** Element that wraps the children, e.g. `ul` for a list of `li`. */
  as?: "div" | "ul" | "ol" | "section";
  ref?: Ref<HTMLElement>;
  children?: ReactNode;
}

/**
 * Its children enter one after another, like `Reveal`, with the whole sequence capped by
 * `maxStagger`. Each child element receives `data-motion` and a `style` variable, so it must
 * pass `style` and `data-*` props to its DOM element (every element and most components do).
 */
export function Stagger({
  delay,
  inView = false,
  maxStagger,
  as: Tag = "div",
  style,
  ref,
  children,
  ...props
}: StaggerProps) {
  const [phaseRef, phase] = useEnterPhase(inView);
  const items = Children.toArray(children);
  const vars: MotionVars = { "--ui-motion-n": Math.max(1, items.length - 1) };
  if (maxStagger !== undefined) vars["--ui-motion-span"] = `${Math.max(0, maxStagger)}ms`;
  const itemVars = (i: number): MotionVars => {
    const next: MotionVars = { "--ui-motion-i": i };
    if (delay) next["--ui-motion-delay"] = `${delay}ms`;
    return next;
  };
  return (
    <>
      <MotionStyles />
      <Tag
        ref={composeRefs<HTMLElement>(ref, phaseRef) as Ref<never>}
        data-motion-stagger={phase === "static" ? undefined : ""}
        style={phase === "static" ? style : { ...vars, ...style }}
        {...props}
      >
        {items.map((child, i) =>
          isValidElement(child) ? (
            <Slot key={child.key} {...phaseProps(phase, itemVars(i))}>
              {child}
            </Slot>
          ) : (
            child
          ),
        )}
      </Tag>
    </>
  );
}
