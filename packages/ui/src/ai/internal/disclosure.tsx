"use client";

import { ChevronDown } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import { cn } from "../../utils/cn.js";

export interface DisclosureProps {
  /** Always-visible header content (icon, title, status). */
  header: ReactNode;
  children: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  panelClassName?: string;
}

/** Header button + animated panel. Closed content is `inert`, so it leaves the tab order. */
export function Disclosure({
  header,
  children,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  className,
  panelClassName,
}: DisclosureProps) {
  const [state, setState] = useState(defaultOpen);
  const open = openProp ?? state;
  const panelId = useId();
  const toggle = () => {
    if (openProp === undefined) setState(!open);
    onOpenChange?.(!open);
  };
  return (
    <div className={cn("min-w-0", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={toggle}
        className="flex w-full min-w-0 cursor-pointer items-center gap-density-sm rounded-button text-left focus-visible:focus-ring"
      >
        <span className="flex min-w-0 flex-1 items-center gap-density-sm">{header}</span>
        <ChevronDown
          aria-hidden
          className={cn(
            "size-4 shrink-0 text-ink-3 transition-transform duration-(--motion-duration) ease-style",
            open && "rotate-180",
          )}
        />
      </button>
      <div
        id={panelId}
        inert={!open}
        className={cn(
          "grid transition-[grid-template-rows] duration-(--motion-duration) ease-style",
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className={cn("min-h-0 overflow-hidden", panelClassName)}>{children}</div>
      </div>
    </div>
  );
}
