import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../utils/cn.js";

export type HighlightLineProps = ComponentPropsWithoutRef<"p">;

/**
 * Focus sentence at the top of a card; wrap the key phrase in `<strong>` to
 * emphasize it. It only paints the text, it computes nothing.
 */
export function HighlightLine({ className, ...props }: HighlightLineProps) {
  return (
    <p
      className={cn("mb-3.5 max-w-[70ch] text-lede text-ink-2 [&_strong]:text-ink", className)}
      {...props}
    />
  );
}
