import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "../../utils/cn.js";
import { type StatusTone, statusIcon } from "../internal/status-icons.js";

export type ChipTone =
  | "neutral"
  | "danger"
  | "warning"
  | "success"
  | "accent"
  | "info"
  | "solid"
  | "outline";

/** Class map behind each `tone`; exported so apps can extend or reuse it. */
export const chipToneClasses: Record<ChipTone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  success: "bg-success-soft text-success",
  accent: "bg-accent-soft text-accent-ink",
  info: "bg-info-soft text-info",
  solid: "bg-accent text-on-accent",
  outline: "bg-transparent text-ink-2 shadow-[inset_0_0_0_1px_var(--line-strong)]",
};

export interface ChipProps extends ComponentPropsWithoutRef<"span"> {
  tone?: ChipTone;
  /** Use the smaller chip radius instead of a full pill. */
  square?: boolean;
  /** Leading decorative icon; wins over `statusIcon`. */
  icon?: ReactNode;
  /** Prefix `info`, `success`, `warning` and `danger` chips with their status glyph. */
  statusIcon?: boolean;
}

const statusTones = new Set<ChipTone>(["info", "success", "warning", "danger"]);

export function Chip({
  tone = "neutral",
  square,
  icon,
  statusIcon: withStatusIcon,
  className,
  children,
  ...props
}: ChipProps) {
  const leading =
    icon ??
    (withStatusIcon && statusTones.has(tone) ? statusIcon(tone as StatusTone, "size-3") : null);
  const interactive = props.onClick !== undefined || props.role === "button";
  return (
    <span
      className={cn(
        "inline-flex h-6 max-w-full items-center gap-1.5 overflow-hidden whitespace-nowrap px-2.5 font-[650] text-fs-120 leading-none [&_svg]:size-3",
        square ? "rounded-chip" : "rounded-badge",
        chipToneClasses[tone],
        interactive && "in-data-[density=touch]:min-h-11",
        className,
      )}
      {...props}
    >
      {leading}
      {children}
    </span>
  );
}
