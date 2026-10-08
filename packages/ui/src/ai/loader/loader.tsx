"use client";

import { cn } from "../../utils/cn.js";
import { usePrefersReducedMotion } from "../../utils/reduced-motion.js";
import { AiKeyframes } from "../internal/keyframes.js";

export type LoaderVariant = "dots" | "typing";
export type LoaderSize = "sm" | "md";

export interface LoaderProps {
  /** `dots` is the bare indicator; `typing` wraps it in a bubble with a label. */
  variant?: LoaderVariant;
  size?: LoaderSize;
  /** Spoken label (`role="status"`); shown as text in the `typing` variant. */
  label?: string;
  className?: string;
}

const dotSize: Record<LoaderSize, string> = { sm: "size-1", md: "size-1.5" };

/** Animated waiting indicator. With reduced motion the dots stay still. */
export function Loader({
  variant = "dots",
  size = "md",
  label = "Escribiendo…",
  className,
}: LoaderProps) {
  const reduced = usePrefersReducedMotion();
  const dots = (
    <span aria-hidden className="inline-flex items-center gap-1">
      {[0, 1, 2].map((n) => (
        <span
          key={n}
          className={cn("rounded-full bg-current opacity-60", dotSize[size])}
          style={
            reduced
              ? undefined
              : { animation: "ui-ai-dot 1.2s ease-in-out infinite", animationDelay: `${n * 160}ms` }
          }
        />
      ))}
    </span>
  );

  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-density-sm text-ink-3",
        variant === "typing" &&
          "rounded-card bg-surface-card px-control-x py-2 text-meta shadow-card border-card",
        className,
      )}
    >
      <AiKeyframes />
      {dots}
      {variant === "typing" ? <span>{label}</span> : <span className="sr-only">{label}</span>}
    </span>
  );
}
