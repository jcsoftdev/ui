import { cachedMap, clamp, type DisplacementField } from "./displacement-map.js";

export interface SpecularMapOptions {
  width: number;
  height: number;
  radius: number;
  /** Device pixel ratio the map is rasterised at. Default 1, capped at 2. */
  dpr?: number;
  /** Direction the light comes from, degrees clockwise from the +x axis (y points down). Default -120, the upper left. */
  angle?: number;
}

/** Thickness, in CSS px, of the glint along the walls that face the light. */
export const GLINT_WIDTH = 3;
/** Thickness of the dark contour that separates the glass from the backdrop. */
export const CONTOUR_WIDTH = 0.75;
/** Depth of the faint inner shadow on the walls that turn away from the light. */
export const SHADE_DEPTH = 9;

/**
 * Directional rim light of a rounded rectangle, three masks in one opaque RGBA map: red is the
 * glint (a thin line on the walls that face the light, a half-strength one on the opposite
 * walls), green the contour (a hairline all around the silhouette) and blue a faint inner shadow
 * on the walls turned away from the light. The filter tints, whitens and darkens the lensed
 * backdrop with them, so the glint takes the colour of what is behind the glass.
 */
export function computeSpecularField({
  width,
  height,
  radius,
  dpr = 1,
  angle = -120,
}: SpecularMapOptions): DisplacementField {
  const ratio = clamp(dpr, 1, 2);
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const r = clamp(radius, 0, Math.min(w, h) / 2);
  const pw = Math.max(1, Math.round(w * ratio));
  const ph = Math.max(1, Math.round(h * ratio));
  const data = new Uint8ClampedArray(pw * ph * 4);
  new Uint32Array(data.buffer).fill(0xff000000);
  const lx = Math.cos((angle * Math.PI) / 180);
  const ly = Math.sin((angle * Math.PI) / 180);
  const hx = w / 2;
  const hy = h / 2;
  const band = Math.min(pw, Math.ceil(SHADE_DEPTH * ratio) + 1);
  for (let j = 0; j < ph; j++) {
    const py = (j + 0.5) / ratio - hy;
    const inner = Math.abs(py) < hy - SHADE_DEPTH;
    for (let i = 0; i < pw; i++) {
      if (inner && i === band) i = Math.max(band, pw - band);
      const px = (i + 0.5) / ratio - hx;
      const qx = Math.abs(px) - (hx - r);
      const qy = Math.abs(py) - (hy - r);
      const out = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
      const depth = r - (out + Math.min(Math.max(qx, qy), 0));
      if (depth < 0 || depth > SHADE_DEPTH) continue;
      // Outward normal of the wall this pixel belongs to.
      const sx = px < 0 ? -1 : 1;
      const sy = py < 0 ? -1 : 1;
      let nx = 0;
      let ny = 0;
      if (qx > 0 && qy > 0) {
        nx = (sx * qx) / out;
        ny = (sy * qy) / out;
      } else if (qx > qy) nx = sx;
      else ny = sy;
      const facing = nx * lx + ny * ly;
      const lit = Math.max(facing, 0) ** 1.5;
      const away = Math.max(-facing, 0) ** 1.5;
      const falloff = clamp(1 - depth / GLINT_WIDTH, 0, 1) ** 1.5;
      const o = (j * pw + i) * 4;
      data[o] = 255 * clamp(falloff * (lit + 0.5 * away + 0.3), 0, 1);
      data[o + 1] = depth < CONTOUR_WIDTH ? 255 * (1 - depth / CONTOUR_WIDTH) : 0;
      data[o + 2] = 255 * (1 - depth / SHADE_DEPTH) ** 2 * away;
    }
  }
  return { width: pw, height: ph, data };
}

/** Specular map for the rim light, as a PNG `data:` URI for `feImage` (browser only, cached). */
export function createSpecularMap(options: SpecularMapOptions): string {
  const key = [
    options.width,
    options.height,
    options.radius,
    options.dpr ?? 1,
    options.angle ?? -120,
  ]
    .map((n) => Math.round(n * 100) / 100)
    .join("x");
  return cachedMap(`s${key}`, () => computeSpecularField(options));
}
