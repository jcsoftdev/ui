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
import { ChevronDown } from "../../icons/index.js";
import * as PopoverPrimitive from "../../primitives/popover/popover.js";
import type { ClassNames } from "../../utils/class-names.js";
import { cn } from "../../utils/cn.js";
import { useComposedRefs } from "../../utils/compose.js";
import { type Material, materialClass } from "../../utils/material.js";
import { useControllableState } from "../../utils/use-controllable-state.js";
import {
  flattenItems,
  isTypeaheadKey,
  type ListboxGroup,
  type ListboxMove,
  type ListboxOption,
  moveActive,
  nextTypeahead,
  typeaheadIndex,
} from "../internal/listbox.js";
import { LISTBOX_SURFACE, ListboxItems, optionDomId } from "../internal/listbox-items.js";

export type SelectMenuOption = Omit<ListboxOption, "keywords">;
export type SelectMenuGroup = ListboxGroup<SelectMenuOption>;

export type SelectMenuPart = "trigger" | "value" | "icon" | "content" | "option" | "group";

export interface SelectMenuProps
  extends Omit<
    ComponentProps<"button">,
    "value" | "defaultValue" | "onChange" | "children" | "type" | "role" | "size"
  > {
  /** Options, optionally nested in labelled groups. A `value` of `""` is a real option, not "nothing". */
  options: readonly (SelectMenuOption | SelectMenuGroup)[];
  /** Selected value (controlled). An unknown value or `undefined` shows the placeholder. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Shown while no option is selected. Defaults to the localized "Select…". */
  placeholder?: string;
  /** Submits the value with a surrounding `<form>` through a hidden input. */
  name?: string;
  required?: boolean;
  invalid?: boolean;
  size?: "sm" | "md";
  /** Portal target for the popup. Defaults to `document.body`; pass an element to keep a scoped `data-style`. */
  container?: HTMLElement | null;
  /** Popup surface material; see `PopoverContent`. */
  material?: Material;
  /** Per-part classes merged with `cn`; consumer classes win. `className` still targets the trigger and is merged last. */
  classNames?: ClassNames<SelectMenuPart>;
}

const TYPEAHEAD_MS = 600;
const OPEN_KEYS = new Set(["ArrowDown", "ArrowUp", "Enter", " "]);

/**
 * Select with a custom listbox popup, for option lists that need descriptions, groups or a
 * styled popup. Select-only combobox pattern (WAI-ARIA APG): focus stays on the trigger and the
 * highlighted option is announced through `aria-activedescendant`. Use `NativeSelect` when the
 * system picker is preferable (long lists on phones).
 */
