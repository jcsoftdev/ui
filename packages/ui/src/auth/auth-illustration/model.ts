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
