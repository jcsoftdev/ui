"use client";

import { type KeyboardEvent, useRef, useState } from "react";
import { intentAttributes, useIntentTargets } from "../../intent/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { DayChip } from "../day-chip/index.js";
import { EventBlock } from "../event-block/index.js";
import { monthGrid, parseDate, type WeekStart } from "../internal/date-utils.js";
import { isGridKey, nextGridCell } from "../internal/grid-navigation.js";
import { calendarItemIntent } from "../internal/intent.js";
import { hiddenCount, itemsOnDate, MAX_VISIBLE_ITEMS } from "../internal/month-model.js";
import { SHADED_DAY_CLASS } from "../internal/styles.js";
import type { CalendarEvent, CalendarMarker, CalendarTone } from "../internal/types.js";
import type { MonthViewPart } from "./month-view.js";

const DAYS_PER_WEEK = 7;
const DAY_EXPECTATION = { role: "gridcell" } as const;
const ITEM_EXPECTATION = { role: "button" } as const;

const DOT_TONE: Record<CalendarTone, string> = {
  accent: "bg-accent",
  neutral: "bg-ink-3",
  success: "bg-success",
  danger: "bg-danger",
  warning: "bg-warning",
};

const chunkWeeks = (days: string[]): string[][] =>
  Array.from({ length: days.length / DAYS_PER_WEEK }, (_, week) =>
    days.slice(week * DAYS_PER_WEEK, (week + 1) * DAYS_PER_WEEK),
  );

export interface MonthGridLabels {
  title: string;
  weekdays: string[];
  fullDates: Record<string, string>;
  more: Record<string, string>;
}

export interface MonthGridProps {
  month: string;
  today: string;
  events: CalendarEvent[];
  markers?: CalendarMarker[];
  shadedDates?: string[];
  weekStartsOn?: WeekStart;
  labels: MonthGridLabels;
  onOpenEvent?: (id: string) => void;
  onOpenMarker?: (id: string) => void;
  onSelectDate?: (date: string) => void;
  dayIntent?: string;
  "aria-label"?: string;
  className?: string;
  classNames?: ClassNames<MonthViewPart>;
}

