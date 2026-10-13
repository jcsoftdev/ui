/**
 * A damped spring, the whole of the motion engine's physics. Pure (no DOM, no timers), so it can
 * run anywhere and be tested by stepping it. Zero dependencies on purpose: the kit ships none.
 */
export interface SpringConfig {
  /** Spring constant: how hard it pulls towards the target. */
  stiffness: number;
  /** Friction. Critical damping is `2 * sqrt(stiffness * mass)`. */
  damping: number;
  mass?: number;
}

export interface SpringState {
  value: number;
  velocity: number;
  target: number;
}

/** Damping that gives a damping ratio `zeta` (1 is critical, below 1 overshoots and wobbles). */
export const dampingFor = (zeta: number, stiffness: number, mass = 1) =>
  2 * zeta * Math.sqrt(stiffness * mass);

/** Damping ratio of a configuration. */
export const dampingRatio = ({ stiffness, damping, mass = 1 }: SpringConfig) =>
  damping / (2 * Math.sqrt(stiffness * mass));

/**
 * Named springs. The first four are the motion presets of a surface; `follow` is how a surface
 * trails the pointer and the `squash` pair are the two deliberately mismatched springs of the
 * velocity squash, whose different damping makes the two axes wobble out of step (jelly).
 */
export const SPRINGS = {
  snappy: { stiffness: 600, damping: 36 },
  smooth: { stiffness: 380, damping: 30 },
  soft: { stiffness: 260, damping: 26 },
  jelly: { stiffness: 250, damping: dampingFor(0.55, 250) },
  follow: { stiffness: 260, damping: 26 },
  squashX: { stiffness: 250, damping: dampingFor(0.6, 250) },
  squashY: { stiffness: 250, damping: dampingFor(0.7, 250) },
} as const satisfies Record<string, SpringConfig>;

export const createSpring = (value = 0, target = value): SpringState => ({
  value,
  velocity: 0,
  target,
});

/** Longest step integrated at once, in seconds; longer frames are split. */
const SUBSTEP = 1 / 240;

/**
 * Advances a spring by `dt` seconds (semi-implicit Euler in sub-steps of at most 1/240 s, which is
 * stable for any stiffness a surface uses and independent of the frame rate).
 */
export function stepSpring(state: SpringState, config: SpringConfig, dt: number): void {
  const mass = config.mass ?? 1;
  let left = Math.min(Math.max(dt, 0), 0.25);
  while (left > 1e-9) {
    const h = Math.min(left, SUBSTEP);
    const force = config.stiffness * (state.target - state.value) - config.damping * state.velocity;
    state.velocity += (force / mass) * h;
    state.value += state.velocity * h;
    left -= h;
  }
}

/** Whether the spring is close enough to its target, and slow enough, to stop simulating it. */
export const isAtRest = (state: SpringState, epsilon = 0.001, speed = 0.01) =>
  Math.abs(state.target - state.value) < epsilon && Math.abs(state.velocity) < speed;

/** Snaps a spring that {@link isAtRest} onto its target. */
export function settle(state: SpringState): void {
  state.value = state.target;
  state.velocity = 0;
}

/** Elastic limit: `distance` passes through almost unchanged near 0 and never exceeds `limit`. */
export const rubberBand = (distance: number, limit: number) => limit * Math.tanh(distance / limit);

/** Speed (px/s) that counts as 1 for the squash. */
export const SQUASH_SPEED = 1400;
/** Largest deformation of one axis from the speed: 20%. */
export const SQUASH_MAX = 0.2;

const clampMag = (value: number) => Math.min(Math.max(value, -SQUASH_MAX), SQUASH_MAX);

/**
 * Target scale of a surface moving at `(vx, vy)` px/s: stretched along the motion and squashed
 * across it, each by at most 20% (so at most 1.25 and at least 0.8 on one axis).
 */
export function squashTarget(vx: number, vy: number): { x: number; y: number } {
  const ax = Math.min(Math.abs(vx) / SQUASH_SPEED, 1);
  const ay = Math.min(Math.abs(vy) / SQUASH_SPEED, 1);
  return {
    x: (1 / (1 - clampMag(ax * 0.75))) * (1 - clampMag(ay * 0.25)),
    y: (1 / (1 - clampMag(ay * 0.75))) * (1 - clampMag(ax * 0.25)),
  };
}
