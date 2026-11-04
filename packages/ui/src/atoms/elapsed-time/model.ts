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
