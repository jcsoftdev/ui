"use client";

import { type ComponentProps, useEffect, useId, useMemo, useState } from "react";
import { isIsoDate, type WeekStart } from "../../calendar/internal/date-utils.js";
import { useUiStrings } from "../../i18n/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import type { Material } from "../../utils/material.js";
import { useControllableState } from "../../utils/use-controllable-state.js";
import { TimeInput } from "../time-input/time-input.js";
import { DatePicker } from "./date-picker.js";
import { dateTimeInRange, joinDateTime, splitDateTime } from "./model.js";

export type DateTimePickerPart = "root" | "date" | "time";

export interface DateTimePickerProps
  extends Omit<
    ComponentProps<"div">,
    "defaultValue" | "onChange" | "children" | "role" | "id" | "aria-label" | "aria-labelledby"
  > {
  /**
   * "YYYY-MM-DDTHH:mm" (controlled), a wall-clock date and time with no zone: the component never
   * converts it, so "2026-09-07T09:30" stays that string whatever the browser's time zone is.
   * `""` while either half is missing or the pair is outside `min`/`max`.
   */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Earliest allowed value: a date ("2026-09-07", whole day) or a date-time. */
  min?: string;
  /** Latest allowed value: a date (whole day) or a date-time. */
  max?: string;
  isDateDisabled?: (date: string) => boolean;
  locale?: string;
  weekStartsOn?: WeekStart;
  /** Minutes moved by ArrowUp / ArrowDown on the minutes of the time half. Default 5. */
  step?: number;
  /** Submits the combined value with a surrounding `<form>` through a hidden input. */
  name?: string;
  id?: string;
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  container?: HTMLElement | null;
  material?: Material;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<DateTimePickerPart>;
}

const EMPTY = { date: "", time: "" };

/**
 * Date field with calendar plus a 24h time field, as one value. Replaces
 * `<input type="datetime-local">`; the value is "YYYY-MM-DDTHH:mm" without a time zone.
 */
export function DateTimePicker({
  value: valueProp,
  defaultValue = "",
  onValueChange,
  min,
  max,
  isDateDisabled,
  locale,
  weekStartsOn,
  step,
  name,
  id,
  disabled,
  required,
  invalid,
  container,
  material,
  className,
  classNames,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  ...props
}: DateTimePickerProps) {
  const strings = useUiStrings();
  const autoId = useId();
  const dateId = id ?? autoId;
  const [current, setCurrent] = useControllableState<string>({
    prop: valueProp,
    defaultProp: defaultValue,
    onChange: onValueChange,
  });
  const [parts, setParts] = useState(() => splitDateTime(current) ?? EMPTY);
  const [synced, setSynced] = useState(current);
  const [timeLabel, setTimeLabel] = useState(strings.time);
  // After a comma the word is lowercase in every locale ("Fecha, hora"); alone it keeps its capital.
  const suffix = strings.time.toLowerCase();

  // Adopt a value set from outside (form reset, prefill) without losing a half-typed pair.
  if (synced !== current) {
    setSynced(current);
    if (joinDateTime(parts) !== current) setParts(splitDateTime(current) ?? EMPTY);
  }

  // The time half is named "<field label>, <time>" so it differs from the date half.
  useEffect(() => {
    const label =
      ariaLabel ??
      ariaLabelledBy
        ?.split(" ")
        .map((labelId) => document.getElementById(labelId)?.textContent ?? "")
        .join(" ")
        .trim() ??
      (
        document.getElementById(dateId) as HTMLInputElement | null
      )?.labels?.[0]?.textContent?.trim();
    setTimeLabel(label ? `${label}, ${suffix}` : strings.time);
  }, [ariaLabel, ariaLabelledBy, dateId, strings.time, suffix]);

  const joined = joinDateTime(parts);
  const outOfRange = joined !== "" && !dateTimeInRange(joined, min, max);
  const dateMin = min && isIsoDate(min.slice(0, 10)) ? min.slice(0, 10) : undefined;
  const dateMax = max && isIsoDate(max.slice(0, 10)) ? max.slice(0, 10) : undefined;

  const update = useMemo(
    () => (next: { date: string; time: string }) => {
      setParts(next);
      const value = joinDateTime(next);
      const committed = value && dateTimeInRange(value, min, max) ? value : "";
      setCurrent(committed);
    },
    [min, max, setCurrent],
  );

  const shared = {
    disabled,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid ?? (invalid || undefined),
  };

  return (
    <div
      {...props}
      className={cn("flex w-full min-w-0 flex-wrap gap-2", classNames?.root, className)}
    >
      <DatePicker
        {...shared}
        id={dateId}
        value={parts.date}
        onValueChange={(date) => update({ ...parts, date })}
        min={dateMin}
        max={dateMax}
        isDateDisabled={isDateDisabled}
        locale={locale}
        weekStartsOn={weekStartsOn}
        required={required}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        container={container}
        material={material}
        className={undefined}
        classNames={{ root: cn("flex-[3_1_10rem]", classNames?.date) }}
      />
      <div className={cn("flex min-w-0 flex-[2_1_6rem]", classNames?.time)}>
        <TimeInput
          {...shared}
          aria-invalid={outOfRange ? true : shared["aria-invalid"]}
          aria-label={timeLabel}
          value={parts.time}
          onValueChange={(time) => update({ ...parts, time })}
          required={required}
          step={step}
        />
      </div>
      {name ? <input type="hidden" name={name} value={current} disabled={disabled} /> : null}
    </div>
  );
}
