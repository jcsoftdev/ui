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
  /** Makes the pill a button. Without it, and without `onClick`, the pill is a plain `span`. */
  onSelect?: () => void;
  /**
   * Forces the element: `true` renders a button even without a handler, `false` a `span` even
   * with one. Omitted, the pill is a button only when `onSelect` or `onClick` is given.
   */
  interactive?: boolean;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<StatusPillPart>;
}

/** Pill showing a status LED and its label; the label is hidden when the surrounding container (e.g. the topbar) is narrow. */
export function StatusPill({
  status,
  label,
  icon,
  onSelect,
  interactive,
  className,
  classNames,
  ...props
}: StatusPillProps) {
  const isButton = interactive ?? (onSelect !== undefined || props.onClick !== undefined);
  const rootClass = cn(
    "flex h-control-sm shrink-0 items-center gap-1.5 whitespace-nowrap rounded-badge border-divider bg-surface-control px-2.5 font-semibold text-fs-120 text-ink-2",
    isButton && "hover:enabled:border-line-strong disabled:cursor-default",
    classNames?.root,
    className,
  );
  const content = (
    <>
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
    </>
  );
  if (!isButton) {
    const { ref, type: _type, disabled: _disabled, onClick: _onClick, ...rest } = props;
    return (
      <span {...(rest as ComponentPropsWithRef<"span">)} ref={ref as never} className={rootClass}>
        {content}
      </span>
    );
  }
  return (
    <button type="button" onClick={onSelect} {...props} className={rootClass}>
      {content}
    </button>
  );
}
