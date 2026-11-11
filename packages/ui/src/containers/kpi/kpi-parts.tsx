"use client";

import {
  type ComponentPropsWithRef,
  createContext,
  type ReactElement,
  type ReactNode,
  useContext,
} from "react";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { isCustomTone } from "../../utils/tone.js";
import {
  builtinTones,
  dotToneClasses,
  type KpiBuiltinTone,
  type KpiPart,
  type KpiTone,
  valueToneClasses,
} from "./kpi-model.js";

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

export interface KpiProviderProps extends KpiContextValue {
  children: ReactNode;
}

export function KpiProvider({ children, ...value }: KpiProviderProps): ReactElement {
  return <KpiContext.Provider value={value}>{children}</KpiContext.Provider>;
}

export interface KpiLabelProps extends ComponentPropsWithRef<"span"> {
  icon?: ReactNode;
  trailing?: ReactNode;
  dot?: boolean;
}

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

export interface KpiValueProps extends ComponentPropsWithRef<"span"> {
  suffix?: ReactNode;
  trend?: ReactNode;
  mono?: boolean;
}

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

export interface KpiDescriptionProps extends ComponentPropsWithRef<"span"> {}

export function KpiDescription({ className, ...props }: KpiDescriptionProps) {
  const { classNames } = useContext(KpiContext);
  return (
    <span
      {...props}
      className={cn("break-words text-fs-120 text-ink-3", classNames?.description, className)}
    />
  );
}
