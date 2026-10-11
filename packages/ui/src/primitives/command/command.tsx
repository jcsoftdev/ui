"use client";

import {
  type ChangeEvent,
  type ComponentProps,
  createContext,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { composeHandlers, useComposedRefs } from "../../utils/compose.js";
import * as DialogPrimitive from "../dialog/dialog.js";
import { type CommandFilter, commandScore } from "./score.js";
import { type CommandState, CommandStore } from "./store.js";

/**
 * Unstyled command menu (search box plus a filterable, keyboard-navigable listbox) in the
 * shape of the popular React command menu libraries. Parts expose `data-ui-command-*` hooks, `data-selected` and
 * `data-disabled`; the list height is published as `--ui-command-list-height`.
 */

export type { CommandFilter, CommandState };

interface CommandContextValue {
  store: CommandStore;
  rootRef: { current: HTMLDivElement | null };
  listId: string;
  inputId: string;
  labelId: string;
  loop: boolean;
}

const CommandContext = createContext<CommandContextValue | null>(null);
const GroupContext = createContext<{ id: string; forceMount: boolean } | null>(null);
/** True inside `Command.Dialog`, which closes on Escape instead of clearing the query first. */
const InDialogContext = createContext(false);

function useCommandContext(part: string): CommandContextValue {
  const context = useContext(CommandContext);
  if (!context) throw new Error(`<Command.${part}> must be rendered inside <Command>`);
  return context;
}

/** Subscribes to a slice of the command state. The selector must return a primitive or a stable reference. */
export function useCommandState<T>(selector: (state: CommandState) => T): T {
  const { store } = useCommandContext("useCommandState");
  const read = () => selector(store.getState());
  return useSyncExternalStore(store.subscribe, read, read);
}

const ITEM = "[data-ui-command-item]";
const ENABLED_ITEM = `${ITEM}:not([data-disabled])`;
const GROUP = "[data-ui-command-group]";
const GROUP_HEADING = "[data-ui-command-group-heading]";

const srOnly = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  borderWidth: 0,
} as const;

export interface CommandRootProps extends Omit<ComponentProps<"div">, "defaultValue" | "onChange"> {
  /** Accessible name of the search box. */
  label?: string;
  /** Turn off to render results as given (server-side search). Defaults to true. */
  shouldFilter?: boolean;
  /** Scoring override: return 0 to hide an item, higher to rank it first. */
  filter?: CommandFilter;
  /** Controlled highlighted item `value`. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Wrap from the last item to the first and back. Defaults to false. */
  loop?: boolean;
  /** Ctrl+N/P/J/K navigate like ArrowDown/ArrowUp. Defaults to true. */
  vimBindings?: boolean;
}

export function Root({
  label = "Command menu",
  shouldFilter = true,
  filter = commandScore,
  value,
  defaultValue = "",
  onValueChange,
  loop = false,
  vimBindings = true,
  onKeyDown,
  children,
  ref,
  ...props
}: CommandRootProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const composedRef = useComposedRefs<HTMLDivElement>(ref, rootRef);
  const [store] = useState(() => {
    const created = new CommandStore({
      shouldFilter,
      filter,
      controlledValue: value,
      onValueChange,
    });
    created.syncValue(value ?? defaultValue);
    return created;
  });
  const listId = useId();
  const inputId = useId();
  const labelId = useId();
  const [context] = useState<CommandContextValue>(() => ({
    store,
    rootRef,
    listId,
    inputId,
    labelId,
    loop,
  }));
  context.loop = loop;

  const previous = useRef({ shouldFilter, filter });
  useLayoutEffect(() => {
    store.options = { shouldFilter, filter, controlledValue: value, onValueChange };
    if (previous.current.shouldFilter !== shouldFilter || previous.current.filter !== filter) {
      previous.current = { shouldFilter, filter };
      store.refresh();
    }
  });
  useLayoutEffect(() => {
    if (value !== undefined) store.syncValue(value);
  }, [store, value]);
  useEffect(() => store.start(), [store]);

  const keyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    const navigator = createNavigator(context);
    const key = event.key;
    const vim = vimBindings && event.ctrlKey;
    if (key === "ArrowDown" || (vim && (key === "n" || key === "j"))) {
      event.preventDefault();
      if (event.metaKey) navigator.last();
      else if (event.altKey) navigator.group(1);
      else navigator.step(1);
    } else if (key === "ArrowUp" || (vim && (key === "p" || key === "k"))) {
      event.preventDefault();
      if (event.metaKey) navigator.first();
      else if (event.altKey) navigator.group(-1);
      else navigator.step(-1);
    } else if (key === "Home") {
      event.preventDefault();
      navigator.first();
    } else if (key === "End") {
      event.preventDefault();
      navigator.last();
    } else if (key === "Enter") {
      event.preventDefault();
      const id = navigator.selected()?.id;
      if (id) store.select(id);
    }
  };

  return (
    <CommandContext.Provider value={context}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: keys typed in the input bubble up to this container */}
      <div tabIndex={-1} data-ui-command="" {...props} ref={composedRef} onKeyDown={keyDown}>
        <label htmlFor={inputId} id={labelId} style={srOnly}>
          {label}
        </label>
        <Effects />
        {children}
      </div>
    </CommandContext.Provider>
  );
}