export function MonthGrid({
  month,
  today,
  events,
  markers = [],
  shadedDates = [],
  weekStartsOn = 1,
  labels,
  onOpenEvent,
  onOpenMarker,
  onSelectDate,
  dayIntent,
  "aria-label": ariaLabel,
  className,
  classNames,
}: MonthGridProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const bind = useIntentTargets();
  const [focusedDate, setFocusedDate] = useState<string>();
  const monthIndex = parseDate(month).getUTCMonth();
  const days = monthGrid(month, weekStartsOn);
  const weeks = chunkWeeks(days);
  const shaded = new Set(shadedDates);
  const firstInMonth = days.find((date) => parseDate(date).getUTCMonth() === monthIndex);
  const defaultDate = days.includes(today) ? today : (firstInMonth ?? days[0]);
  const tabStop =
    focusedDate !== undefined && days.includes(focusedDate) ? focusedDate : defaultDate;

  const moveFocus = (date: string | undefined) => {
    if (date === undefined) return;
    rootRef.current?.querySelector<HTMLElement>(`[role="gridcell"][data-date="${date}"]`)?.focus();
  };

  const handleCellKeyDown = (event: KeyboardEvent<HTMLDivElement>, date: string, row: number) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" && onSelectDate) {
      event.preventDefault();
      onSelectDate(date);
      return;
    }
    if (!isGridKey(event.key)) return;
    event.preventDefault();
    const col = days.indexOf(date) - row * DAYS_PER_WEEK;
    const size = { rows: weeks.length, cols: DAYS_PER_WEEK };
    const next = nextGridCell({ row, col }, event.key, size);
    moveFocus(next ? weeks[next.row]?.[next.col] : undefined);
  };

  return (
    <div
      ref={rootRef}
      role="grid"
      aria-label={ariaLabel ?? labels.title}
      className={cn("@container/month grid min-w-0 grid-cols-7", classNames?.root, className)}
    >
      <div role="row" className="col-span-7 grid grid-cols-subgrid">
        {days.slice(0, DAYS_PER_WEEK).map((date, column) => (
          <div
            key={date}
            role="columnheader"
            className={cn(
              "min-w-0 truncate border-b-divider px-2.5 py-2 text-overline text-ink-3 @max-[40rem]/month:px-0.5 @max-[40rem]/month:text-center",
              classNames?.weekday,
            )}
          >
            {labels.weekdays[column]}
          </div>
        ))}
      </div>
      {weeks.map((weekDays, row) => (
        <div key={weekDays[0]} role="row" className="col-span-7 grid grid-cols-subgrid">
          {weekDays.map((date) => {
            const parsed = parseDate(date);
            const outside = parsed.getUTCMonth() !== monthIndex;
            const isToday = date === today;
            const items = itemsOnDate(date, markers, events);
            const visible = items.slice(0, MAX_VISIBLE_ITEMS);
            const hidden = hiddenCount(items);
            const dayProps = { intent: dayIntent, intentKey: date };

            return (
              <div
                key={date}
                ref={bind(dayProps, DAY_EXPECTATION)}
                role="gridcell"
                tabIndex={date === tabStop ? 0 : -1}
                aria-current={isToday ? "date" : undefined}
                data-date={date}
                data-today={isToday || undefined}
                data-outside-month={outside || undefined}
                data-shaded={shaded.has(date) || undefined}
                {...intentAttributes(dayProps)}
                onFocus={(event) => {
                  if (event.target === event.currentTarget) setFocusedDate(date);
                }}
                onKeyDown={(event) => handleCellKeyDown(event, date, row)}
                className={cn(
                  "flex min-h-30 min-w-0 flex-col gap-0.75 border-b-divider border-l-divider p-1.5 @max-[40rem]/month:min-h-16 @max-[40rem]/month:items-center @max-[40rem]/month:p-0.5",
                  shaded.has(date) && SHADED_DAY_CLASS,
                  outside && "bg-surface-2/50",
                  classNames?.day,
                )}
              >
                <span className="sr-only">{labels.fullDates[date]}</span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid h-5.5 min-w-6 place-items-center self-start rounded-xs font-mono text-chip-text text-ink-2",
                    isToday && "bg-accent text-on-accent",
                    outside && "text-ink-3",
                    classNames?.dayNumber,
                  )}
                >
                  {parsed.getUTCDate()}
                </span>
                <div
                  className={cn(
                    "flex min-w-0 flex-col gap-0.75 @max-[40rem]/month:hidden",
                    classNames?.items,
                  )}
                >
                  {visible.map(({ kind, item }) =>
                    kind === "marker" ? (
                      <DayChip
                        key={item.id}
                        ref={bind(calendarItemIntent(item), ITEM_EXPECTATION)}
                        marker={item}
                        onOpen={onOpenMarker}
                      />
                    ) : (
                      <EventBlock
                        key={item.id}
                        ref={bind(calendarItemIntent(item), ITEM_EXPECTATION)}
                        event={item}
                        variant="compact"
                        onOpen={onOpenEvent}
                      />
                    ),
                  )}
                  {hidden > 0 ? (
                    <button
                      type="button"
                      onClick={onSelectDate ? () => onSelectDate(date) : undefined}
                      className={cn("px-1.5 text-left text-chip-text text-ink-3", classNames?.more)}
                    >
                      {labels.more[date]}
                    </button>
                  ) : null}
                </div>
                {items.length > 0 ? (
                  <div
                    className={cn(
                      "hidden flex-wrap justify-center gap-0.5 @max-[40rem]/month:flex",
                      classNames?.dots,
                    )}
                  >
                    {items.map(({ kind, item }) => (
                      <button
                        key={item.id}
                        type="button"
                        aria-label={item.title}
                        onClick={
                          kind === "marker"
                            ? onOpenMarker
                              ? () => onOpenMarker(item.id)
                              : undefined
                            : onOpenEvent
                              ? () => onOpenEvent(item.id)
                              : undefined
                        }
                        className={cn(
                          "size-2 rounded-avatar p-0",
                          kind === "marker"
                            ? item.tone === "danger"
                              ? DOT_TONE.danger
                              : DOT_TONE.accent
                            : DOT_TONE[item.tone ?? "accent"],
                          classNames?.dot,
                        )}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
