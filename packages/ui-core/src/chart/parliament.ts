/** Hemicycle seat layout and whole-unit sharing between categories. */
import { assignUnits, clean, largestRemainder } from "../internal/unit-share.ts";

export { assignUnits, largestRemainder };

export interface Seat {
  /** Center relative to the hemicycle center, in outer-radius units (y grows downwards). */
  x: number;
  y: number;
  /** 0 is the innermost row. */
  row: number;
  /** Radians, pi on the left end, 0 on the right end. */
  angle: number;
}

export interface ParliamentLayout {
  rows: number;
  /** Radius of each seat, in outer-radius units. */
  seatRadius: number;
  /** Every seat ordered left to right, so consecutive groups form wedges. */
  seats: Seat[];
  /** Radius of every row, innermost first. */
  radii: number[];
}

function rowRadii(rows: number, inner: number): number[] {
  if (rows <= 1) return [1];
  return Array.from({ length: rows }, (_, row) => inner + ((1 - inner) * row) / (rows - 1));
}

/** Seats that fit in `rows` arcs when neighbours keep the radial row spacing. */
function arcCapacity(rows: number, inner: number): number {
  if (rows <= 1) return 5;
  const spacing = (1 - inner) / (rows - 1);
  return rowRadii(rows, inner).reduce(
    (acc, radius) => acc + Math.floor((Math.PI * radius) / spacing) + 1,
    0,
  );
}

/** Fewest arcs that hold `seats` without crowding. */
export function parliamentRows(seats: number, innerRatio = 0.4): number {
  if (seats <= 0) return 0;
  const inner = Math.min(0.9, Math.max(0, innerRatio));
  let rows = 1;
  while (rows < 60 && arcCapacity(rows, inner) < seats) rows += 1;
  return rows;
}

/**
 * Seats of a hemicycle. Rows are auto-computed for the seat count (or fixed
 * with `rows`), each row gets seats in proportion to its length, and the
 * result is sorted left to right so assigning groups in order draws wedges.
 */
export function parliamentLayout(
  total: number,
  { rows: fixedRows, innerRatio = 0.4 }: { rows?: number; innerRatio?: number } = {},
): ParliamentLayout {
  const seatsWanted = Math.max(0, Math.floor(total));
  if (seatsWanted === 0) return { rows: 0, seatRadius: 0, seats: [], radii: [] };
  const inner = Math.min(0.9, Math.max(0, innerRatio));
  const rows = Math.max(1, Math.min(seatsWanted, fixedRows ?? parliamentRows(seatsWanted, inner)));
  const radii = rowRadii(rows, inner);
  const perRow = largestRemainder(radii, seatsWanted);
  const seats: Seat[] = [];
  let spacing = rows > 1 ? (1 - inner) / (rows - 1) : Number.POSITIVE_INFINITY;
  perRow.forEach((count, row) => {
    const radius = radii[row] as number;
    if (count > 1) spacing = Math.min(spacing, (Math.PI * radius) / (count - 1));
    for (let index = 0; index < count; index += 1) {
      const angle = count === 1 ? Math.PI / 2 : Math.PI - (index * Math.PI) / (count - 1);
      seats.push({
        x: clean(radius * Math.cos(angle)),
        y: clean(-radius * Math.sin(angle)),
        row,
        angle,
      });
    }
  });
  seats.sort((a, b) => b.angle - a.angle || a.row - b.row);
  const seatRadius = Number.isFinite(spacing) ? spacing * 0.42 : 0.3;
  return { rows, seatRadius, seats, radii };
}