/** Applies DOM order and repairs the highlight after every filter pass, once the items have rendered. */
function Effects() {
  const { store, rootRef } = useCommandContext("Root");
  const revision = useSyncExternalStore(store.subscribe, store.getRevision, store.getRevision);
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision is the trigger
  useLayoutEffect(() => {
    store.sort();
    const root = rootRef.current;
    if (!root) return;
    const searchChanged = store.consumeSearchChange();
    const enabled = [...root.querySelectorAll<HTMLElement>(ENABLED_ITEM)];
    const current = store.getState().value;
    const stillValid = enabled.some((item) => item.dataset.value === current);
    if (searchChanged || !stillValid) {
      const first = enabled[0]?.dataset.value ?? "";
      if (first !== current) store.setValue(first);
    }
  }, [revision, store, rootRef]);
  return null;
}

function createNavigator({ store, rootRef, loop }: CommandContextValue) {
  const root = () => rootRef.current;
  const enabled = () => [...(root()?.querySelectorAll<HTMLElement>(ENABLED_ITEM) ?? [])];
  const selected = () =>
    root()?.querySelector<HTMLElement>(`${ITEM}[data-selected="true"]`) ?? null;

  const go = (item: HTMLElement | undefined) => {
    if (!item) return;
    store.setValue(item.dataset.value ?? "");
    const group = item.closest(GROUP);
    const firstInGroup = group?.querySelector(ENABLED_ITEM) === item;
    const heading = firstInGroup ? group?.querySelector(GROUP_HEADING) : null;
    (heading ?? item).scrollIntoView({ block: "nearest" });
  };

  return {
    selected,
    first: () => go(enabled()[0]),
    last: () => go(enabled().at(-1)),
    step(direction: 1 | -1) {
      const items = enabled();
      if (items.length === 0) return;
      const current = selected();
      const index = current ? items.indexOf(current) : -1;
      let next = index === -1 ? (direction === 1 ? 0 : items.length - 1) : index + direction;
      if (next < 0 || next >= items.length) {
        next = loop
          ? (next + items.length) % items.length
          : Math.min(Math.max(next, 0), items.length - 1);
      }
      go(items[next]);
    },
    group(direction: 1 | -1) {
      const items = enabled();
      const current = selected();
      const groups = [...new Set(items.map((item) => item.closest(GROUP)))];
      const index = groups.indexOf(current?.closest(GROUP) ?? null);
      let next = index + direction;
      if (next < 0 || next >= groups.length) {
        if (!loop) return;
        next = (next + groups.length) % groups.length;
      }
      go(items.find((item) => item.closest(GROUP) === groups[next]));
    },
  };
}

export interface CommandInputProps
  extends Omit<ComponentProps<"input">, "value" | "onChange" | "type"> {
  /** Controlled search text. */
  value?: string;
  onValueChange?: (search: string) => void;
}

export function Input({ value, onValueChange, onKeyDown, ref, ...props }: CommandInputProps) {
  const { store, listId, inputId, labelId } = useCommandContext("Input");
  const inDialog = useContext(InDialogContext);
  const search = useSyncExternalStore(
    store.subscribe,
    () => store.getState().search,
    () => store.getState().search,
  );
  const activeId = useSyncExternalStore(
    store.subscribe,
    () => store.activeId(),
    () => undefined,
  );
  useLayoutEffect(() => {
    if (value !== undefined) store.setSearch(value);
  }, [store, value]);

  const change = (next: string) => {
    if (value === undefined) store.setSearch(next);
    onValueChange?.(next);
  };
  // An inline command inside another dialog clears its query on Escape before the dialog
  // sees the key; `data-ui-escape-claim` tells the layer stack to leave it alone.
  const claimsEscape = !inDialog && search !== "";

  return (
    <input
      id={inputId}
      type="text"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      role="combobox"
      aria-expanded={true}
      aria-autocomplete="list"
      aria-controls={listId}
      aria-labelledby={labelId}
      aria-activedescendant={activeId}
      data-ui-command-input=""
      data-ui-escape-claim={claimsEscape ? "" : undefined}
      {...props}
      ref={ref}
      value={search}
      onChange={(event: ChangeEvent<HTMLInputElement>) => change(event.target.value)}
      onKeyDown={composeHandlers(onKeyDown, (event) => {
        if (event.key === "Escape" && claimsEscape && !event.nativeEvent.isComposing) {
          event.preventDefault();
          change("");
        }
      })}
    />
  );
}

