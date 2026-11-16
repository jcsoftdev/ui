export type GridKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown" | "Home" | "End";

export interface GridCell {
  row: number;
  col: number;
}

export interface GridSize {
  rows: number;
  cols: number;
}

const GRID_KEYS: readonly string[] = [
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Home",
  "End",
];

export const isGridKey = (key: string): key is GridKey => GRID_KEYS.includes(key);

const targetOf = (at: GridCell, key: GridKey, size: GridSize): GridCell => {
  switch (key) {
    case "ArrowLeft":
      return { row: at.row, col: at.col - 1 };
    case "ArrowRight":
      return { row: at.row, col: at.col + 1 };
    case "ArrowUp":
      return { row: at.row - 1, col: at.col };
    case "ArrowDown":
      return { row: at.row + 1, col: at.col };
    case "Home":
      return { row: at.row, col: 0 };
    case "End":
      return { row: at.row, col: size.cols - 1 };
  }
};

const isInside = (cell: GridCell, size: GridSize): boolean =>
  cell.row >= 0 && cell.row < size.rows && cell.col >= 0 && cell.col < size.cols;

export function nextGridCell(at: GridCell, key: GridKey, size: GridSize): GridCell | undefined {
  const target = targetOf(at, key, size);
  return isInside(target, size) ? target : undefined;
}
