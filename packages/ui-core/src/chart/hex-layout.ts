/**
 * Honeycomb geometry for heatmaps: pointy-top hexagons in an "odd-r" offset
 * grid (odd rows are shifted half a cell to the right). Pure.
 */

const SQRT3 = Math.sqrt(3);

export interface HexLayoutInput {
  rows: number;
  columns: number;
  /** Area the honeycomb must fit, in pixels. */
  width: number;
  height: number;
}

export interface HexLayout {
  /** Circumradius of one hexagon. */
  radius: number;
  /** Horizontal distance between two neighbours of a row. */
  stepX: number;
  /** Vertical distance between two rows. */
  stepY: number;
  /** Top-left of the honeycomb inside the area (it is centred). */
  originX: number;
  originY: number;
  /** Centre of a cell. */
  center(row: number, column: number): { x: number; y: number };
  /** Cell under a point (relative to the area), or null outside the honeycomb. */
  cellAt(x: number, y: number): { row: number; column: number } | null;
}

export function hexLayout({ rows, columns, width, height }: HexLayoutInput): HexLayout {
  const fitX = columns > 0 ? width / (SQRT3 * (columns + 0.5)) : 0;
  const fitY = rows > 0 ? height / (1.5 * (rows - 1) + 2) : 0;
  const radius = Math.max(0, Math.min(fitX, fitY));
  const stepX = SQRT3 * radius;
  const stepY = 1.5 * radius;
  const usedWidth = stepX * (columns + 0.5);
  const usedHeight = stepY * Math.max(0, rows - 1) + 2 * radius;
  const originX = Math.max(0, (width - usedWidth) / 2);
  const originY = Math.max(0, (height - usedHeight) / 2);
  const center = (row: number, column: number) => ({
    x: originX + stepX * (column + 0.5 + (row & 1) * 0.5),
    y: originY + radius + stepY * row,
  });
  return {
    radius,
    stepX,
    stepY,
    originX,
    originY,
    center,
    cellAt(x, y) {
      if (radius <= 0) return null;
      // Pixel to fractional axial coordinates relative to cell (0, 0).
      const first = center(0, 0);
      const px = x - first.x;
      const py = y - first.y;
      const q = ((SQRT3 / 3) * px - py / 3) / radius;
      const r = ((2 / 3) * py) / radius;
      // Cube rounding.
      let cx = Math.round(q);
      let cz = Math.round(r);
      const cy = Math.round(-q - r);
      const dx = Math.abs(cx - q);
      const dy = Math.abs(cy - (-q - r));
      const dz = Math.abs(cz - r);
      if (dx > dy && dx > dz) cx = -cy - cz;
      else if (dy <= dz) cz = -cx - cy;
      const row = cz;
      const column = cx + (row - (row & 1)) / 2;
      if (row < 0 || row >= rows || column < 0 || column >= columns) return null;
      return { row, column };
    },
  };
}

/** Closed path of a pointy-top hexagon centred at `(cx, cy)`. */
export function hexPath(cx: number, cy: number, radius: number): string {
  const points: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 180) * (60 * i - 90);
    points.push(
      `${Math.round((cx + radius * Math.cos(angle)) * 100) / 100},${Math.round((cy + radius * Math.sin(angle)) * 100) / 100}`,
    );
  }
  return `M${points.join("L")}Z`;
}
