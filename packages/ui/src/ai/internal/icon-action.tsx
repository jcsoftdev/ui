import type { ComponentPropsWithRef } from "react";
import { intentAttributes } from "../../intent/attributes.js";
import type { IntentProps } from "../../intent/types.js";
import { cn } from "../../utils/cn.js";

export interface IconActionProps extends ComponentPropsWithRef<"button">, IntentProps {
  /** Accessible name; the icon alone carries no text. */
  label: string;
}

/** Square ghost icon button used by the AI set (copy, regenerate, remove…). */
export function IconAction({
  label,
  className,
  children,
  intent,
  intentKey,
  ...props
}: IconActionProps) {
  return (
    <button
      {...intentAttributes({ intent, intentKey })}
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-grid size-7 shrink-0 cursor-pointer place-items-center rounded-button text-ink-3 pressable hover:bg-surface-2 hover:text-ink focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:bg-accent-soft aria-pressed:text-accent-ink [&_svg]:size-3.5",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
