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
  /** Margins each chart needs, by chart. */
  margins: Readonly<Record<string, SyncMargin>>;
  /** The widest left and right margin of the group: every chart takes it so the plots line up. */
  margin: SyncMargin | null;
}

export interface SyncMargin {
  left: number;
  right: number;
}

export const EMPTY_CHANNEL: SyncChannel = {
  hover: null,
  owner: null,
  range: null,
  margins: {},
  margin: null,
};
const EMPTY = EMPTY_CHANNEL;

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

  /** Registers (or with `null` withdraws) the margins `owner` needs. */
  setMargin(id: string, owner: string, margin: SyncMargin | null) {
    const current = this.get(id);
    const before = current.margins[owner];
    if (
      before === margin ||
      (before && margin && before.left === margin.left && before.right === margin.right)
    ) {
      return;
    }
    const margins = { ...current.margins };
    if (margin) margins[owner] = margin;
    else delete margins[owner];
    const all = Object.values(margins);
    const widest = all.length
      ? { left: Math.max(...all.map((m) => m.left)), right: Math.max(...all.map((m) => m.right)) }
      : null;
    const same =
      current.margin === widest ||
      (current.margin &&
        widest &&
        current.margin.left === widest.left &&
        current.margin.right === widest.right);
    this.set(id, { ...current, margins, margin: same ? current.margin : widest });
  }
}
