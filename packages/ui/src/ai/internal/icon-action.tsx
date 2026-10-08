import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../utils/cn.js";

export interface IconActionProps extends ComponentPropsWithoutRef<"button"> {
  /** Accessible name; the icon alone carries no text. */
  label: string;
}

/** Square ghost icon button used by the AI set (copy, regenerate, remove…). */
export function IconAction({ label, className, children, ...props }: IconActionProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-grid size-7 shrink-0 cursor-pointer place-items-center rounded-button text-ink-3 pressable hover:bg-surface-2 hover:text-ink focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-45 aria-pressed:bg-accent-soft aria-pressed:text-accent-ink [&_svg]:size-3.5",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
