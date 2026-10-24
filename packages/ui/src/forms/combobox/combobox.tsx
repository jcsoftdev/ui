"use client";

import {
  type ComponentProps,
  type KeyboardEvent,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useUiStrings } from "../../i18n/index.js";
import { X } from "../../icons/index.js";
import * as PopoverPrimitive from "../../primitives/popover/popover.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { useComposedRefs } from "../../utils/compose.js";
import { type Material, materialClass } from "../../utils/material.js";
import { useControllableState } from "../../utils/use-controllable-state.js";
import {
  filterItems,
  flattenItems,
  type ListboxGroup,
  type ListboxOption,
  matchesQuery,
  moveActive,
} from "../internal/listbox.js";
import { LISTBOX_SURFACE, ListboxItems, optionDomId } from "../internal/listbox-items.js";

export type ComboboxOption = ListboxOption;
export type ComboboxGroup = ListboxGroup<ComboboxOption>;

export type ComboboxPart = "root" | "input" | "clear" | "content" | "option" | "group" | "status";

export interface ComboboxProps
  extends Omit<
    ComponentProps<"input">,
    "value" | "defaultValue" | "onChange" | "type" | "role" | "size"
  > {
  /** Options, optionally nested in labelled groups. For async search, pass the current results. */
  options: readonly (ComboboxOption | ComboboxGroup)[];
  /** Selected option value (controlled). `""` means nothing is selected. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string, option: ComboboxOption | null) => void;
  /**
   * Called on every keystroke with the text typed, and with `""` when the search resets. Debounce
   * in the caller before fetching; the component never delays or cancels requests.
   */
  onSearchChange?: (query: string) => void;
  /**
   * Local filtering. `true` (default) matches label, description and keywords ignoring case and
   * accents; `false` shows `options` as given (server-side search); a function decides per option.
   */
  filter?: boolean | ((option: ComboboxOption, query: string) => boolean);
  /** Most options rendered at once. Default 50. */
  maxVisible?: number;
  /** Shows the loading status, e.g. while an async search is in flight. */
  loading?: boolean;
  loadingText?: string;
  /** Shown when nothing matches. Defaults to the localized "No results". */
  emptyText?: string;
  /** Shows a button that clears the selection. Default `true`. */
  clearable?: boolean;
  clearLabel?: string;
  /** Label to show for `value` while it is not (yet) among `options`, e.g. after an async search moved on. */
  valueLabel?: string;
  /** Submits the value (not the typed text) with a surrounding `<form>` through a hidden input. */
  name?: string;
  invalid?: boolean;
  /**
   * `required` always sets `aria-required`. The native attribute, which blocks form submission
   * with the browser's own bubble before your validation can render, is added only when this is
   * `true`. Default `false`.
   */
  nativeRequired?: boolean;
  size?: "sm" | "md";
  /** Portal target for the popup. Defaults to `document.body`; pass an element to keep a scoped `data-style`. */
  container?: HTMLElement | null;
  /** Popup surface material; see `PopoverContent`. */
  material?: Material;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the root and is merged last. */
  classNames?: ClassNames<ComboboxPart>;
}

/**
 * Searchable single select (WAI-ARIA combobox with a listbox popup). The input shows the typed
 * text while editing and the selected label otherwise; focus never leaves the input and the
 * highlighted option is announced through `aria-activedescendant`. Works with local options or
 * with results the caller loads from `onSearchChange`.
 */
