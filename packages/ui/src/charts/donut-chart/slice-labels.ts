const CHAR_WIDTH_EM = 0.6;
const FILL_RATIO = 0.92;

export interface SliceLabelInput {
  /** Radius of the hole (0 for a pie). */
  inner: number;
  radius: number;
  /** Angles in radians from 12 o'clock, clockwise. */
  start: number;
  end: number;
  chars: number;
  fontSize: number;
}

export interface SliceLabelFit {
  x: number;
  y: number;
}

/**
 * Where a horizontal label sits inside a ring slice, relative to the centre, or null when the text
 * does not fit: the box is projected on the radial and the tangential direction of the slice and
 * must stay within the ring thickness and the arc length at its middle radius.
 */
export function fitSliceLabel(input: SliceLabelInput): SliceLabelFit | null {
  const { inner, radius, start, end, chars, fontSize } = input;
  const mid = (start + end) / 2;
  const at = inner <= 0 ? radius * 0.62 : (inner + radius) / 2;
  const thickness = inner <= 0 ? radius * 0.7 : radius - inner;
  const arc = (end - start) * at;
  const width = chars * fontSize * CHAR_WIDTH_EM;
  const height = fontSize * 1.1;
  const rx = Math.sin(mid);
  const ry = -Math.cos(mid);
  const radial = width * Math.abs(rx) + height * Math.abs(ry);
  const tangent = width * Math.abs(ry) + height * Math.abs(rx);
  if (radial > thickness * FILL_RATIO || tangent > arc * FILL_RATIO) return null;
  return { x: at * rx, y: at * ry };
}
