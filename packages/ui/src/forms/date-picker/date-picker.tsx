"use client";

import { type ComponentProps, type KeyboardEvent, useMemo, useRef, useState } from "react";
import { DateCalendar } from "../../calendar/date-calendar/date-calendar.js";
import { isIsoDate, type WeekStart } from "../../calendar/internal/date-utils.js";
import { useUiStrings } from "../../i18n/index.js";
import { Calendar as CalendarIcon, X } from "../../icons/index.js";
import * as PopoverPrimitive from "../../primitives/popover/popover.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { useComposedRefs } from "../../utils/compose.js";
import { type Material, materialClass } from "../../utils/material.js";
import { useControllableState } from "../../utils/use-controllable-state.js";
import {
  dateFormatFor,
  displayPlaceholder,
  formatDisplay,
  maskDisplay,
  parseDisplay,
} from "./model.js";

export type DatePickerPart = "root" | "input" | "clear" | "trigger" | "content" | "calendar";

export interface DatePickerProps
  extends Omit<
    ComponentProps<"input">,
    | "value"
    | "defaultValue"
    | "onChange"
    | "type"
    | "min"
    | "max"
    | "size"
    | "inputMode"
    | "maxLength"
  > {
  /** Selected date as "YYYY-MM-DD" (controlled); `""` means none. Never converted through a time zone. */
  value?: string;
  defaultValue?: string;
  /** Called with a valid "YYYY-MM-DD" date, or `""` when the field is cleared. */
  onValueChange?: (value: string) => void;
  /** Earliest allowed date, "YYYY-MM-DD". */
  min?: string;
  /** Latest allowed date, "YYYY-MM-DD". */
  max?: string;
  /** Extra dates that cannot be picked or typed (holidays, taken days). */
  isDateDisabled?: (date: string) => boolean;
  /** BCP 47 locale for labels and the typed format. Defaults to the `locale` UI string (es-PE: dd/mm/aaaa). */
  locale?: string;
  /** First day of the week in the calendar, 0 (Sunday) to 6. Defaults from the locale (es-PE: Monday). */
  weekStartsOn?: WeekStart;
  /** `sm` is 30px and `md` (default) 38px, the heights of `Button` and `Input` of the same size. */
  size?: "sm" | "md";
  /** Shows a button that clears the date. Default `true`. */
  clearable?: boolean;
  clearLabel?: string;
  /** Submits the "YYYY-MM-DD" value with a surrounding `<form>` through a hidden input. */
  name?: string;
  invalid?: boolean;
  /** Portal target for the calendar popover. Defaults to `document.body`. */
  container?: HTMLElement | null;
  /** Popover surface material; see `PopoverContent`. */
  material?: Material;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the input and is merged last. */
  classNames?: ClassNames<DatePickerPart>;
}

// The clear and calendar buttons wrap a 14-16px glyph; `min-h-control-sm` gives each a 30px hit area.
const ICON_BUTTON =
  "flex min-h-control-sm w-8 items-center justify-center rounded-input text-ink-3 outline-none hover:text-ink focus-visible:focus-ring disabled:pointer-events-none disabled:opacity-50";

/**
 * Typed date field plus a calendar popover. The value is an ISO "YYYY-MM-DD" string end to end,
 * so it never shifts with the time zone. The person types in the locale's order ("07/09/2026" in
 * es-PE) or picks from the calendar; Alt+ArrowDown opens it from the keyboard.
 */
