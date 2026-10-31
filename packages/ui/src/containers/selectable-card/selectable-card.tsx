"use client";

import { type ComponentPropsWithRef, type MouseEvent, type ReactNode, useId } from "react";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";

export type SelectableCardPart = "root" | "content" | "reason";

export interface SelectableCardProps
  extends Omit<ComponentPropsWithRef<"button">, "children" | "role" | "aria-checked"> {
  /** Card content. It sits inside a button, so use phrasing content only (spans, text, icons). */
  children: ReactNode;
  /**
   * Selectable mode. Omitted: the card is a plain button that runs `onClick`. A boolean makes it
   * a toggle (`aria-pressed`), or a radio (`aria-checked`) with `semantics="radio"`.
   */
  selected?: boolean;
  /** `"pressed"` for a toggle (default), `"radio"` when exactly one card of a group is selected; wrap the group in `role="radiogroup"`. */
  semantics?: "pressed" | "radio";
  /** The card stays focusable and ignores clicks (`aria-disabled`), and the reason is read out with it. */
  disabled?: boolean;
  /** Visible text explaining why the card is disabled; announced as its description. */
  disabledReason?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<SelectableCardPart>;
}

/**
 * A card that is itself the interactive element: one `button`, no overlay and no nested
 * controls. Use it as a button (`onClick`) or as a selectable option (`selected`). A disabled card
 * keeps focus so its reason can be reached.
 */
export function SelectableCard({
  children,
  selected,
  semantics = "pressed",
  disabled = false,
  disabledReason,
  onClick,
  className,
  classNames,
  "aria-describedby": describedBy,
  ...props
}: SelectableCardProps) {
  const reasonId = useId();
  const showReason = disabled && Boolean(disabledReason);
  const radio = semantics === "radio" && selected !== undefined;
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (disabled) {
      event.preventDefault();
      return;
    }
    onClick?.(event);
  };
  return (
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-checked is only set together with role="radio"
    <button
      type="button"
      {...props}
      role={radio ? "radio" : undefined}
      aria-checked={radio ? selected : undefined}
      aria-pressed={!radio && selected !== undefined ? selected : undefined}
      aria-disabled={disabled || undefined}
      aria-describedby={
        [describedBy, showReason ? reasonId : undefined].filter(Boolean).join(" ") || undefined
      }
      onClick={handleClick}
      className={cn(
        "pressable flex w-full min-w-0 flex-col gap-1 rounded-card border-card p-card text-left shadow-card surface-card focus-visible:focus-ring",
        selected && "border-accent-line bg-accent-soft shadow-selected",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
        classNames?.root,
        className,
      )}
    >
      <span className={cn("flex min-w-0 flex-col gap-1", classNames?.content)}>{children}</span>
      {showReason ? (
        <span id={reasonId} className={cn("text-ink-3 text-meta", classNames?.reason)}>
          {disabledReason}
        </span>
      ) : null}
    </button>
  );
}
