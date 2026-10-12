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
 * offset, both neutral (50%) across the middle of the shape and ramping to 0% and 100% over the
 * rim on opposite edges, which is what bends the backdrop along the rim like a lens. Returned as
 * a `data:` URI for `feImage`.
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
  const edge = (size: number) => ((rim / size) * 100).toFixed(2);
  const ramp = (id: string, vertical: boolean, channel: (value: number) => string, size: number) =>
    `<linearGradient id="${id}" x1="0%" y1="0%" x2="${vertical ? "0%" : "100%"}" y2="${vertical ? "100%" : "0%"}">` +
    `<stop offset="0%" stop-color="${channel(0)}"/>` +
    `<stop offset="${edge(size)}%" stop-color="${channel(128)}"/>` +
    `<stop offset="${(100 - Number(edge(size))).toFixed(2)}%" stop-color="${channel(128)}"/>` +
    `<stop offset="100%" stop-color="${channel(255)}"/></linearGradient>`;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    "<defs>" +
    ramp("x", false, (v) => `rgb(${v},0,0)`, w) +
    ramp("y", true, (v) => `rgb(0,0,${v})`, h) +
    "</defs>" +
    `<rect width="${w}" height="${h}" fill="black"/>` +
    `<rect width="${w}" height="${h}" rx="${r}" fill="url(#x)"/>` +
    `<rect width="${w}" height="${h}" rx="${r}" fill="url(#y)" style="mix-blend-mode:screen"/>` +
    "</svg>";
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}
