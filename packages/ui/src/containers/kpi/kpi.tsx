import type { ComponentPropsWithoutRef, ReactNode } from "react";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";

export type KpiVariant = "default" | "danger";

export type KpiPart = "root" | "label" | "value" | "suffix" | "description";

export interface KpiProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  /** Short label describing the metric. */
  label: ReactNode;
  /** Highlighted number, already formatted by the consumer. */
  value: ReactNode;
  /** Small suffix next to the number, e.g. "/12". */
  suffix?: ReactNode;
  /** Optional subtext. */
  description?: ReactNode;
  variant?: KpiVariant;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<KpiPart>;
}

export function Kpi({
  label,
  value,
  suffix,
  description,
  variant = "default",
  className,
  classNames,
  ...props
}: KpiProps) {
  return (
    <div
      {...props}
      className={cn(
        "@container/kpi flex min-w-0 flex-col gap-0.5 bg-surface px-4.5 py-3.5",
        classNames?.root,
        className,
      )}
    >
      <span className={cn("break-words font-semibold text-fs-120 text-ink-2", classNames?.label)}>
        {label}
      </span>
      <span
        className={cn(
          "break-words text-kpi-number tabular-nums @max-[9rem]/kpi:text-fs-220",
          variant === "danger" ? "text-danger" : "text-ink",
          classNames?.value,
        )}
      >
        {value}
        {suffix ? (
          <small
            className={cn(
              "ml-1 font-semibold text-fs-140 text-ink-3 tracking-normal",
              classNames?.suffix,
            )}
          >
            {suffix}
          </small>
        ) : null}
      </span>
      {description ? (
        <span className={cn("break-words text-fs-120 text-ink-3", classNames?.description)}>
          {description}
        </span>
      ) : null}
    </div>
  );
}
