/** One editable part of a masked field (`hour`, `minute`, `day`, `month`, `year`) and its text range. */
export interface Segment {
  type: "hour" | "minute" | "day" | "month" | "year";
  start: number;
  end: number;
}

export type DateOrder = "dmy" | "mdy" | "ymd";

const pad = (value: number, length = 2) => String(value).padStart(length, "0");
const onlyDigits = (text: string) => text.replace(/\D/g, "");

/** Inserts `separator` between groups of digits; groups are the segment lengths of the field. */
function maskGroups(text: string, groups: readonly number[], separator: string): string {
  const digits = onlyDigits(text).slice(
    0,
    groups.reduce((sum, size) => sum + size, 0),
  );
  let out = "";
  let at = 0;
  for (const size of groups) {
    const part = digits.slice(at, at + size);
    if (part === "") break;
    out += (at > 0 ? separator : "") + part;
    at += size;
    if (part.length < size) break;
  }
  return out;
}

function segmentsOf(groups: readonly number[], types: Segment["type"][]): Segment[] {
  let start = 0;
  return groups.map((size, index) => {
    const segment = { type: types[index] as Segment["type"], start, end: start + size };
    start += size + 1;
    return segment;
  });
}

export const TIME_SEGMENTS: readonly Segment[] = segmentsOf([2, 2], ["hour", "minute"]);

const DATE_GROUPS: Record<DateOrder, readonly number[]> = {
  dmy: [2, 2, 4],
  mdy: [2, 2, 4],
  ymd: [4, 2, 2],
};
const DATE_TYPES: Record<DateOrder, Segment["type"][]> = {
  dmy: ["day", "month", "year"],
  mdy: ["month", "day", "year"],
  ymd: ["year", "month", "day"],
};

export function dateSegments(order: DateOrder): Segment[] {
  return segmentsOf(DATE_GROUPS[order], DATE_TYPES[order]);
}

/** The segment a caret is in; a caret on a separator belongs to the segment before it. */
export function segmentAt(segments: readonly Segment[], caret: number): Segment {
  const last = segments[segments.length - 1] as Segment;
  return segments.find((segment) => caret <= segment.end) ?? last;
}

const TIME_VALID = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Keeps digits only and inserts the colon once the hour is complete: `930` becomes `93:0`. */
export function maskTime(text: string): string {
  const digits = onlyDigits(text).slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : digits;
}

/** `930`, `9:30`, `0930` and `09:30` become `09:30`; null when it is not a 24h time. */
export function normalizeTime(text: string): string | null {
  const digits = onlyDigits(text);
  if (digits.length < 3 || digits.length > 4) return null;
  const padded = digits.padStart(4, "0");
  const candidate = `${padded.slice(0, 2)}:${padded.slice(2)}`;
  return TIME_VALID.test(candidate) ? candidate : null;
}

/**
 * ArrowUp/ArrowDown on a time: the hours move by one, the minutes by `step` (carrying into the
 * hours), wrapping on 24 hours. An unparsable `value` starts from 00:00.
 */
export function stepTime(value: string, caret: number, direction: 1 | -1, step = 5): string {
  const [hours = 0, minutes = 0] = (normalizeTime(value) ?? "00:00").split(":").map(Number);
  if (segmentAt(TIME_SEGMENTS, caret).type === "hour")
    return `${pad((hours + direction + 24) % 24)}:${pad(minutes)}`;
  const total = (hours * 60 + minutes + direction * step + 1440) % 1440;
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** The field text for a stored "HH:MM" (an empty or invalid value shows an empty field). */
export const formatTime = (value: string): string => normalizeTime(value) ?? "";

const daysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

function splitDate(text: string, order: DateOrder) {
  const digits = onlyDigits(text);
  if (digits.length !== 8) return null;
  const parts = { day: 0, month: 0, year: 0 } as Record<"day" | "month" | "year", number>;
  let at = 0;
  DATE_GROUPS[order].forEach((size, index) => {
    parts[DATE_TYPES[order][index] as "day" | "month" | "year"] = Number(
      digits.slice(at, at + size),
    );
    at += size;
  });
  return parts;
}

function validDate({ day, month, year }: { day: number; month: number; year: number }): boolean {
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

/** Digits only, with `separator` between day, month and year (`ymd`: year first). */
export function maskDate(text: string, order: DateOrder = "dmy", separator = "/"): string {
  return maskGroups(text, DATE_GROUPS[order], separator);
}

/** A complete real calendar date in the field's order becomes ISO `YYYY-MM-DD`; otherwise null. */
export function normalizeDate(text: string, order: DateOrder = "dmy"): string | null {
  const parts = splitDate(text, order);
  return parts && validDate(parts)
    ? `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}`
    : null;
}

/** ISO `YYYY-MM-DD` as the field text in `order`; empty for anything that is not a real date. */
export function formatDate(iso: string, order: DateOrder = "dmy", separator = "/"): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return "";
  const parts = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) };
  if (!validDate(parts)) return "";
  const text = DATE_TYPES[order]
    .map((type) => pad(parts[type as "day" | "month" | "year"], type === "year" ? 4 : 2))
    .join(separator);
  return text;
}

