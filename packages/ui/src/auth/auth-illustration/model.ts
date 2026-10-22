/** What the sign-in screen is doing. It is the only input of the illustration besides `progress`. */
export type AuthState = "idle" | "typing" | "password" | "error" | "success";

export const AUTH_STATES: readonly AuthState[] = [
  "idle",
  "typing",
  "password",
  "error",
  "success",
] as const;

export const clamp01 = (value: number): number =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;

/** `progress` is the fill of the whole form: the identifier is the first half, the password the second. */
export const IDENTIFIER_SHARE = 0.5;

const SPREAD = { idle: 0.85, error: 1.35, success: 0 } as const;
const TYPING = { start: 0.65, end: 0.35 } as const;
const PASSWORD = { start: 0.22, end: 0.05 } as const;

const lerp = (from: number, to: number, t: number) => from + (to - from) * clamp01(t);

/**
 * How far the three slabs sit apart: 0 is assembled, 1 is the loose resting layout. The slabs
 * drift together as the form fills (first the identifier, then the password), fly apart on an
 * error and lock together on success.
 */
export function slabSpread(state: AuthState, progress: number): number {
  const p = clamp01(progress);
  switch (state) {
    case "typing":
      return lerp(TYPING.start, TYPING.end, p / IDENTIFIER_SHARE);
    case "password":
      return lerp(PASSWORD.start, PASSWORD.end, (p - IDENTIFIER_SHARE) / (1 - IDENTIFIER_SHARE));
    default:
      return SPREAD[state];
  }
}

export const SLAB_COUNT = 3;

/** Apex of the first slab's top face in the 640x520 art box. */
const SLAB_BASE = { x: 277, y: 149 } as const;
/** Position of each slab when assembled, relative to {@link SLAB_BASE}. */
const SLAB_ASSEMBLED = [
  { x: 0, y: 0 },
  { x: 86.6, y: 50 },
  { x: 0, y: 100 },
] as const;
/** How far each slab travels (x, y) and rises (lift) at `spread` 1. */
const SLAB_TRAVEL = [
  { x: -120, y: 14, lift: 34 },
  { x: 104, y: -44, lift: 62 },
  { x: 14, y: 78, lift: 14 },
] as const;
const ACTIVE_LIFT = 20;

export interface SlabPlacement {
  x: number;
  y: number;
  lift: number;
}

const round = (value: number) => Math.round(value * 100) / 100;

/** Position and height of one slab. The slab at `activeIndex` rises a little above the rest. */
export function slabPlacement(index: number, spread: number, activeIndex: number): SlabPlacement {
  const assembled = SLAB_ASSEMBLED[index];
  const travel = SLAB_TRAVEL[index];
  if (!assembled || !travel) return { x: SLAB_BASE.x, y: SLAB_BASE.y, lift: 0 };
  return {
    x: round(SLAB_BASE.x + assembled.x + travel.x * spread),
    y: round(SLAB_BASE.y + assembled.y + travel.y * spread),
    lift: round(travel.lift * spread + (index === activeIndex ? ACTIVE_LIFT : 0)),
  };
}

export interface SparkVector {
  dx: number;
  dy: number;
}

/** Offsets of the success burst. Deterministic, so server and client render the same markup. */
export function sparkVectors(count = 12): SparkVector[] {
  return Array.from({ length: count }, (_, n) => {
    const angle = (n / count) * Math.PI * 2;
    const distance = 90 + ((n * 37) % 90);
    return { dx: round(Math.cos(angle) * distance), dy: round(Math.sin(angle) * distance * 0.7) };
  });
}

/** How long an error stays on screen before the illustration settles back to the password state. */
export const ERROR_HOLD_MS = 1100;

/** The state the art shows: an error that has been held long enough reads as `password` again. */
export function shownState(state: AuthState, errorHeld: boolean): AuthState {
  return state === "error" && errorHeld ? "password" : state;
}

/** Characters per field at which the form reports it full; one keystroke moves `progress` by 1/(2 x this). */
export const KEYSTROKES_PER_FIELD = 10;

export interface Keystroke {
  /** Keystrokes so far across both fields. */
  count: number;
  /** Which of the three pieces reacts to this keystroke. */
  target: number;
  /**
   * Alternates every time the same piece reacts again, so CSS can swap between two identical
   * keyframes and restart the animation without JavaScript timers.
   */
  phase: 0 | 1;
}

/** The keystroke a `progress` value stands for. */
export function keystroke(progress: number, pieces = 3): Keystroke {
  const count = Math.round(clamp01(progress) * KEYSTROKES_PER_FIELD * 2);
  return { count, target: count % pieces, phase: (Math.floor(count / pieces) % 2) as 0 | 1 };
}

export interface PointerOffset {
  x: number;
  y: number;
}

/**
 * Where a pointer is relative to a box, as -1 to 1 on each axis from its center (clamped, so a
 * pointer far over the form still reads as "all the way to that side").
 */
export function pointerOffset(
  point: { x: number; y: number },
  box: { left: number; top: number; width: number; height: number },
): PointerOffset {
  const axis = (value: number, start: number, size: number) =>
    size > 0
      ? Math.round(Math.max(-1, Math.min(1, (value - start - size / 2) / (size / 2))) * 1000) / 1000
      : 0;
  return { x: axis(point.x, box.left, box.width), y: axis(point.y, box.top, box.height) };
}

/* ---------------------------------------------------------------- isometric geometry */

const ISO_X = 0.866;
const ISO_Y = 0.5;

/** Screen position of a point in isometric space: `u` runs right-down, `v` left-down, `z` up. */
export function isoPoint(u: number, v: number, z = 0): { x: number; y: number } {
  return { x: round(ISO_X * (u - v)), y: round(ISO_Y * (u + v) - z) };
}

