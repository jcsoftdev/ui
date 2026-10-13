import type { Bounds } from "../internal/geo.js";

/** Zoom and pan of a map: screen = point * k + (x, y). */
export interface MapView {
  k: number;
  x: number;
  y: number;
}

export const IDENTITY_VIEW: MapView = { k: 1, x: 0, y: 0 };

export interface ViewLimits {
  minZoom: number;
  maxZoom: number;
}

export const DEFAULT_LIMITS: ViewLimits = { minZoom: 1, maxZoom: 16 };

/** Screen position of a point drawn at zoom 1. */
export function toScreen(view: MapView, x: number, y: number): [number, number] {
  return [x * view.k + view.x, y * view.k + view.y];
}

/**
 * Keeps the map from being lost: its content box (`content`, in zoom 1 pixels)
 * must stay inside the `width` x `height` viewport on each axis, or, when it is
 * bigger than the viewport, cover it, with `margin` pixels of slack.
 */
export function clampView(
  view: MapView,
  width: number,
  height: number,
  content: Bounds,
  limits: ViewLimits = DEFAULT_LIMITS,
  margin = 0,
): MapView {
  const k = Math.min(limits.maxZoom, Math.max(limits.minZoom, view.k));
  if (k <= 1.0001) return { k: Math.max(1, k), x: 0, y: 0 };
  const axis = (offset: number, lo: number, hi: number, size: number) => {
    const start = lo * k;
    const end = hi * k;
    const min = size - margin - end;
    const max = margin - start;
    if (min > max) return (min + max) / 2;
    return Math.min(max, Math.max(min, offset));
  };
  return {
    k,
    x: axis(view.x, content[0], content[2], width),
    y: axis(view.y, content[1], content[3], height),
  };
}

/** Multiplies the zoom by `factor` keeping the screen point (`cx`, `cy`) fixed. */
export function zoomAt(
  view: MapView,
  factor: number,
  cx: number,
  cy: number,
  limits: ViewLimits = DEFAULT_LIMITS,
): MapView {
  const k = Math.min(limits.maxZoom, Math.max(limits.minZoom, view.k * factor));
  const ratio = k / view.k;
  return { k, x: cx - (cx - view.x) * ratio, y: cy - (cy - view.y) * ratio };
}

/** View that frames a box given in zoom 1 pixels inside the viewport. */
export function viewFitting(
  box: Bounds,
  width: number,
  height: number,
  { padding = 32, maxZoom = DEFAULT_LIMITS.maxZoom }: { padding?: number; maxZoom?: number } = {},
): MapView {
  const w = Math.max(1, box[2] - box[0]);
  const h = Math.max(1, box[3] - box[1]);
  const k = Math.min(
    maxZoom,
    Math.max(1, Math.min((width - padding * 2) / w, (height - padding * 2) / h)),
  );
  return {
    k,
    x: width / 2 - ((box[0] + box[2]) / 2) * k,
    y: height / 2 - ((box[1] + box[3]) / 2) * k,
  };
}

/** Pans the view the least that brings the zoom 1 point (`x`, `y`) inside the viewport. */
export function revealPoint(
  view: MapView,
  x: number,
  y: number,
  width: number,
  height: number,
  margin = 40,
): MapView {
  const [sx, sy] = toScreen(view, x, y);
  const dx = sx < margin ? margin - sx : sx > width - margin ? width - margin - sx : 0;
  const dy = sy < margin ? margin - sy : sy > height - margin ? height - margin - sy : 0;
  return dx === 0 && dy === 0 ? view : { ...view, x: view.x + dx, y: view.y + dy };
}

export type { Bounds } from "../internal/geo.js";
