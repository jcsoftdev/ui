import type { ComponentPropsWithoutRef, ReactNode } from "react";
import type { NumberFormatConfig } from "../../atoms/number-value/format.js";
import { NumberValue } from "../../atoms/number-value/number-value.js";
import { TrendChip } from "../../atoms/trend-chip/trend-chip.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";

export interface KpiGroupItem {
  id: string;
  label: ReactNode;
  /** A number is formatted (and animated) with `format`; a node is shown as is. */
  value: number | ReactNode;
  format?: NumberFormatConfig;
  /** Change in percent; renders a TrendChip. */
  trend?: number;
  trendLabel?: string;
  /** Lower is better for this metric. */
  invertTrend?: boolean;
  description?: ReactNode;
}

export type KpiGroupPart = "root" | "list" | "item" | "label" | "value" | "trend" | "description";

export interface KpiGroupProps extends Omit<ComponentPropsWithoutRef<"dl">, "children"> {
  items: KpiGroupItem[];
  /** Animate numeric values counting up. */
  animate?: boolean;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root wrapper. */
  classNames?: ClassNames<KpiGroupPart>;
}

/**
 * Metrics that belong together in one card, divided by hairlines. Columns follow the
 * container width: 1, 2 or 4 across.
 */
export function KpiGroup({
  items,
  animate = true,
  className,
  classNames,
  ...props
}: KpiGroupProps) {
  return (
    <div className={cn("@container/kpi-group min-w-0", className, classNames?.root)}>
      <dl
        {...props}
        className={cn(
          "m-0 grid grid-cols-1 gap-px overflow-hidden rounded-card border-card bg-divider shadow-card @sm/kpi-group:grid-cols-2 @3xl/kpi-group:grid-cols-4",
          classNames?.list,
        )}
      >
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "surface-card flex min-w-0 flex-col gap-density-sm p-card",
              classNames?.item,
            )}
          >
            <dt className={cn("truncate font-semibold text-ink-2 text-meta", classNames?.label)}>
              {item.label}
            </dt>
            <dd className="m-0 flex min-w-0 flex-col gap-density-sm">
              <span
                className={cn(
                  "break-words text-kpi-number text-ink tabular-nums",
                  classNames?.value,
                )}
              >
                {typeof item.value === "number" ? (
                  <NumberValue
                    value={item.value}
                    format={item.format}
                    duration={animate ? 900 : 0}
                    animateOnMount={animate}
                  />
                ) : (
                  item.value
                )}
              </span>
              {item.trend !== undefined ? (
                <TrendChip
                  value={item.trend}
                  invert={item.invertTrend}
                  label={item.trendLabel}
                  className={cn("w-fit", classNames?.trend)}
                />
              ) : null}
              {item.description ? (
                <span className={cn("break-words text-ink-3 text-meta", classNames?.description)}>
                  {item.description}
                </span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
