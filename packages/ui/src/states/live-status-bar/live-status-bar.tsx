"use client";

import type { ComponentPropsWithoutRef } from "react";
import { useUiStrings } from "../../i18n/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";

export type LiveStatus = "live" | "reconnecting" | "offline";

export type LiveStatusBarPart = "root" | "indicator" | "label";

const dotClasses: Record<LiveStatus, string> = {
  live: "bg-success",
  reconnecting: "animate-pulse bg-warning motion-reduce:animate-none",
  offline: "bg-danger",
};

export interface LiveStatusBarProps extends Omit<ComponentPropsWithoutRef<"div">, "role"> {
  status: LiveStatus;
  /** Replaces the localized text of a status, e.g. `{ live: "Connected" }`. */
  labels?: Partial<Record<LiveStatus, string>>;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<LiveStatusBarPart>;
}

/**
 * Connection status for a realtime view: a colored dot plus its text, and `children` for what
 * the view shows next to it (counts, a last-update time). A polite `role="status"`, so a change
 * of `status` is announced without interrupting. Meaning never relies on color alone.
 */
export function LiveStatusBar({
  status,
  labels,
  className,
  classNames,
  children,
  ...props
}: LiveStatusBarProps) {
  const strings = useUiStrings();
  const text = labels?.[status] ?? strings[status];
  return (
    <div
      role="status"
      data-status={status}
      className={cn(
        "flex flex-wrap items-center gap-x-4 gap-y-1 rounded-card bg-surface-2 px-3.5 py-2.5 text-control",
        classNames?.root,
        className,
      )}
      {...props}
    >
      <span className={cn("inline-flex items-center gap-2 font-semibold", classNames?.label)}>
        <span
          aria-hidden="true"
          className={cn("size-2.5 rounded-pill", dotClasses[status], classNames?.indicator)}
        />
        {text}
      </span>
      {children}
    </div>
  );
}
