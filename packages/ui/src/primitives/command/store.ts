import type { CommandFilter } from "./score.js";

/** What `useCommandState` selectors receive. */
export interface CommandState {
  /** The search text. */
  search: string;
  /** The highlighted item's `value` (empty when nothing is highlighted). */
  value: string;
  /** Result of the last filter pass. */
  filtered: {
    /** Number of visible items. */
    count: number;
    /** Visible item ids mapped to their score. */
    items: Map<string, number>;
    /** Ids of the groups that have at least one visible item. */
    groups: Set<string>;
  };
}

interface ItemEntry {
  value: string;
  keywords: readonly string[];
  groupId: string | undefined;
  forceMount: boolean;
  rank: number;
  element: HTMLElement | null;
  onSelect: (() => void) | undefined;
}

interface GroupEntry {
  rank: number;
  element: HTMLElement | null;
}

export interface StoreOptions {
  shouldFilter: boolean;
  filter: CommandFilter;
  /** Controlled highlighted value; `undefined` while uncontrolled. */
  controlledValue: string | undefined;
  onValueChange: ((value: string) => void) | undefined;
}

type Listener = () => void;

/** Moves `entries` into the DOM slots they already occupy, in the order given. */
function reorder(parent: Element, entries: HTMLElement[]) {
  const current = [...parent.children].filter((child) => entries.includes(child as HTMLElement));
  if (current.every((child, index) => child === entries[index])) return;
  const markers = current.map((child) => {
    const marker = document.createComment("");
    parent.insertBefore(marker, child);
    return marker;
  });
  entries.forEach((entry, index) => {
    parent.insertBefore(entry, markers[index] ?? null);
  });
  for (const marker of markers) marker.remove();
}

/**
 * Framework-free state for one command menu. Items and groups register here; filtering
 * runs once per change and each item subscribes only to the booleans it renders, so
 * typing re-renders just the items whose visibility or highlight flips.
 */
export class CommandStore {
  private state: CommandState = {
    search: "",
    value: "",
    filtered: { count: 0, items: new Map(), groups: new Set() },
  };
  private listeners = new Set<Listener>();
  private items = new Map<string, ItemEntry>();
  private groups = new Map<string, GroupEntry>();
  private rank = 0;
  private dirty = false;
  private searchDirty = false;
  private ordered = false;
  private revision = 0;
  options: StoreOptions;

  constructor(options: StoreOptions) {
    this.options = options;
  }

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = () => this.state;
  /** Bumps whenever filtering or items change; drives DOM sorting and selection repair. */
  getRevision = () => this.revision;

  private emit() {
    for (const listener of [...this.listeners]) listener();
  }

  isItemVisible(id: string): boolean {
    const item = this.items.get(id);
    if (item?.forceMount) return true;
    const { search, filtered } = this.state;
    if (!search || !this.options.shouldFilter) return true;
    return (filtered.items.get(id) ?? 0) > 0;
  }

  isGroupVisible(id: string, forceMount: boolean): boolean {
    if (forceMount) return true;
    const { search, filtered } = this.state;
    if (!search || !this.options.shouldFilter) return true;
    return filtered.groups.has(id);
  }

  itemValue(id: string): string | undefined {
    return this.items.get(id)?.value;
  }

  upsertItem(id: string, entry: Omit<ItemEntry, "rank" | "element">, element: HTMLElement | null) {
    const existing = this.items.get(id);
    this.items.set(id, {
      ...entry,
      rank: existing?.rank ?? this.rank++,
      element: element ?? existing?.element ?? null,
    });
    this.schedule();
  }

  removeItem(id: string) {
    this.items.delete(id);
    this.schedule();
  }

  /** Highlighted item's id, for `aria-activedescendant`. */
  activeId(): string | undefined {
    const { value } = this.state;
    if (value === "") return undefined;
    for (const [id, item] of this.items) {
      if (item.value === value && item.element?.isConnected && this.isItemVisible(id)) return id;
    }
    return undefined;
  }

