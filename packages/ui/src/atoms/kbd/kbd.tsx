import type { ComponentPropsWithRef } from "react";
import { cn } from "../../utils/cn.js";

export type KbdProps = ComponentPropsWithRef<"kbd">;

/**
 * A keyboard key or shortcut hint (`⌘K`, `Esc`). Purely presentational: put it next to the
 * action's label, never as the only way to tell what a control does.
 */
export function Kbd({ className, ...props }: KbdProps) {
  return (
    <kbd
      {...props}
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-xs border-divider bg-surface-2 px-1.25 py-0.5 font-mono text-count text-ink-2",
        className,
      )}
    />
  );
}
