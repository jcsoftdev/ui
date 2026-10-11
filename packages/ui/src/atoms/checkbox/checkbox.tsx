"use client";

import { type ComponentProps, useRef } from "react";
import { Check } from "../../icons/index.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { composeHandlers, useComposedRefs } from "../../utils/compose.js";
import { BubbleInput, useFormBubble, useFormReset } from "../../utils/form-bubble.js";
import { useControllableState } from "../../utils/use-controllable-state.js";

export type CheckedState = boolean | "indeterminate";

export type CheckboxPart = "root" | "box" | "indicator" | "icon";

export interface CheckboxProps
  extends Omit<
    ComponentProps<"button">,
    "value" | "defaultValue" | "checked" | "defaultChecked" | "children"
  > {
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root. */
  classNames?: ClassNames<CheckboxPart>;
  checked?: CheckedState;
  defaultChecked?: CheckedState;
  onCheckedChange?: (checked: CheckedState) => void;
  required?: boolean;
  name?: string;
  value?: string;
  /** Id of the `<form>` the checkbox belongs to when it is rendered outside it. */
  form?: string;
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

  return (
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
        {...props}
        ref={composedRef}
        className={cn(
          "group inline-flex size-10 shrink-0 items-center justify-center in-data-[density=touch]:size-11",
          className,
          classNames?.root,
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
            "grid size-4.5 place-items-center rounded-pill border-[1.5px] border-line-strong group-data-[state=checked]:border-success group-data-[state=checked]:bg-success group-data-[state=indeterminate]:border-success group-data-[state=indeterminate]:bg-success",
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
              <Check
                aria-hidden="true"
                className={cn("size-2.75 stroke-[3] text-on-accent", classNames?.icon)}
              />
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
}
