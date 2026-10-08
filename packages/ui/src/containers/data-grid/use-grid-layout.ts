"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type PinSide, sanitizePinned, setColumnPin } from "../table/pin.js";
import {
  clampWidth,
  defaultWidth,
  moveColumn,
  moveColumnTo,
  parseStoredLayout,
  reconcileLayout,
} from "./model.js";
import type { DataGridColumn, Density, GridLayout } from "./types.js";

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be blocked (private mode, quota); the layout just stops persisting.
  }
}

export interface LayoutDefaults {
  pinned?: { left?: readonly string[]; right?: readonly string[] };
  hidden?: readonly string[];
  density: Density;
}

/**
 * Column order, visibility, widths, pins and density. Starts from the column definitions and
 * the defaults, then (after mount, so server and client render the same) from `storageKey`.
 */
export function useGridLayout<T>(
  columns: readonly DataGridColumn<T>[],
  defaults: LayoutDefaults,
  storageKey?: string,
) {
  const initial = useMemo<GridLayout>(() => {
    const order = columns.map((column) => column.id);
    return {
      order,
      hidden: (defaults.hidden ?? []).filter((id) => order.includes(id)),
      widths: Object.fromEntries(columns.map((column) => [column.id, defaultWidth(column)])),
      pinned: sanitizePinned(defaults.pinned ?? {}, order),
      density: defaults.density,
    };
  }, [columns, defaults.hidden, defaults.pinned, defaults.density]);

  const [layout, setLayout] = useState<GridLayout>(initial);
  const loaded = useRef(false);
  const columnsKey = columns.map((column) => column.id).join("|");

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-read only when the key or the set of columns changes.
  useEffect(() => {
    const stored = storageKey ? parseStoredLayout(readStorage(storageKey)) : null;
    setLayout((previous) => reconcileLayout(columns, stored, loaded.current ? previous : initial));
    loaded.current = true;
  }, [storageKey, columnsKey]);

  useEffect(() => {
    if (storageKey && loaded.current) writeStorage(storageKey, JSON.stringify(layout));
  }, [layout, storageKey]);

  const byId = useMemo(() => new Map(columns.map((column) => [column.id, column])), [columns]);

  const setWidth = useCallback(
    (id: string, width: number) => {
      const column = byId.get(id);
      if (!column) return;
      setLayout((previous) => ({
        ...previous,
        widths: { ...previous.widths, [id]: clampWidth(width, column) },
      }));
    },
    [byId],
  );

  const resetWidth = useCallback(
    (id: string) => {
      const column = byId.get(id);
      if (column) setWidth(id, defaultWidth(column));
    },
    [byId, setWidth],
  );

  const move = useCallback((id: string, delta: number) => {
    setLayout((previous) => ({ ...previous, order: moveColumn(previous.order, id, delta) }));
  }, []);

  const moveTo = useCallback((id: string, targetId: string, place: "before" | "after") => {
    setLayout((previous) => ({
      ...previous,
      order: moveColumnTo(previous.order, id, targetId, place),
    }));
  }, []);

  const pin = useCallback((id: string, side: PinSide | null) => {
    setLayout((previous) => ({
      ...previous,
      pinned: setColumnPin(previous.pinned, id, side, previous.order),
    }));
  }, []);

  const setHidden = useCallback((id: string, hidden: boolean) => {
    setLayout((previous) => ({
      ...previous,
      hidden: hidden
        ? [...new Set([...previous.hidden, id])]
        : previous.hidden.filter((x) => x !== id),
    }));
  }, []);

  const setDensity = useCallback((density: Density) => {
    setLayout((previous) => ({ ...previous, density }));
  }, []);

  const reset = useCallback(() => setLayout(initial), [initial]);

  return { layout, setWidth, resetWidth, move, moveTo, pin, setHidden, setDensity, reset };
}
