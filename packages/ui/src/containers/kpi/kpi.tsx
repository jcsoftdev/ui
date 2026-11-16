import type { ComponentPropsWithRef, ReactNode } from "react";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { customToneStyle } from "../../utils/tone.js";
import { builtinTones, type KpiPart, type KpiTone, type KpiVariant } from "./kpi-model.js";
import { KpiDescription, KpiLabel, KpiProvider, KpiValue } from "./kpi-parts.js";

export type { KpiBuiltinTone, KpiPart, KpiTone, KpiVariant } from "./kpi-model.js";
export type { KpiDescriptionProps, KpiLabelProps, KpiValueProps } from "./kpi-parts.js";
export { KpiDescription, KpiLabel, KpiValue };

export interface KpiProps extends Omit<ComponentPropsWithRef<"div">, "children"> {
  /** Short label describing the metric. Optional when you compose `Kpi.Label` as children. */
  label?: ReactNode;
  /** Highlighted number, already formatted by the consumer. Optional when you compose `Kpi.Value`. */
  value?: ReactNode;
  /** Small suffix next to the number, e.g. "/12". */
  suffix?: ReactNode;
  /** Optional subtext. */
  description?: ReactNode;
  variant?: KpiVariant;
  /** Colours the value and the label dot. Wins over `variant`. */
  tone?: KpiTone;
  /** Leading dot on the label, in the tone's colour. */
  dot?: boolean;
  /** Decorative icon at the end of the label row (`aria-hidden`). */
  icon?: ReactNode;
  /** Interactive or labelled content at the end of the label row (a menu, a link); not hidden from assistive tech. */
  trailing?: ReactNode;
  /** Change indicator next to the value, e.g. a `TrendChip`. */
  trend?: ReactNode;
  /** Draws the tile as a card: border and radius. Off by default, so tiles in a `KpiGroup` stay flush. */
  card?: boolean;
  /**
   * Compose the tile from `Kpi.Label`, `Kpi.Value` and `Kpi.Description` instead of (or after)
   * the props. They are laid out in the tile's column in the order written.
   */
  children?: ReactNode;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<KpiPart>;
}

/**
 * One metric: a label, a big number and an optional description. Fill it with props, or compose
 * `Kpi.Label`, `Kpi.Value` and `Kpi.Description` as children when the parts need their own
 * slots (a menu beside the label, a monospaced amount). `card` adds a border and radius.
 */
export function Kpi({
  label,
  value,
  suffix,
  description,
  variant = "default",
  tone: toneProp,
  dot = false,
  icon,
  trailing,
  trend,
  card = false,
  children,
  className,
  classNames,
  style,
  ...props
}: KpiProps) {
  const tone: KpiTone = toneProp ?? (variant === "danger" ? "danger" : "neutral");
  return (
    <KpiProvider tone={tone} dot={dot} classNames={classNames}>
      <div
        {...props}
        style={customToneStyle(tone, builtinTones, style)}
        className={cn(
          "@container/kpi flex min-w-0 flex-col gap-0.5 bg-surface px-4.5 py-3.5",
          card && "rounded-card border border-line",
          classNames?.root,
          className,
        )}
      >
        {label !== undefined ? (
          <KpiLabel icon={icon} trailing={trailing}>
            {label}
          </KpiLabel>
        ) : null}
        {value !== undefined ? (
          <KpiValue suffix={suffix} trend={trend}>
            {value}
          </KpiValue>
        ) : null}
        {description ? <KpiDescription>{description}</KpiDescription> : null}
        {children}
      </div>
    </KpiProvider>
  );
}

Kpi.Label = KpiLabel;
Kpi.Value = KpiValue;
Kpi.Description = KpiDescription;
