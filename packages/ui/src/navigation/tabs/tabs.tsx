"use client";

import {
  type ComponentPropsWithRef,
  createContext,
  type KeyboardEvent,
  type MouseEvent,
  useContext,
  useId,
} from "react";
import { cn } from "../../utils/cn.js";
import { composeHandlers, useComposedRefs } from "../../utils/compose.js";
import {
  type RovingDirection,
  type RovingOrientation,
  useRovingFocus,
} from "../../utils/roving-focus.js";
import { useControllableState } from "../../utils/use-controllable-state.js";

type TabsActivationMode = "automatic" | "manual";
type GetItemProps = ReturnType<typeof useRovingFocus>["getItemProps"];

interface TabsContextValue {
  baseId: string;
  value: string;
  setValue: (value: string) => void;
  orientation: RovingOrientation;
  dir: RovingDirection;
  activationMode: TabsActivationMode;
}

const TabsContext = createContext<TabsContextValue | null>(null);
const TabsListContext = createContext<GetItemProps | null>(null);

function useTabsContext(part: string): TabsContextValue {
  const context = useContext(TabsContext);
  if (!context) throw new Error(`\`${part}\` must be used within \`Tabs\``);
  return context;
}

const triggerId = (baseId: string, value: string) => `${baseId}-trigger-${value}`;
const contentId = (baseId: string, value: string) => `${baseId}-content-${value}`;

export interface TabsProps
  extends Omit<ComponentPropsWithRef<"div">, "dir" | "defaultValue" | "onChange"> {
  /** Controlled active tab. */
  value?: string | undefined;
  /** Initial active tab when uncontrolled. */
  defaultValue?: string | undefined;
  onValueChange?: ((value: string) => void) | undefined;
  orientation?: RovingOrientation | undefined;
  dir?: RovingDirection | undefined;
  /** `automatic` activates a tab on focus; `manual` waits for Enter, Space or a click. */
  activationMode?: TabsActivationMode | undefined;
}

/**
 * To sync the active tab with a search param, use the controlled pattern:
 * `value={param}` + `onValueChange={(v) => updateParam(v)}`.
 */
export function Tabs({
  className,
  value: valueProp,
  defaultValue,
  onValueChange,
  orientation = "horizontal",
  dir = "ltr",
  activationMode = "automatic",
  ...props
}: TabsProps) {
  const baseId = useId();
  const [value, setValue] = useControllableState({
    prop: valueProp,
    defaultProp: defaultValue ?? "",
    onChange: onValueChange,
  });

  return (
    <TabsContext.Provider value={{ baseId, value, setValue, orientation, dir, activationMode }}>
      <div
        dir={dir}
        data-orientation={orientation}
        className={cn("flex min-w-0 flex-col", className)}
        {...props}
      />
    </TabsContext.Provider>
  );
}

export interface TabsListProps extends ComponentPropsWithRef<"div"> {
  /** Wraps arrow navigation around the ends. Defaults to `true`. */
  loop?: boolean | undefined;
}

export function TabsList({ className, loop = true, ref, onFocus, ...props }: TabsListProps) {
  const context = useTabsContext("TabsList");
  const roving = useRovingFocus({
    orientation: context.orientation,
    dir: context.dir,
    loop,
    activeId: context.value,
  });
  const { ref: rovingRef, onFocus: rovingOnFocus, tabIndex } = roving.rootProps;
  const composedRef = useComposedRefs<HTMLDivElement>(rovingRef, ref);

  return (
    <TabsListContext.Provider value={roving.getItemProps}>
      <div
        role="tablist"
        aria-orientation={context.orientation}
        tabIndex={tabIndex}
        {...props}
        ref={composedRef}
        onFocus={composeHandlers(onFocus, rovingOnFocus)}
        className={cn(
          "@container/tabs flex max-w-full gap-0.5 overflow-x-auto overscroll-x-contain border-b-divider px-2",
          className,
        )}
      />
    </TabsListContext.Provider>
  );
}

export interface TabsTriggerProps extends Omit<ComponentPropsWithRef<"button">, "value"> {
  value: string;
  /** Optional record count shown after the label. */
  count?: number;
}

export function TabsTrigger({
  className,
  count,
  children,
  value,
  disabled = false,
  onMouseDown,
  onKeyDown,
  onFocus,
  ...props
}: TabsTriggerProps) {
  const context = useTabsContext("TabsTrigger");
  const getItemProps = useContext(TabsListContext);
  if (!getItemProps) throw new Error("`TabsTrigger` must be used within `TabsList`");
  const selected = value === context.value;

  const item = getItemProps<HTMLButtonElement>(value, {
    disabled,
    onKeyDown: composeHandlers(onKeyDown, (event: KeyboardEvent<HTMLButtonElement>) => {
      if (disabled || event.target !== event.currentTarget) return;
      if (event.key === " " || event.key === "Enter") context.setValue(value);
    }),
    onFocus: composeHandlers(onFocus, () => {
      if (!selected && !disabled && context.activationMode !== "manual") context.setValue(value);
    }),
  });

  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      aria-controls={contentId(context.baseId, value)}
      data-state={selected ? "active" : "inactive"}
      data-orientation={context.orientation}
      data-disabled={disabled ? "" : undefined}
      disabled={disabled}
      id={triggerId(context.baseId, value)}
      {...props}
      {...item}
      onMouseDown={composeHandlers(onMouseDown, (event: MouseEvent<HTMLButtonElement>) => {
        if (!disabled && event.button === 0 && !event.ctrlKey) {
          event.currentTarget.focus();
          context.setValue(value);
        } else {
          event.preventDefault();
        }
      })}
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent px-2.5 @max-[420px]/tabs:px-2 pt-2.75 pb-2.5 text-control text-ink-3 hover:text-ink focus-visible:-outline-offset-2 data-[state=active]:border-accent-word data-[state=active]:text-ink",
        className,
      )}
    >
      {children}
      {count !== undefined && <span className="text-count text-ink-3">{count}</span>}
    </button>
  );
}

export interface TabsContentProps extends Omit<ComponentPropsWithRef<"div">, "value"> {
  value: string;
  /** Keeps the panel mounted (hidden) while inactive. */
  forceMount?: boolean | undefined;
}

export function TabsContent({
  className,
  value,
  forceMount,
  children,
  ...props
}: TabsContentProps) {
  const context = useTabsContext("TabsContent");
  const selected = value === context.value;
  const present = forceMount || selected;
  if (!present) return null;

  return (
    <div
      data-state={selected ? "active" : "inactive"}
      data-orientation={context.orientation}
      role="tabpanel"
      aria-labelledby={triggerId(context.baseId, value)}
      id={contentId(context.baseId, value)}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: WAI-ARIA tabpanels are focusable so keyboard users can reach the content
      tabIndex={0}
      {...props}
      className={cn(className)}
    >
      {children}
    </div>
  );
}
