import type { ComponentPropsWithRef } from "react";
import { cn } from "../../utils/cn.js";

export interface LabelProps extends ComponentPropsWithRef<"label"> {}

export function Label({ className, ...props }: LabelProps) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: htmlFor and children arrive via ...props
    <label className={cn("font-semibold text-ink-2 text-meta", className)} {...props} />
  );
}
