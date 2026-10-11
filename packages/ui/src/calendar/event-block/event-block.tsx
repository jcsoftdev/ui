import type { ComponentPropsWithRef } from "react";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import type { CalendarEvent, CalendarTone } from "../internal/types.js";

/** Class map behind each event `tone`; exported so apps can extend or reuse it. */
export const eventToneClasses: Readonly<Record<CalendarTone, string>> = {
  accent: "bg-accent-soft border-accent-line",
  neutral: "bg-surface-2 border-line-strong",
  success: "bg-success-soft border-success/35",
  danger: "bg-danger-soft border-danger/40",
  warning: "bg-warning-soft border-warning/40",
};

export type EventBlockPart =
  | "root"
  | "layout"
  | "time"
  | "body"
  | "title"
  | "subtitle"
  | "trailing";

export interface EventBlockProps
  extends Omit<ComponentPropsWithRef<"button">, "children" | "title" | "onClick"> {
  event: CalendarEvent;
  /** "detailed": time range, title and subtitle. "compact": one "time title" line. */
  variant?: "detailed" | "compact";
  onOpen?: (id: string) => void;
  className?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<EventBlockPart>;
}

export function EventBlock({
  event,
  variant = "detailed",
  onOpen,
  className,
  classNames,
  ...props
}: EventBlockProps) {
  const tone = eventToneClasses[event.tone ?? "accent"];
  const range = event.end ? `${event.start}–${event.end}` : event.start;
  const srLabel = event.srLabel ? <span className="sr-only">{event.srLabel} </span> : null;
  const handleClick = onOpen ? () => onOpen(event.id) : undefined;

  if (variant === "compact") {
    return (
      <button
        type="button"
        onClick={handleClick}
        {...props}
        className={cn(
          "block w-full truncate rounded-xs border px-1.5 py-0.5 text-left text-chip-text text-ink",
          tone,
          classNames?.root,
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
      {...props}
      className={cn(
        "@container/event block w-full min-w-0 overflow-hidden rounded-event border px-2.5 py-2 text-left",
        tone,
        classNames?.root,
        className,
      )}
    >
      {srLabel}
      <span
        className={cn(
          "grid h-full grid-cols-[96px_minmax(0,1fr)_auto] items-center gap-x-2.5",
          "@max-[28rem]/event:grid-cols-[70px_minmax(0,1fr)]",
          "@max-[9rem]/event:grid-cols-[minmax(0,1fr)] @max-[9rem]/event:gap-y-0.5",
          classNames?.layout,
        )}
      >
        <span className={cn("whitespace-nowrap font-mono text-meta text-ink-2", classNames?.time)}>
          {range}
        </span>
        <span className={cn("min-w-0", classNames?.body)}>
          <span className={cn("block truncate text-row-title text-ink", classNames?.title)}>
            {event.title}
          </span>
          {event.subtitle ? (
            <span className={cn("block truncate text-meta text-ink-3", classNames?.subtitle)}>
              {event.subtitle}
            </span>
          ) : null}
        </span>
        {event.trailing ? (
          <span className={cn("@max-[28rem]/event:hidden", classNames?.trailing)}>
            {event.trailing}
          </span>
        ) : null}
      </span>
    </button>
  );
}