/**
 * ArrowUp/ArrowDown on a date: the segment under the caret moves by one and wraps inside its own
 * range (day inside the month, month 1-12) without carrying into the next one. The day is clamped
 * when the month or the year gets shorter. An unparsable `iso` starts from `fallback`.
 */
export function stepDate(
  iso: string,
  segment: Segment["type"],
  direction: 1 | -1,
  fallback = "2000-01-01",
): string {
  const source = formatDate(iso) ? iso : fallback;
  let [year = 2000, month = 1, day = 1] = source.split("-").map(Number);
  if (segment === "year") year = Math.min(9999, Math.max(1, year + direction));
  else if (segment === "month") month = ((month - 1 + direction + 12) % 12) + 1;
  const length = daysInMonth(year, month);
  if (segment === "day") day = ((day - 1 + direction + length) % length) + 1;
  else day = Math.min(day, length);
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`;
}

export interface SegmentedInputOptions {
  kind: "time" | "date";
  /** Initial committed value: "HH:MM" for a time, ISO "YYYY-MM-DD" for a date, or "". */
  value?: string;
  /** Minutes moved by ArrowUp/ArrowDown on the minutes of a time. Default 5. */
  step?: number;
  /** Field order of a date. Default "dmy". */
  order?: DateOrder;
  separator?: string;
  /** A valid value was committed, or "" when the field was cleared. */
  onChange?: (value: string) => void;
}

export interface SegmentedInput {
  getValue(): string;
  /** Sets the committed value from outside (no `onChange`). */
  setValue(value: string): void;
  destroy(): void;
}

/**
 * Masks a text `<input>` as a time or a date field: digits only, separators inserted, the caret
 * kept in place, ArrowUp/ArrowDown on the segment under the caret, and a value committed once the
 * text is a real time or date. A half-typed field falls back to the committed value on blur.
 * Mirrors the React kit's `TimeInput`. Returns a controller.
 */
export function createSegmentedInput(
  input: HTMLInputElement,
  options: SegmentedInputOptions,
): SegmentedInput {
  const { kind, step = 5, order = "dmy", separator = kind === "time" ? ":" : "/" } = options;
  const segments = kind === "time" ? TIME_SEGMENTS : dateSegments(order);
  const mask = (text: string) =>
    kind === "time" ? maskTime(text) : maskDate(text, order, separator);
  const normalize = (text: string) =>
    kind === "time" ? normalizeTime(text) : normalizeDate(text, order);
  const display = (value: string) =>
    kind === "time" ? formatTime(value) : formatDate(value, order, separator);
  const complete = kind === "time" ? 5 : 10;
  const canonical = (value: string) =>
    kind === "time" ? (normalizeTime(value) ?? "") : formatDate(value) ? value : "";
  let committed = canonical(options.value ?? "");
  let draft: string | null = null;

  const show = (text: string) => {
    input.value = text;
  };
  const commit = (next: string) => {
    if (next === committed) return;
    committed = next;
    options.onChange?.(next);
  };
  const placeCaret = (digitsBefore: number, text: string) => {
    if (!input.matches(":focus")) return;
    let seen = 0;
    let at = 0;
    while (at < text.length && seen < digitsBefore) if (/\d/.test(text.charAt(at++))) seen++;
    input.setSelectionRange(at, at);
  };

  const onInput = () => {
    const raw = input.value;
    const digitsBefore = onlyDigits(raw.slice(0, input.selectionStart ?? raw.length)).length;
    const masked = mask(raw);
    draft = masked;
    show(masked);
    placeCaret(digitsBefore, masked);
    if (masked === "") commit("");
    else if (masked.length === complete) {
      const valid = normalize(masked);
      if (valid) commit(valid);
    }
  };
  const onBlur = () => {
    const valid = draft === null ? null : normalize(draft);
    if (valid) commit(valid);
    draft = null;
    show(display(committed));
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.defaultPrevented || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
    event.preventDefault();
    const direction = event.key === "ArrowUp" ? 1 : -1;
    const caret = input.selectionStart ?? 0;
    const segment = segmentAt(segments, caret);
    const base = (draft === null ? committed : normalize(draft)) ?? "";
    const next =
      kind === "time"
        ? stepTime(base, caret, direction, step)
        : stepDate(base, segment.type, direction);
    draft = null;
    commit(next);
    show(display(next));
    input.setSelectionRange(segment.start, segment.end);
  };

  show(display(committed));
  input.addEventListener("input", onInput);
  input.addEventListener("blur", onBlur);
  input.addEventListener("keydown", onKeyDown);
  return {
    getValue: () => committed,
    setValue(value) {
      committed = canonical(value);
      draft = null;
      show(display(committed));
    },
    destroy() {
      input.removeEventListener("input", onInput);
      input.removeEventListener("blur", onBlur);
      input.removeEventListener("keydown", onKeyDown);
    },
  };
}
