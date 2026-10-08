import type { ReactNode } from "react";
import { cn } from "../../utils/cn.js";

export type KpiVariant = "default" | "danger";

export interface KpiProps {
  /** Short label describing the metric. */
  label: ReactNode;
  /** Highlighted number, already formatted by the consumer. */
  value: ReactNode;
  /** Small suffix next to the number, e.g. "/12". */
  suffix?: ReactNode;
  /** Optional subtext. */
  description?: ReactNode;
  variant?: KpiVariant;
  className?: string;
}

export function Kpi({
  label,
  value,
  suffix,
  description,
  variant = "default",
  className,
}: KpiProps) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5 bg-surface px-[18px] py-3.5", className)}>
      <span className="font-semibold text-[12px] text-ink-2">{label}</span>
      <span
        className={cn(
          "text-kpi-number tabular-nums",
          variant === "danger" ? "text-danger" : "text-ink",
        )}
      >
        {value}
        {suffix ? (
          <small className="ml-1 font-semibold text-[14px] text-ink-3 tracking-normal">
            {suffix}
          </small>
        ) : null}
      </span>
      {description ? <span className="text-[12px] text-ink-3">{description}</span> : null}
    </div>
  );
}
