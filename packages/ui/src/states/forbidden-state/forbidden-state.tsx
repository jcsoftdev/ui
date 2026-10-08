import type { ReactNode } from "react";
import { cn } from "../../utils/cn.js";

export interface ForbiddenStateProps {
  title: ReactNode;
  /** Reason for the block, e.g. depending on role; never just "Forbidden". */
  reason?: ReactNode;
  className?: string;
}

export function ForbiddenState({ title, reason, className }: ForbiddenStateProps) {
  return (
    <div
      role="alert"
      className={cn("flex flex-col items-center gap-2 px-6 py-10 text-center", className)}
    >
      <p className="font-semibold text-[14px] text-ink">{title}</p>
      {reason ? <p className="max-w-[42ch] text-[13px] text-ink-3">{reason}</p> : null}
    </div>
  );
}
