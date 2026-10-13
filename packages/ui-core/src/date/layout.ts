/** Greedy column packing of overlapping events within one day. */

function minutesSinceMidnight(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

/** Minimum duration (minutes) for an event without an end time. */
const MIN_DURATION = 30;

/** An event of one day: "HH:MM" start and optional end. Extra fields ride along. */
export interface DayEvent {
  start: string;
  end?: string | undefined;
}

export interface TimedEvent<E extends DayEvent = DayEvent> {
  event: E;
  start: number;
  end: number;
}

export interface PositionedEvent<E extends DayEvent = DayEvent> extends TimedEvent<E> {
  /** 0-based column inside its group of overlapping events. */
  column: number;
  /** Number of columns in the group, used to split the width. */
  columns: number;
}

function toMinutes<E extends DayEvent>(events: E[]): TimedEvent<E>[] {
  return events.map((event) => {
    const start = minutesSinceMidnight(event.start);
    const end = event.end ? minutesSinceMidnight(event.end) : start + MIN_DURATION;
    return { event, start, end: Math.max(end, start + 1) };
  });
}

/** Greedy column assignment for the overlapping events of one day. */
export function layoutDayEvents<E extends DayEvent>(events: E[]): PositionedEvent<E>[] {
  const sorted = toMinutes(events).sort((a, b) => a.start - b.start || a.end - b.end);
  const positioned: PositionedEvent<E>[] = [];
  let group: PositionedEvent<E>[] = [];
  let groupEnd = Number.NEGATIVE_INFINITY;

  const closeGroup = () => {
    const columns = group.reduce((max, item) => Math.max(max, item.column + 1), 0);
    for (const item of group) {
      item.columns = columns;
      positioned.push(item);
    }
    group = [];
  };

  for (const item of sorted) {
    if (group.length > 0 && item.start >= groupEnd) {
      closeGroup();
      groupEnd = Number.NEGATIVE_INFINITY;
    }
    const columnEnds: number[] = [];
    for (const previous of group) {
      columnEnds[previous.column] = Math.max(columnEnds[previous.column] ?? 0, previous.end);
    }
    let column = columnEnds.findIndex((end) => end <= item.start);
    if (column === -1) column = columnEnds.length;
    group.push({ ...item, column, columns: 0 });
    groupEnd = Math.max(groupEnd, item.end);
  }
  closeGroup();
  return positioned;
}
