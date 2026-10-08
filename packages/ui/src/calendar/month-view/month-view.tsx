import { cn } from "../../utils/cn.js";
import { DayChip } from "../day-chip/index.js";
import { EventBlock } from "../event-block/index.js";
import { formatWeekday, monthGrid, parseDate, type WeekStart } from "../internal/date-utils.js";
import { SHADED_DAY_CLASS } from "../internal/styles.js";
import type { CalendarEvent, CalendarMarker } from "../internal/types.js";

const MAX_VISIBLE_ITEMS = 3;

type DayItem = { kind: "marker"; item: CalendarMarker } | { kind: "event"; item: CalendarEvent };

export interface MonthViewProps {
  /** Any "YYYY-MM-DD" date inside the month to show. */
  month: string;
  /** "YYYY-MM-DD" date highlighted as today; the view never computes it. */
  today: string;
  events: CalendarEvent[];
  markers?: CalendarMarker[];
  /** Dates ("YYYY-MM-DD") rendered with a hatch pattern (non-working days). */
  shadedDates?: string[];
  /** BCP 47 locale for weekday labels. Defaults to the runtime locale. */
  locale?: string;
  /** First day of the week, 0 (Sunday) to 6 (Saturday). Defaults to 1 (Monday). */
  weekStartsOn?: WeekStart;
  /** Label for the overflow button, e.g. `(n) => \`+${n} more\``. */
  formatMore: (count: number) => string;
  onOpenEvent?: (id: string) => void;
  onOpenMarker?: (id: string) => void;
  /** Called with the day's date when the overflow button is clicked. */
  onSelectDate?: (date: string) => void;
  className?: string;
}

export function MonthView({
  month,
  today,
  events,
  markers = [],
  shadedDates = [],
  locale,
  weekStartsOn = 1,
  formatMore,
  onOpenEvent,
  onOpenMarker,
  onSelectDate,
  className,
}: MonthViewProps) {
  const monthIndex = parseDate(month).getUTCMonth();
  const days = monthGrid(month, weekStartsOn);
  const shaded = new Set(shadedDates);

  return (
    <div className={cn("grid min-w-[800px] grid-cols-7", className)}>
      {days.slice(0, 7).map((date) => (
        <div key={date} className="border-line border-b px-2.5 py-2 text-overline text-ink-3">
          {formatWeekday(date, locale)}
        </div>
      ))}
      {days.map((date) => {
        const parsed = parseDate(date);
        const outside = parsed.getUTCMonth() !== monthIndex;
        const isToday = date === today;
        const items: DayItem[] = [
          ...markers
            .filter((marker) => marker.date === date)
            .map((item): DayItem => ({ kind: "marker", item })),
          ...events
            .filter((event) => event.date === date)
            .map((item): DayItem => ({ kind: "event", item })),
        ];
        const visible = items.slice(0, MAX_VISIBLE_ITEMS);
        const hidden = items.length - visible.length;

        return (
          <div
            key={date}
            data-date={date}
            data-today={isToday || undefined}
            data-outside-month={outside || undefined}
            data-shaded={shaded.has(date) || undefined}
            className={cn(
              "flex min-h-30 min-w-0 flex-col gap-0.75 border-line border-b border-l p-1.5",
              shaded.has(date) && SHADED_DAY_CLASS,
              outside && "opacity-45",
            )}
          >
            <span
              className={cn(
                "grid h-5.5 min-w-6 place-items-center self-start rounded-xs font-mono text-chip-text text-ink-2",
                isToday && "bg-accent text-on-accent",
              )}
            >
              {parsed.getUTCDate()}
            </span>
            {visible.map(({ kind, item }) =>
              kind === "marker" ? (
                <DayChip key={item.id} marker={item} onOpen={onOpenMarker} />
              ) : (
                <EventBlock key={item.id} event={item} variant="compact" onOpen={onOpenEvent} />
              ),
            )}
            {hidden > 0 ? (
              <button
                type="button"
                onClick={onSelectDate ? () => onSelectDate(date) : undefined}
                className="px-1.5 text-left text-chip-text text-ink-3"
              >
                {formatMore(hidden)}
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