  setItemElement(id: string, element: HTMLElement | null) {
    const item = this.items.get(id);
    if (item) item.element = element;
  }

  upsertGroup(id: string) {
    if (!this.groups.has(id)) this.groups.set(id, { rank: this.rank++, element: null });
  }

  removeGroup(id: string) {
    this.groups.delete(id);
    this.schedule();
  }

  /** Runs the first filter pass; marks the store ready so `Empty` can tell "no items yet" from "no match". */
  start() {
    this.schedule();
  }

  /** Called from a ref callback, which runs before the group's layout effect: creates the entry. */
  setGroupElement(id: string, element: HTMLElement | null) {
    const group = this.groups.get(id);
    if (group) group.element = element;
    else if (element) this.groups.set(id, { rank: this.rank++, element });
  }

  /** Coalesces a burst of (un)registrations into one filter pass. */
  private schedule() {
    if (this.dirty) return;
    this.dirty = true;
    queueMicrotask(() => {
      if (!this.dirty) return;
      this.dirty = false;
      this.refilter();
      this.bump();
    });
  }

  private bump() {
    this.revision++;
    this.emit();
  }

  setSearch(search: string) {
    if (search === this.state.search) return;
    this.state = { ...this.state, search };
    this.searchDirty = true;
    this.refilter();
    this.bump();
  }

  /** Refilters after `shouldFilter` or `filter` changed. */
  refresh() {
    this.refilter();
    this.bump();
  }

  /** Highlights `value`. Controlled owners hear about it through `onValueChange` only. */
  setValue(value: string) {
    if (value === this.state.value) return;
    if (this.options.controlledValue === undefined) this.state = { ...this.state, value };
    this.options.onValueChange?.(value);
    this.emit();
  }

  /** Mirrors a controlled `value` prop into the store. */
  syncValue(value: string) {
    if (value === this.state.value) return;
    this.state = { ...this.state, value };
    this.emit();
  }

  private refilter() {
    const { search } = this.state;
    const { shouldFilter, filter } = this.options;
    const scores = new Map<string, number>();
    const groupBest = new Map<string, number>();
    const filtering = shouldFilter && search !== "";
    for (const [id, item] of this.items) {
      const score = filtering ? filter(item.value, search, item.keywords) : 1;
      if (score > 0) {
        scores.set(id, score);
        if (item.groupId !== undefined) {
          groupBest.set(item.groupId, Math.max(groupBest.get(item.groupId) ?? 0, score));
        }
      }
    }
    this.state = {
      ...this.state,
      filtered: { count: scores.size, items: scores, groups: new Set(groupBest.keys()) },
    };
    this.groupBest = groupBest;
  }

  private groupBest = new Map<string, number>();

  /** Reorders the rendered items and groups by score, or back to registration order. */
  sort() {
    const { search, filtered } = this.state;
    const ranking = this.options.shouldFilter && search !== "";
    if (!ranking && !this.ordered) return;
    this.ordered = ranking;

    const buckets = new Map<Element, { element: HTMLElement; score: number; rank: number }[]>();
    const place = (element: HTMLElement | null, score: number, rank: number) => {
      const parent = element?.parentElement;
      if (!element || !parent) return;
      const list = buckets.get(parent);
      if (list) list.push({ element, score, rank });
      else buckets.set(parent, [{ element, score, rank }]);
    };
    for (const [id, item] of this.items) {
      place(item.element, filtered.items.get(id) ?? 0, item.rank);
    }
    for (const [id, group] of this.groups) {
      place(group.element, this.groupBest.get(id) ?? 0, group.rank);
    }
    for (const [parent, list] of buckets) {
      list.sort((a, b) => (ranking ? b.score - a.score : 0) || a.rank - b.rank);
      reorder(
        parent,
        list.map((entry) => entry.element),
      );
    }
  }

  /** True once after each search change, so the highlight can jump to the first result. */
  consumeSearchChange(): boolean {
    const changed = this.searchDirty;
    this.searchDirty = false;
    return changed;
  }

  select(id: string) {
    this.items.get(id)?.onSelect?.();
  }
}
