import type { ComponentPropsWithoutRef, ReactNode } from "react";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { customToneStyle, isCustomTone } from "../../utils/tone.js";

export type KpiVariant = "default" | "danger";

export type KpiBuiltinTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

/** A built-in tone, or the name of a tone declared in `tonePalettes`. */
export type KpiTone = KpiBuiltinTone | (string & {});

const valueToneClasses: Record<KpiBuiltinTone, string> = {
  neutral: "text-ink",
  accent: "text-accent-ink",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
};

const dotToneClasses: Record<KpiBuiltinTone, string> = {
  neutral: "bg-ink-3",
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
};

const builtinTones = new Set<string>(Object.keys(valueToneClasses));

export type KpiPart =
  | "root"
  | "header"
  | "label"
  | "dot"
  | "icon"
  | "value"
  | "suffix"
  | "trend"
  | "description";

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
  /** Colours the value and the label dot. Wins over `variant`. */
  tone?: KpiTone;
  /** Leading dot on the label, in the tone's colour. */
  dot?: boolean;
  /** Icon at the end of the label row. */
  icon?: ReactNode;
  /** Change indicator next to the value, e.g. a `TrendChip`. */
  trend?: ReactNode;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<KpiPart>;
}

export function Kpi({
  label,
  value,
  suffix,
  description,
  variant = "default",
  tone: toneProp,
  dot,
  icon,
  trend,
  className,
  classNames,
  style,
  ...props
}: KpiProps) {
  const tone: KpiTone = toneProp ?? (variant === "danger" ? "danger" : "neutral");
  const custom = isCustomTone(tone, builtinTones);
  const valueTone = custom
    ? "text-(--tone-c-ink)"
    : (valueToneClasses[tone as KpiBuiltinTone] ?? valueToneClasses.neutral);
  const dotTone = custom
    ? "bg-(--tone-c)"
    : (dotToneClasses[tone as KpiBuiltinTone] ?? dotToneClasses.neutral);
  const labelNode = (
    <span
      className={cn(
        "break-words font-semibold text-fs-120 text-ink-2",
        dot && "inline-flex items-center gap-1.5",
        classNames?.label,
      )}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className={cn("size-1.5 shrink-0 rounded-pill", dotTone, classNames?.dot)}
        />
      ) : null}
      {label}
    </span>
  );
  const valueNode = (
    <span
      className={cn(
        "break-words text-kpi-number tabular-nums @max-[9rem]/kpi:text-fs-220",
        valueTone,
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
  );
  return (
    <div
      {...props}
      style={customToneStyle(tone, builtinTones, style)}
      className={cn(
        "@container/kpi flex min-w-0 flex-col gap-0.5 bg-surface px-4.5 py-3.5",
        classNames?.root,
        className,
      )}
    >
      {icon ? (
        <div className={cn("flex items-center justify-between gap-2", classNames?.header)}>
          {labelNode}
          <span
            aria-hidden="true"
            className={cn("shrink-0 text-ink-3 [&_svg]:size-4", classNames?.icon)}
          >
            {icon}
          </span>
        </div>
      ) : (
        labelNode
      )}
      {trend ? (
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          {valueNode}
          <span className={cn("shrink-0", classNames?.trend)}>{trend}</span>
        </div>
      ) : (
        valueNode
      )}
      {description ? (
        <span className={cn("break-words text-fs-120 text-ink-3", classNames?.description)}>
          {description}
        </span>
      ) : null}
    </div>
  );
}
