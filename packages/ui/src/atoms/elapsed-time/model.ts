import type { UiStrings } from "../../i18n/index.js";

export type ElapsedTone = "neutral" | "warning" | "danger";

export interface ElapsedReading {
  /** Whole seconds away from the reference: elapsed since it, or remaining until the target. */
  seconds: number;
  /** True once a countdown passed its target. */
  over: boolean;
}

export function toMs(value: Date | string | number): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

export function readElapsed(options: {
  since: Date | string;
  now: number;
  serverOffsetMs?: number | undefined;
  countdownTo?: Date | string | undefined;
}): ElapsedReading {
  const { since, now, serverOffsetMs = 0, countdownTo } = options;
  const clock = now + serverOffsetMs;
  if (countdownTo !== undefined) {
    const diff = Math.floor((toMs(countdownTo) - clock) / 1000);
    return { seconds: Math.abs(diff), over: diff < 0 };
  }
  return { seconds: Math.max(0, Math.floor((clock - toMs(since)) / 1000)), over: false };
}

export function toneFor(
  reading: ElapsedReading,
  countdown: boolean,
  warnAt?: number,
  dangerAt?: number,
): ElapsedTone {
  const minutes = reading.seconds / 60;
  if (countdown) {
    if (reading.over || (dangerAt !== undefined && minutes <= dangerAt)) return "danger";
    if (warnAt !== undefined && minutes <= warnAt) return "warning";
    return "neutral";
  }
  if (dangerAt !== undefined && minutes >= dangerAt) return "danger";
  if (warnAt !== undefined && minutes >= warnAt) return "warning";
  return "neutral";
}

const pad = (n: number) => String(n).padStart(2, "0");

export function formatClock(seconds: number): string {
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
}

export function isoDuration(seconds: number): string {
  return `PT${Math.floor(seconds / 60)}M${seconds % 60}S`;
}

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const SECONDS_PER_HOUR = SECONDS_PER_MINUTE * MINUTES_PER_HOUR;

type DurationStrings = Pick<UiStrings, "minutesShort" | "hoursShort" | "hoursMinutesShort">;
type SpokenDurationStrings = Pick<
  UiStrings,
  "elapsedMinutesOne" | "elapsedMinutes" | "elapsedHoursOne" | "elapsedHours"
>;

function fillTemplate(template: string, values: Record<string, number>): string {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replace(`{${key}}`, String(value)),
    template,
  );
}

export function formatMinutesText(totalMinutes: number, strings: DurationStrings): string {
  if (totalMinutes < MINUTES_PER_HOUR) {
    return fillTemplate(strings.minutesShort, { count: totalMinutes });
  }
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const minutes = totalMinutes % MINUTES_PER_HOUR;
  return minutes === 0
    ? fillTemplate(strings.hoursShort, { hours })
    : fillTemplate(strings.hoursMinutesShort, { hours, minutes });
}

export function formatClockText(seconds: number, strings: DurationStrings): string {
  if (seconds < SECONDS_PER_HOUR) return formatClock(seconds);
  return formatMinutesText(Math.floor(seconds / SECONDS_PER_MINUTE), strings);
}

export function formatOverrunText(seconds: number, strings: DurationStrings): string {
  if (seconds < SECONDS_PER_HOUR) {
    return `${Math.floor(seconds / SECONDS_PER_MINUTE)}:${pad(seconds % SECONDS_PER_MINUTE)}`;
  }
  return formatMinutesText(Math.floor(seconds / SECONDS_PER_MINUTE), strings);
}

function spokenMinutes(minutes: number, strings: SpokenDurationStrings): string {
  const template = minutes === 1 ? strings.elapsedMinutesOne : strings.elapsedMinutes;
  return fillTemplate(template, { count: minutes });
}

export function spokenDuration(totalMinutes: number, strings: SpokenDurationStrings): string {
  if (totalMinutes < MINUTES_PER_HOUR) return spokenMinutes(totalMinutes, strings);
  const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
  const minutes = totalMinutes % MINUTES_PER_HOUR;
  const spokenHours = fillTemplate(hours === 1 ? strings.elapsedHoursOne : strings.elapsedHours, {
    count: hours,
  });
  return minutes === 0 ? spokenHours : `${spokenHours} ${spokenMinutes(minutes, strings)}`;
}
