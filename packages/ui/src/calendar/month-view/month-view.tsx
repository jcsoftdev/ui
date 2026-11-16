import type { ClassNames } from "../../utils/class-names.js";
import {
  formatFullDate,
  formatMonthTitle,
  formatWeekday,
  monthGrid,
  type WeekStart,
} from "../internal/date-utils.js";
import { hiddenCount, itemsOnDate } from "../internal/month-model.js";
import type { CalendarEvent, CalendarMarker } from "../internal/types.js";
import { MonthGrid, type MonthGridLabels } from "./month-grid.js";

const DAYS_PER_WEEK = 7;

export type MonthViewPart =
  | "root"
  | "weekday"
  | "day"
  | "dayNumber"
  | "items"
  | "more"
  | "dots"
  | "dot";

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
  dayIntent?: string;
  "aria-label"?: string;
  className?: string;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<MonthViewPart>;
}

function monthLabels(props: MonthViewProps): MonthGridLabels {
  const { month, locale, weekStartsOn = 1, formatMore, markers = [], events } = props;
  const days = monthGrid(month, weekStartsOn);
  const more: Record<string, string> = {};
  const fullDates: Record<string, string> = {};
  for (const date of days) {
    fullDates[date] = formatFullDate(date, locale);
    const hidden = hiddenCount(itemsOnDate(date, markers, events));
    if (hidden > 0) more[date] = formatMore(hidden);
  }
  return {
    title: formatMonthTitle(month, locale),
    weekdays: days.slice(0, DAYS_PER_WEEK).map((date) => formatWeekday(date, locale)),
    fullDates,
    more,
  };
}

export function MonthView(props: MonthViewProps) {
  const { locale: _locale, formatMore: _formatMore, ...gridProps } = props;
  return <MonthGrid {...gridProps} labels={monthLabels(props)} />;
}
