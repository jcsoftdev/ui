"use client";

import { createContext, type ReactNode, useContext, useMemo, useSyncExternalStore } from "react";
import { ChartSyncStore, type SyncChannel, type SyncKey } from "./sync-store.js";

export { ChartSyncStore, type SyncChannel, type SyncKey, syncKeyOf } from "./sync-store.js";

const EMPTY: SyncChannel = { hover: null, owner: null, range: null };
const globalStore = new ChartSyncStore();
const SyncContext = createContext<ChartSyncStore>(globalStore);

/**
 * Scopes chart sync to its children, so two groups that happen to use the same
 * `syncId` never talk to each other. Optional: charts with the same `syncId`
 * already sync through a shared default store.
 */
export function ChartSyncProvider({ children }: { children: ReactNode }) {
  const store = useMemo(() => new ChartSyncStore(), []);
  return <SyncContext.Provider value={store}>{children}</SyncContext.Provider>;
}

export interface ChartSync {
  channel: SyncChannel;
  setHover: (key: SyncKey, owner: string) => void;
  clearHover: (owner: string) => void;
  setRange: (range: readonly [SyncKey, SyncKey] | null) => void;
}

/** Subscribes to a sync channel; with no `syncId` it is inert and never re-renders. */
export function useChartSync(syncId: string | undefined): ChartSync {
  const store = useContext(SyncContext);
  const id = syncId ?? "";
  const channel = useSyncExternalStore(
    store.subscribe,
    () => (syncId ? store.get(id) : EMPTY),
    () => EMPTY,
  );
  const actions = useMemo(
    () => ({
      setHover: (key: SyncKey, owner: string) => {
        if (syncId) store.setHover(id, key, owner);
      },
      clearHover: (owner: string) => {
        if (syncId) store.clearHover(id, owner);
      },
      setRange: (range: readonly [SyncKey, SyncKey] | null) => {
        if (syncId) store.setRange(id, range);
      },
    }),
    [store, id, syncId],
  );
  return { channel, ...actions };
}
