import type { ComponentPropsWithoutRef } from "react";
import { ChevronDown } from "../../icons/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";

export interface NativeSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface NativeSelectGroup {
  label: string;
  options: NativeSelectOption[];
}

export type NativeSelectPart = "root" | "select" | "icon";

export interface NativeSelectProps extends Omit<ComponentPropsWithoutRef<"select">, "size"> {
  /** Data-driven alternative to `<option>` children; groups render as `<optgroup>`. */
  options?: (NativeSelectOption | NativeSelectGroup)[];
  /** Disabled first option shown while nothing is chosen. */
  placeholder?: string;
  size?: "sm" | "md";
  invalid?: boolean;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the `<select>`. */
  classNames?: ClassNames<NativeSelectPart>;
}

function isGroup(item: NativeSelectOption | NativeSelectGroup): item is NativeSelectGroup {
  return "options" in item;
}

/**
 * Styled native `<select>` (keeps the system picker on touch devices). It extends the existing
 * `Select` styling with a data-driven `options` API, optgroups, a placeholder and a compact size.
 */
export function NativeSelect({
  options,
  placeholder,
  size = "md",
  invalid,
  className,
  classNames,
  children,
  defaultValue,
  value,
  ...props
}: NativeSelectProps) {
  const fallbackDefault =
    placeholder && value === undefined && defaultValue === undefined ? "" : defaultValue;
  return (
    <span className={cn("relative flex w-full min-w-0 items-center", classNames?.root)}>
      <select
        value={value}
        defaultValue={fallbackDefault}
        aria-invalid={invalid || undefined}
        className={cn(
          "w-full min-w-0 appearance-none rounded-input border-control bg-surface-control py-0 pl-3 text-control text-ink focus:border-transparent focus:outline-2 focus:outline-accent-ink focus:-outline-offset-1 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger",
          size === "sm" ? "h-control-sm pr-7" : "h-input pr-8",
          className,
          classNames?.select,
        )}
        {...props}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options?.map((item) =>
          isGroup(item) ? (
            <optgroup key={item.label} label={item.label}>
              {item.options.map((o) => (
                <option key={o.value} value={o.value} disabled={o.disabled}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          ) : (
            <option key={item.value} value={item.value} disabled={item.disabled}>
              {item.label}
            </option>
          ),
        )}
        {children}
      </select>
      <ChevronDown
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute right-2.5 size-3.5 text-ink-3",
          classNames?.icon,
        )}
      />
    </span>
  );
}
