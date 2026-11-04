import type { TableShape } from "../../atoms/table-glyph/layout.js";

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FloorPlanBox extends Box {
  id: string;
}

export type LabelPlacement = "inside" | "below";

export const DEFAULT_PX_PER_UNIT = 32;
const CHAIR_BAND = 0.24;
const MIN_INSIDE_WIDTH = 44;
const MIN_INSIDE_HEIGHT = 30;

/**
 * Whether an item's label fits inside the table body. The usable area is the box minus the chair
 * band (and a round body only offers its inscribed square), measured in pixels from the canvas
 * scale; anything smaller puts the label under the shape.
 */
export function labelPlacement(
  item: { width: number; height: number; shape: TableShape },
  pxPerUnit: number = DEFAULT_PX_PER_UNIT,
): LabelPlacement {
  if (item.shape === "bar") return "below";
  const usable = (units: number) => units * pxPerUnit * (1 - 2 * CHAIR_BAND);
  const round = item.shape === "round" ? Math.SQRT1_2 : 1;
  const fits =
    usable(item.width) * round >= MIN_INSIDE_WIDTH &&
    usable(item.height) * round >= MIN_INSIDE_HEIGHT;
  return fits ? "inside" : "below";
}

export function percentBox(box: Box, width: number, height: number) {
  return {
    left: `${(box.x / width) * 100}%`,
    top: `${(box.y / height) * 100}%`,
    width: `${(box.width / width) * 100}%`,
    height: `${(box.height / height) * 100}%`,
  };
}

export interface GroupOutline extends Box {
  groupId: string;
}

export const GROUP_PADDING = 0.2;

/** One outline per `groupId` shared by at least two items: their union box plus a small padding. */
export function groupOutlines(
  items: ReadonlyArray<Box & { groupId?: string | undefined }>,
): GroupOutline[] {
  const groups = new Map<string, Box[]>();
  for (const item of items) {
    if (item.groupId === undefined) continue;
    const list = groups.get(item.groupId) ?? [];
    list.push(item);
    groups.set(item.groupId, list);
  }
  const outlines: GroupOutline[] = [];
  for (const [groupId, members] of groups) {
    if (members.length < 2) continue;
    const left = Math.min(...members.map((m) => m.x));
    const top = Math.min(...members.map((m) => m.y));
    const right = Math.max(...members.map((m) => m.x + m.width));
    const bottom = Math.max(...members.map((m) => m.y + m.height));
    outlines.push({
      groupId,
      x: left - GROUP_PADDING,
      y: top - GROUP_PADDING,
      width: right - left + 2 * GROUP_PADDING,
      height: bottom - top + 2 * GROUP_PADDING,
    });
  }
  return outlines;
}
