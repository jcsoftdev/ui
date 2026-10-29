import { type ComponentPropsWithoutRef, createContext, type ReactNode, useContext } from "react";
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
  | "trailing"
  | "value"
  | "suffix"
  | "trend"
  | "description";

interface KpiContextValue {
  tone: KpiTone;
  dot: boolean;
  classNames: ClassNames<KpiPart> | undefined;
}

const KpiContext = createContext<KpiContextValue>({
  tone: "neutral",
  dot: false,
  classNames: undefined,
});

export interface KpiProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
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

export interface KpiLabelProps extends ComponentPropsWithoutRef<"span"> {
  /** Decorative icon at the end of the row (`aria-hidden`). */
  icon?: ReactNode;
  /** Interactive or labelled content at the end of the row. */
  trailing?: ReactNode;
  /** Overrides the tile's `dot`. */
  dot?: boolean;
}

/** Label row of a composed `Kpi`: the label, then an optional icon and trailing slot at the end. */
export function KpiLabel({
  icon,
  trailing,
  dot: dotProp,
  className,
  children,
  ...props
}: KpiLabelProps) {
  const { tone, dot: tileDot, classNames } = useContext(KpiContext);
  const dot = dotProp ?? tileDot;
  const dotTone = isCustomTone(tone, builtinTones)
    ? "bg-(--tone-c)"
    : (dotToneClasses[tone as KpiBuiltinTone] ?? dotToneClasses.neutral);
  const labelNode = (
    <span
      {...props}
      className={cn(
        "min-w-0 break-words font-semibold text-fs-120 text-ink-2",
        dot && "inline-flex items-center gap-1.5",
        classNames?.label,
        className,
      )}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className={cn("size-1.5 shrink-0 rounded-pill", dotTone, classNames?.dot)}
        />
      ) : null}
      {children}
    </span>
  );
  if (!icon && !trailing) return labelNode;
  return (
    <div className={cn("flex items-center justify-between gap-2", classNames?.header)}>
      {labelNode}
      <span className="flex shrink-0 items-center gap-1.5">
        {icon ? (
          <span
            aria-hidden="true"
            className={cn("shrink-0 text-ink-3 [&_svg]:size-4", classNames?.icon)}
          >
            {icon}
          </span>
        ) : null}
        {trailing ? <span className={cn("shrink-0", classNames?.trailing)}>{trailing}</span> : null}
      </span>
    </div>
  );
}

export interface KpiValueProps extends ComponentPropsWithoutRef<"span"> {
  /** Small suffix next to the number. */
  suffix?: ReactNode;
  /** Change indicator next to the value. */
  trend?: ReactNode;
  /** Monospaced digits at a steady weight, for amounts and codes. */
  mono?: boolean;
}

/** The highlighted number of a composed `Kpi`, coloured by the tile's tone. */
export function KpiValue({ suffix, trend, mono, className, children, ...props }: KpiValueProps) {
  const { tone, classNames } = useContext(KpiContext);
  const valueTone = isCustomTone(tone, builtinTones)
    ? "text-(--tone-c-ink)"
    : (valueToneClasses[tone as KpiBuiltinTone] ?? valueToneClasses.neutral);
  const valueNode = (
    <span
      {...props}
      className={cn(
        "break-words text-kpi-number tabular-nums @max-[9rem]/kpi:text-fs-200",
        mono && "font-mono tracking-normal",
        valueTone,
        classNames?.value,
        className,
      )}
    >
      {children}
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
  if (!trend) return valueNode;
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
      {valueNode}
      <span className={cn("shrink-0", classNames?.trend)}>{trend}</span>
    </div>
  );
}

export interface KpiDescriptionProps extends ComponentPropsWithoutRef<"span"> {}

export function KpiDescription({ className, ...props }: KpiDescriptionProps) {
  const { classNames } = useContext(KpiContext);
  return (
    <span
      {...props}
      className={cn("break-words text-fs-120 text-ink-3", classNames?.description, className)}
    />
  );
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
    <KpiContext.Provider value={{ tone, dot, classNames }}>
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
    </KpiContext.Provider>
  );
}

Kpi.Label = KpiLabel;
Kpi.Value = KpiValue;
Kpi.Description = KpiDescription;
