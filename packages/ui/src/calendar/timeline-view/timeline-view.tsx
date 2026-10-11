import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { DayChip } from "../day-chip/index.js";
import { EventBlock } from "../event-block/index.js";
import { formatMonthShort, formatWeekdayAndDay } from "../internal/date-utils.js";
import type { CalendarEvent, CalendarMarker } from "../internal/types.js";

export type TimelineViewPart = "root" | "day" | "heading" | "weekday" | "date" | "items" | "empty";

export interface TimelineViewProps {
  /** "YYYY-MM-DD" date highlighted as today; the view never computes it. */
  today: string;
  events: CalendarEvent[];
  markers?: CalendarMarker[];
  /** Dates ("YYYY-MM-DD") hidden from the timeline unless they are today. */
  hiddenDates?: string[];
  /** BCP 47 locale for date labels. Defaults to the runtime locale. */
  locale?: string;
  /** Suffix marking today's group, e.g. "today". */
  todayLabel: string;
  /** Text shown for a day without events or markers. */
  emptyLabel: string;
  onOpenEvent?: (id: string) => void;
  onOpenMarker?: (id: string) => void;
  className?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root. */
  classNames?: ClassNames<TimelineViewPart>;
}

function visibleDates(
  today: string,
  events: CalendarEvent[],
  markers: CalendarMarker[],
  hiddenDates: string[],
): string[] {
  const hidden = new Set(hiddenDates);
  const dates = new Set<string>([
    today,
    ...events.map((event) => event.date),
    ...markers.map((marker) => marker.date),
  ]);
  return [...dates].filter((date) => date === today || !hidden.has(date)).sort();
}

export function TimelineView({
  today,
  events,
  markers = [],
  hiddenDates = [],
  locale,
  todayLabel,
  emptyLabel,
  onOpenEvent,
  onOpenMarker,
  className,
  classNames,
}: TimelineViewProps) {
  const dates = visibleDates(today, events, markers, hiddenDates);

  return (
    <div className={cn("@container/timeline flex min-w-0 flex-col", className, classNames?.root)}>
      {dates.map((date) => {
        const isToday = date === today;
        const dayMarkers = markers.filter((marker) => marker.date === date);
        const dayEvents = events
          .filter((event) => event.date === date)
          .sort((a, b) => a.start.localeCompare(b.start));
        const label = formatWeekdayAndDay(date, locale);

        return (
          // biome-ignore lint/a11y/useSemanticElements: the group describes a whole day, not a page-level region.
          <div
            key={date}
            role="group"
            aria-label={isToday ? `${label} · ${todayLabel}` : label}
            data-date={date}
            data-today={isToday || undefined}
            className={cn(
              "grid grid-cols-[8rem_minmax(0,1fr)] gap-3.5 border-t-divider px-4 py-3.5 first:border-t-0 @max-[34rem]/timeline:grid-cols-[minmax(0,1fr)] @max-[34rem]/timeline:gap-y-2",
              classNames?.day,
            )}
          >
            <div className={classNames?.heading}>
              <b
                className={cn(
                  "block text-row-title",
                  isToday && "text-accent-ink",
                  classNames?.weekday,
                )}
              >
                {label}
              </b>
              <span className={cn("text-meta text-ink-3", classNames?.date)}>
                {formatMonthShort(date, locale)}
                {isToday ? ` · ${todayLabel}` : ""}
              </span>
            </div>
            <div className={cn("flex min-w-0 flex-col gap-1.5", classNames?.items)}>
              {dayMarkers.length === 0 && dayEvents.length === 0 ? (
                <span className={cn("py-2 text-meta text-ink-3", classNames?.empty)}>
                  {emptyLabel}
                </span>
              ) : (
                <>
                  {dayMarkers.map((marker) => (
                    <DayChip key={marker.id} marker={marker} onOpen={onOpenMarker} />
                  ))}
                  {dayEvents.map((event) => (
                    <EventBlock key={event.id} event={event} onOpen={onOpenEvent} />
                  ))}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
