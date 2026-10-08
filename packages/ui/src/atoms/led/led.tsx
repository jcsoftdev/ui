import { cn } from "../../utils/cn.js";

export type LedStatus = "success" | "warning" | "danger" | "idle";

const statusClasses: Record<LedStatus, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  idle: "bg-ink-3",
};

export interface LedProps {
  status?: LedStatus;
  /** Text describing the status: color is never the only signal. */
  label: string;
  showLabel?: boolean;
  className?: string;
}

export function Led({ status = "success", label, showLabel, className }: LedProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span
        aria-hidden="true"
        className={cn("size-[7px] shrink-0 rounded-pill", statusClasses[status])}
      />
      <span className={showLabel ? undefined : "sr-only"}>{label}</span>
    </span>
  );
}
