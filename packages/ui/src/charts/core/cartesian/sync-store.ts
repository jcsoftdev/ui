import type { XValue } from "../types.js";

/** Category identity shared between charts: dates by time, everything else as given. */
export type SyncKey = number | string;

export function syncKeyOf(value: XValue): SyncKey {
  return value instanceof Date ? +value : value;
}

export interface SyncChannel {
  /** Hovered category and the chart that owns the hover. */
  hover: SyncKey | null;
  owner: string | null;
  /** Zoom window as the first and last visible category. */
  range: readonly [SyncKey, SyncKey] | null;
}

const EMPTY: SyncChannel = { hover: null, owner: null, range: null };

/** A set of named channels. `ChartSyncProvider` scopes one; charts outside a provider share a global one. */
export class ChartSyncStore {
  private channels = new Map<string, SyncChannel>();
  private listeners = new Set<() => void>();

  get = (id: string): SyncChannel => this.channels.get(id) ?? EMPTY;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private set(id: string, next: SyncChannel) {
    this.channels.set(id, next);
    for (const listener of this.listeners) listener();
  }

  setHover(id: string, key: SyncKey, owner: string) {
    const current = this.get(id);
    if (current.hover === key && current.owner === owner) return;
    this.set(id, { ...current, hover: key, owner });
  }

  /** Only the chart that set the hover can clear it. */
  clearHover(id: string, owner: string) {
    const current = this.get(id);
    if (current.owner !== owner || current.hover == null) return;
    this.set(id, { ...current, hover: null, owner: null });
  }

  setRange(id: string, range: readonly [SyncKey, SyncKey] | null) {
    const current = this.get(id);
    const same =
      current.range === range ||
      (current.range != null &&
        range != null &&
        current.range[0] === range[0] &&
        current.range[1] === range[1]);
    if (same) return;
    this.set(id, { ...current, range });
  }
}