export function SelectMenu({
  options,
  value: valueProp,
  defaultValue,
  onValueChange,
  placeholder,
  name,
  required,
  invalid,
  size = "md",
  container,
  material,
  disabled,
  className,
  classNames,
  onKeyDown,
  onKeyUp,
  onClick,
  ref,
  id,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  "aria-invalid": ariaInvalid,
  ...props
}: SelectMenuProps) {
  const strings = useUiStrings();
  const listId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const composedRef = useComposedRefs<HTMLButtonElement>(ref, triggerRef);
  const typeahead = useRef({ buffer: "", at: 0 });
  const [value, setValue] = useControllableState<string | undefined>({
    prop: valueProp,
    defaultProp: defaultValue,
    onChange: (next) => {
      if (next !== undefined) onValueChange?.(next);
    },
  });
  const [open, setOpenState] = useState(false);
  const [active, setActive] = useState(-1);
  const [listLabel, setListLabel] = useState<string | undefined>();

  const flat = useMemo(() => flattenItems(options), [options]);
  const selectedIndex = flat.findIndex((option) => option.value === value);
  const selected = flat[selectedIndex];
  const isDisabled = Boolean(disabled);

  const setOpen = (next: boolean, move?: ListboxMove) => {
    if (next && isDisabled) return;
    if (next) {
      const preferred = selected && !selected.disabled ? selectedIndex : -1;
      setActive(
        move
          ? moveActive(flat, move === "last" ? flat.length : -1, move)
          : preferred >= 0
            ? preferred
            : moveActive(flat, -1, "first"),
      );
      setListLabel(triggerRef.current?.labels?.[0]?.textContent?.trim() || undefined);
    }
    setOpenState(next);
  };

  useEffect(() => {
    if (!open || active < 0) return;
    document.getElementById(optionDomId(listId, active))?.scrollIntoView?.({ block: "nearest" });
  }, [open, active, listId]);

  const pick = (index: number) => {
    const option = flat[index];
    if (!option || option.disabled) return;
    setValue(option.value);
    setOpenState(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
    const { key } = event;
    const buffering =
      typeahead.current.buffer !== "" && Date.now() - typeahead.current.at <= TYPEAHEAD_MS;
    const typing = isTypeaheadKey(event) && !(key === " " && !buffering);

    if (typing) {
      event.preventDefault();
      typeahead.current = nextTypeahead(typeahead.current, key, Date.now());
      const found = typeaheadIndex(flat, typeahead.current.buffer, open ? active : selectedIndex);
      if (found < 0) return;
      if (open) setActive(found);
      else pick(found);
      return;
    }

    if (!open) {
      if (OPEN_KEYS.has(key)) {
        event.preventDefault();
        setOpen(true);
      } else if (key === "Home" || key === "End") {
        event.preventDefault();
        setOpen(true, key === "Home" ? "first" : "last");
      }
      return;
    }

    const moves: Record<string, ListboxMove> = {
      ArrowDown: "next",
      ArrowUp: "prev",
      Home: "first",
      End: "last",
    };
    const move = moves[key];
    if (move) {
      event.preventDefault();
      setActive((current) => moveActive(flat, current, move));
    } else if (key === "Enter" || key === " ") {
      event.preventDefault();
      pick(active);
    } else if (key === "Tab") {
      setOpenState(false);
    }
  };

  const showPlaceholder = !selected;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={(next) => setOpen(next)}>
      <PopoverPrimitive.Trigger
        ref={composedRef}
        id={id}
        role="combobox"
        data-ui-layer=""
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && active >= 0 ? optionDomId(listId, active) : undefined}
        aria-required={required || undefined}
        aria-invalid={ariaInvalid ?? (invalid || undefined)}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        disabled={disabled}
        data-placeholder={showPlaceholder ? "" : undefined}
        {...props}
        onClick={(event) => {
          onClick?.(event);
          // Safari does not focus a button on press; the keyboard needs focus on it.
          event.currentTarget.focus({ preventScroll: true });
        }}
        onKeyDown={handleKeyDown}
        onKeyUp={(event) => {
          onKeyUp?.(event);
          // Space activates a button on keyup; the keydown already handled it.
          if (event.key === " ") event.preventDefault();
        }}
        className={cn(
          "flex w-full min-w-0 items-center justify-between gap-2 rounded-input border-control bg-surface-control py-0 pr-2.5 pl-3 text-left text-control text-ink focus:border-transparent focus:outline-2 focus:outline-accent-ink focus:-outline-offset-1 disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-danger",
          size === "sm" ? "h-control-sm" : "h-control-md min-h-(--touch-target)",
          classNames?.trigger,
          className,
        )}
      >
        <span
          className={cn(
            "min-w-0 flex-1 truncate",
            showPlaceholder && "text-ink-3",
            classNames?.value,
          )}
        >
          {selected?.label ?? placeholder ?? strings.selectPlaceholder}
        </span>
        <ChevronDown
          aria-hidden="true"
          className={cn("size-3.5 shrink-0 text-ink-3", classNames?.icon)}
        />
      </PopoverPrimitive.Trigger>
      {name ? <input type="hidden" name={name} value={value ?? ""} disabled={disabled} /> : null}
      <PopoverPrimitive.Portal container={container}>
        <PopoverPrimitive.Content
          id={listId}
          role="listbox"
          data-ui-layer=""
          aria-label={ariaLabelledBy ? undefined : (ariaLabel ?? listLabel ?? placeholder)}
          aria-labelledby={ariaLabelledBy}
          sideOffset={4}
          collisionPadding={8}
          align="start"
          // Focus stays on the trigger, going in and out.
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          className={cn(
            LISTBOX_SURFACE,
            materialClass(material, "surface-solid"),
            classNames?.content,
          )}
        >
          <ListboxItems
            items={options}
            flat={flat}
            idBase={listId}
            isSelected={(option) => option.value === value}
            activeIndex={active}
            onActivate={setActive}
            onPick={(option) => pick(flat.indexOf(option))}
            optionClassName={classNames?.option}
            groupClassName={classNames?.group}
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
