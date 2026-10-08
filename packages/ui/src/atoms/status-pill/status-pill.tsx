"use client";

import { cn } from "../../utils/cn.js";
import { Led, type LedStatus } from "../led/index.js";

export interface StatusPillProps {
  status: LedStatus;
  label: string;
  /** Without this the pill is decorative (disabled). */
  onSelect?: () => void;
  className?: string;
}

/** Pill showing a status LED and its label; the label is hidden when the surrounding container (e.g. the topbar) is narrow. */
export function StatusPill({ status, label, onSelect, className }: StatusPillProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!onSelect}
      className={cn(
        "flex h-control-sm shrink-0 items-center gap-1.5 whitespace-nowrap rounded-badge border-divider bg-surface-control px-2.5 font-semibold text-[12px] text-ink-2 hover:enabled:border-line-strong disabled:cursor-default",
        className,
      )}
    >
      <Led status={status} label={label} />
      <span aria-hidden="true" className="@max-[700px]:hidden">
        {label}
      </span>
    </button>
  );
}
