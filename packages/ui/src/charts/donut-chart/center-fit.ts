const VALUE_WIDTH_EM = 0.62;
const CAPTION_WIDTH_EM = 0.58;
const LINE_GAP = 4;
const HOLE_MARGIN = 0.92;

export interface CenterFit {
  valueSize: number;
  captionSize: number;
  /** Characters of the caption that fit the hole; 0 hides it. */
  captionChars: number;
  /** Height of the whole text block, for vertical centring. */
  block: number;
}

/** Width of the chord of a circle of radius `radius` at distance `dy` from its centre. */
function chordWidth(radius: number, dy: number): number {
  return 2 * Math.sqrt(Math.max(0, radius * radius - dy * dy));
}

/**
 * Sizes the centre text of a donut so both lines sit inside the hole: the font shrinks from
 * `maxSize` until the value fits the chord at the block's outer edge, and the caption drops
 * characters (or disappears) when only the value fits.
 */
export function fitCenterText(
  inner: number,
  valueChars: number,
  captionChars: number,
  semi = false,
  maxSize = 34,
): CenterFit {
  const room = inner * HOLE_MARGIN;
  const captionSize = inner > 54 ? 12 : 10.5;
  const start = Math.min(maxSize, Math.max(15, Math.round(inner * 0.34)));

  for (let valueSize = start; valueSize >= 9; valueSize--) {
    const block = valueSize + LINE_GAP + captionSize;
    const width = chordWidth(room, semi ? block + 6 : block / 2);
    const chars = Math.floor(width / (captionSize * CAPTION_WIDTH_EM));
    if (valueChars * VALUE_WIDTH_EM * valueSize <= width && chars >= 6) {
      return { valueSize, captionSize, captionChars: Math.min(captionChars, chars), block };
    }
  }
  for (let valueSize = Math.min(maxSize, Math.round(inner * 0.5)); valueSize >= 8; valueSize--) {
    if (
      valueChars * VALUE_WIDTH_EM * valueSize <=
      chordWidth(room, semi ? valueSize + 6 : valueSize / 2)
    ) {
      return { valueSize, captionSize, captionChars: 0, block: valueSize };
    }
  }
  return { valueSize: 8, captionSize, captionChars: 0, block: 8 };
}
