"use client";

import { type ComponentPropsWithRef, createContext, useContext } from "react";
import { cn } from "../../utils/cn.js";
import { composeHandlers, useComposedRefs } from "../../utils/compose.js";
import {
  type RovingDirection,
  type RovingOrientation,
  useRovingFocus,
} from "../../utils/roving-focus.js";
import { useControllableState } from "../../utils/use-controllable-state.js";
import { nextSegmentedValue } from "./model.js";

type GetItemProps = ReturnType<typeof useRovingFocus>["getItemProps"];

interface SegmentedContextValue {
  value: string;
  setValue: (value: string) => void;
  disabled: boolean;
  deselectable: boolean;
  getItemProps: GetItemProps | null;
}

const SegmentedContext = createContext<SegmentedContextValue | null>(null);

export interface SegmentedProps
  extends Omit<ComponentPropsWithRef<"div">, "dir" | "defaultValue" | "onChange"> {
  /** Controlled selected value; an empty string means nothing selected. */
  value?: string | undefined;
  defaultValue?: string | undefined;
  onValueChange?: ((value: string) => void) | undefined;
  /** Disables every item. */
  disabled?: boolean | undefined;
  /** Lets a second press on the selected item clear the selection. By default the selected item stays selected. */
  deselectable?: boolean | undefined;
  /** Set to `false` to put every item in the tab order instead of roving. Defaults to `true`. */
  rovingFocus?: boolean | undefined;
  orientation?: RovingOrientation | undefined;
  dir?: RovingDirection | undefined;
  loop?: boolean | undefined;
}

/**
 * Exclusive selector for 2-4 options. Like Radix `type="single"`, it uses the `radiogroup` role.
 * Pressing the selected item keeps it selected; pass `deselectable` to let it clear instead.
 */
export function Segmented({
  className,
  value: valueProp,
  defaultValue,
  onValueChange,
  disabled = false,
  deselectable = false,
  rovingFocus = true,
  orientation,
  dir = "ltr",
  loop = true,
  ref,
  onFocus,
  ...props
}: SegmentedProps) {
  const [value, setValue] = useControllableState({
    prop: valueProp,
    defaultProp: defaultValue ?? "",
    onChange: onValueChange,
  });
  const roving = useRovingFocus({ orientation, dir, loop, activeId: value || null });
  const { ref: rovingRef, onFocus: rovingOnFocus, tabIndex } = roving.rootProps;
  const composedRef = useComposedRefs<HTMLDivElement>(rovingRef, ref);

  return (
    <SegmentedContext.Provider
      value={{
        value,
        setValue,
        disabled,
        deselectable,
        getItemProps: rovingFocus ? roving.getItemProps : null,
      }}
    >
      <div
        role="radiogroup"
        dir={dir}
        {...(rovingFocus ? { tabIndex } : {})}
        {...props}
        ref={composedRef}
        onFocus={rovingFocus ? composeHandlers(onFocus, rovingOnFocus) : onFocus}
        className={cn(
          "inline-flex max-w-full overflow-x-auto rounded-button bg-seg-track p-0.75",
          className,
        )}
      />
    </SegmentedContext.Provider>
  );
}

export interface SegmentedItemProps extends Omit<ComponentPropsWithRef<"button">, "value"> {
  value: string;
}

export function SegmentedItem({
  className,
  value,
  disabled: disabledProp,
  onClick,
  ...props
}: SegmentedItemProps) {
  const context = useContext(SegmentedContext);
  if (!context) throw new Error("`SegmentedItem` must be used within `Segmented`");
  const pressed = context.value === value;
  const disabled = context.disabled || disabledProp;
  const item = context.getItemProps?.<HTMLButtonElement>(value, {
    disabled,
    onKeyDown: props.onKeyDown,
    onFocus: props.onFocus,
  });

  return (
    // biome-ignore lint/a11y/useSemanticElements: toggle-style radio; native inputs cannot be deselected
    <button
      type="button"
      role="radio"
      aria-checked={pressed}
      data-state={pressed ? "on" : "off"}
      data-disabled={disabled ? "" : undefined}
      disabled={disabled}
      {...props}
      {...item}
      onClick={composeHandlers(onClick, () => {
        if (!disabled)
          context.setValue(nextSegmentedValue(context.value, value, context.deselectable));
      })}
      className={cn(
        "inline-flex h-control-sm shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-button px-3.5 @max-[420px]:px-2.5 text-control text-ink-2 hover:text-ink data-[state=on]:bg-seg-on data-[state=on]:text-ink data-[state=on]:shadow-sel",
        className,
      )}
    />
  );
}
