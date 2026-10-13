/** Hemicycle seat layout and whole-unit sharing between categories. */
/** Drops floating point noise (0.6000000000000001 -> 0.6). */
function clean(value: number): number {
  return Math.round(value * 1e9) / 1e9;
}

/**
 * Shares `total` whole units between weights so they add up exactly
 * (largest remainder method). Negative or missing weights count as zero; all
 * zero weights get nothing.
 */
export function largestRemainder(weights: readonly number[], total: number): number[] {
  const safe = weights.map((weight) => (Number.isFinite(weight) && weight > 0 ? weight : 0));
  const sum = safe.reduce((acc, weight) => acc + weight, 0);
  const slots = Math.max(0, Math.round(total));
  if (sum <= 0 || slots === 0) return safe.map(() => 0);
  const exact = safe.map((weight) => (weight / sum) * slots);
  const counts = exact.map((share) => Math.floor(clean(share)));
  let left = slots - counts.reduce((acc, count) => acc + count, 0);
  const order = exact
    .map((share, index) => ({ index, rest: share - (counts[index] as number) }))
    .filter((entry) => (safe[entry.index] as number) > 0)
    .sort((a, b) => b.rest - a.rest || a.index - b.index);
  for (let i = 0; left > 0 && order.length > 0; i += 1, left -= 1) {
    const entry = order[i % order.length] as { index: number };
    counts[entry.index] = (counts[entry.index] as number) + 1;
  }
  return counts;
}

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

/** Category of each position when `counts` are laid one after the other. */
export function assignUnits(counts: readonly number[]): number[] {
  const owners: number[] = [];
  counts.forEach((count, category) => {
    for (let i = 0; i < count; i += 1) owners.push(category);
  });
  return owners;
}
