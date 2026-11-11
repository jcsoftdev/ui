"use client";

import { type FocusEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";
import { intentAttributes, useIntentTargets } from "../../intent/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { DayChip } from "../day-chip/index.js";
import { EventBlock } from "../event-block/index.js";
import {
  addDays,
  formatFullDate,
  formatHour,
  formatWeekdayAndDay,
  minutesSinceMidnight,
  startOfWeek,
  type WeekStart,
} from "../internal/date-utils.js";
import { type GridCell, isGridKey, nextGridCell } from "../internal/grid-navigation.js";
import { calendarItemIntent } from "../internal/intent.js";
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
const DAYS_PER_WEEK = 7;
const GRID_SIZE = { rows: 2, cols: DAYS_PER_WEEK };
const ALL_DAY_ROW = 0;
const TIMED_ROW = 1;
const DAY_EXPECTATION = { role: "gridcell" } as const;
const ITEM_EXPECTATION = { role: "button" } as const;

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
  dayIntent?: string;
  "aria-label"?: string;
  onOpenEvent?: (id: string) => void;
  onOpenMarker?: (id: string) => void;
  className?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
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
  dayIntent,
  "aria-label": ariaLabel,
  onOpenEvent,
  onOpenMarker,
  className,
  classNames,
}: WeekViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const bind = useIntentTargets();
  const [focused, setFocused] = useState<GridCell>();
  const first = startOfWeek(week, weekStartsOn);
  const days = Array.from({ length: 7 }, (_, index) => addDays(first, index));
  const shaded = new Set(shadedDates);
  const todayCol = days.indexOf(today);
  const tabStop = focused ?? { row: ALL_DAY_ROW, col: Math.max(todayCol, 0) };
  const label =
    ariaLabel ?? `${formatFullDate(first, locale)} – ${formatFullDate(days[6] ?? first, locale)}`;

  const handleCellKeyDown = (event: KeyboardEvent<HTMLDivElement>, row: number, col: number) => {
    if (event.target !== event.currentTarget || !isGridKey(event.key)) return;
    event.preventDefault();
    const next = nextGridCell({ row, col }, event.key, GRID_SIZE);
    if (next === undefined) return;
    const cells = gridRef.current?.querySelectorAll<HTMLElement>(
      '[role="gridcell"][data-grid-cell]',
    );
    cells?.[next.row * DAYS_PER_WEEK + next.col]?.focus();
  };

  const cellProps = (row: number, col: number) => ({
    role: "gridcell",
    "data-grid-cell": "",
    tabIndex: row === tabStop.row && col === tabStop.col ? 0 : -1,
    onFocus: (event: FocusEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget) setFocused({ row, col });
    },
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>) => handleCellKeyDown(event, row, col),
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = INITIAL_SCROLL_HOUR * PX_PER_HOUR;
    }
  }, []);

  return (
    <div className={cn("@container/week min-w-0", classNames?.root, className)}>
      <div
        ref={scrollRef}
        data-hours-scroll
        className={cn("max-h-150 overflow-auto", classNames?.scroll)}
      >
        <div
          ref={gridRef}
          role="grid"
          aria-label={label}
          className="flex min-w-205 flex-col @max-[40rem]/week:min-w-209"
        >
          <div
            role="row"
            className={cn("sticky top-0 z-20 grid bg-surface", COLUMNS, classNames?.header)}
          >
            <div aria-hidden="true" className={GUTTER} />
            {days.map((date) => (
              <div
                key={date}
                role="columnheader"
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
            role="row"
            aria-label={allDayLabel}
            data-all-day-row
            className={cn("sticky top-10 z-20 grid bg-surface", COLUMNS, classNames?.allDayRow)}
          >
            <div
              aria-hidden="true"
              className={cn(
                GUTTER,
                "whitespace-nowrap border-b-divider px-1.5 pt-2.5 text-right text-meta text-ink-3",
                classNames?.allDayLabel,
              )}
            >
              {allDayLabel}
            </div>
            {days.map((date, col) => (
              <div
                key={date}
                {...cellProps(ALL_DAY_ROW, col)}
                className={cn(
                  "flex min-h-10 flex-col gap-1 border-b-divider border-l-divider p-1",
                  classNames?.allDayCell,
                )}
              >
                <span className="sr-only">{formatFullDate(date, locale)}</span>
                {markers
                  .filter((marker) => marker.date === date)
                  .map((marker) => (
                    <DayChip
                      key={marker.id}
                      ref={bind(calendarItemIntent(marker), ITEM_EXPECTATION)}
                      marker={marker}
                      onOpen={onOpenMarker}
                    />
                  ))}
                {events
                  .filter((event) => event.date === date && event.allDay)
                  .map((event) => (
                    <div key={event.id} data-event={event.id}>
                      <EventBlock
                        ref={bind(calendarItemIntent(event), ITEM_EXPECTATION)}
                        event={event}
                        variant="compact"
                        onOpen={onOpenEvent}
                      />
                    </div>
                  ))}
              </div>
            ))}
          </div>

          <div>
            <div
              role="row"
              className={cn("grid", COLUMNS)}
              style={{ height: HOURS.length * PX_PER_HOUR }}
            >
              <div aria-hidden="true" className={GUTTER}>
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

              {days.map((date, col) => {
                const isToday = date === today;
                const dayProps = { intent: dayIntent, intentKey: date };
                const positioned = layoutDayEvents(
                  events.filter((event) => event.date === date && !event.allDay),
                );
                const nowMinutes =
                  isToday && currentTime ? minutesSinceMidnight(currentTime) : undefined;

                return (
                  <div
                    key={date}
                    ref={bind(dayProps, DAY_EXPECTATION)}
                    {...cellProps(TIMED_ROW, col)}
                    {...intentAttributes(dayProps)}
                    data-date={date}
                    aria-current={isToday ? "date" : undefined}
                    data-hours-column
                    data-shaded={shaded.has(date) || undefined}
                    className={cn(
                      "relative border-l-divider bg-[linear-gradient(to_bottom,var(--line)_1px,transparent_1px)] bg-size-[100%_48px]",
                      isToday && "bg-accent-soft/40",
                      shaded.has(date) && SHADED_DAY_CLASS,
                      classNames?.column,
                    )}
                  >
                    <span className="sr-only">{formatFullDate(date, locale)}</span>
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
                            ref={bind(calendarItemIntent(event), ITEM_EXPECTATION)}
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
