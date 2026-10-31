"use client";

import { type ComponentPropsWithoutRef, type ReactNode, useMemo } from "react";
import { Button } from "../../atoms/button/button.js";
import { Chip } from "../../atoms/chip/chip.js";
import { ChipGroup, type ChipGroupOption } from "../../forms/chip-group/chip-group.js";
import { Input } from "../../forms/input/input.js";
import { useUiStrings } from "../../i18n/index.js";
import { Search, SlidersHorizontal } from "../../icons/index.js";
import { Popover, PopoverContent, PopoverTrigger } from "../../overlays/popover/popover.js";
import { cn } from "../../utils/cn.js";
import { useControllableState } from "../../utils/use-controllable-state.js";

export interface FilterBarChip {
  id: string;
  /** Text of the chip, e.g. "Status: Overdue". */
  label: string;
  onRemove: () => void;
}

export interface FilterBarQuickFilters {
  options: readonly ChipGroupOption[];
  /** Selected option (`""` for none). Pair it with `onValueChange`. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Name of the group. Defaults to the localized "Filters". */
  label?: string;
}

export interface FilterBarLabels {
  search: string;
  filters: string;
  moreFilters: string;
  clearAll: string;
  /** `{filter}` is replaced by the chip label. */
  removeFilter: string;
  activeFilters: string;
  resultOne: string;
  /** `{count}` is replaced. */
  resultMany: string;
}

export interface FilterBarProps extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  /** Controlled search text. Pair it with `onSearchChange`. */
  search?: string;
  defaultSearch?: string;
  onSearchChange?: (search: string) => void;
  /** Placeholder of the search field. Defaults to the localized "Search". */
  searchPlaceholder?: string;
  /** Always-visible single-choice chips (a status, a period). Under a narrow container they move into the Filters popover. */
  quickFilters?: FilterBarQuickFilters;
  /** Extra filter controls; they go in the "More filters" popover. */
  children?: ReactNode;
  /** One removable chip per applied filter, in the row under the bar. */
  activeFilters?: readonly FilterBarChip[];
  /** Shows "Clear all" next to the chips; it should reset every filter, search included. */
  onClearAll?: () => void;
  /** Number of results of the current filters; announced politely when it changes. */
  resultCount?: number;
  /** End slot: export, create, view switch. */
  actions?: ReactNode;
  labels?: Partial<FilterBarLabels>;
}

function fill(template: string, values: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => values[key] ?? match);
}

/**
 * Toolbar for filtering a list or table: search, quick chips, a "More filters" popover, the
 * applied filters as removable chips with "Clear all", and the result count. It answers to its own
 * container width, never the viewport: under 40rem the quick chips and the extra filters fold into
 * one "Filters" button and only the search stays inline. The bar holds no filter state beyond the
 * search text: you pass the chips and the controls, and apply the filters to your rows.
 */
export function FilterBar({
  search,
  defaultSearch = "",
  onSearchChange,
  searchPlaceholder,
  quickFilters,
  children,
  activeFilters = [],
  onClearAll,
  resultCount,
  actions,
  labels,
  className,
  ...props
}: FilterBarProps) {
  const strings = useUiStrings();
  const text: FilterBarLabels = {
    search: labels?.search ?? strings.search,
    filters: labels?.filters ?? strings.filters,
    moreFilters: labels?.moreFilters ?? strings.moreFilters,
    clearAll: labels?.clearAll ?? strings.clearAllFilters,
    removeFilter: labels?.removeFilter ?? strings.removeFilter,
    activeFilters: labels?.activeFilters ?? strings.activeFilters,
    resultOne: labels?.resultOne ?? strings.resultOne,
    resultMany: labels?.resultMany ?? strings.resultMany,
  };
  const [query, setQuery] = useControllableState<string>({
    prop: search,
    defaultProp: defaultSearch,
    onChange: onSearchChange,
  });
  const format = useMemo(() => new Intl.NumberFormat(strings.locale), [strings.locale]);
  const count = activeFilters.length;
  const suffix = count > 0 ? ` (${format.format(count)})` : "";
  const hasExtra = children !== undefined && children !== null && children !== false;
  const quick = quickFilters ? (
    <ChipGroup
      type="single"
      allowDeselect
      aria-label={quickFilters.label ?? text.filters}
      options={quickFilters.options}
      value={quickFilters.value}
      defaultValue={quickFilters.defaultValue}
      onValueChange={quickFilters.onValueChange}
    />
  ) : null;
  const trigger = (label: string, className: string) => (
    <PopoverTrigger asChild>
      <Button size="sm" variant="secondary" className={className}>
        <SlidersHorizontal aria-hidden="true" />
        {label}
        {suffix}
      </Button>
    </PopoverTrigger>
  );
  return (
    <div className={cn("@container/filter-bar flex min-w-0 flex-col gap-2", className)} {...props}>
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <Input
          type="search"
          size="xs"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={searchPlaceholder ?? text.search}
          aria-label={text.search}
          start={<Search aria-hidden="true" className="size-4 text-ink-3" />}
          className="w-full min-w-0 @min-[40rem]/filter-bar:w-64"
        />
        {quick ? <div className="hidden min-w-0 @min-[40rem]/filter-bar:block">{quick}</div> : null}
        {hasExtra ? (
          <Popover>
            {trigger(text.moreFilters, "hidden @min-[40rem]/filter-bar:inline-flex")}
            <PopoverContent align="start" aria-label={text.moreFilters} className="grid gap-3 p-3">
              {children}
            </PopoverContent>
          </Popover>
        ) : null}
        {quick || hasExtra ? (
          <Popover>
            {trigger(text.filters, "@min-[40rem]/filter-bar:hidden")}
            <PopoverContent align="start" aria-label={text.filters} className="grid gap-3 p-3">
              {quick}
              {children}
            </PopoverContent>
          </Popover>
        ) : null}
        <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2">
          {resultCount !== undefined ? (
            <p role="status" aria-live="polite" className="m-0 text-fs-120 text-ink-3 tabular-nums">
              {resultCount === 1
                ? text.resultOne
                : fill(text.resultMany, { count: format.format(resultCount) })}
            </p>
          ) : null}
          {actions}
        </div>
      </div>
      {count > 0 ? (
        <ul
          aria-label={text.activeFilters}
          className="m-0 flex min-w-0 list-none flex-wrap items-center gap-1.5 p-0"
        >
          {activeFilters.map((filter) => (
            <li key={filter.id} className="min-w-0">
              <Chip
                tone="accent"
                onRemove={filter.onRemove}
                removeLabel={fill(text.removeFilter, { filter: filter.label })}
              >
                {filter.label}
              </Chip>
            </li>
          ))}
          {onClearAll ? (
            <li>
              <Button size="sm" variant="ghost" onClick={onClearAll}>
                {text.clearAll}
              </Button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
