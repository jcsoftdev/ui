"use client";

import type { ReactNode } from "react";
import { todayIso } from "../../calendar/internal/date-utils.js";
import { useUiStrings } from "../../i18n/index.js";
import { Chip, type ChipProps } from "../chip/chip.js";
import { type DueState, dueCalendarDate, dueStatus, formatDueDay } from "./model.js";

export type { DueState } from "./model.js";

const toneFor: Record<DueState, "danger" | "warning" | "neutral"> = {
  overdue: "danger",
  soon: "warning",
  ok: "neutral",
};

export interface DueChipProps
  extends Omit<ChipProps, "tone" | "children" | "onRemove" | "statusIcon"> {
  /** Due date: "2026-03-04", a naive date-time "2026-03-04T17:00", or an ISO instant (read in the viewer's zone). */
  date: string;
  /**
   * Reference day ("YYYY-MM-DD") the state is measured from. Defaults to the viewer's today;
   * pass it for deterministic output (server render, tests, "as of" views).
   */
  today?: string | undefined;
  /** Days ahead (inclusive of today) that count as `soon`. Defaults to 3. */
  soonDays?: number | undefined;
  /**
   * Forces the state regardless of the date, for a status the date alone cannot tell (a
   * payment that is late by policy, a hold). `done` is the neutral finished look. Wins over `done`.
   */
  state?: DueState | "done" | undefined;
  /** A finished item is never overdue or soon: the chip stays neutral. */
  done?: boolean | undefined;
  /** Replaces the formatted date text. */
  children?: ReactNode;
  locale?: string | undefined;
}

/**
 * A due date as a chip: neutral while it is far off, warning from `soonDays` before, danger once
 * past. The tone is never the only signal: overdue and soon chips carry a status glyph and a
 * screen-reader state. Renders `<time datetime>`; an unreadable date is shown as given.
 */
export function DueChip({
  date,
  today,
  soonDays,
  done = false,
  state: forced,
  locale,
  children,
  ...props
}: DueChipProps) {
  const strings = useUiStrings();
  const reference = today ?? todayIso();
  const day = dueCalendarDate(date);
  const status = day ? dueStatus(date, { today: reference, soonDays }) : null;
  if (!day || !status) return <Chip {...props}>{children ?? date}</Chip>;

  const resolved: DueState | "done" = forced ?? (done ? "done" : status.state);
  const state: DueState = resolved === "done" ? "ok" : resolved;
  const tone = toneFor[state];
  const stateText =
    state === "overdue" ? strings.overdue : state === "soon" ? strings.dueSoon : null;
  return (
    <Chip tone={tone} statusIcon data-state={resolved} {...props}>
      <time dateTime={date}>
        {children ??
          formatDueDay(day, dueCalendarDate(reference) ?? reference, locale ?? strings.locale)}
      </time>
      {stateText ? <span className="sr-only">, {stateText}</span> : null}
    </Chip>
  );
}
