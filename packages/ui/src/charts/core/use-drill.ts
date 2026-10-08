"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ancestors,
  buildHierarchy,
  findNode,
  type HierarchyDatum,
  type HierarchyNode,
  interpolateView,
  type PartitionView,
} from "./hierarchy.js";
import { useReducedMotion } from "./motion.js";

export interface DrillState {
  root: HierarchyNode;
  /** Node filling the view. */
  focus: HierarchyNode;
  /** Root first, focus last. */
  path: HierarchyNode[];
  /** Zooms into a node with children; any ancestor id zooms back out. */
  drill: (id: string) => void;
  /** One level up; returns false at the root. */
  up: () => boolean;
}

/**
 * Builds the hierarchy once per data set and keeps the focused (zoomed) node.
 * Drilling into a leaf does nothing; a stale focus falls back to the root.
 */
export function useDrill(
  data: HierarchyDatum,
  sort = true,
  onFocusChange?: (node: HierarchyNode) => void,
): DrillState {
  const root = useMemo(() => buildHierarchy(data, { sort }), [data, sort]);
  const [focusId, setFocusId] = useState(root.id);
  const focus = findNode(root, focusId) ?? root;
  const path = useMemo(() => ancestors(focus), [focus]);
  const change = (node: HierarchyNode) => {
    setFocusId(node.id);
    onFocusChange?.(node);
  };
  return {
    root,
    focus,
    path,
    drill: (id) => {
      const node = findNode(root, id);
      if (node && node.children.length > 0 && node.id !== focus.id) change(node);
    },
    up: () => {
      if (!focus.parent) return false;
      change(focus.parent);
      return true;
    },
  };
}

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/**
 * Animates a partition view (the zoom window of a sunburst or icicle) towards
 * `target` with `requestAnimationFrame`. Jumps straight there when disabled,
 * under `prefers-reduced-motion`, or on the server.
 */
export function useAnimatedView(
  target: PartitionView,
  { disabled = false, duration = 650 }: { disabled?: boolean; duration?: number } = {},
): PartitionView {
  const reduced = useReducedMotion();
  const [view, setView] = useState(target);
  const current = useRef(target);
  const { x0, x1, depth } = target;

  useEffect(() => {
    const to = { x0, x1, depth };
    const from = current.current;
    if (disabled || reduced || typeof requestAnimationFrame !== "function") {
      current.current = to;
      setView(to);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const next = interpolateView(from, to, easeOutCubic(t));
      current.current = next;
      setView(next);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [x0, x1, depth, disabled, reduced, duration]);

  return view;
}
