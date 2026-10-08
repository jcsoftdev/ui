export interface DotPosition {
  /** Pixels from the left edge of the lane to the dot centre. */
  x: number;
  /** Pixels above the baseline to the dot centre. */
  y: number;
}

export interface DotStack {
  radius: number;
  dots: DotPosition[];
}

export interface DotStackInput {
  /** Observations in the bin. */
  count: number;
  /** Lane width in pixels. */
  width: number;
  /** Height in pixels the stack should fit (the bar it replaces). */
  height: number;
}

export interface DotStackOptions {
  maxRadius?: number;
  minRadius?: number;
  /** Space between neighbours in pixels (default 1). */
  gap?: number;
}

const grid = (count: number, width: number, radius: number, gap: number) => {
  const cell = radius * 2 + gap;
  const columns = Math.max(1, Math.floor(width / cell));
  return { cell, columns, rows: Math.ceil(count / columns) };
};

/** Largest radius at which `count` dots fit a `width` x `height` box, or the minimum radius. */
export function fitRadius(input: DotStackInput, options: DotStackOptions = {}): number {
  const { maxRadius = 6, minRadius = 1.5, gap = 1 } = options;
  if (input.count <= 0) return maxRadius;
  for (let r = maxRadius; r > minRadius; r -= 0.25) {
    const { cell, rows } = grid(input.count, input.width, r, gap);
    if (rows * cell <= input.height) return r;
  }
  return minRadius;
}

/**
 * Dot-plot stack for one bin: dots fill rows from the baseline up, each row
 * centred in the lane. A row never exceeds the lane width.
 */
export function packDots(count: number, width: number, radius: number, gap = 1): DotPosition[] {
  const { cell, columns } = grid(count, width, radius, gap);
  const out: DotPosition[] = [];
  for (let index = 0; index < count; index += 1) {
    const row = Math.floor(index / columns);
    const inRow = Math.min(columns, count - row * columns);
    const column = index - row * columns;
    out.push({
      x: width / 2 + (column - (inRow - 1) / 2) * cell,
      y: radius + row * cell,
    });
  }
  return out;
}

/**
 * Stacks for every bin with one shared radius (the smallest that makes the
 * fullest bin fit), so all the dots of a histogram look alike.
 */
export function explodeBins(
  bins: readonly DotStackInput[],
  options: DotStackOptions = {},
): { radius: number; stacks: DotPosition[][] } {
  const gap = options.gap ?? 1;
  let radius = options.maxRadius ?? 6;
  for (const bin of bins)
    radius = Math.min(radius, fitRadius(bin, { ...options, maxRadius: radius }));
  return { radius, stacks: bins.map((bin) => packDots(bin.count, bin.width, radius, gap)) };
}
