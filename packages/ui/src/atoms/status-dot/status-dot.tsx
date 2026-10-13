import type { ComponentPropsWithRef } from "react";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { customToneStyle, isCustomTone } from "../../utils/tone.js";

export type StatusDotBuiltinTone = "danger" | "warning" | "success" | "accent" | "neutral";

/** A built-in tone, or the name of a tone declared in `tonePalettes`. */
export type StatusDotTone = StatusDotBuiltinTone | (string & {});

const toneClasses: Record<StatusDotBuiltinTone, string> = {
  danger: "bg-danger",
  warning: "bg-warning",
  success: "bg-success",
  accent: "bg-accent",
  neutral: "bg-ink-3",
};

const builtinTones = new Set<string>(Object.keys(toneClasses));

export type StatusDotShape = "dot" | "square";

const shapeClasses: Record<StatusDotShape, string> = {
  dot: "size-1.5 rounded-pill",
  square: "size-2.25 rounded-xs",
};

export type StatusDotPart = "root" | "dot" | "label";

export interface StatusDotProps extends Omit<ComponentPropsWithRef<"span">, "children"> {
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<StatusDotPart>;
  tone: StatusDotTone;
  /** Text describing the status: color is never the only signal. */
  label: string;
  showLabel?: boolean;
  shape?: StatusDotShape;
  /** Hollow variant: transparent fill with an accent inner ring. */
  hollow?: boolean;
}

export function StatusDot({
  tone,
  label,
  showLabel,
  shape = "dot",
  hollow,
  className,
  classNames,
  style,
  ...props
}: StatusDotProps) {
  return (
    <span
      {...props}
      style={customToneStyle(tone, builtinTones, style)}
      className={cn("inline-flex max-w-full items-center gap-1.5", classNames?.root, className)}
    >
      <span
        aria-hidden="true"
        className={cn(
          "shrink-0",
          shapeClasses[shape],
          hollow
            ? "bg-transparent shadow-[inset_0_0_0_2px_var(--accent)]"
            : isCustomTone(tone, builtinTones)
              ? "bg-(--tone-c)"
              : (toneClasses[tone as StatusDotBuiltinTone] ?? toneClasses.neutral),
          classNames?.dot,
        )}
      />
      <span className={cn(showLabel ? "min-w-0 truncate" : "sr-only", classNames?.label)}>
        {label}
      </span>
    </span>
  );
}
