export interface KanbanCardData {
  id: string;
  title: string;
  description?: string;
  tag?: string;
  assignee?: string;
  meta?: string;
}

export interface KanbanColumnData {
  id: string;
  title: string;
  /** Work-in-progress limit: the badge warns at the limit and turns red above it. */
  wipLimit?: number;
  cards: KanbanCardData[];
}

export interface KanbanMove {
  cardId: string;
  fromColumnId: string;
  fromIndex: number;
  toColumnId: string;
  toIndex: number;
}

export type WipStatus = "none" | "ok" | "at-limit" | "over";

export function wipStatus(count: number, limit?: number): WipStatus {
  if (limit === undefined) return "none";
  if (count > limit) return "over";
  return count === limit ? "at-limit" : "ok";
}

export function locateCard(
  columns: KanbanColumnData[],
  cardId: string,
): { columnId: string; index: number } | null {
  for (const column of columns) {
    const index = column.cards.findIndex((card) => card.id === cardId);
    if (index !== -1) return { columnId: column.id, index };
  }
  return null;
}

export interface MoveOptions {
  /** Refuse drops into a different column that is already at its WIP limit. */
  enforceLimit?: boolean;
}

/**
 * Moves a card. `toIndex` is the position in the target column AFTER the card is removed from
 * its origin, clamped to the column. Returns null when nothing changes (unknown ids, same spot,
 * or a blocked drop), so callers can skip the update.
 */
export function moveCard(
  columns: KanbanColumnData[],
  cardId: string,
  toColumnId: string,
  toIndex: number,
  options: MoveOptions = {},
): { columns: KanbanColumnData[]; move: KanbanMove } | null {
  const from = locateCard(columns, cardId);
  const target = columns.find((column) => column.id === toColumnId);
  if (!from || !target) return null;

  const sameColumn = from.columnId === toColumnId;
  if (
    !sameColumn &&
    options.enforceLimit &&
    target.wipLimit !== undefined &&
    target.cards.length >= target.wipLimit
  ) {
    return null;
  }

  const remaining = sameColumn ? target.cards.length - 1 : target.cards.length;
  const index = Math.min(Math.max(0, Math.trunc(toIndex)), remaining);
  if (sameColumn && index === from.index) return null;

  const source = columns.find((column) => column.id === from.columnId);
  const card = source?.cards[from.index];
  if (!card) return null;

  const next = columns.map((column) => {
    if (column.id === from.columnId && !sameColumn) {
      return { ...column, cards: column.cards.filter((c) => c.id !== cardId) };
    }
    if (column.id === toColumnId) {
      const cards = column.cards.filter((c) => c.id !== cardId);
      cards.splice(index, 0, card);
      return { ...column, cards };
    }
    return column;
  });

  return {
    columns: next,
    move: {
      cardId,
      fromColumnId: from.columnId,
      fromIndex: from.index,
      toColumnId,
      toIndex: index,
    },
  };
}

export type KanbanKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown";

/** Where a grabbed card goes for an arrow key: sideways keeps the row, vertical reorders. */
export function keyboardTarget(
  columns: KanbanColumnData[],
  cardId: string,
  key: KanbanKey,
): { columnId: string; index: number } | null {
  const at = locateCard(columns, cardId);
  if (!at) return null;
  const columnIndex = columns.findIndex((column) => column.id === at.columnId);
  const column = columns[columnIndex];
  if (!column) return null;

  if (key === "ArrowUp")
    return at.index > 0 ? { columnId: at.columnId, index: at.index - 1 } : null;
  if (key === "ArrowDown") {
    return at.index < column.cards.length - 1
      ? { columnId: at.columnId, index: at.index + 1 }
      : null;
  }
  const neighbour = columns[columnIndex + (key === "ArrowRight" ? 1 : -1)];
  if (!neighbour) return null;
  return { columnId: neighbour.id, index: Math.min(at.index, neighbour.cards.length) };
}

/** Insert index for a pointer at `y`, from the vertical midpoints of the cards left in a column. */
export function dropIndex(midpoints: number[], y: number): number {
  let index = 0;
  for (const mid of midpoints) {
    if (y > mid) index += 1;
  }
  return index;
}

export interface CardRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

/**
 * Insert index for a pointer at (`x`, `y`) over a lane that lays its cards out as a grid, from the
 * rectangles of the cards left in the lane in reading order: a card is passed when the pointer is
 * below its row, or inside its row and past its horizontal midpoint.
 */
export function dropIndexGrid(rects: CardRect[], x: number, y: number): number {
  let index = 0;
  for (const rect of rects) {
    if (y > rect.bottom || (y >= rect.top && x > (rect.left + rect.right) / 2)) index += 1;
  }
  return index;
}
