import type { CalendarEvent, CalendarMarker } from "./types.js";

export const MAX_VISIBLE_ITEMS = 3;

export type DayItem =
  | { kind: "marker"; item: CalendarMarker }
  | { kind: "event"; item: CalendarEvent };

export const itemsOnDate = (
  date: string,
  markers: CalendarMarker[],
  events: CalendarEvent[],
): DayItem[] => [
  ...markers
    .filter((marker) => marker.date === date)
    .map((item): DayItem => ({ kind: "marker", item })),
  ...events
    .filter((event) => event.date === date)
    .map((item): DayItem => ({ kind: "event", item })),
];

export const hiddenCount = (items: DayItem[]): number =>
  Math.max(0, items.length - MAX_VISIBLE_ITEMS);
