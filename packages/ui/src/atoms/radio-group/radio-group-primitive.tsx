"use client";

import {
  type ComponentProps,
  createContext,
  type ReactNode,
  useContext,
  useRef,
  useState,
} from "react";
import { composeHandlers, useComposedRefs } from "../../utils/compose.js";
import { BubbleInput, useFormBubble, useFormReset } from "../../utils/form-bubble.js";
import {
  type RovingDirection,
  type RovingOrientation,
  useRovingFocus,
} from "../../utils/roving-focus.js";
import { useControllableState } from "../../utils/use-controllable-state.js";

// Internal building blocks shared by RadioGroup and AccentPicker; not public API.

interface RadioGroupContextValue {
  value: string | null;
  onValueChange: (value: string) => void;
  name: string | undefined;
  form: string | undefined;
  required: boolean;
  disabled: boolean;
  getItemProps: ReturnType<typeof useRovingFocus>["getItemProps"];
}

const RadioGroupContext = createContext<RadioGroupContextValue | null>(null);

function useRadioGroupContext() {
  const context = useContext(RadioGroupContext);
  if (!context) throw new Error("RadioGroupItem must be rendered inside a RadioGroupRoot.");
  return context;
}

export interface RadioGroupRootProps
  extends Omit<ComponentProps<"div">, "defaultValue" | "dir" | "onChange"> {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  name?: string;
  form?: string;
  required?: boolean;
  disabled?: boolean;
  orientation?: RovingOrientation;
  dir?: RovingDirection;
  loop?: boolean;
}

export function RadioGroupRoot({
  value: valueProp,
  defaultValue,
  onValueChange,
  name,
  form,
  required = false,
  disabled = false,
  orientation,
  dir,
  loop = true,
  ref,
  ...props
}: RadioGroupRootProps) {
  const [value, setValue] = useControllableState<string | null>({
    prop: valueProp,
    defaultProp: defaultValue ?? null,
    onChange: onValueChange as ((value: string | null) => void) | undefined,
  });
  const roving = useRovingFocus({ orientation, dir, loop, activeId: value });
  const { ref: rovingRef, ...rovingRootProps } = roving.rootProps;
  const [control, setControl] = useState<HTMLElement | null>(null);
  const composedRef = useComposedRefs<HTMLDivElement>(ref, rovingRef, setControl);
  const initialRef = useRef(value);
  useFormReset(control, form, () => setValue(initialRef.current));

  return (
    <RadioGroupContext
      value={{
        value,
        onValueChange: setValue,
        name,
        form,
        required,
        disabled,
        getItemProps: roving.getItemProps,
      }}
    >
      <div
        role="radiogroup"
        aria-required={required}
        aria-orientation={orientation}
        data-disabled={disabled ? "" : undefined}
        dir={dir}
        {...rovingRootProps}
        {...props}
        onFocus={composeHandlers(props.onFocus, rovingRootProps.onFocus)}
        ref={composedRef}
      />
    </RadioGroupContext>
  );
}

const ItemContext = createContext<{ checked: boolean; disabled: boolean } | null>(null);

export interface RadioGroupItemProps
  extends Omit<ComponentProps<"button">, "value" | "defaultValue" | "checked" | "defaultChecked"> {
  value: string;
}

const ARROW_KEYS = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];

export function RadioGroupItem({
  value,
  disabled,
  children,
  onClick,
  onKeyDown,
  onFocus,
  ref,
  ...props
}: RadioGroupItemProps) {
  const group = useRadioGroupContext();
  const bubble = useFormBubble(group.form);
  const composedRef = useComposedRefs(ref, bubble.setControl);
  const isDisabled = group.disabled || !!disabled;
  const checked = group.value === value;
  const roving = group.getItemProps(value, {
    disabled: isDisabled,
    onKeyDown: composeHandlers(onKeyDown, (event) => {
      if (event.key === "Enter") event.preventDefault();
    }),
    onFocus,
    // Arrow keys check the radio they land on; Home/End only move focus.
    onNavigate: (target, key) => {
      if (ARROW_KEYS.includes(key)) target.click();
    },
  });

  return (
    <ItemContext value={{ checked, disabled: isDisabled }}>
      {/* biome-ignore lint/a11y/useSemanticElements: custom control; the hidden input carries the native form value */}
      <button
        type="button"
        role="radio"
        aria-checked={checked}
        data-state={checked ? "checked" : "unchecked"}
        data-disabled={isDisabled ? "" : undefined}
        disabled={isDisabled}
        value={value}
        {...props}
        {...roving}
        ref={composedRef}
        onClick={composeHandlers(onClick, (event) => {
          if (!checked) group.onValueChange(value);
          bubble.onControlClick(event, !checked);
        })}
      >
        {children}
      </button>
      {bubble.isFormControl ? (
        <BubbleInput
          type="radio"
          checked={checked}
          bubble={bubble}
          name={group.name}
          value={value}
          required={group.required}
          disabled={isDisabled}
          form={group.form}
        />
      ) : null}
    </ItemContext>
  );
}

export interface RadioGroupIndicatorProps extends ComponentProps<"span"> {
  forceMount?: boolean;
  children?: ReactNode;
}

export function RadioGroupIndicator({ forceMount, ...props }: RadioGroupIndicatorProps) {
  const item = useContext(ItemContext);
  if (!item) throw new Error("RadioGroupIndicator must be rendered inside a RadioGroupItem.");
  if (!forceMount && !item.checked) return null;
  return (
    <span
      data-state={item.checked ? "checked" : "unchecked"}
      data-disabled={item.disabled ? "" : undefined}
      {...props}
    />
  );
}