const pathOf = (points: readonly { x: number; y: number }[]) =>
  `M${points.map((p) => `${p.x} ${p.y}`).join("L")}Z`;

export interface IsoBox {
  top: string;
  /** Face along the front-left edge (`v` at its maximum). */
  left: string;
  /** Face along the front-right edge (`u` at its maximum). */
  right: string;
}

/** The three visible faces of a `w` by `d` by `h` box standing on the origin, centred on it. */
export function isoBox(w: number, d: number, h: number): IsoBox {
  const [u0, u1, v0, v1] = [-w / 2, w / 2, -d / 2, d / 2];
  return {
    top: pathOf([
      isoPoint(u0, v0, h),
      isoPoint(u1, v0, h),
      isoPoint(u1, v1, h),
      isoPoint(u0, v1, h),
    ]),
    left: pathOf([
      isoPoint(u0, v1, h),
      isoPoint(u1, v1, h),
      isoPoint(u1, v1, 0),
      isoPoint(u0, v1, 0),
    ]),
    right: pathOf([
      isoPoint(u1, v0, h),
      isoPoint(u1, v1, h),
      isoPoint(u1, v1, 0),
      isoPoint(u1, v0, 0),
    ]),
  };
}

/* ---------------------------------------------------------------- stack */

export interface StackBook {
  /** Footprint along `u` and `v`, and thickness. */
  w: number;
  d: number;
  h: number;
  /** Offset from the tower's axis, in isometric units, so the pile looks hand stacked. */
  du: number;
  dv: number;
  /** Colour role, 0 to 3. */
  tone: number;
}

/** The books of the tower from the bottom up. Narrow containers show only the first ones. */
export const STACK_BOOKS: readonly StackBook[] = [
  { w: 178, d: 128, h: 30, du: 0, dv: 0, tone: 0 },
  { w: 152, d: 112, h: 22, du: 8, dv: -6, tone: 1 },
  { w: 164, d: 104, h: 26, du: -10, dv: 6, tone: 2 },
  { w: 140, d: 112, h: 20, du: 6, dv: 4, tone: 3 },
  { w: 150, d: 98, h: 24, du: -6, dv: -8, tone: 1 },
  { w: 128, d: 100, h: 20, du: 4, dv: 6, tone: 0 },
];

/** How many books a container shows: fewer when it is narrow. */
export const STACK_COUNTS = [4, 5, 6] as const;
export type StackCount = (typeof STACK_COUNTS)[number];

/**
 * Books resting in a tower of `count`: the foundation is always there, the rest land one by one
 * as the form fills, and all of them are down on success.
 */
export function stackPlaced(state: AuthState, progress: number, count: number): number {
  if (state === "success") return count;
  return Math.min(count, 1 + Math.floor(clamp01(progress) * (count - 1) + 1e-9));
}

export interface StackSlot {
  /** Screen offset of the book's ground centre from the tower's base. */
  x: number;
  y: number;
}

/** Where each book sits, from its offsets and the thickness of the books under it. */
export function stackSlots(books: readonly StackBook[] = STACK_BOOKS): StackSlot[] {
  let z = 0;
  return books.map((book) => {
    const at = isoPoint(book.du, book.dv, z);
    z += book.h;
    return at;
  });
}

/** Top centre of the tower of `count` books, where the success flag is planted. */
export function stackTop(count: number, books: readonly StackBook[] = STACK_BOOKS): StackSlot {
  const shown = books.slice(0, count);
  const last = shown[shown.length - 1];
  if (!last) return { x: 0, y: 0 };
  const z = shown.reduce((sum, book) => sum + book.h, 0);
  return isoPoint(last.du, last.dv, z);
}

/* ---------------------------------------------------------------- mosaic */

/** Tiles per side of the mosaic floor; its container picks one by width. */
export const MOSAIC_SIZES = [4, 5, 6] as const;
export type MosaicSize = (typeof MOSAIC_SIZES)[number];

/** Diagonals of an `n` by `n` floor that are lit: they fill from the back corner as the form fills. */
export function mosaicFilled(state: AuthState, progress: number, n: number): number {
  const diagonals = n * 2 - 1;
  if (state === "success") return diagonals;
  return Math.min(diagonals, Math.floor(clamp01(progress) * diagonals + 1e-9));
}

export interface MosaicTile {
  row: number;
  col: number;
  /** Diagonal from the back corner, 0 to 2n-2: the fill and the error sweep follow it. */
  diagonal: number;
  /** Steps from the centre: the success ripple follows it. */
  ring: number;
}

export function mosaicTiles(n: number): MosaicTile[] {
  const middle = (n - 1) / 2;
  return Array.from({ length: n * n }, (_, k) => {
    const row = Math.floor(k / n);
    const col = k % n;
    return {
      row,
      col,
      diagonal: row + col,
      ring: Math.round(Math.abs(row - middle) + Math.abs(col - middle)),
    };
  });
}

/** Row and column of the tile carrying each portal's glyph, for each floor size. */
export const MOSAIC_GLYPH_TILES: Readonly<
  Record<MosaicSize, readonly (readonly [number, number])[]>
> = {
  4: [
    [1, 0],
    [0, 2],
    [2, 3],
  ],
  5: [
    [1, 1],
    [0, 3],
    [3, 3],
  ],
  6: [
    [1, 1],
    [1, 4],
    [4, 3],
  ],
};

/** The tile that glints on a keystroke: it jumps around the floor instead of marching in order. */
export function mosaicGlint(count: number, n: number): number {
  return count > 0 ? (count * 7) % (n * n) : -1;
}