export function Combobox({
  options,
  value: valueProp,
  defaultValue = "",
  onValueChange,
  onSearchChange,
  filter = true,
  maxVisible = 50,
  loading = false,
  loadingText,
  emptyText,
  clearable = true,
  clearLabel,
  valueLabel,
  name,
  invalid,
  required,
  nativeRequired = false,
  size = "md",
  container,
  material,
  disabled,
  className,
  classNames,
  ref,
  id,
  onFocus,
  onClick,
  onBlur,
  onKeyDown,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-invalid": ariaInvalid,
  ...props
}: ComboboxProps) {
  const strings = useUiStrings();
  const autoId = useId();
  const inputId = id ?? autoId;
  const listId = `${inputId}-listbox`;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const composedRef = useComposedRefs<HTMLInputElement>(ref, inputRef);
  const allOptions = useMemo(() => flattenItems(options), [options]);
  const [value, setValue] = useControllableState<string>({
    prop: valueProp,
    defaultProp: defaultValue,
    onChange: (next) =>
      onValueChange?.(next, allOptions.find((option) => option.value === next) ?? null),
  });
  const [query, setQuery] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const text = query ?? "";
  const items = useMemo(() => {
    const predicate =
      filter === false
        ? () => true
        : typeof filter === "function"
          ? (option: ComboboxOption) => filter(option, text)
          : (option: ComboboxOption) => matchesQuery(option, text);
    return filterItems(options, predicate, maxVisible);
  }, [options, filter, text, maxVisible]);
  const flat = useMemo(() => flattenItems(items), [items]);

  const selected = value === "" ? undefined : allOptions.find((option) => option.value === value);
  const selectedLabel = selected?.label ?? (value === "" ? "" : (valueLabel ?? ""));
  const isOpen = open && !disabled;
  const showList = isOpen && flat.length > 0;
  const showEmpty = isOpen && !loading && flat.length === 0;
  const activeIndex =
    flat[active] && !flat[active]?.disabled ? active : moveActive(flat, -1, "first");
  // biome-ignore lint/correctness/useExhaustiveDependencies: the highlight restarts when the text or the open state changes, not on every new results array.
  useEffect(() => setActive(0), [query, isOpen]);
  useEffect(() => {
    if (!showList || activeIndex < 0) return;
    document
      .getElementById(optionDomId(listId, activeIndex))
      ?.scrollIntoView?.({ block: "nearest" });
  }, [showList, activeIndex, listId]);

  const resetSearch = () => {
    if (query !== null) onSearchChange?.("");
    setQuery(null);
  };

  const pick = (option: ComboboxOption | undefined) => {
    if (!option || option.disabled) return;
    setValue(option.value);
    resetSearch();
    setOpen(false);
  };

  const clear = () => {
    setValue("");
    resetSearch();
    setOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const { key } = event;
    if (key === "ArrowDown") {
      event.preventDefault();
      if (!isOpen) setOpen(true);
      else setActive(moveActive(flat, activeIndex, "next"));
    } else if (key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) setOpen(true);
      else setActive(moveActive(flat, activeIndex, "prev"));
    } else if (key === "Enter") {
      if (showList && flat[activeIndex]) {
        event.preventDefault();
        pick(flat[activeIndex]);
      }
    } else if (key === "Escape") {
      if (isOpen) {
        event.preventDefault();
        setOpen(false);
      } else if (query !== null) {
        event.preventDefault();
        resetSearch();
      }
    } else if (key === "Backspace" && clearable && text === "" && query !== null && selected) {
      clear();
    }
  };

  const hasClear = clearable && !disabled && value !== "";

  return (
    <PopoverPrimitive.Root open={isOpen} onOpenChange={setOpen}>
      <PopoverPrimitive.Anchor asChild>
        <div
          ref={rootRef}
          className={cn("relative flex w-full min-w-0", classNames?.root, className)}
        >
          <input
            {...props}
            ref={composedRef}
            id={inputId}
            type="text"
            role="combobox"
            data-ui-layer=""
            autoComplete="off"
            aria-expanded={isOpen}
            aria-controls={isOpen ? listId : undefined}
            aria-autocomplete="list"
            aria-activedescendant={
              showList && activeIndex >= 0 ? optionDomId(listId, activeIndex) : undefined
            }
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            aria-invalid={ariaInvalid ?? (invalid || undefined)}
            aria-required={required || undefined}
            required={nativeRequired ? required : undefined}
            disabled={disabled}
            value={query ?? selectedLabel}
            onFocus={(event) => {
              onFocus?.(event);
              event.currentTarget.select();
              setOpen(true);
            }}
            onClick={(event) => {
              onClick?.(event);
              setOpen(true);
            }}
            onChange={(event) => {
              setQuery(event.target.value);
              onSearchChange?.(event.target.value);
              setOpen(true);
            }}
            onBlur={(event) => {
              onBlur?.(event);
              setOpen(false);
              resetSearch();
            }}
            onKeyDown={handleKeyDown}
            className={cn(
              "w-full min-w-0 rounded-input border-control bg-surface-control pl-3 text-control text-ink placeholder:text-ink-3 focus:border-transparent focus:outline-2 focus:outline-accent-ink focus:-outline-offset-1 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger",
              size === "sm" ? "h-control-sm" : "h-control-md min-h-(--touch-target)",
              hasClear ? "pr-8" : "pr-3",
              classNames?.input,
            )}
          />
          {hasClear ? (
            <button
              type="button"
              aria-label={clearLabel ?? strings.clear}
              onPointerDown={(event) => event.preventDefault()}
              onMouseDown={(event) => event.preventDefault()}
              onClick={clear}
              className={cn(
                "absolute inset-y-0 right-0 flex w-8 items-center justify-center rounded-input text-ink-3 outline-none hover:text-ink focus-visible:focus-ring",
                classNames?.clear,
              )}
            >
              <X aria-hidden="true" className="size-3.5" />
            </button>
          ) : null}
          {name ? <input type="hidden" name={name} value={value} disabled={disabled} /> : null}
        </div>
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Portal container={container}>
        <PopoverPrimitive.Content
          role="presentation"
          sideOffset={4}
          collisionPadding={8}
          align="start"
          // Focus stays in the input, going in and out.
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => {
            if (rootRef.current?.contains(event.detail.originalEvent.target as Node)) {
              event.preventDefault();
            }
          }}
          className={cn(
            LISTBOX_SURFACE,
            materialClass(material, "surface-solid"),
            classNames?.content,
          )}
        >
          {loading ? (
            <p
              role="status"
              className={cn("px-2.5 py-1.5 text-ink-3 text-meta", classNames?.status)}
            >
              {loadingText ?? strings.loading}
            </p>
          ) : null}
          {showEmpty ? (
            <p
              role="status"
              className={cn("px-2.5 py-1.5 text-ink-3 text-meta", classNames?.status)}
            >
              {emptyText ?? strings.noResults}
            </p>
          ) : null}
          <div
            id={listId}
            role="listbox"
            data-ui-layer=""
            hidden={!showList}
            aria-label={ariaLabelledBy ? undefined : ariaLabel}
            aria-labelledby={ariaLabelledBy}
          >
            {showList ? (
              <ListboxItems
                items={items}
                flat={flat}
                idBase={listId}
                isSelected={(option) => option.value === value}
                activeIndex={activeIndex}
                onActivate={setActive}
                onPick={pick}
                optionClassName={classNames?.option}
                groupClassName={classNames?.group}
              />
            ) : null}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
