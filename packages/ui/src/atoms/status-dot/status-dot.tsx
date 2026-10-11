import type { ComponentPropsWithRef } from "react";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";

export type StatusDotTone = "danger" | "warning" | "success" | "accent" | "neutral";

const toneClasses: Record<StatusDotTone, string> = {
  danger: "bg-danger",
  warning: "bg-warning",
  success: "bg-success",
  accent: "bg-accent",
  neutral: "bg-ink-3",
};

export type StatusDotShape = "dot" | "square";

const shapeClasses: Record<StatusDotShape, string> = {
  dot: "size-1.5 rounded-pill",
  square: "size-2.25 rounded-xs",
};

export type StatusDotPart = "root" | "dot" | "label";

export interface StatusDotProps extends Omit<ComponentPropsWithRef<"span">, "children"> {
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<StatusDotPart>;
  tone: StatusDotTone;
  /** Text describing the status: color is never the only signal. */
  label: string;
  showLabel?: boolean;
  shape?: StatusDotShape;
  /** Hollow variant: transparent fill with an accent inner ring. */
  hollow?: boolean;
}

export function StatusDot({
  tone,
  label,
  showLabel,
  shape = "dot",
  hollow,
  className,
  classNames,
  ...props
}: StatusDotProps) {
  return (
    <span
      {...props}
      className={cn("inline-flex max-w-full items-center gap-1.5", classNames?.root, className)}
    >
      <span
        aria-hidden="true"
        className={cn(
          "shrink-0",
          shapeClasses[shape],
          hollow ? "bg-transparent shadow-[inset_0_0_0_2px_var(--accent)]" : toneClasses[tone],
          classNames?.dot,
        )}
      />
      <span className={cn(showLabel ? "min-w-0 truncate" : "sr-only", classNames?.label)}>
        {label}
      </span>
    </span>
  );
}
