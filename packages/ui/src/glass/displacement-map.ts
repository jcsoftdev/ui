export interface DisplacementMapOptions {
  width: number;
  height: number;
  /** Corner radius of the glass shape, in px. */
  radius: number;
  /** Width of the refracting rim, in px. The centre stays undistorted. */
  bezel: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/**
 * SVG displacement map for `feDisplacementMap`: red carries the horizontal and blue the vertical
 * offset, both neutral (50%) in the middle of the shape and ramping towards the edge, which is
 * what bends the backdrop along the rim like a lens. Returned as a `data:` URI for `feImage`.
 */
export function createDisplacementMap({
  width,
  height,
  radius,
  bezel,
}: DisplacementMapOptions): string {
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const rim = clamp(Math.round(bezel), 1, Math.floor(Math.min(w, h) / 2));
  const r = clamp(Math.round(radius), 0, Math.floor(Math.min(w, h) / 2));
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    "<defs>" +
    '<linearGradient id="x" x1="100%" y1="0%" x2="0%" y2="0%"><stop offset="0%" stop-color="red" stop-opacity="0"/><stop offset="100%" stop-color="red"/></linearGradient>' +
    '<linearGradient id="y" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="blue" stop-opacity="0"/><stop offset="100%" stop-color="blue"/></linearGradient>' +
    `<filter id="b"><feGaussianBlur stdDeviation="${rim / 2}"/></filter>` +
    "</defs>" +
    `<rect width="${w}" height="${h}" fill="black"/>` +
    `<rect width="${w}" height="${h}" rx="${r}" fill="url(#x)"/>` +
    `<rect width="${w}" height="${h}" rx="${r}" fill="url(#y)" style="mix-blend-mode:difference"/>` +
    `<rect x="${rim}" y="${rim}" width="${Math.max(1, w - rim * 2)}" height="${Math.max(1, h - rim * 2)}" rx="${Math.max(0, r - rim)}" fill="gray" filter="url(#b)"/>` +
    "</svg>";
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