export function DatePicker({
  value: valueProp,
  defaultValue = "",
  onValueChange,
  min,
  max,
  isDateDisabled,
  locale: localeProp,
  weekStartsOn,
  size = "md",
  clearable = true,
  clearLabel,
  name,
  invalid,
  container,
  material,
  disabled,
  placeholder,
  className,
  classNames,
  ref,
  onBlur,
  onKeyDown,
  "aria-invalid": ariaInvalid,
  ...props
}: DatePickerProps) {
  const strings = useUiStrings();
  const locale = localeProp || strings.locale;
  const format = useMemo(() => dateFormatFor(locale), [locale]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const composedRef = useComposedRefs<HTMLInputElement>(ref, inputRef);
  const [current, setCurrent] = useControllableState<string>({
    prop: valueProp,
    defaultProp: defaultValue,
    onChange: onValueChange,
  });
  const date = isIsoDate(current) ? current : "";
  const [draft, setDraft] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const allowed = (iso: string) =>
    !(min && iso < min) && !(max && iso > max) && !isDateDisabled?.(iso);
  const typed = draft === null ? null : parseDisplay(draft, format);
  const rejected = typed !== null && !allowed(typed);

  const onChange = (raw: string) => {
    const masked = maskDisplay(raw, format);
    const iso = parseDisplay(masked, format);
    if (iso && allowed(iso)) {
      setCurrent(iso);
      setDraft(null);
      return;
    }
    setDraft(masked);
    if (masked === "") setCurrent("");
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === "ArrowDown" && event.altKey && !disabled) {
      event.preventDefault();
      setOpen(true);
    }
  };

  const hasClear = clearable && !disabled && date !== "";

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Anchor asChild>
        <div className={cn("relative flex w-full min-w-0", classNames?.root)}>
          <input
            {...props}
            ref={composedRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={10}
            disabled={disabled}
            placeholder={
              placeholder ??
              displayPlaceholder(format, {
                day: strings.dayPlaceholder,
                month: strings.monthPlaceholder,
                year: strings.yearPlaceholder,
              })
            }
            aria-invalid={ariaInvalid ?? (invalid || rejected || undefined)}
            value={draft ?? formatDisplay(date, format)}
            onChange={(event) => onChange(event.target.value)}
            onBlur={(event) => {
              onBlur?.(event);
              setDraft(null);
            }}
            onKeyDown={handleKeyDown}
            className={cn(
              size === "sm" ? "h-control-sm" : "h-control-md",
              "min-h-(--touch-target) w-full min-w-0 rounded-input border-control bg-surface-control pl-3 text-control text-ink tabular-nums placeholder:text-ink-3 focus:border-transparent focus:outline-2 focus:outline-accent-ink focus:-outline-offset-1 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger",
              hasClear ? "pr-16" : "pr-9",
              classNames?.input,
              className,
            )}
          />
          <div className="absolute inset-y-0 right-0 flex items-center">
            {hasClear ? (
              <button
                type="button"
                aria-label={clearLabel ?? strings.clear}
                onClick={() => {
                  setCurrent("");
                  setDraft(null);
                  inputRef.current?.focus();
                }}
                className={cn(ICON_BUTTON, classNames?.clear)}
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            ) : null}
            <PopoverPrimitive.Trigger
              disabled={disabled}
              aria-label={strings.openCalendar}
              className={cn(ICON_BUTTON, classNames?.trigger)}
            >
              <CalendarIcon aria-hidden="true" className="size-4" />
            </PopoverPrimitive.Trigger>
          </div>
          {name ? <input type="hidden" name={name} value={date} disabled={disabled} /> : null}
        </div>
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal container={container}>
        <PopoverPrimitive.Content
          aria-label={strings.calendar}
          sideOffset={4}
          collisionPadding={8}
          align="start"
          // The calendar takes focus itself; closing hands it back to the field.
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            inputRef.current?.focus({ preventScroll: true });
          }}
          className={cn(
            "z-85 max-w-(--ui-popper-available-width) overflow-y-auto rounded-popover surface-overlay p-3 text-ink shadow-overlay",
            materialClass(material, "surface-solid"),
            classNames?.content,
          )}
        >
          <DateCalendar
            autoFocus
            value={date || undefined}
            min={min}
            max={max}
            isDateDisabled={isDateDisabled}
            locale={locale}
            weekStartsOn={weekStartsOn}
            className={classNames?.calendar}
            onSelect={(next) => {
              setCurrent(next);
              setDraft(null);
              setOpen(false);
            }}
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
