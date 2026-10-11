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
      className={cn(
        "@container/state flex min-w-0 flex-col items-center gap-2 px-4 py-8 text-center @min-[360px]/state:px-6 @min-[360px]/state:py-10",
        className,
      )}
    >
      <p className="max-w-full font-semibold text-fs-140 text-ink [overflow-wrap:anywhere]">
        {title}
      </p>
      {reason ? (
        <p className="max-w-[42ch] text-fs-130 text-ink-3 [overflow-wrap:anywhere]">{reason}</p>
      ) : null}
    </div>
  );
}
