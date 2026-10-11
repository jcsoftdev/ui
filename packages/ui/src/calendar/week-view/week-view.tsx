"use client";

import { useEffect, useRef } from "react";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { DayChip } from "../day-chip/index.js";
import { EventBlock } from "../event-block/index.js";
import {
  addDays,
  formatHour,
  formatWeekdayAndDay,
  minutesSinceMidnight,
  startOfWeek,
  type WeekStart,
} from "../internal/date-utils.js";
import { layoutDayEvents } from "../internal/layout.js";
import { SHADED_DAY_CLASS } from "../internal/styles.js";
import type { CalendarEvent, CalendarMarker } from "../internal/types.js";

/** Height in px of one hour (matches `h-(--agenda-hour)` = 48px). */
const PX_PER_HOUR = 48;
const INITIAL_SCROLL_HOUR = 8;
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const COLUMNS = cn(
  "grid-cols-[58px_repeat(7,minmax(96px,1fr))]",
  "@max-[40rem]/week:grid-cols-[52px_repeat(7,minmax(112px,1fr))]",
);
const GUTTER = "sticky left-0 z-10 bg-surface";

export type WeekViewPart =
  | "root"
  | "scroll"
  | "header"
  | "dayHeader"
  | "allDayRow"
  | "allDayLabel"
  | "allDayCell"
  | "hourLabel"
  | "column"
  | "workingHours"
  | "event"
  | "nowLine";

export interface WeekViewProps {
  /** Any "YYYY-MM-DD" date inside the week to show. */
  week: string;
  /** "YYYY-MM-DD" date highlighted as today; the view never computes it. */
  today: string;
  /** Current time "HH:mm" for the "now" line; without it no line is drawn. */
  currentTime?: string;
  events: CalendarEvent[];
  /** Markers render in the all-day row. */
  markers?: CalendarMarker[];
  /** Dates ("YYYY-MM-DD") rendered with a hatch pattern (non-working days). */
  shadedDates?: string[];
  /** Highlighted band of working hours, [start, end) in hours. */
  workingHours?: readonly [number, number];
  locale?: string;
  /** First day of the week, 0 (Sunday) to 6 (Saturday). Defaults to 1 (Monday). */
  weekStartsOn?: WeekStart;
  /** Label of the all-day row. */
  allDayLabel: string;
  onOpenEvent?: (id: string) => void;
  onOpenMarker?: (id: string) => void;
  className?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root. */
  classNames?: ClassNames<WeekViewPart>;
}

