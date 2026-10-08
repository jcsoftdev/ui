import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../utils/cn.js";

export type ChipTone =
  | "neutral"
  | "danger"
  | "warning"
  | "success"
  | "accent"
  | "solid"
  | "outline";

const toneClasses: Record<ChipTone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  danger: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-warning",
  success: "bg-success-soft text-success",
  accent: "bg-accent-soft text-accent-ink",
  solid: "bg-accent text-on-accent",
  outline: "bg-transparent text-ink-2 shadow-[inset_0_0_0_1px_var(--line-strong)]",
};

export interface ChipProps extends ComponentPropsWithoutRef<"span"> {
  tone?: ChipTone;
  /** Use the smaller chip radius instead of a full pill. */
  square?: boolean;
}

export function Chip({ tone = "neutral", square, className, ...props }: ChipProps) {
  return (
    <span
      className={cn(
        "inline-flex h-6 max-w-full items-center gap-1.5 overflow-hidden whitespace-nowrap px-2.5 font-[650] text-[12px] leading-none [&_svg]:size-3",
        square ? "rounded-chip" : "rounded-pill",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
