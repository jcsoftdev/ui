import type { ComponentPropsWithoutRef } from "react";
import { cn } from "../../utils/cn.js";

export type BigDateSize = "normal" | "compact";

const sizeClasses: Record<BigDateSize, string> = {
  normal: "text-fs-240",
  compact: "text-fs-200",
};

export interface BigDateProps extends ComponentPropsWithoutRef<"div"> {
  size?: BigDateSize;
}

/** Prominent date or number, typically at the top of a card. */
export function BigDate({ size = "normal", className, ...props }: BigDateProps) {
  return (
    <div
      className={cn("font-[720] leading-[1.1] tracking-[-0.025em]", sizeClasses[size], className)}
      {...props}
    />
  );
}
