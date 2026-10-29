"use client";

import type { ComponentPropsWithRef, ReactNode } from "react";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { Led, type LedStatus } from "../led/index.js";

export type StatusPillPart = "root" | "icon" | "dot" | "label";

export interface StatusPillProps
  extends Omit<ComponentPropsWithRef<"button">, "children" | "onSelect"> {
  status: LedStatus;
  label: string;
  /** Decorative leading icon, hidden from screen readers; the label still names the status. */
  icon?: ReactNode;
  /** Without this the pill is decorative (disabled). */
  onSelect?: () => void;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<StatusPillPart>;
}

/** Pill showing a status LED and its label; the label is hidden when the surrounding container (e.g. the topbar) is narrow. */
export function StatusPill({
  status,
  label,
  icon,
  onSelect,
  className,
  classNames,
  ...props
}: StatusPillProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!onSelect}
      {...props}
      className={cn(
        "flex h-control-sm shrink-0 items-center gap-1.5 whitespace-nowrap rounded-badge border-divider bg-surface-control px-2.5 font-semibold text-fs-120 text-ink-2 hover:enabled:border-line-strong disabled:cursor-default",
        classNames?.root,
        className,
      )}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className={cn("inline-flex shrink-0 [&_svg]:size-3.5", classNames?.icon)}
        >
          {icon}
        </span>
      ) : null}
      <Led status={status} label={label} classNames={{ dot: classNames?.dot }} />
      <span aria-hidden="true" className={cn("@max-[700px]:hidden", classNames?.label)}>
        {label}
      </span>
    </button>
  );
}
