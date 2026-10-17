import { type ReactNode, useId, useMemo } from "react";
import { Check } from "../../icons/index.js";
import { cn } from "../../utils/cn.js";
import { isGroup, type ListboxItem, type ListboxOption } from "./listbox.js";

export const LISTBOX_SURFACE =
  "z-85 min-w-(--ui-popper-anchor-width) max-h-[min(20rem,var(--ui-popper-available-height))] max-w-(--ui-popper-available-width) overflow-y-auto overscroll-contain rounded-popover surface-overlay p-1.5 text-ink shadow-overlay";

const OPTION =
  "flex min-h-[max(2rem,var(--touch-target))] w-full cursor-pointer items-center gap-2 rounded-event px-2.5 py-1.5 text-body text-ink outline-none data-[highlighted]:bg-surface-2 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50";

export function optionDomId(base: string, index: number): string {
  return `${base}-opt-${index}`;
}

export interface ListboxItemsProps<O extends ListboxOption> {
  items: readonly ListboxItem<O>[];
  /** Options in display order; an option's position here is its id and `activeIndex` slot. */
  flat: readonly O[];
  idBase: string;
  isSelected: (option: O) => boolean;
  activeIndex: number;
  onActivate: (index: number) => void;
  onPick: (option: O) => void;
  optionClassName?: string | undefined;
  groupClassName?: string | undefined;
}

/** Renders options (and optional group headings) with the WAI-ARIA listbox roles. */
export function ListboxItems<O extends ListboxOption>({
  items,
  flat,
  idBase,
  isSelected,
  activeIndex,
  onActivate,
  onPick,
  optionClassName,
  groupClassName,
}: ListboxItemsProps<O>): ReactNode {
  const headingBase = useId();
  const indexes = useMemo(() => new Map(flat.map((option, index) => [option, index])), [flat]);

  const renderOption = (option: O) => {
    const index = indexes.get(option) ?? -1;
    const selected = isSelected(option);
    return (
      // biome-ignore lint/a11y/useFocusableInteractive: options are never focused; the owner keeps focus and points at one with aria-activedescendant.
      // biome-ignore lint/a11y/useKeyWithClickEvents: the owner (trigger or input) handles every key.
      <div
        key={`${index}-${option.value}`}
        id={optionDomId(idBase, index)}
        role="option"
        aria-selected={selected}
        aria-disabled={option.disabled || undefined}
        data-selected={selected ? "" : undefined}
        data-disabled={option.disabled ? "" : undefined}
        data-highlighted={index === activeIndex ? "" : undefined}
        // Focus stays on the trigger or the input; the press must not move it.
        onPointerDown={(event) => event.preventDefault()}
        onMouseDown={(event) => event.preventDefault()}
        onPointerMove={() => {
          if (!option.disabled && index !== activeIndex) onActivate(index);
        }}
        onClick={() => {
          if (!option.disabled) onPick(option);
        }}
        className={cn(OPTION, optionClassName)}
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <span className={cn("truncate", selected && "font-semibold")}>{option.label}</span>
          {option.description ? (
            <span className="truncate text-ink-3 text-meta">{option.description}</span>
          ) : null}
        </span>
        {selected ? (
          <Check aria-hidden="true" className="size-3.5 shrink-0 text-accent-ink" />
        ) : null}
      </div>
    );
  };

  return items.map((item, position) => {
    if (!isGroup(item)) return renderOption(item);
    const headingId = `${headingBase}-g${position}`;
    return (
      // biome-ignore lint/a11y/useSemanticElements: a fieldset inside a listbox breaks the listbox > group > option structure.
      <div key={`group-${item.label}`} role="group" aria-labelledby={headingId}>
        <div
          id={headingId}
          role="presentation"
          className={cn(
            "px-2.5 pt-2 pb-1 font-semibold text-ink-3 text-meta uppercase tracking-wide",
            groupClassName,
          )}
        >
          {item.label}
        </div>
        {item.options.map(renderOption)}
      </div>
    );
  });
}
