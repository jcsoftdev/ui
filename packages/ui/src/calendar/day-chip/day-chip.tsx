import type { ComponentPropsWithRef } from "react";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import type { CalendarMarker } from "../internal/types.js";

/** Class map behind each marker `tone`; exported so apps can extend or reuse it. */
export const dayChipToneClasses: Record<NonNullable<CalendarMarker["tone"]>, string> = {
  danger: "bg-danger text-surface",
  accent: "bg-accent-soft text-accent-ink shadow-inset-accent",
};

export type DayChipPart = "root" | "subtitle";

export interface DayChipProps
  extends Omit<ComponentPropsWithRef<"button">, "children" | "title" | "onClick"> {
  marker: CalendarMarker;
  onOpen?: (id: string) => void;
  className?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root. */
  classNames?: ClassNames<DayChipPart>;
}

/** Compact single-line chip for a day marker. */
export function DayChip({ marker, onOpen, className, classNames, ...props }: DayChipProps) {
  return (
    <button
      type="button"
      onClick={onOpen ? () => onOpen(marker.id) : undefined}
      {...props}
      className={cn(
        "block w-full truncate rounded-xs px-1.5 py-0.5 text-left text-chip-text",
        dayChipToneClasses[marker.tone ?? "accent"],
        className,
        classNames?.root,
      )}
    >
      {marker.srLabel ? <span className="sr-only">{marker.srLabel} </span> : null}
      {marker.title}
      {marker.subtitle ? (
        <span className={cn("font-normal", classNames?.subtitle)}> · {marker.subtitle}</span>
      ) : null}
    </button>
  );
}
