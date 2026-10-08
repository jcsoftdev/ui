import { cn } from "../../utils/cn.js";
import type { CalendarEvent, CalendarTone } from "../internal/types.js";

const TONE: Record<CalendarTone, string> = {
  accent: "bg-accent-soft border-accent-line",
  neutral: "bg-surface-2 border-line-strong",
  success: "bg-success-soft border-success/35",
  danger: "bg-danger-soft border-danger/40",
  warning: "bg-warning-soft border-warning/40",
};

export interface EventBlockProps {
  event: CalendarEvent;
  /** "detailed": time range, title and subtitle. "compact": one "time title" line. */
  variant?: "detailed" | "compact";
  onOpen?: (id: string) => void;
  className?: string;
}

export function EventBlock({ event, variant = "detailed", onOpen, className }: EventBlockProps) {
  const tone = TONE[event.tone ?? "accent"];
  const range = event.end ? `${event.start}–${event.end}` : event.start;
  const srLabel = event.srLabel ? <span className="sr-only">{event.srLabel} </span> : null;
  const handleClick = onOpen ? () => onOpen(event.id) : undefined;

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "block w-full truncate rounded-xs border px-1.5 py-0.5 text-left text-chip-text text-ink",
          tone,
          className,
        )}
      >
        {srLabel}
        {event.start} {event.title}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        "grid grid-cols-[96px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-event border px-2.5 py-2 text-left max-[760px]:grid-cols-[70px_minmax(0,1fr)]",
        tone,
        className,
      )}
    >
      {srLabel}
      <span className="font-mono text-meta text-ink-2">{range}</span>
      <span className="min-w-0">
        <span className="block truncate text-row-title text-ink">{event.title}</span>
        {event.subtitle ? (
          <span className="block truncate text-meta text-ink-3">{event.subtitle}</span>
        ) : null}
      </span>
      {event.trailing ? <span className="max-[760px]:hidden">{event.trailing}</span> : null}
    </button>
  );
}
