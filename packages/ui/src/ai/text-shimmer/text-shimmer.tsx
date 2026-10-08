"use client";

import type { CSSProperties, ElementType, ReactNode } from "react";
import { cn } from "../../utils/cn.js";
import { usePrefersReducedMotion } from "../../utils/reduced-motion.js";
import { AiKeyframes } from "../internal/keyframes.js";

export interface TextShimmerProps {
  children: ReactNode;
  /** Element to render. */
  as?: ElementType;
  /** Seconds for one sweep. */
  duration?: number;
  className?: string;
}

/** Text with a light sweep, used for "thinking…" labels. Static with reduced motion. */
export function TextShimmer({
  children,
  as: Comp = "span",
  duration = 2,
  className,
}: TextShimmerProps) {
  const reduced = usePrefersReducedMotion();
  const style: CSSProperties | undefined = reduced
    ? undefined
    : {
        backgroundImage:
          "linear-gradient(100deg, var(--color-ink-3) 35%, var(--color-ink) 50%, var(--color-ink-3) 65%)",
        backgroundSize: "250% 100%",
        animation: `ui-ai-shimmer ${duration}s linear infinite`,
        WebkitBackgroundClip: "text",
        backgroundClip: "text",
        color: "transparent",
      };
  return (
    <Comp className={cn("inline-block text-ink-3", className)} style={style}>
      <AiKeyframes />
      {children}
    </Comp>
  );
}
