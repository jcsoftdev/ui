"use client";

import { type ComponentPropsWithRef, createContext, type ReactNode, useContext } from "react";
import { cn } from "../../utils/cn.js";
import { composeHandlers, useComposedRefs } from "../../utils/compose.js";
import {
  type RovingDirection,
  type RovingOrientation,
  useRovingFocus,
} from "../../utils/roving-focus.js";
import { useControllableState } from "../../utils/use-controllable-state.js";

type GetItemProps = ReturnType<typeof useRovingFocus>["getItemProps"];

interface SegmentedContextValue {
  value: string;
  setValue: (value: string) => void;
  disabled: boolean;
  block: boolean;
  allowDeselect: boolean;
  getItemProps: GetItemProps | null;
}

const SegmentedContext = createContext<SegmentedContextValue | null>(null);

export interface SegmentedOption {
  value: string;
  label: ReactNode;
  disabled?: boolean | undefined;
}

export interface SegmentedProps
  extends Omit<ComponentPropsWithRef<"div">, "dir" | "defaultValue" | "onChange"> {
  /** Controlled selected value; an empty string means nothing selected. */
  value?: string | undefined;
  defaultValue?: string | undefined;
  onValueChange?: ((value: string) => void) | undefined;
  /** Disables every item. */
  disabled?: boolean | undefined;
  /** Set to `false` to put every item in the tab order instead of roving. Defaults to `true`. */
  rovingFocus?: boolean | undefined;
  /** Items from data, rendered when no children are given. */
  options?: SegmentedOption[] | undefined;
  /** Full-width selector with equal-width, control-height items. */
  block?: boolean | undefined;
  /** When `false`, pressing the selected item keeps it selected. Defaults to `true`. */
  allowDeselect?: boolean | undefined;
  orientation?: RovingOrientation | undefined;
  dir?: RovingDirection | undefined;
  loop?: boolean | undefined;
}

/** Exclusive selector for 2-4 options. Like Radix `type="single"`, it uses the `radiogroup` role. */
export function Segmented({
  className,
  value: valueProp,
  defaultValue,
  onValueChange,
  disabled = false,
  rovingFocus = true,
  options,
  block = false,
  allowDeselect = true,
  children,
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
        block,
        allowDeselect,
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
          "max-w-full overflow-x-auto rounded-button bg-seg-track p-0.75",
          block ? "flex w-full" : "inline-flex",
          className,
        )}
      >
        {children ??
          options?.map((option) => (
            <SegmentedItem key={option.value} value={option.value} disabled={option.disabled}>
              {option.label}
            </SegmentedItem>
          ))}
      </div>
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
        if (!disabled) context.setValue(pressed && context.allowDeselect ? "" : value);
      })}
      className={cn(
        "inline-flex h-control-sm shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-button px-3.5 @max-[420px]:px-2.5 text-control text-ink-2 hover:text-ink data-[state=on]:bg-seg-on data-[state=on]:text-ink data-[state=on]:shadow-sel",
        context.block && "h-control flex-1 shrink justify-center",
        className,
      )}
    />
  );
}
