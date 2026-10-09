"use client";

import { type PointerEvent, type RefObject, useCallback, useEffect, useRef, useState } from "react";
import { useReducedMotion } from "../../core/motion.js";
import type { Bounds } from "./types.js";
import {
  clampView,
  DEFAULT_LIMITS,
  IDENTITY_VIEW,
  type MapView,
  viewFitting,
  zoomAt,
} from "./view.js";

export interface UseMapViewOptions {
  width: number;
  height: number;
  /** Pixel box of the map at zoom 1. */
  content: Bounds;
  /** Wheel, drag and pinch. Buttons and keyboard (`zoomBy`, `fit`) always work. */
  gestures: boolean;
  /** "always": the wheel zooms; "modifier" (default): only with Ctrl or Cmd held, so page scrolling is never trapped. */
  wheelZoom?: "always" | "modifier";
  minZoom?: number;
  maxZoom?: number;
  animate?: boolean;
}

const MOVE_THRESHOLD = 4;
const DURATION = 220;

function easeOut(t: number): number {
  return 1 - (1 - t) ** 3;
}

/**
 * Zoom and pan state of a map: wheel, drag, two-finger pinch, and imperative
 * `zoomBy` / `fit` / `focusBox` for buttons, keyboard and cluster clicks. The
 * view is always clamped so the map cannot be lost, and transitions are
 * driven in JS (not CSS) so every layer, including the screen-space bubbles
 * and labels, moves in step. Instant under `prefers-reduced-motion`.
 */
