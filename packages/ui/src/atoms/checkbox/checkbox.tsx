"use client";

import { type ComponentProps, type ReactNode, useId, useRef } from "react";
import { Check, Minus } from "../../icons/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { composeHandlers, useComposedRefs } from "../../utils/compose.js";
import { BubbleInput, useFormBubble, useFormReset } from "../../utils/form-bubble.js";
import { useControllableState } from "../../utils/use-controllable-state.js";

export type CheckedState = boolean | "indeterminate";

export type CheckboxPart = "root" | "box" | "indicator" | "icon" | "wrapper" | "label";

export interface CheckboxProps
  extends Omit<
    ComponentProps<"button">,
    "value" | "defaultValue" | "checked" | "defaultChecked" | "children"
  > {
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<CheckboxPart>;
  checked?: CheckedState;
  defaultChecked?: CheckedState;
  onCheckedChange?: (checked: CheckedState) => void;
  required?: boolean;
  name?: string;
  value?: string;
  /** Id of the `<form>` the checkbox belongs to when it is rendered outside it. */
  form?: string;
  /**
   * Text shown next to the box. It renders a `<label>` tied to the checkbox, so it names it for
   * assistive tech and a click on it toggles. Without it the checkbox is bare and needs `aria-label`.
   */
  label?: ReactNode;
}

function getState(checked: CheckedState) {
  return checked === "indeterminate" ? "indeterminate" : checked ? "checked" : "unchecked";
}

export function Checkbox({
  className,
  classNames,
  checked: checkedProp,
  defaultChecked,
  onCheckedChange,
  required,
  disabled,
  name,
  value = "on",
  form,
  label,
  id,
  onClick,
  onKeyDown,
  ref,
  ...props
}: CheckboxProps) {
  const [checked, setChecked] = useControllableState<CheckedState>({
    prop: checkedProp,
    defaultProp: defaultChecked ?? false,
    onChange: onCheckedChange,
  });
  const bubble = useFormBubble(form);
  const initialRef = useRef(checked);
  useFormReset(bubble.control, form, () => setChecked(initialRef.current));
  const composedRef = useComposedRefs(ref, bubble.setControl);
  const state = getState(checked);
  const disabledAttr = disabled ? "" : undefined;
  const generatedId = useId();
  const controlId = label === undefined ? id : (id ?? generatedId);

  const control = (
    <>
      {/* biome-ignore lint/a11y/useSemanticElements: custom control; the hidden input carries the native form value */}
      <button
        type="button"
        role="checkbox"
        aria-checked={checked === "indeterminate" ? "mixed" : checked}
        aria-required={required}
        data-state={state}
        data-disabled={disabledAttr}
        disabled={disabled}
        value={value}
        id={controlId}
        {...props}
        ref={composedRef}
        className={cn(
          "group inline-flex size-10 shrink-0 items-center justify-center in-data-[density=touch]:size-11 disabled:cursor-not-allowed disabled:opacity-50",
          classNames?.root,
          className,
        )}
        onKeyDown={composeHandlers(onKeyDown, (event) => {
          // WAI-ARIA: checkboxes toggle with Space only; Enter must not submit or toggle.
          if (event.key === "Enter") event.preventDefault();
        })}
        onClick={composeHandlers(onClick, (event) => {
          setChecked((prev) => (prev === "indeterminate" ? true : !prev));
          bubble.onControlClick(event);
        })}
      >
        <span
          className={cn(
            "grid size-4.5 place-items-center rounded-xs border-[1.5px] border-line-strong group-data-[state=checked]:border-accent group-data-[state=checked]:bg-accent group-data-[state=indeterminate]:border-accent group-data-[state=indeterminate]:bg-accent",
            classNames?.box,
          )}
        >
          {checked === false ? null : (
            <span
              data-state={state}
              data-disabled={disabledAttr}
              style={{ pointerEvents: "none" }}
              className={classNames?.indicator}
            >
              {checked === "indeterminate" ? (
                <Minus
                  aria-hidden="true"
                  className={cn("size-2.75 stroke-[3] text-on-accent", classNames?.icon)}
                />
              ) : (
                <Check
                  aria-hidden="true"
                  className={cn("size-2.75 stroke-[3] text-on-accent", classNames?.icon)}
                />
              )}
            </span>
          )}
        </span>
      </button>
      {bubble.isFormControl ? (
        <BubbleInput
          type="checkbox"
          checked={checked}
          bubble={bubble}
          name={name}
          value={value}
          required={required}
          disabled={disabled}
          form={form}
        />
      ) : null}
    </>
  );

  if (label === undefined) return control;
  return (
    <span className={cn("inline-flex items-center", classNames?.wrapper)}>
      {control}
      <label
        htmlFor={controlId}
        data-disabled={disabledAttr}
        className={cn(
          "cursor-pointer select-none text-control text-ink data-disabled:cursor-not-allowed data-disabled:opacity-50",
          classNames?.label,
        )}
      >
        {label}
      </label>
    </span>
  );
}