export interface CommandListProps extends ComponentProps<"div"> {
  /** Accessible name of the listbox. */
  label?: string;
}

export function List({ label = "Suggestions", children, ref, ...props }: CommandListProps) {
  const { listId } = useCommandContext("List");
  const listRef = useRef<HTMLDivElement | null>(null);
  const sizerRef = useRef<HTMLDivElement | null>(null);
  const composedRef = useComposedRefs<HTMLDivElement>(ref, listRef);

  useEffect(() => {
    const list = listRef.current;
    const sizer = sizerRef.current;
    if (!list || !sizer || typeof ResizeObserver === "undefined") return;
    const update = () =>
      list.style.setProperty("--ui-command-list-height", `${sizer.offsetHeight.toFixed(1)}px`);
    const observer = new ResizeObserver(update);
    observer.observe(sizer);
    update();
    return () => observer.disconnect();
  }, []);

  return (
    <div
      id={listId}
      role="listbox"
      aria-label={label}
      data-ui-command-list=""
      {...props}
      ref={composedRef}
    >
      <div ref={sizerRef} data-ui-command-list-sizer="">
        {children}
      </div>
    </div>
  );
}

export interface CommandItemProps extends Omit<ComponentProps<"div">, "onSelect" | "value"> {
  /** Identity and default search text. Defaults to the item's text content. */
  value?: string;
  /** Extra terms that match this item. */
  keywords?: string[];
  disabled?: boolean;
  onSelect?: (value: string) => void;
  /** Keep rendering the item while a search would hide it. */
  forceMount?: boolean;
}

