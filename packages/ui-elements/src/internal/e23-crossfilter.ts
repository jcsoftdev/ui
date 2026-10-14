/** What the crossfilter charts share: the provider contract, the lookup of the provider, the header and the labels. */
import { emit } from "./base.js";
import type {
  Accessors,
  CrossfilterFilters,
  DimensionValue,
  Group,
  GroupOptions,
} from "./e23-crossfilter-engine.js";

export * from "./e23-crossfilter-engine.js";

/** The surface of `<ui-crossfilter>` the charts use. Records are `unknown`: the provider owns their type. */
export interface CrossfilterApi {
  readonly records: readonly unknown[];
  /** Records that pass every filter. */
  readonly filtered: readonly unknown[];
  readonly total: number;
  readonly filters: CrossfilterFilters;
  readonly activeCount: number;
  readonly accessors: Accessors<unknown>;
  toggle(dimension: string, value: DimensionValue): void;
  setRange(dimension: string, range: readonly [number, number] | null): void;
  clear(dimension?: string): void;
  group(dimension: string, options?: GroupOptions<unknown>): Group[];
  groupAll(dimension: string, options?: GroupOptions<unknown>): Group[];
  bins(dimension: string, edges: readonly number[]): number[];
  binsAll(dimension: string, edges: readonly number[]): number[];
  inContext(dimension: string): unknown[];
}

export const PROVIDER_EVENT = { ready: "crossfilter-ready", change: "crossfilter-change" } as const;
const isProvider = (element: Element | null): element is HTMLElement & CrossfilterApi =>
  !!element && typeof (element as unknown as CrossfilterApi).groupAll === "function";

export interface ProviderLink {
  readonly api: CrossfilterApi | null;
  stop(): void;
}

/**
 * Binds `host` to the closest `<ui-crossfilter>` as soon as there is one (the provider and its
 * charts can be defined in any order) and calls `onChange` when the data or the filters change.
 */
export function linkProvider(host: HTMLElement, onChange: () => void): ProviderLink {
  let bound: (HTMLElement & CrossfilterApi) | null = null;
  const root = host.getRootNode();
  const heard = () => onChange();
  const sync = () => {
    const found = host.closest('[data-ui="crossfilter"]');
    const next = isProvider(found) ? found : null;
    if (next === bound) return;
    bound?.removeEventListener(PROVIDER_EVENT.change, heard);
    bound = next;
    bound?.addEventListener(PROVIDER_EVENT.change, heard);
    onChange();
  };
  root.addEventListener(PROVIDER_EVENT.ready, sync);
  sync();
  return {
    get api() {
      return bound;
    },
    stop() {
      root.removeEventListener(PROVIDER_EVENT.ready, sync);
      bound?.removeEventListener(PROVIDER_EVENT.change, heard);
      bound = null;
    },
  };
}

/** Visible strings of the crossfilter elements. English defaults; override with the `texts` property. */
export interface CrossfilterTexts {
  /** Series of the unfiltered totals. */
  total: string;
  /** Series of what the other charts leave in. */
  filtered: string;
  /** "128 of 480" caption. */
  count: (filtered: number, total: number) => string;
  clear: string;
  clearAll: string;
  /** Series of the points the filters leave out (scatter). */
  excluded: string;
  /** Accessible name of the scatter's keyboard brush. */
  brush: string;
  /** Spoken range of a scatter brush, given the text of each axis range. */
  selection: (x: string, y: string) => string;
}

export const DEFAULT_TEXTS: CrossfilterTexts = {
  total: "Total",
  filtered: "Filtered",
  count: (filtered, total) => `${filtered} of ${total}`,
  clear: "Clear",
  clearAll: "Clear all filters",
  excluded: "Filtered out",
  brush:
    "Select a rectangle: arrows move it, Shift and arrows resize it, Enter applies, Escape clears",
  selection: (x, y) => `${x}; ${y}`,
};

/** Color of the bars outside the chart's own filter. */
export const DIMMED = "color-mix(in oklab, var(--accent) 30%, transparent)";

export interface HeaderState {
  heading: string;
  count: string;
  /** Show the Clear button: this chart's own dimension filters. */
  own: boolean;
  clearLabel: string;
  onClear(): void;
}

/** The title, the "128 of 480" caption and the Clear button above a chart. */
export function createHeader(): { el: HTMLElement; update(state: HeaderState): void } {
  const el = document.createElement("div");
  el.dataset.uiPart = "xf-header";
  const title = document.createElement("h3");
  const side = document.createElement("div");
  const count = document.createElement("span");
  count.setAttribute("aria-live", "polite");
  const clear = document.createElement("button");
  clear.type = "button";
  clear.hidden = true;
  side.append(count, clear);
  el.append(title, side);
  let handler: () => void = () => {};
  clear.addEventListener("click", () => handler());
  return {
    el,
    update(state) {
      title.textContent = state.heading;
      title.hidden = !state.heading;
      count.textContent = state.count;
      clear.textContent = state.clearLabel;
      clear.hidden = !state.own;
      handler = state.onClear;
    },
  };
}

/** Tells the charts the provider's data or filters changed. */
export const notify = (provider: HTMLElement, detail: unknown) =>
  emit(provider, PROVIDER_EVENT.change, detail);

/**
 * Plain settings of an element (`keys`, `texts`, ...) as accessors with defaults: assigning one
 * redraws a connected element, and `upgradeProperties` can restore a value set before the element
 * was defined (a class field would overwrite it).
 */
export function defineSettings(
  ctor: { prototype: object },
  defaults: Record<string, unknown>,
): void {
  const store = new WeakMap<object, Record<string, unknown>>();
  for (const [name, fallback] of Object.entries(defaults))
    Object.defineProperty(ctor.prototype, name, {
      configurable: true,
      enumerable: true,
      get(this: object) {
        return store.get(this)?.[name] ?? fallback;
      },
      set(this: HTMLElement & { sync?(): void }, value: unknown) {
        let values = store.get(this);
        if (!values) store.set(this, (values = {}));
        values[name] = value;
        if (this.isConnected) this.sync?.();
      },
    });
}

/**
 * Names the chart after its `heading` unless the author set a `label`. Follows later changes of
 * the heading; an authored label is never touched.
 */
export function followHeading(host: HTMLElement): (heading: string) => void {
  let auto = "";
  return (heading) => {
    const current = host.getAttribute("label");
    if (current != null && current !== auto) return;
    if (heading) host.setAttribute("label", heading);
    else if (current != null) host.removeAttribute("label");
    auto = heading;
  };
}
