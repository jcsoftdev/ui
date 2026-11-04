import type { Box } from "./model.js";

export type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export interface EditBounds {
  /** Canvas size in grid units. */
  width: number;
  height: number;
  /** Grid step positions and sizes snap to. */
  snap: number;
  /** Smallest width or height. */
  minSize: number;
}

export function snapTo(value: number, step: number): number {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

const clean = (value: number) => Math.round(value * 1e6) / 1e6;

function contain(box: Box, bounds: EditBounds): Box {
  const width = Math.min(Math.max(box.width, bounds.minSize), bounds.width);
  const height = Math.min(Math.max(box.height, bounds.minSize), bounds.height);
  return {
    x: clean(Math.min(Math.max(box.x, 0), bounds.width - width)),
    y: clean(Math.min(Math.max(box.y, 0), bounds.height - height)),
    width: clean(width),
    height: clean(height),
  };
}

/** Moves a box by a delta in grid units, snapped to the grid and kept inside the canvas. */
export function moveBox(box: Box, dx: number, dy: number, bounds: EditBounds): Box {
  return contain(
    { ...box, x: snapTo(box.x + dx, bounds.snap), y: snapTo(box.y + dy, bounds.snap) },
    bounds,
  );
}

/** Resizes a box from one handle by a delta in grid units; the opposite edges stay put. */
export function resizeBox(
  box: Box,
  handle: ResizeHandle,
  dx: number,
  dy: number,
  bounds: EditBounds,
): Box {
  let left = box.x;
  let top = box.y;
  let right = box.x + box.width;
  let bottom = box.y + box.height;
  const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
  if (handle.includes("w")) left = clamp(snapTo(left + dx, bounds.snap), 0, right - bounds.minSize);
  if (handle.includes("e")) {
    right = clamp(snapTo(right + dx, bounds.snap), left + bounds.minSize, bounds.width);
  }
  if (handle.includes("n")) top = clamp(snapTo(top + dy, bounds.snap), 0, bottom - bounds.minSize);
  if (handle.includes("s")) {
    bottom = clamp(snapTo(bottom + dy, bounds.snap), top + bounds.minSize, bounds.height);
  }
  return contain({ x: left, y: top, width: right - left, height: bottom - top }, bounds);
}

/** Turns a box a quarter by swapping its width and height around its centre, snapped and kept inside the canvas. */
export function rotateBox(box: Box, bounds: EditBounds): Box {
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  return moveBox(
    {
      x: centerX - box.height / 2,
      y: centerY - box.width / 2,
      width: box.height,
      height: box.width,
    },
    0,
    0,
    bounds,
  );
}

const ARROWS: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

export type EditKeyResult = { box: Box } | undefined;

/**
 * Keyboard edit of a box: Alt with an arrow nudges by one grid step, Alt and Shift with an arrow
 * grows or shrinks the bottom-right corner, `r` turns it a quarter. Anything else is not an edit.
 */
export function editKey(
  box: Box,
  event: { key: string; altKey: boolean; shiftKey: boolean; ctrlKey?: boolean; metaKey?: boolean },
  bounds: EditBounds,
): EditKeyResult {
  if (event.ctrlKey || event.metaKey) return undefined;
  if (!event.altKey && !event.shiftKey && event.key.toLowerCase() === "r") {
    return { box: rotateBox(box, bounds) };
  }
  const arrow = ARROWS[event.key];
  if (!arrow || !event.altKey) return undefined;
  const dx = arrow[0] * bounds.snap;
  const dy = arrow[1] * bounds.snap;
  return {
    box: event.shiftKey ? resizeBox(box, "se", dx, dy, bounds) : moveBox(box, dx, dy, bounds),
  };
}

export function sameBox(a: Box, b: Box): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}
