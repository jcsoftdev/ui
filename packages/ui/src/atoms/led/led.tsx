import type { ComponentPropsWithRef } from "react";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";

export type LedStatus = "success" | "warning" | "danger" | "idle";

const statusClasses: Record<LedStatus, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  idle: "bg-ink-3",
};

export type LedPart = "root" | "dot" | "label";

export interface LedProps extends Omit<ComponentPropsWithRef<"span">, "children"> {
  status?: LedStatus;
  /** Text describing the status: color is never the only signal. */
  label: string;
  showLabel?: boolean;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<LedPart>;
}

export function Led({
  status = "success",
  label,
  showLabel,
  className,
  classNames,
  ...props
}: LedProps) {
  return (
    <span
      {...props}
      className={cn("inline-flex items-center gap-1.5", classNames?.root, className)}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.75 shrink-0 rounded-pill", statusClasses[status], classNames?.dot)}
      />
      <span className={cn(showLabel ? undefined : "sr-only", classNames?.label)}>{label}</span>
    </span>
  );
}
