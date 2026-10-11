"use client";

import { type ComponentProps, useRef } from "react";
import { cn } from "../../utils/cn.js";
import { composeHandlers, useComposedRefs } from "../../utils/compose.js";
import { BubbleInput, useFormBubble, useFormReset } from "../../utils/form-bubble.js";
import { useControllableState } from "../../utils/use-controllable-state.js";

export interface SwitchProps
  extends Omit<
    ComponentProps<"button">,
    "value" | "defaultValue" | "checked" | "defaultChecked" | "children"
  > {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  required?: boolean;
  name?: string;
  value?: string;
  /** Id of the `<form>` the switch belongs to when it is rendered outside it. */
  form?: string;
}

export function Switch({
  className,
  checked: checkedProp,
  defaultChecked,
  onCheckedChange,
  required,
  disabled,
  name,
  value = "on",
  form,
  onClick,
  ref,
  ...props
}: SwitchProps) {
  const [checked, setChecked] = useControllableState({
    prop: checkedProp,
    defaultProp: defaultChecked ?? false,
    onChange: onCheckedChange,
  });
  const bubble = useFormBubble(form);
  const initialRef = useRef(checked);
  useFormReset(bubble.control, form, () => setChecked(initialRef.current));
  const composedRef = useComposedRefs(ref, bubble.setControl);
  const state = checked ? "checked" : "unchecked";
  const disabledAttr = disabled ? "" : undefined;

  return (
    <>
      {/* biome-ignore lint/a11y/useSemanticElements: custom control; the hidden input carries the native form value */}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
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
        )}
        onClick={composeHandlers(onClick, (event) => {
          setChecked((prev) => !prev);
          bubble.onControlClick(event);
        })}
      >
        <span className="relative block h-5 w-[34px] rounded-pill bg-line-strong transition-colors group-data-[state=checked]:bg-accent">
          <span
            data-state={state}
            data-disabled={disabledAttr}
            className="absolute top-[3px] left-[3px] block size-3.5 rounded-pill bg-surface transition-transform data-[state=checked]:translate-x-3.5"
          />
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
