/** A cell position in grid coordinates: row 0 is the header row, rows 1..n the body. */
export interface GridPos {
  row: number;
  col: number;
}

export interface NavigateInput {
  key: string;
  /** Ctrl or Meta. */
  mod: boolean;
  pos: GridPos;
  /** Body rows (the header row is extra). */
  rowCount: number;
  colCount: number;
  /** Rows PageUp / PageDown move. */
  pageSize: number;
  rtl: boolean;
}

export const NAVIGATION_KEYS: readonly string[] = [
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
];

/**
 * The WAI-ARIA grid navigation keys: arrows move one cell (no wrap), Home / End go to the first /
 * last cell of the row, Ctrl+Home / Ctrl+End to the first / last cell of the grid, PageUp /
 * PageDown move `pageSize` rows. Arrow left and right swap in right-to-left. Returns `null` for a
 * key that is not navigation; a move that would leave the grid returns the same position.
 */
export function navigate({
  key,
  mod,
  pos,
  rowCount,
  colCount,
  pageSize,
  rtl,
}: NavigateInput): GridPos | null {
  const lastRow = Math.max(0, rowCount);
  const lastCol = Math.max(0, colCount - 1);
  const clamp = (row: number, col: number): GridPos => ({
    row: Math.min(lastRow, Math.max(0, row)),
    col: Math.min(lastCol, Math.max(0, col)),
  });
  const inline = rtl ? -1 : 1;
  switch (key) {
    case "ArrowRight":
      return clamp(pos.row, pos.col + inline);
    case "ArrowLeft":
      return clamp(pos.row, pos.col - inline);
    case "ArrowDown":
      return clamp(pos.row + 1, pos.col);
    case "ArrowUp":
      return clamp(pos.row - 1, pos.col);
    case "Home":
      return mod ? clamp(0, 0) : clamp(pos.row, 0);
    case "End":
      return mod ? clamp(lastRow, lastCol) : clamp(pos.row, lastCol);
    case "PageDown":
      return clamp(pos.row + pageSize, pos.col);
    case "PageUp":
      // From the body, PageUp stops at the first body row; the header is reached with ArrowUp.
      return clamp(Math.max(pos.row === 0 ? 0 : 1, pos.row - pageSize), pos.col);
    default:
      return null;
  }
}

export type HeaderAction =
  | { type: "sort"; additive: boolean }
  /** `direction` is -1 toward the inline start, +1 toward the inline end. */
  | { type: "resize"; direction: 1 | -1 }
  | { type: "move"; direction: 1 | -1 }
  | { type: "menu" };

export interface HeaderKey {
  key: string;
  shift: boolean;
  alt: boolean;
  /** Ctrl or Meta. */
  mod: boolean;
}

/**
 * Keys with a meaning on a column header, as in the React kit: Enter / Space sort (Shift adds a
 * rule), Shift+Arrow resizes, Ctrl+Shift+Arrow moves the column, Alt+ArrowDown opens the menu.
 * `direction` is logical: with `rtl`, ArrowLeft points toward the inline end.
 */
export function headerAction(event: HeaderKey, rtl: boolean): HeaderAction | null {
  const { key, shift, alt, mod } = event;
  if ((key === "ArrowLeft" || key === "ArrowRight") && shift && !alt) {
    const visual = key === "ArrowRight" ? 1 : -1;
    const direction = (rtl ? -visual : visual) as 1 | -1;
    return mod ? { type: "move", direction } : { type: "resize", direction };
  }
  if (key === "ArrowDown" && alt) return { type: "menu" };
  if (key === "Enter" || key === " ") return { type: "sort", additive: shift };
  return null;
}
