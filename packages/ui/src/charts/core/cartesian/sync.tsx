"use client";

import { createContext, type ReactNode, useContext, useMemo, useSyncExternalStore } from "react";
import {
  ChartSyncStore,
  EMPTY_CHANNEL as EMPTY,
  type SyncChannel,
  type SyncKey,
  type SyncMargin,
} from "./sync-store.js";

export {
  ChartSyncStore,
  type SyncChannel,
  type SyncKey,
  type SyncMargin,
  syncKeyOf,
} from "./sync-store.js";

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
  setMargin: (owner: string, margin: SyncMargin | null) => void;
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
      setMargin: (owner: string, margin: SyncMargin | null) => {
        if (syncId) store.setMargin(id, owner, margin);
      },
      setRange: (range: readonly [SyncKey, SyncKey] | null) => {
        if (syncId) store.setRange(id, range);
      },
    }),
    [store, id, syncId],
  );
  return { channel, ...actions };
}
