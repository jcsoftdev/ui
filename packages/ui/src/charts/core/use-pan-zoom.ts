"use client";

import { type PointerEvent, useCallback, useEffect, useRef, useState } from "react";

/** Scale `k` and translation of a pannable stage: screen = content * k + (x, y). */
export interface PanZoomView {
  k: number;
  x: number;
  y: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Scales `view` by `factor` keeping the screen point `px, py` fixed. */
export function zoomAround(
  view: PanZoomView,
  factor: number,
  px: number,
  py: number,
  minZoom: number,
  maxZoom: number,
): PanZoomView {
  const k = clamp(view.k * factor, minZoom, maxZoom);
  const ratio = k / view.k;
  return { k, x: px - (px - view.x) * ratio, y: py - (py - view.y) * ratio };
}

/**
 * View that shows a `contentWidth` x `contentHeight` drawing centred in a
 * `width` x `height` viewport, `padding` from the edges, never enlarged past `maxFit`.
 */
export function fitView(
  contentWidth: number,
  contentHeight: number,
  width: number,
  height: number,
  { padding = 16, minZoom = 0.05, maxFit = 1 } = {},
): PanZoomView {
  const k = clamp(
    Math.min(
      (width - padding * 2) / Math.max(1, contentWidth),
      (height - padding * 2) / Math.max(1, contentHeight),
      maxFit,
    ),
    minZoom,
    Number.POSITIVE_INFINITY,
  );
  return { k, x: (width - contentWidth * k) / 2, y: (height - contentHeight * k) / 2 };
}

export interface UsePanZoomOptions {
  minZoom?: number;
  maxZoom?: number;
  /**
   * Wheel zoom: `modifier` (default) only with Ctrl/⌘ or a trackpad pinch, so
   * the page keeps scrolling; `always` captures the wheel; `off` ignores it.
   */
  wheel?: "modifier" | "always" | "off";
}

const DRAG_THRESHOLD = 4;

/**
 * Pan (drag), zoom (wheel, pinch, buttons) for an element that holds a
 * transformed stage. Pointer capture starts only once a drag passes a few
 * pixels, so clicks on content inside the stage still work; `wasDrag()` tells
 * a click handler to ignore the click that ends a drag.
 */
export function usePanZoom<T extends HTMLElement>({
  minZoom = 0.1,
  maxZoom = 2.5,
  wheel = "modifier",
}: UsePanZoomOptions = {}) {
  const ref = useRef<T | null>(null);
  const [view, setViewState] = useState<PanZoomView>({ k: 1, x: 0, y: 0 });
  const [interacting, setInteracting] = useState(false);
  const viewRef = useRef(view);
  const userMoved = useRef(false);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ dragged: boolean; startX: number; startY: number; distance: number }>({
    dragged: false,
    startX: 0,
    startY: 0,
    distance: 0,
  });
  const lastDrag = useRef(false);

  const setView = useCallback((next: PanZoomView, { user = true }: { user?: boolean } = {}) => {
    viewRef.current = next;
    if (user) userMoved.current = true;
    setViewState(next);
  }, []);

  const zoomBy = useCallback(
    (factor: number, around?: { x: number; y: number }) => {
      const element = ref.current;
      const px = around?.x ?? (element ? element.clientWidth / 2 : 0);
      const py = around?.y ?? (element ? element.clientHeight / 2 : 0);
      setView(zoomAround(viewRef.current, factor, px, py, minZoom, maxZoom));
    },
    [minZoom, maxZoom, setView],
  );

  useEffect(() => {
    const element = ref.current;
    if (!element || wheel === "off") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onWheel = (event: WheelEvent) => {
      if (wheel === "modifier" && !event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const box = element.getBoundingClientRect();
      const factor = Math.exp(-event.deltaY * (event.deltaMode === 1 ? 0.05 : 0.0025));
      setInteracting(true);
      clearTimeout(timer);
      timer = setTimeout(() => setInteracting(false), 160);
      setView(
        zoomAround(
          viewRef.current,
          factor,
          event.clientX - box.left,
          event.clientY - box.top,
          minZoom,
          maxZoom,
        ),
      );
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      clearTimeout(timer);
      element.removeEventListener("wheel", onWheel);
    };
  }, [wheel, minZoom, maxZoom, setView]);

  const local = (event: PointerEvent<T>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - box.left, y: event.clientY - box.top };
  };

  const onPointerDown = (event: PointerEvent<T>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const point = local(event);
    pointers.current.set(event.pointerId, point);
    if (pointers.current.size === 1) {
      gesture.current = { dragged: false, startX: point.x, startY: point.y, distance: 0 };
    } else if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()] as [
        { x: number; y: number },
        { x: number; y: number },
      ];
      gesture.current.distance = Math.hypot(a.x - b.x, a.y - b.y);
      gesture.current.dragged = true;
    }
  };

  const onPointerMove = (event: PointerEvent<T>) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const point = local(event);
    pointers.current.set(event.pointerId, point);
    const state = gesture.current;
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()] as [
        { x: number; y: number },
        { x: number; y: number },
      ];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (state.distance > 0) {
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        setView(
          zoomAround(viewRef.current, distance / state.distance, mid.x, mid.y, minZoom, maxZoom),
        );
      }
      state.distance = distance;
      return;
    }
    if (!state.dragged) {
      if (Math.hypot(point.x - state.startX, point.y - state.startY) < DRAG_THRESHOLD) return;
      state.dragged = true;
      setInteracting(true);
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
    const current = viewRef.current;
    setView({
      k: current.k,
      x: current.x + point.x - previous.x,
      y: current.y + point.y - previous.y,
    });
  };

  const onPointerEnd = (event: PointerEvent<T>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) {
      lastDrag.current = gesture.current.dragged;
      setInteracting(false);
    }
  };

  return {
    ref,
    view,
    setView,
    zoomBy,
    /** True while dragging, pinching or wheel zooming: transitions should be off. */
    interacting,
    /** The user moved the view since the last automatic fit. */
    userMoved,
    /** The last pointer gesture was a drag, not a click. */
    wasDrag: () => lastDrag.current,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: onPointerEnd,
      onPointerCancel: onPointerEnd,
    },
  };
}
