"use client";

import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { Check } from "../../icons/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { useComposedRefs } from "../../utils/compose.js";
import { useRovingFocus } from "../../utils/roving-focus.js";
import { useControllableState } from "../../utils/use-controllable-state.js";

export interface ChipGroupOption {
  value: string;
  label: ReactNode;
  /** Small count after the label. */
  count?: ReactNode;
  /** Decorative glyph before the label (replaced by a check while selected in a multiple group). */
  icon?: ReactNode;
  disabled?: boolean;
}

export type ChipGroupPart = "root" | "chip" | "label" | "count" | "check";

interface ChipGroupCommon {
  options: readonly ChipGroupOption[];
  disabled?: boolean | undefined;
  /** Form field name: a hidden input per selected value. */
  name?: string | undefined;
  /** Marks the group invalid (also set by `Field` through `aria-invalid`). */
  invalid?: boolean | undefined;
  /** Set by `Field`; the group is named from the field's label. */
  id?: string | undefined;
  "aria-label"?: string | undefined;
  "aria-labelledby"?: string | undefined;
  "aria-describedby"?: string | undefined;
  "aria-invalid"?: boolean | "true" | "false" | undefined;
  /**
   * Minimum chip height: `sm` (default) is 30px (`--control-height-sm`), `md` 38px
   * (`--control-height-md`), the heights of `Button` and `Input` of the same size.
   */
  size?: "sm" | "md" | undefined;
  className?: string | undefined;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root. */
  classNames?: ClassNames<ChipGroupPart>;
}

export interface ChipGroupMultipleProps extends ChipGroupCommon {
  /** Any number of chips can be on. This is the default. */
  type?: "multiple";
  value?: string[] | undefined;
  defaultValue?: string[] | undefined;
  onValueChange?: ((value: string[]) => void) | undefined;
}

export interface ChipGroupSingleProps extends ChipGroupCommon {
  /** At most one chip is on. */
  type: "single";
  value?: string | undefined;
  defaultValue?: string | undefined;
  onValueChange?: ((value: string) => void) | undefined;
  /** Lets the pressed chip be pressed again to clear the choice (`""`). Off by default: a filter keeps one on. */
  allowDeselect?: boolean | undefined;
}

export type ChipGroupProps = ChipGroupMultipleProps | ChipGroupSingleProps;

/**
 * A set of chips that act as toggle buttons (`aria-pressed`) in a `fieldset` (a named group): pick several
 * (`type="multiple"`, default) or one (`type="single"`). Arrow keys, Home and End move between
 * chips and Space or Enter toggles; the group works inside `Field` (named from its label,
 * described by its hint and error) and submits one hidden input per selected value when named.
 */
export function ChipGroup(props: ChipGroupProps) {
  const {
    options,
    disabled,
    name,
    invalid,
    id,
    size = "sm",
    className,
    classNames,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    "aria-describedby": ariaDescribedBy,
    "aria-invalid": ariaInvalid,
  } = props;
  const single = props.type === "single";
  const generated = useId();
  const baseId = id ?? generated;

  const [multiValue, setMultiValue] = useControllableState<string[]>({
    prop: props.type === "single" ? undefined : props.value,
    defaultProp: (props.type === "single" ? undefined : props.defaultValue) ?? [],
    onChange: props.type === "single" ? undefined : props.onValueChange,
  });
  const [singleValue, setSingleValue] = useControllableState<string>({
    prop: props.type === "single" ? props.value : undefined,
    defaultProp: (props.type === "single" ? props.defaultValue : undefined) ?? "",
    onChange: props.type === "single" ? props.onValueChange : undefined,
  });

  const selected = single ? (singleValue ? [singleValue] : []) : multiValue;
  const toggle = (value: string) => {
    if (props.type === "single") {
      if (singleValue === value) {
        if (props.allowDeselect) setSingleValue("");
      } else setSingleValue(value);
      return;
    }
    setMultiValue(
      multiValue.includes(value) ? multiValue.filter((v) => v !== value) : [...multiValue, value],
    );
  };

  const roving = useRovingFocus({
    activeId: selected.find((v) => options.some((o) => o.value === v && !o.disabled)) ?? null,
  });
  const { ref: rovingRef, onFocus: rovingOnFocus, tabIndex } = roving.rootProps;
  const localRef = useRef<HTMLFieldSetElement | null>(null);
  const composedRef = useComposedRefs<HTMLFieldSetElement>(rovingRef, localRef);

  // A group is not a labelable element, so `Field`'s <label for> cannot name it: read its text.
  const [fieldLabel, setFieldLabel] = useState<string | undefined>();
  useEffect(() => {
    if (ariaLabel || ariaLabelledBy || !id) return;
    const label = Array.from(
      localRef.current?.ownerDocument.querySelectorAll<HTMLLabelElement>("label[for]") ?? [],
    ).find((candidate) => candidate.htmlFor === id);
    setFieldLabel(label?.textContent?.trim() || undefined);
  }, [id, ariaLabel, ariaLabelledBy]);

  const isInvalid = invalid || ariaInvalid === true || ariaInvalid === "true";

  return (
    <fieldset
      ref={composedRef}
      id={baseId}
      tabIndex={tabIndex}
      aria-label={ariaLabel ?? (ariaLabelledBy ? undefined : fieldLabel)}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
      data-type={single ? "single" : "multiple"}
      data-invalid={isInvalid ? "" : undefined}
      data-disabled={disabled ? "" : undefined}
      onFocus={rovingOnFocus}
      className={cn(
        "group/chips m-0 flex min-w-0 flex-wrap gap-1.5 border-0 p-0 outline-none",
        classNames?.root,
        className,
      )}
    >
      {options.map((option) => {
        const pressed = selected.includes(option.value);
        const off = disabled || option.disabled;
        const item = roving.getItemProps<HTMLButtonElement>(option.value, { disabled: off });
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={pressed}
            disabled={off}
            {...item}
            onClick={() => toggle(option.value)}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-badge border-control bg-surface-control px-3 font-medium text-fs-130 text-ink-2 hover:bg-surface-2 focus-visible:focus-ring disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:border-accent aria-pressed:bg-accent-soft aria-pressed:text-accent-ink group-data-[invalid]/chips:border-danger in-data-[density=touch]:min-h-11 [&_svg]:size-3",
              size === "md" ? "min-h-control-md" : "min-h-control-sm",
              classNames?.chip,
            )}
          >
            {pressed && !single ? (
              <Check aria-hidden="true" className={classNames?.check} />
            ) : option.icon ? (
              <span aria-hidden="true" className="inline-flex shrink-0">
                {option.icon}
              </span>
            ) : null}
            <span className={cn("min-w-0", classNames?.label)}>{option.label}</span>
            {option.count !== undefined ? (
              <span className={cn("text-count tabular-nums", classNames?.count)}>
                {option.count}
              </span>
            ) : null}
          </button>
        );
      })}
      {name
        ? selected.map((value) => <input key={value} type="hidden" name={name} value={value} />)
        : null}
    </fieldset>
  );
}
