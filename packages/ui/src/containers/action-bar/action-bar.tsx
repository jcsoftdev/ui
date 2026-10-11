"use client";

import type { ComponentPropsWithoutRef, KeyboardEvent, ReactNode } from "react";
import { X } from "../../icons/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";

export type ActionBarPart = "root" | "count" | "actions" | "clear";

export interface ActionBarProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  /** Number of selected items. The bar renders nothing while it is 0. */
  selectedCount: number;
  /** Singular and plural noun for the live count, e.g. ["cita", "citas"]. */
  noun?: [singular: string, plural: string];
  /** Clears the selection (close button and Escape). */
  onClear?: () => void;
  /** Bulk actions, usually Buttons. */
  children?: ReactNode;
  /**
   * `fixed` floats over the viewport; `absolute` floats inside the nearest positioned
   * ancestor (a card, a table wrapper); `static` renders inline.
   */
  position?: "fixed" | "absolute" | "static";
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root. */
  classNames?: ClassNames<ActionBarPart>;
}

const positionClasses = {
  fixed: "fixed inset-x-0 bottom-4 mx-auto",
  absolute: "absolute inset-x-0 bottom-4 mx-auto",
  static: "relative",
} as const;

/** Floating toolbar for bulk actions on a selection. Announces the count politely. */
export function ActionBar({
  selectedCount,
  noun = ["seleccionado", "seleccionados"],
  onClear,
  children,
  position = "absolute",
  className,
  classNames,
  onKeyDown,
  ...props
}: ActionBarProps) {
  if (selectedCount <= 0) return null;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.key === "Escape" && onClear) {
      event.stopPropagation();
      onClear();
    }
  };

  return (
    <div
      role="toolbar"
      aria-label="Acciones para la selección"
      onKeyDown={handleKeyDown}
      className={cn(
        "@container/action-bar z-40 flex w-fit max-w-[calc(100%-1rem)] flex-wrap items-center gap-density rounded-popover border-card surface-overlay bg-surface-overlay px-control-x py-density-sm shadow-overlay",
        positionClasses[position],
        className,
        classNames?.root,
      )}
      {...props}
    >
      <span
        aria-live="polite"
        className={cn("whitespace-nowrap font-semibold text-control text-ink", classNames?.count)}
      >
        {selectedCount} {selectedCount === 1 ? noun[0] : noun[1]}
      </span>
      <div
        className={cn("flex min-w-0 flex-wrap items-center gap-density-sm", classNames?.actions)}
      >
        {children}
      </div>
      {onClear ? (
        <button
          type="button"
          aria-label="Limpiar selección"
          onClick={onClear}
          className={cn(
            "pressable inline-flex size-control-sm cursor-pointer items-center justify-center rounded-button text-ink-2 hover:bg-surface-2 hover:text-ink focus-visible:focus-ring",
            classNames?.clear,
          )}
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
