export interface ResolveHeightInput {
  /** Pixels, a function of the measured width, or "fill" to take what the parent leaves. */
  height: number | "fill" | ((width: number) => number);
  /** Width / height ratio. Wins over a pixel height; ignored when filling. */
  aspectRatio?: number;
  width: number;
  /** Measured height of the drawing slot (meaningful when filling). */
  measured: number;
}

/**
 * Height of the drawing: the measured slot when filling, `width / aspectRatio`
 * when a ratio is given, else the pixel height. Never below `min`.
 */
export function resolveDrawingHeight(input: ResolveHeightInput, min = 40): number {
  const { height, aspectRatio, width, measured } = input;
  let value: number;
  if (height === "fill") value = measured;
  else if (aspectRatio && aspectRatio > 0) value = width / aspectRatio;
  else value = typeof height === "function" ? height(width) : height;
  return Math.max(min, Math.floor(value));
}
