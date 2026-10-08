"use client";

import { type ComponentPropsWithoutRef, type PointerEvent, useRef } from "react";
import { cn } from "../../utils/cn.js";
import { usePrefersReducedMotion } from "../../utils/reduced-motion.js";

export interface PressableFeedbackProps extends ComponentPropsWithoutRef<"span"> {
  /** Draws an expanding ripple from the pointer position. */
  ripple?: boolean;
  /** Scales the content down while pressed (uses the preset's `--press-scale`). */
  scale?: boolean;
  disabled?: boolean;
}

/**
 * Wraps any content with press feedback: a ripple from the pointer and a small scale-down. Both
 * are skipped under `prefers-reduced-motion`. It adds no semantics, so put it around (or let it
 * contain) the real button or link.
 */
export function PressableFeedback({
  ripple = true,
  scale = true,
  disabled,
  className,
  children,
  onPointerDown,
  ...props
}: PressableFeedbackProps) {
  const host = useRef<HTMLSpanElement>(null);
  const reduced = usePrefersReducedMotion();

  const spawn = (event: PointerEvent<HTMLSpanElement>) => {
    onPointerDown?.(event);
    const node = host.current;
    if (!ripple || disabled || reduced || !node || typeof node.animate !== "function") return;
    const rect = node.getBoundingClientRect();
    const size = Math.hypot(rect.width, rect.height) * 2;
    const dot = document.createElement("span");
    dot.setAttribute("aria-hidden", "true");
    Object.assign(dot.style, {
      position: "absolute",
      left: `${event.clientX - rect.left - size / 2}px`,
      top: `${event.clientY - rect.top - size / 2}px`,
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: "9999px",
      background: "currentColor",
      opacity: "0",
      pointerEvents: "none",
    });
    node.appendChild(dot);
    const run = dot.animate(
      [
        { transform: "scale(0)", opacity: 0.18 },
        { transform: "scale(1)", opacity: 0 },
      ],
      { duration: 480, easing: "cubic-bezier(.2,.7,.3,1)" },
    );
    run.onfinish = () => dot.remove();
    run.oncancel = () => dot.remove();
  };

  return (
    <span
      ref={host}
      data-disabled={disabled || undefined}
      onPointerDown={spawn}
      className={cn(
        "relative inline-flex max-w-full overflow-hidden rounded-[inherit]",
        scale && !reduced && !disabled && "pressable",
        disabled && "pointer-events-none opacity-60",
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
