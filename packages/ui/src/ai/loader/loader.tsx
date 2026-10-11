"use client";

import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { usePrefersReducedMotion } from "../../utils/reduced-motion.js";
import { AiKeyframes } from "../internal/keyframes.js";

export type LoaderVariant = "dots" | "typing";
export type LoaderSize = "sm" | "md";

export type LoaderPart = "root" | "dots" | "dot" | "label";

export interface LoaderProps {
  /** `dots` is the bare indicator; `typing` wraps it in a bubble with a label. */
  variant?: LoaderVariant;
  size?: LoaderSize;
  /** Spoken label (`role="status"`); shown as text in the `typing` variant. */
  label?: string;
  className?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<LoaderPart>;
}

const dotSize: Record<LoaderSize, string> = { sm: "size-1", md: "size-1.5" };

/** Animated waiting indicator. With reduced motion the dots stay still. */
export function Loader({
  variant = "dots",
  size = "md",
  label = "Escribiendo…",
  className,
  classNames,
}: LoaderProps) {
  const reduced = usePrefersReducedMotion();
  const dots = (
    <span aria-hidden className={cn("inline-flex items-center gap-1", classNames?.dots)}>
      {[0, 1, 2].map((n) => (
        <span
          key={n}
          className={cn("rounded-full bg-current opacity-60", dotSize[size], classNames?.dot)}
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
        classNames?.root,
        className,
      )}
    >
      <AiKeyframes />
      {dots}
      {variant === "typing" ? (
        <span className={classNames?.label}>{label}</span>
      ) : (
        <span className={cn("sr-only", classNames?.label)}>{label}</span>
      )}
    </span>
  );
}
