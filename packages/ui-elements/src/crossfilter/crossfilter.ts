import {
  adoptStyles,
  type DefineOptions,
  defineElement,
  ElementBase,
  emit,
  rootOf,
} from "../internal/base.js";
import { upgradeProperties } from "../internal/e10.js";
import {
  type Accessors,
  activeFilterCount,
  binRecords,
  type CrossfilterApi,
  type CrossfilterFilters,
  clearFilters,
  type DimensionValue,
  filterRecords,
  type Group,
  type GroupOptions,
  groupRecords,
  NO_FILTERS,
  PROVIDER_EVENT,
  setRangeFilter,
  toggleValue,
} from "../internal/e23-crossfilter.js";
import css from "./crossfilter.css.js";

export type {
  Accessors,
  CrossfilterApi,
  CrossfilterFilter,
  CrossfilterFilters,
  DimensionValue,
  Group,
  GroupOptions,
} from "../internal/e23-crossfilter.js";

/**
 * `<ui-crossfilter>`: shares one dataset and its filters with the charts inside it
 * (`<ui-crossfilter-bar>`, `-histogram`, `-scatter`, `-summary`). Each chart filters by clicking or
 * brushing and every other chart follows; feed a table from `filtered`. It draws nothing.
 *
 * Properties: `data` (the records), `dimensions` (`{ id: (record) => value }`, keep the object
 * stable), `filters` (read, or set to restore a state). Methods: `toggle(dimension, value)`,
 * `setRange(dimension, [min, max] | null)`, `clear(dimension?)`, `group`, `groupAll`, `bins`,
 * `binsAll`, `inContext`. Event: `crossfilter-change` (`{ filters, count, total }`).
 */
export class UiCrossfilter extends ElementBase implements CrossfilterApi {
  #data: readonly unknown[] = [];
  #dimensions: Accessors<unknown> = {};
  #filters: CrossfilterFilters = NO_FILTERS;
  #filtered: { key: unknown[]; value: unknown[] } | undefined;

  get data(): readonly unknown[] {
    return this.#data;
  }
  set data(value: readonly unknown[]) {
    this.#data = value ?? [];
    this.#changed();
  }
  get dimensions(): Accessors<unknown> {
    return this.#dimensions;
  }
  set dimensions(value: Accessors<unknown>) {
    this.#dimensions = value ?? {};
    this.#changed();
  }
  get filters(): CrossfilterFilters {
    return this.#filters;
  }
  set filters(value: CrossfilterFilters) {
    this.#filters = value ?? NO_FILTERS;
    this.#changed();
  }

  get records(): readonly unknown[] {
    return this.#data;
  }
  get total(): number {
    return this.#data.length;
  }
  get accessors(): Accessors<unknown> {
    return this.#dimensions;
  }
  get activeCount(): number {
    return activeFilterCount(this.#filters);
  }
  /** Records that pass every filter (computed once per change). */
  get filtered(): readonly unknown[] {
    const key = [this.#data, this.#dimensions, this.#filters];
    const known = this.#filtered;
    if (known && known.key.every((item, i) => item === key[i])) return known.value;
    const value = filterRecords(this.#data, this.#dimensions, this.#filters);
    this.#filtered = { key, value };
    return value;
  }

  connectedCallback(): void {
    this.dataset.ui = "crossfilter";
    adoptStyles(rootOf(this), css);
    upgradeProperties(this, ["data", "dimensions", "filters"]);
    emit(this, PROVIDER_EVENT.ready);
  }

  toggle(dimension: string, value: DimensionValue): void {
    this.filters = toggleValue(this.#filters, dimension, value);
  }
  setRange(dimension: string, range: readonly [number, number] | null): void {
    this.filters = setRangeFilter(this.#filters, dimension, range);
  }
  clear(dimension?: string): void {
    this.filters = clearFilters(this.#filters, dimension);
  }
  group(dimension: string, options?: GroupOptions<unknown>): Group[] {
    return groupRecords(this.#data, this.#dimensions, this.#filters, dimension, options);
  }
  groupAll(dimension: string, options?: GroupOptions<unknown>): Group[] {
    return groupRecords(this.#data, this.#dimensions, NO_FILTERS, dimension, options);
  }
  bins(dimension: string, edges: readonly number[]): number[] {
    return binRecords(this.#data, this.#dimensions, this.#filters, dimension, edges);
  }
  binsAll(dimension: string, edges: readonly number[]): number[] {
    return binRecords(this.#data, this.#dimensions, NO_FILTERS, dimension, edges);
  }
  inContext(dimension: string): unknown[] {
    return filterRecords(this.#data, this.#dimensions, this.#filters, dimension);
  }

  #changed(): void {
    emit(this, PROVIDER_EVENT.change, {
      filters: this.#filters,
      count: this.filtered.length,
      total: this.#data.length,
    });
  }
}

/** Registers `<ui-crossfilter>` (or `<prefix>-crossfilter`) and returns the tag. */
export function defineCrossfilter(options?: DefineOptions): string {
  return defineElement("crossfilter", UiCrossfilter, options);
}
