import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../utils/cn.js";

export type NoteTone = "neutral" | "info" | "success" | "warning" | "danger";

const toneClasses: Record<NoteTone, string> = {
  neutral: "text-ink-3",
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

export interface NoteProps extends ComponentPropsWithoutRef<"p"> {
  /** Colors the text. Defaults to `neutral`. */
  tone?: NoteTone;
  /** Hairline above the note, to hang it under a block it explains. */
  divider?: boolean;
}

/**
 * Small annotated text under a block: explains a rule, a caveat or an empty state. Flush to its
 * container's inline edges; tone only changes the text color, so it never carries meaning alone.
 */
export function Note({ tone = "neutral", divider = false, className, ...props }: NoteProps) {
  return (
    <p
      data-tone={tone}
      className={cn(
        "m-0 text-meta",
        divider && "border-t-divider pt-2.5",
        toneClasses[tone],
        className,
      )}
      {...props}
    />
  );
}