export function useMapView<E extends Element>({
  width,
  height,
  content,
  gestures,
  wheelZoom = "modifier",
  minZoom = DEFAULT_LIMITS.minZoom,
  maxZoom = DEFAULT_LIMITS.maxZoom,
  animate = true,
}: UseMapViewOptions) {
  const [view, setViewState] = useState<MapView>(IDENTITY_VIEW);
  const [dragging, setDragging] = useState(false);
  const reduced = useReducedMotion();
  const ref = useRef<E | null>(null);
  const viewRef = useRef(view);
  const frame = useRef(0);
  const contentRef = useRef({ width, height, content, minZoom, maxZoom });
  contentRef.current = { width, height, content, minZoom, maxZoom };
  const wasDragged = useRef(false);

  const clamp = useCallback((next: MapView): MapView => {
    const c = contentRef.current;
    return clampView(next, c.width, c.height, c.content, {
      minZoom: c.minZoom,
      maxZoom: c.maxZoom,
    });
  }, []);

  const apply = useCallback(
    (next: MapView) => {
      const clamped = clamp(next);
      viewRef.current = clamped;
      setViewState(clamped);
    },
    [clamp],
  );

  const cancelAnimation = useCallback(() => cancelAnimationFrame(frame.current), []);

  const animateTo = useCallback(
    (target: MapView) => {
      cancelAnimationFrame(frame.current);
      const goal = clamp(target);
      if (!animate || reduced || typeof requestAnimationFrame === "undefined") {
        apply(goal);
        return;
      }
      const from = viewRef.current;
      const start = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, Math.max(0, (now - start) / DURATION));
        const e = easeOut(t);
        // Interpolate zoom geometrically so the speed feels constant.
        const k = from.k * (goal.k / from.k) ** e;
        apply({ k, x: from.x + (goal.x - from.x) * e, y: from.y + (goal.y - from.y) * e });
        if (t < 1) frame.current = requestAnimationFrame(step);
      };
      frame.current = requestAnimationFrame(step);
    },
    [animate, reduced, apply, clamp],
  );

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  // A new box (resize, other data) re-fits: the old pixel offsets mean nothing now.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only the box size resets the view.
  useEffect(() => {
    apply(IDENTITY_VIEW);
  }, [width, height, apply]);

  const zoomBy = useCallback(
    (factor: number, cx = width / 2, cy = height / 2) =>
      animateTo(zoomAt(viewRef.current, factor, cx, cy, contentRef.current)),
    [animateTo, width, height],
  );
  const fit = useCallback(() => animateTo(IDENTITY_VIEW), [animateTo]);
  const panBy = useCallback(
    (dx: number, dy: number) => {
      const current = viewRef.current;
      animateTo({ ...current, x: current.x + dx, y: current.y + dy });
    },
    [animateTo],
  );
  /** Frames a pixel box (zoom 1 coordinates). */
  const focusBox = useCallback(
    (box: Bounds) => animateTo(viewFitting(box, width, height, { maxZoom })),
    [animateTo, width, height, maxZoom],
  );

  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    view: MapView;
    x: number;
    y: number;
    distance: number;
    moved: boolean;
  } | null>(null);

  const local = (event: { clientX: number; clientY: number }) => {
    const box = (ref.current as Element | null)?.getBoundingClientRect();
    return { x: event.clientX - (box?.left ?? 0), y: event.clientY - (box?.top ?? 0) };
  };
  const center = () => {
    const points = [...pointers.current.values()];
    const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    const [a, b] = points;
    const distance = a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    return { x, y, distance };
  };

  const onPointerDown = (event: PointerEvent<E>) => {
    if (!gestures || (event.pointerType === "mouse" && event.button !== 0)) return;
    cancelAnimation();
    wasDragged.current = false;
    pointers.current.set(event.pointerId, local(event));
    const c = center();
    gesture.current = { view: viewRef.current, x: c.x, y: c.y, distance: c.distance, moved: false };
  };

  const onPointerMove = (event: PointerEvent<E>) => {
    if (!gestures || !pointers.current.has(event.pointerId) || !gesture.current) return;
    pointers.current.set(event.pointerId, local(event));
    const g = gesture.current;
    const c = center();
    if (!g.moved && Math.hypot(c.x - g.x, c.y - g.y) < MOVE_THRESHOLD && pointers.current.size < 2)
      return;
    if (!g.moved) {
      g.moved = true;
      wasDragged.current = true;
      setDragging(true);
      try {
        (event.currentTarget as Element).setPointerCapture(event.pointerId);
      } catch {
        // Pointer already released.
      }
    }
    let next = { ...g.view, x: g.view.x + (c.x - g.x), y: g.view.y + (c.y - g.y) };
    if (pointers.current.size >= 2 && g.distance > 0) {
      next = zoomAt(g.view, c.distance / g.distance, g.x, g.y, contentRef.current);
      next = { ...next, x: next.x + (c.x - g.x), y: next.y + (c.y - g.y) };
    }
    apply(next);
  };

  const release = (event: PointerEvent<E>) => {
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) {
      gesture.current = null;
      setDragging(false);
    } else {
      const c = center();
      gesture.current = {
        view: viewRef.current,
        x: c.x,
        y: c.y,
        distance: c.distance,
        moved: true,
      };
    }
  };

  // The wheel listener must be non-passive to cancel page scrolling while zooming.
  useEffect(() => {
    const element = ref.current;
    if (!gestures || !element) return;
    const onWheel = (event: Event) => {
      const wheel = event as WheelEvent;
      if (wheelZoom === "modifier" && !(wheel.ctrlKey || wheel.metaKey)) return;
      const current = viewRef.current;
      const out = wheel.deltaY > 0;
      const limitsNow = contentRef.current;
      // At the zoom floor, scrolling "out" belongs to the page.
      if (out && current.k <= limitsNow.minZoom + 1e-6) return;
      event.preventDefault();
      cancelAnimationFrame(frame.current);
      const unit = wheel.deltaMode === 1 ? 16 : wheel.deltaMode === 2 ? 400 : 1;
      const speed = wheel.ctrlKey ? 0.01 : 0.0018;
      const box = element.getBoundingClientRect();
      apply(
        zoomAt(
          current,
          Math.exp(-wheel.deltaY * unit * speed),
          wheel.clientX - box.left,
          wheel.clientY - box.top,
          limitsNow,
        ),
      );
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [gestures, wheelZoom, apply]);

  return {
    ref: ref as RefObject<E | null>,
    view,
    dragging,
    /** True right after a drag ended: the click that follows must be ignored. */
    wasDragged: () => wasDragged.current,
    zoomBy,
    fit,
    panBy,
    focusBox,
    animateTo,
    canZoomIn: view.k < maxZoom - 1e-6,
    canZoomOut: view.k > minZoom + 1e-6,
    pointerProps: { onPointerDown, onPointerMove, onPointerUp: release, onPointerCancel: release },
  };
}

export type MapViewController = ReturnType<typeof useMapView<SVGSVGElement>>;
