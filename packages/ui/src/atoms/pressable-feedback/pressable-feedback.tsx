"use client";

import { type ComponentPropsWithRef, type PointerEvent, useRef } from "react";
import { intentAttributes } from "../../intent/attributes.js";
import type { IntentProps } from "../../intent/types.js";
import { useIntentTarget } from "../../intent/use-intent-target.js";
import { cn } from "../../utils/cn.js";
import { useComposedRefs } from "../../utils/compose.js";
import { usePrefersReducedMotion } from "../../utils/reduced-motion.js";

export interface PressableFeedbackProps extends ComponentPropsWithRef<"span">, IntentProps {
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
  intent,
  intentKey,
  ref,
  ...props
}: PressableFeedbackProps) {
  const host = useRef<HTMLSpanElement>(null);
  const composedRef = useComposedRefs<HTMLSpanElement>(
    ref,
    host,
    useIntentTarget({ intent, intentKey }),
  );
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
      ref={composedRef}
      data-disabled={disabled || undefined}
      onPointerDown={spawn}
      className={cn(
        "relative inline-flex max-w-full overflow-hidden rounded-[inherit]",
        scale && !reduced && !disabled && "pressable",
        disabled && "pointer-events-none opacity-60",
        className,
      )}
      {...intentAttributes({ intent, intentKey })}
      {...props}
    >
      {children}
    </span>
  );
}
