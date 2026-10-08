import type { ComponentPropsWithoutRef, ReactNode } from "react";
import type { NumberFormatConfig } from "../../atoms/number-value/format.js";
import { NumberValue } from "../../atoms/number-value/number-value.js";
import { TrendChip } from "../../atoms/trend-chip/trend-chip.js";
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

export interface KpiGroupProps extends Omit<ComponentPropsWithoutRef<"dl">, "children"> {
  items: KpiGroupItem[];
  /** Animate numeric values counting up. */
  animate?: boolean;
}

/**
 * Metrics that belong together in one card, divided by hairlines. Columns follow the
 * container width: 1, 2 or 4 across.
 */
export function KpiGroup({ items, animate = true, className, ...props }: KpiGroupProps) {
  return (
    <div className={cn("@container/kpi-group min-w-0", className)}>
      <dl
        className="m-0 grid grid-cols-1 gap-px overflow-hidden rounded-card border-card bg-divider shadow-card @sm/kpi-group:grid-cols-2 @3xl/kpi-group:grid-cols-4"
        {...props}
      >
        {items.map((item) => (
          <div key={item.id} className="surface-card flex min-w-0 flex-col gap-density-sm p-card">
            <dt className="truncate font-semibold text-ink-2 text-meta">{item.label}</dt>
            <dd className="m-0 flex min-w-0 flex-col gap-density-sm">
              <span className="break-words text-kpi-number text-ink tabular-nums">
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
                  className="w-fit"
                />
              ) : null}
              {item.description ? (
                <span className="break-words text-ink-3 text-meta">{item.description}</span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
