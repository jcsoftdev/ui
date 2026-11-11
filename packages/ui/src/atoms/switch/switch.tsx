"use client";

import { type ComponentProps, type ReactNode, useId, useRef } from "react";
import { intentAttributes } from "../../intent/attributes.js";
import type { IntentProps } from "../../intent/types.js";
import { useIntentTarget } from "../../intent/use-intent-target.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { composeHandlers, useComposedRefs } from "../../utils/compose.js";
import { BubbleInput, useFormBubble, useFormReset } from "../../utils/form-bubble.js";
import { useControllableState } from "../../utils/use-controllable-state.js";
import { touchHitArea } from "../internal/hit-area.js";
import { describedByProps, LabelledControl } from "../internal/labelled-control.js";

export type SwitchPart = "root" | "track" | "thumb" | "wrapper" | "label" | "description";

export interface SwitchProps
  extends Omit<
      ComponentProps<"button">,
      "value" | "defaultValue" | "checked" | "defaultChecked" | "children"
    >,
    IntentProps {
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<SwitchPart>;
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  required?: boolean;
  name?: string;
  value?: string;
  /** Id of the `<form>` the switch belongs to when it is rendered outside it. */
  form?: string;
  label?: ReactNode;
  description?: ReactNode;
}

export function Switch({
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
  description,
  onClick,
  intent,
  intentKey,
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
  const composedRef = useComposedRefs(
    ref,
    bubble.setControl,
    useIntentTarget<HTMLButtonElement>({ intent, intentKey }, { role: "switch" }),
  );
  const state = checked ? "checked" : "unchecked";
  const disabledAttr = disabled ? "" : undefined;
  const generatedId = useId();
  const controlId = label === undefined ? props.id : (props.id ?? generatedId);
  const descriptionId = `${generatedId}-description`;

  const control = (
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
        {...(label === undefined ? {} : { id: controlId })}
        {...intentAttributes({ intent, intentKey })}
        {...props}
        {...describedByProps(props["aria-describedby"], descriptionId, description)}
        ref={composedRef}
        className={cn(
          touchHitArea,
          "group inline-flex size-10 shrink-0 items-center justify-center",
          classNames?.root,
          className,
        )}
        onClick={composeHandlers(onClick, (event) => {
          setChecked((prev) => !prev);
          bubble.onControlClick(event);
        })}
      >
        <span
          className={cn(
            "relative block h-5 w-8.5 rounded-pill bg-line-strong transition-colors group-data-[state=checked]:bg-accent",
            classNames?.track,
          )}
        >
          <span
            data-state={state}
            data-disabled={disabledAttr}
            className={cn(
              "absolute top-0.75 left-0.75 block size-3.5 rounded-pill bg-surface transition-transform data-[state=checked]:translate-x-3.5",
              classNames?.thumb,
            )}
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

  if (label === undefined && description === undefined) return control;
  return (
    <LabelledControl
      control={control}
      controlId={controlId}
      label={label}
      description={description}
      descriptionId={descriptionId}
      disabled={disabled}
      classNames={classNames}
    />
  );
}
