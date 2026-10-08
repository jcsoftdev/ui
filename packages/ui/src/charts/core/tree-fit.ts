import type { TreeDirection, TreeLayout } from "./tree-layout.js";
import type { PanZoomView } from "./use-pan-zoom.js";

/** `contain` shows the whole tree, `readable` keeps cards legible and puts the root in view. */
export type TreeFitMode = "contain" | "readable";

export interface TreeFitOptions {
  /** Pixels reserved at the top (the zoom toolbar). */
  inset?: number;
  padding?: number;
  /** `auto` falls back to `readable` when `contain` would scale below `minReadable`. */
  mode?: TreeFitMode | "auto";
  /** Smallest scale at which a fitted tree still counts as legible. */
  minReadable?: number;
  /** Scale range of the `readable` view. */
  readableMin?: number;
  readableMax?: number;
  minZoom?: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Initial view of a laid out tree in a `width` x `height` viewport. `contain` scales the whole
 * tree to fit (never past 1). `readable` ignores the width: it fits by height within
 * `[readableMin, readableMax]` and puts the root at its edge (centred across), so the rest is a
 * pan away. `auto` picks `contain` unless it would drop below `minReadable`.
 */
export function treeFitView(
  layout: Pick<TreeLayout, "nodes" | "width" | "height">,
  width: number,
  height: number,
  direction: TreeDirection,
  {
    inset = 0,
    padding = 16,
    mode = "auto",
    minReadable = 0.6,
    readableMin = 0.85,
    readableMax = 1,
    minZoom = 0.05,
  }: TreeFitOptions = {},
): { view: PanZoomView; mode: TreeFitMode } {
  const areaHeight = Math.max(1, height - inset);
  const containK = Math.max(
    minZoom,
    Math.min(
      (width - padding * 2) / Math.max(1, layout.width),
      (areaHeight - padding * 2) / Math.max(1, layout.height),
      1,
    ),
  );
  const root = layout.nodes[0];
  if (!root || mode === "contain" || (mode === "auto" && containK >= minReadable)) {
    return {
      mode: "contain",
      view: {
        k: containK,
        x: (width - layout.width * containK) / 2,
        y: inset + (areaHeight - layout.height * containK) / 2,
      },
    };
  }

  const k = clamp(
    (areaHeight - padding * 2) / Math.max(1, layout.height),
    readableMin,
    readableMax,
  );
  let x = width / 2 - root.x * k;
  let y = inset + areaHeight / 2 - root.y * k;
  if (direction === "top") y = inset + padding - (root.y - root.height / 2) * k;
  else if (direction === "bottom") y = height - padding - (root.y + root.height / 2) * k;
  else if (direction === "left") x = padding - (root.x - root.width / 2) * k;
  else x = width - padding - (root.x + root.width / 2) * k;
  return { mode: "readable", view: { k, x, y } };
}
