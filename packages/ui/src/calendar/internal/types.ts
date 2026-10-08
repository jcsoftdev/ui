import type { ReactNode } from "react";

/** Visual tone shared by events and markers. */
export type CalendarTone = "accent" | "neutral" | "success" | "danger" | "warning";

/** A calendar event. Dates are ISO calendar dates ("YYYY-MM-DD"), times are "HH:mm". */
export interface CalendarEvent {
  id: string;
  date: string;
  start: string;
  end?: string;
  title: string;
  subtitle?: string;
  tone?: CalendarTone;
  /** Screen-reader-only text announced before the title (e.g. the event kind). */
  srLabel?: string;
  /** All-day events render in the week view's top row instead of the hour grid. */
  allDay?: boolean;
  /** Optional node rendered at the end of the detailed block (e.g. an avatar). */
  trailing?: ReactNode;
}

/** A single-day marker rendered as a chip (deadline, reminder, holiday...). */
export interface CalendarMarker {
  id: string;
  date: string;
  title: string;
  subtitle?: string;
  tone?: "danger" | "accent";
  /** Screen-reader-only text announced before the title. */
  srLabel?: string;
}