export function WeekView({
  week,
  today,
  currentTime,
  events,
  markers = [],
  shadedDates = [],
  workingHours,
  locale,
  weekStartsOn = 1,
  allDayLabel,
  onOpenEvent,
  onOpenMarker,
  className,
  classNames,
}: WeekViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const first = startOfWeek(week, weekStartsOn);
  const days = Array.from({ length: 7 }, (_, index) => addDays(first, index));
  const shaded = new Set(shadedDates);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = INITIAL_SCROLL_HOUR * PX_PER_HOUR;
    }
  }, []);

  return (
    <div className={cn("@container/week min-w-0", className, classNames?.root)}>
      <div
        ref={scrollRef}
        data-hours-scroll
        className={cn("max-h-150 overflow-auto", classNames?.scroll)}
      >
        <div className="flex min-w-205 flex-col @max-[40rem]/week:min-w-209">
          <div className={cn("sticky top-0 z-20 grid bg-surface", COLUMNS, classNames?.header)}>
            <div className={GUTTER} />
            {days.map((date) => (
              <div
                key={date}
                data-date={date}
                data-today={date === today || undefined}
                className={cn(
                  "flex h-10 min-w-0 items-center truncate whitespace-nowrap border-b-divider px-2 text-meta text-ink-3",
                  date === today && "text-accent-ink",
                  classNames?.dayHeader,
                )}
              >
                {formatWeekdayAndDay(date, locale)}
              </div>
            ))}
          </div>

          <div
            data-all-day-row
            className={cn("sticky top-10 z-20 grid bg-surface", COLUMNS, classNames?.allDayRow)}
          >
            <div
              className={cn(
                GUTTER,
                "whitespace-nowrap border-b-divider px-1.5 pt-2.5 text-right text-meta text-ink-3",
                classNames?.allDayLabel,
              )}
            >
              {allDayLabel}
            </div>
            {days.map((date) => (
              <div
                key={date}
                className={cn(
                  "flex min-h-10 flex-col gap-1 border-b-divider border-l-divider p-1",
                  classNames?.allDayCell,
                )}
              >
                {markers
                  .filter((marker) => marker.date === date)
                  .map((marker) => (
                    <DayChip key={marker.id} marker={marker} onOpen={onOpenMarker} />
                  ))}
                {events
                  .filter((event) => event.date === date && event.allDay)
                  .map((event) => (
                    <div key={event.id} data-event={event.id}>
                      <EventBlock event={event} variant="compact" onOpen={onOpenEvent} />
                    </div>
                  ))}
              </div>
            ))}
          </div>

          <div>
            <div className={cn("grid", COLUMNS)} style={{ height: HOURS.length * PX_PER_HOUR }}>
              <div className={GUTTER}>
                {HOURS.map((hour) => (
                  <span
                    key={hour}
                    className={cn(
                      "-translate-y-1/2 absolute right-2 whitespace-nowrap font-mono text-meta text-ink-3",
                      classNames?.hourLabel,
                    )}
                    style={{ top: hour * PX_PER_HOUR }}
                  >
                    {formatHour(hour, locale)}
                  </span>
                ))}
              </div>

              {days.map((date) => {
                const isToday = date === today;
                const positioned = layoutDayEvents(
                  events.filter((event) => event.date === date && !event.allDay),
                );
                const nowMinutes =
                  isToday && currentTime ? minutesSinceMidnight(currentTime) : undefined;

                return (
                  <div
                    key={date}
                    data-date={date}
                    data-hours-column
                    data-shaded={shaded.has(date) || undefined}
                    className={cn(
                      "relative border-l-divider bg-[linear-gradient(to_bottom,var(--line)_1px,transparent_1px)] bg-size-[100%_48px]",
                      isToday && "bg-accent-soft/40",
                      shaded.has(date) && SHADED_DAY_CLASS,
                      classNames?.column,
                    )}
                  >
                    {workingHours ? (
                      <div
                        data-working-hours
                        className={cn(
                          "pointer-events-none absolute inset-x-0 bg-accent-soft/30",
                          classNames?.workingHours,
                        )}
                        style={{
                          top: workingHours[0] * PX_PER_HOUR,
                          height: (workingHours[1] - workingHours[0]) * PX_PER_HOUR,
                        }}
                      />
                    ) : null}

                    {positioned.map(({ event, start, end, column, columns }) => {
                      const short = end - start <= 30;
                      const width = 100 / columns;
                      return (
                        <div
                          key={event.id}
                          data-event={event.id}
                          className={cn("absolute px-px", classNames?.event)}
                          style={{
                            top: (start / 60) * PX_PER_HOUR,
                            height: Math.max(((end - start) / 60) * PX_PER_HOUR - 2, 18),
                            left: `${column * width}%`,
                            width: `${width}%`,
                          }}
                        >
                          <EventBlock
                            event={event}
                            variant={short ? "compact" : "detailed"}
                            onOpen={onOpenEvent}
                            className="h-full"
                          />
                        </div>
                      );
                    })}

                    {nowMinutes !== undefined ? (
                      <div
                        data-now-line
                        className={cn(
                          "pointer-events-none absolute inset-x-0 h-0.5 bg-danger",
                          classNames?.nowLine,
                        )}
                        style={{ top: (nowMinutes / 60) * PX_PER_HOUR }}
                      />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
