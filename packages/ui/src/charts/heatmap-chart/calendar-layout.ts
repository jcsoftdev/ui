export interface CalendarDay {
  date: Date;
  /** `null` marks a day without data (drawn as an empty cell). */
  value: number | null;
}

export interface CalendarGrid {
  /** Monday of every week, oldest first. */
  weeks: Date[];
  /** `cells[weekday][week]`, Monday = 0. `undefined` for days outside the range. */
  cells: Array<Array<{ date: Date; value: number | null } | undefined>>;
  /** Index of the first week of each month that starts inside the range. */
  monthStarts: Array<{ week: number; date: Date }>;
}

function startOfDay(date: Date): Date {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

/** Monday on or before `date`. */
export function mondayOf(date: Date): Date {
  const day = startOfDay(date);
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return day;
}

function key(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/**
 * Lays days out like a contribution calendar: one column per week (Monday
 * first), one row per weekday. Days between `from` and `to` without an entry
 * get `null`; days outside are left `undefined`.
 */
export function calendarGrid(days: readonly CalendarDay[], from?: Date, to?: Date): CalendarGrid {
  const times = days.map((day) => startOfDay(day.date).getTime());
  const first = startOfDay(from ?? new Date(times.length ? Math.min(...times) : Date.now()));
  const last = startOfDay(to ?? new Date(times.length ? Math.max(...times) : Date.now()));
  const values = new Map<string, number | null>();
  for (const day of days) values.set(key(day.date), day.value);

  const weeks: Date[] = [];
  for (let monday = mondayOf(first); monday <= last; ) {
    weeks.push(new Date(monday));
    monday = new Date(monday);
    monday.setDate(monday.getDate() + 7);
  }
  const cells: CalendarGrid["cells"] = Array.from({ length: 7 }, () => weeks.map(() => undefined));
  const monthStarts: CalendarGrid["monthStarts"] = [];
  weeks.forEach((monday, week) => {
    for (let weekday = 0; weekday < 7; weekday++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + weekday);
      if (date < first || date > last) continue;
      (cells[weekday] as Array<{ date: Date; value: number | null } | undefined>)[week] = {
        date,
        value: values.get(key(date)) ?? null,
      };
      if (date.getDate() === 1 || date.getTime() === first.getTime()) {
        if (!monthStarts.some((start) => start.week === week)) monthStarts.push({ week, date });
      }
    }
  });
  return { weeks, cells, monthStarts };
}
