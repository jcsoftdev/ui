"use client";

import { useCallback, useState } from "react";

export interface SeriesState {
  /** Ids hidden through the legend. */
  hidden: ReadonlySet<string>;
  /** Series under the legend pointer or focus; the others are dimmed. */
  highlighted: string | null;
  toggle: (id: string) => void;
  setHighlighted: (id: string | null) => void;
  isHidden: (id: string) => boolean;
  /** True when another series is highlighted. */
  isDimmed: (id: string) => boolean;
}

/** Legend-driven visibility and highlight, shared by every chart type. */
export function useSeriesState(initialHidden: readonly string[] = []): SeriesState {
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set(initialHidden));
  const [highlighted, setHighlighted] = useState<string | null>(null);

  const toggle = useCallback((id: string) => {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setHighlighted(null);
  }, []);

  return {
    hidden,
    highlighted,
    toggle,
    setHighlighted,
    isHidden: (id) => hidden.has(id),
    isDimmed: (id) => highlighted != null && highlighted !== id && !hidden.has(highlighted),
  };
}