export function Item({
  value: valueProp,
  keywords,
  disabled = false,
  onSelect,
  forceMount = false,
  onClick,
  onPointerMove,
  children,
  ref,
  ...props
}: CommandItemProps) {
  const { store } = useCommandContext("Item");
  const group = useContext(GroupContext);
  const id = useId();
  const elementRef = useRef<HTMLDivElement | null>(null);
  const [derived, setDerived] = useState("");
  const value = valueProp !== undefined ? valueProp.trim() : derived;
  const onSelectRef = useRef(onSelect);
  const keywordsKey = keywords?.join("\u0001") ?? "";
  const groupId = group?.id;

  const visible = useSyncExternalStore(
    store.subscribe,
    () => forceMount || store.isItemVisible(id),
    () => true,
  );
  const selected = useSyncExternalStore(
    store.subscribe,
    () => {
      const current = store.getState().value;
      return current !== "" && current === store.itemValue(id);
    },
    () => false,
  );

  useLayoutEffect(() => {
    onSelectRef.current = onSelect;
  });
  useLayoutEffect(() => {
    if (valueProp === undefined) setDerived(elementRef.current?.textContent?.trim() ?? "");
  });
  useLayoutEffect(() => () => store.removeItem(id), [store, id]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: keywordsKey stands for keywords
  useLayoutEffect(() => {
    store.upsertItem(
      id,
      {
        value,
        keywords: keywords ?? [],
        groupId,
        forceMount,
        onSelect: () => onSelectRef.current?.(value),
      },
      elementRef.current,
    );
  }, [store, id, value, keywordsKey, groupId, forceMount]);

  const composedRef = useComposedRefs<HTMLDivElement>(
    ref,
    elementRef,
    (node: HTMLDivElement | null) => store.setItemElement(id, node),
  );

  if (!visible) return null;
  return (
    // biome-ignore lint/a11y/useFocusableInteractive lint/a11y/useKeyWithClickEvents: options are driven through aria-activedescendant and the root key handler
    <div
      id={id}
      role="option"
      aria-selected={selected}
      aria-disabled={disabled || undefined}
      data-ui-command-item=""
      data-selected={selected}
      data-disabled={disabled ? "" : undefined}
      data-value={value}
      {...props}
      ref={composedRef}
      onPointerMove={composeHandlers(onPointerMove, () => {
        if (!disabled) store.setValue(value);
      })}
      onClick={composeHandlers(onClick, () => {
        if (!disabled) onSelect?.(value);
      })}
    >
      {children}
    </div>
  );
}

export interface CommandGroupProps extends Omit<ComponentProps<"div">, "heading"> {
  heading?: ReactNode;
  /** Keep the group visible while a search would hide it. */
  forceMount?: boolean;
}

export function Group({ heading, forceMount = false, children, ref, ...props }: CommandGroupProps) {
  const { store } = useCommandContext("Group");
  const id = useId();
  const headingId = useId();
  const [scope] = useState(() => ({ id, forceMount }));
  scope.forceMount = forceMount;
  useLayoutEffect(() => {
    store.upsertGroup(id);
    return () => store.removeGroup(id);
  }, [store, id]);
  const visible = useSyncExternalStore(
    store.subscribe,
    () => store.isGroupVisible(id, forceMount),
    () => true,
  );
  const composedRef = useComposedRefs<HTMLDivElement>(ref, (node: HTMLDivElement | null) =>
    store.setGroupElement(id, node),
  );
  return (
    <div
      role="presentation"
      hidden={visible ? undefined : true}
      data-ui-command-group=""
      {...props}
      ref={composedRef}
    >
      {heading ? (
        <div aria-hidden="true" id={headingId} data-ui-command-group-heading="">
          {heading}
        </div>
      ) : null}
      {/* biome-ignore lint/a11y/useSemanticElements: a div keeps the group unstyled and portable */}
      <div
        role="group"
        aria-labelledby={heading ? headingId : undefined}
        data-ui-command-group-items=""
      >
        <GroupContext.Provider value={scope}>{children}</GroupContext.Provider>
      </div>
    </div>
  );
}

export interface CommandSeparatorProps extends ComponentProps<"div"> {
  /** Keep the separator while a search is active. */
  alwaysRender?: boolean;
}

export function Separator({ alwaysRender = false, ...props }: CommandSeparatorProps) {
  const searching = useCommandState((state) => state.search !== "");
  if (searching && !alwaysRender) return null;
  // Decorative: a listbox may only contain options and groups, so the separator is hidden from assistive tech.
  return <div aria-hidden="true" data-ui-command-separator="" {...props} />;
}

export function Empty(props: ComponentProps<"div">) {
  const { store } = useCommandContext("Empty");
  const empty = useSyncExternalStore(
    store.subscribe,
    () => store.getRevision() > 0 && store.getState().filtered.count === 0,
    () => false,
  );
  if (!empty) return null;
  return <div role="presentation" data-ui-command-empty="" {...props} />;
}

export interface CommandLoadingProps extends ComponentProps<"div"> {
  /** Progress from 0 to 100. */
  progress?: number;
  label?: string;
}

/** A progress indicator for async results. Place it next to `List`: a listbox may only contain options and groups. */
export function Loading({
  progress,
  label = "Loading...",
  children,
  ...props
}: CommandLoadingProps) {
  return (
    <div
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      data-ui-command-loading=""
      {...props}
    >
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

export interface CommandDialogProps extends CommandRootProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Portal target. Defaults to `document.body`. */
  container?: HTMLElement | null;
  overlayClassName?: string;
  contentClassName?: string;
  onOpenAutoFocus?: (event: Event) => void;
  onCloseAutoFocus?: (event: Event) => void;
  onEscapeKeyDown?: (event: KeyboardEvent) => void;
}

/** A modal dialog (focus trap, scroll lock, Escape and outside dismissal) around a command menu. */
export function Dialog({
  open,
  onOpenChange,
  container,
  overlayClassName,
  contentClassName,
  onOpenAutoFocus,
  onCloseAutoFocus,
  onEscapeKeyDown,
  label,
  children,
  ...rootProps
}: CommandDialogProps) {
  const rootLabel = label ?? "Command menu";
  return (
    <DialogPrimitive.Root
      {...(open !== undefined ? { open } : {})}
      {...(onOpenChange ? { onOpenChange } : {})}
    >
      <DialogPrimitive.Portal container={container}>
        <DialogPrimitive.Overlay className={overlayClassName} data-ui-command-overlay="" />
        <DialogPrimitive.Content
          aria-label={rootLabel}
          aria-labelledby={undefined}
          aria-describedby={undefined}
          className={contentClassName}
          data-ui-command-dialog=""
          {...(onOpenAutoFocus ? { onOpenAutoFocus } : {})}
          {...(onCloseAutoFocus ? { onCloseAutoFocus } : {})}
          {...(onEscapeKeyDown ? { onEscapeKeyDown } : {})}
        >
          <InDialogContext.Provider value={true}>
            <Root label={rootLabel} {...rootProps}>
              {children}
            </Root>
          </InDialogContext.Provider>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
