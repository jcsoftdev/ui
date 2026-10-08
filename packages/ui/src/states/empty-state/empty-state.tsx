import type { ReactNode } from "react";
import { cn } from "../../utils/cn.js";

export interface EmptyStateProps {
  /** Decorative icon; hidden from screen readers. */
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Primary call to action. */
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center gap-2 px-6 py-12 text-center", className)}>
      {icon ? (
        <span aria-hidden="true" className="text-ink-3">
          {icon}
        </span>
      ) : null}
      <p className="font-semibold text-[14px] text-ink">{title}</p>
      {description ? <p className="max-w-[42ch] text-[13px] text-ink-3">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
