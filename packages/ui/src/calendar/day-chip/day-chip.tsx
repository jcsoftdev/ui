import { cn } from "../../utils/cn.js";
import type { CalendarMarker } from "../internal/types.js";

const TONE: Record<NonNullable<CalendarMarker["tone"]>, string> = {
  danger: "bg-danger text-on-accent",
  accent: "bg-accent-soft text-accent-ink shadow-inset-accent",
};

export interface DayChipProps {
  marker: CalendarMarker;
  onOpen?: (id: string) => void;
  className?: string;
}

/** Compact single-line chip for a day marker. */
export function DayChip({ marker, onOpen, className }: DayChipProps) {
  return (
    <button
      type="button"
      onClick={onOpen ? () => onOpen(marker.id) : undefined}
      className={cn(
        "block w-full truncate rounded-xs px-1.5 py-0.5 text-left text-chip-text",
        TONE[marker.tone ?? "accent"],
        className,
      )}
    >
      {marker.srLabel ? <span className="sr-only">{marker.srLabel} </span> : null}
      {marker.title}
      {marker.subtitle ? (
        <span className="font-normal opacity-80"> · {marker.subtitle}</span>
      ) : null}
    </button>
  );
}
