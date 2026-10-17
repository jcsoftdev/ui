"use client";

import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { useUiStrings } from "../../i18n/index.js";
import { ChevronLeft, ChevronRight } from "../../icons/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import {
  addDays,
  addMonths,
  clampDate,
  formatFullDate,
  formatMonthTitle,
  isIsoDate,
  monthWeeks,
  startOfWeek,
  todayIso,
  type WeekStart,
  weekdayNames,
  weekStartFor,
} from "../internal/date-utils.js";

export type DateCalendarPart = "root" | "header" | "title" | "nav" | "grid" | "weekday" | "day";

export interface DateCalendarProps {
  /** Selected date, "YYYY-MM-DD". */
  value?: string;
  /** Called with the "YYYY-MM-DD" date the person picks. */
  onSelect: (date: string) => void;
  /** Earliest selectable date, "YYYY-MM-DD". */
  min?: string;
  /** Latest selectable date, "YYYY-MM-DD". */
  max?: string;
  /** Extra dates that cannot be picked (holidays, taken days). */
  isDateDisabled?: (date: string) => boolean;
  /** BCP 47 locale for labels. Defaults to the `locale` UI string. */
  locale?: string;
  /** First day of the week, 0 (Sunday) to 6. Defaults from the locale: Monday for es-PE. */
  weekStartsOn?: WeekStart;
  /** "YYYY-MM-DD" treated as today. Defaults to the viewer's local date. */
  today?: string;
  /** Moves focus into the grid on mount (when it opens inside a popover). */
  autoFocus?: boolean;
  className?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<DateCalendarPart>;
}

const KEY_STEPS: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -7,
  ArrowDown: 7,
};

const NAV =
  "inline-flex size-8 min-h-(--touch-target) min-w-(--touch-target) items-center justify-center rounded-event text-ink-2 outline-none hover:bg-surface-2 focus-visible:focus-ring disabled:pointer-events-none disabled:opacity-40";

/**
 * Month grid for picking one date (WAI-ARIA date picker grid). Dates are "YYYY-MM-DD" strings
 * handled in UTC, so a day never shifts with the time zone. Arrows move by day and week,
 * Home/End to the week edges, PageUp/PageDown by month (Shift: year); Enter or Space picks.
 */
export function DateCalendar({
  value,
  onSelect,
  min,
  max,
  isDateDisabled,
  locale: localeProp,
  weekStartsOn: weekStartProp,
  today: todayProp,
  autoFocus = false,
  className,
  classNames,
}: DateCalendarProps) {
  const strings = useUiStrings();
  const locale = localeProp ?? strings.locale;
  const weekStartsOn = weekStartProp ?? weekStartFor(locale);
  const titleId = useId();
  const gridRef = useRef<HTMLTableElement | null>(null);
  const moveFocus = useRef(autoFocus);
  const [today] = useState(() => todayProp ?? todayIso());
  const [focused, setFocused] = useState(() =>
    clampDate(value && isIsoDate(value) ? value : today, min, max),
  );

  const weeks = useMemo(() => monthWeeks(focused, weekStartsOn), [focused, weekStartsOn]);
  const names = useMemo(() => weekdayNames(locale, weekStartsOn), [locale, weekStartsOn]);
  const month = focused.slice(0, 7);
  const disabled = (date: string) =>
    Boolean((min && date < min) || (max && date > max) || isDateDisabled?.(date));

  useEffect(() => {
    if (!moveFocus.current) return;
    gridRef.current?.querySelector<HTMLElement>(`[data-date="${focused}"]`)?.focus();
  }, [focused]);

  const goTo = (date: string, focusDay: boolean) => {
    moveFocus.current = focusDay;
    setFocused(clampDate(date, min, max));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTableElement>) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const step = KEY_STEPS[event.key];
    let next: string | undefined;
    if (step !== undefined) next = addDays(focused, step);
    else if (event.key === "Home") next = startOfWeek(focused, weekStartsOn);
    else if (event.key === "End") next = addDays(startOfWeek(focused, weekStartsOn), 6);
    else if (event.key === "PageUp" || event.key === "PageDown") {
      next = addMonths(focused, (event.key === "PageUp" ? -1 : 1) * (event.shiftKey ? 12 : 1));
    }
    if (next === undefined) return;
    event.preventDefault();
    goTo(next, true);
  };

  const monthStart = `${month}-01`;
  const prevDisabled = Boolean(min && addDays(monthStart, -1) < min);
  const nextDisabled = Boolean(max && addMonths(monthStart, 1) > max);

  return (
    <div className={cn("flex w-fit flex-col gap-2", classNames?.root, className)}>
      <div className={cn("flex items-center justify-between gap-2", classNames?.header)}>
        <button
          type="button"
          aria-label={strings.previousMonth}
          disabled={prevDisabled}
          onClick={() => goTo(addMonths(focused, -1), false)}
          className={cn(NAV, classNames?.nav)}
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
        </button>
        <div
          id={titleId}
          aria-live="polite"
          className={cn("font-semibold text-body text-ink", classNames?.title)}
        >
          {formatMonthTitle(focused, locale)}
        </div>
        <button
          type="button"
          aria-label={strings.nextMonth}
          disabled={nextDisabled}
          onClick={() => goTo(addMonths(focused, 1), false)}
          className={cn(NAV, classNames?.nav)}
        >
          <ChevronRight aria-hidden="true" className="size-4" />
        </button>
      </div>
      <table
        ref={gridRef}
        // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: APG date picker grid on a table.
        role="grid"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
        className={cn("border-collapse", classNames?.grid)}
      >
        <thead>
          <tr>
            {names.map((name) => (
              <th
                key={name.long}
                scope="col"
                aria-label={name.long}
                className={cn(
                  "size-9 p-0 text-center font-semibold text-ink-3 text-meta uppercase",
                  classNames?.weekday,
                )}
              >
                {name.narrow}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0]}>
              {week.map((date) => {
                const selected = date === value;
                const isDisabled = disabled(date);
                const outside = !date.startsWith(month);
                return (
                  // biome-ignore lint/a11y/useFocusableInteractive: the button inside the cell takes focus.
                  <td
                    key={date}
                    // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: APG date picker gridcell.
                    role="gridcell"
                    aria-selected={selected}
                    className="p-0"
                  >
                    <button
                      type="button"
                      data-date={date}
                      tabIndex={date === focused ? 0 : -1}
                      aria-label={formatFullDate(date, locale)}
                      aria-current={date === today ? "date" : undefined}
                      aria-disabled={isDisabled || undefined}
                      data-selected={selected ? "" : undefined}
                      data-outside={outside ? "" : undefined}
                      onFocus={() => {
                        moveFocus.current = true;
                        setFocused(date);
                      }}
                      onClick={() => {
                        if (!isDisabled) onSelect(date);
                      }}
                      className={cn(
                        "flex size-9 min-h-(--touch-target) min-w-(--touch-target) items-center justify-center rounded-event text-body tabular-nums outline-none focus-visible:focus-ring",
                        outside ? "text-ink-3" : "text-ink",
                        date === today && !selected && "font-bold text-accent-ink",
                        !isDisabled && !selected && "hover:bg-surface-2",
                        selected && "bg-accent font-bold text-on-accent",
                        isDisabled && "cursor-not-allowed text-ink-3 line-through opacity-50",
                        classNames?.day,
                      )}
                    >
                      {Number(date.slice(8))}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
