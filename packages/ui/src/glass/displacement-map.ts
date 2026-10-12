export interface DisplacementMapOptions {
  width: number;
  height: number;
  /** Corner radius of the glass shape, in px. */
  radius: number;
  /** Width of the refracting rim, in px. The centre stays undistorted. */
  bezel: number;
  /** Device pixel ratio the map is rasterised at. Default 1, capped at 2. */
  dpr?: number;
}

export interface DisplacementField {
  /** Width and height of `data` in pixels (CSS size times the capped ratio). */
  width: number;
  height: number;
  /**
   * RGBA, row major. Red and green carry the horizontal and vertical source offset (128 is zero);
   * blue carries how soft the backdrop is there: 255 in the middle, easing down to 0 at the edge,
   * so the lens shows the backdrop sharp and lively along the rim and frosted under the text.
   */
  data: Uint8ClampedArray;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** How much of the legibility veil is left at the very edge of the rim. */
export const VEIL_FLOOR = 0.5;

/** Refractive index of the glass (crown glass), as in the usual web recreations. */
const INDEX = 1.5;
const PROFILE_SAMPLES = 64;
/** How steep the bezel is relative to its width: the thickness of the glass over the rim width. */
const STEEPNESS = 2.5;

let profile: Float32Array | undefined;

/**
 * Lateral displacement across the rim, 1 at the outer edge and 0 at the inner one.
 *
 * The rim is a convex squircle, `h(x) = (1 - (1 - x)^4)^(1/4)` with x running from the outer edge
 * inwards. A ray entering vertically meets the surface at the angle of its slope, bends by
 * Snell's law (`sin t1 = n sin t2`, n = 1.5) and lands `tan(t1 - t2)` further sideways per unit
 * of glass thickness. The curve is normalised by its maximum, so the strength of the lens is the
 * `scale` of the displacement filter and not a property of the profile.
 */
export function lensProfile(): Float32Array {
  if (profile) return profile;
  const out = new Float32Array(PROFILE_SAMPLES);
  let max = 0;
  for (let i = 0; i < PROFILE_SAMPLES; i++) {
    const x = clamp(i / (PROFILE_SAMPLES - 1), 0.002, 1);
    const slope = (1 - x) ** 3 * (1 - (1 - x) ** 4) ** -0.75 * STEEPNESS;
    const incidence = Math.atan(slope);
    const refracted = Math.asin(Math.sin(incidence) / INDEX);
    out[i] = Math.tan(incidence - refracted);
    max = Math.max(max, out[i] as number);
  }
  for (let i = 0; i < PROFILE_SAMPLES; i++) out[i] = (out[i] as number) / max;
  out[PROFILE_SAMPLES - 1] = 0;
  profile = out;
  return out;
}

/**
 * Displacement field of a rounded rectangle, from its signed distance function: zero in the
 * middle, and across the rim a source offset pointing into the shape whose length follows
 * {@link lensProfile} and whose direction is the inward surface normal (straight edges pull
 * along the axis, corners along the radius). Pure, so it runs anywhere.
 */
export function computeDisplacementField({
  width,
  height,
  radius,
  bezel,
  dpr = 1,
}: DisplacementMapOptions): DisplacementField {
  const ratio = clamp(dpr, 1, 2);
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const rim = clamp(bezel, 1, Math.min(w, h) / 2);
  const r = clamp(radius, 0, Math.min(w, h) / 2);
  const pw = Math.max(1, Math.round(w * ratio));
  const ph = Math.max(1, Math.round(h * ratio));
  const data = new Uint8ClampedArray(pw * ph * 4);
  // Neutral everywhere (128, 128, 255, 255), then only the rim is computed: rows between the
  // rims are visited at their two ends. Little-endian packing of R, G, B, A.
  new Uint32Array(data.buffer).fill(0xffff8080);
  const band = Math.min(pw, Math.ceil(rim * ratio) + 1);
  const table = lensProfile();
  const last = table.length - 1;
  const hx = w / 2;
  const hy = h / 2;
  for (let j = 0; j < ph; j++) {
    const py = (j + 0.5) / ratio - hy;
    const inner = Math.abs(py) < hy - rim;
    for (let i = 0; i < pw; i++) {
      if (inner && i === band) i = Math.max(band, pw - band);
      const px = (i + 0.5) / ratio - hx;
      const o = (j * pw + i) * 4;
      const qx = Math.abs(px) - (hx - r);
      const qy = Math.abs(py) - (hy - r);
      const out = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
      const depth = r - (out + Math.min(Math.max(qx, qy), 0));
      let dx = 0;
      let dy = 0;
      let veil = 1;
      if (depth > 0 && depth < rim) {
        const x = depth / rim;
        veil = x * x * (3 - 2 * x);
        const at = (depth / rim) * last;
        const lo = Math.floor(at);
        const m =
          (table[lo] as number) * (1 - (at - lo)) +
          (table[Math.min(lo + 1, last)] as number) * (at - lo);
        const sx = px < 0 ? -1 : 1;
        const sy = py < 0 ? -1 : 1;
        let nx = 0;
        let ny = 0;
        if (qx > 0 && qy > 0) {
          nx = (sx * qx) / out;
          ny = (sy * qy) / out;
        } else if (qx > qy) nx = sx;
        else ny = sy;
        dx = -nx * m;
        dy = -ny * m;
      }
      data[o] = 128 + dx * 127;
      data[o + 1] = 128 + dy * 127;
      data[o + 2] = veil * 255;
      data[o + 3] = 255;
    }
  }
  return { width: pw, height: ph, data };
}

const cache = new Map<string, string>();
const CACHE_SIZE = 8;

/**
 * Displacement map for `feDisplacementMap`, as a PNG `data:` URI for `feImage`. Browser only
 * (it rasterises on a canvas); results are kept in a small cache, so reopening a dialog of the
 * same size costs nothing.
 */
export function createDisplacementMap(options: DisplacementMapOptions): string {
  const key = [options.width, options.height, options.radius, options.bezel, options.dpr ?? 1]
    .map((n) => Math.round(n * 100) / 100)
    .join("x");
  const hit = cache.get(key);
  if (hit) return hit;
  const field = computeDisplacementField(options);
  const canvas = document.createElement("canvas");
  canvas.width = field.width;
  canvas.height = field.height;
  const context = canvas.getContext("2d");
  if (!context) return "";
  const image = context.createImageData(field.width, field.height);
  image.data.set(field.data);
  context.putImageData(image, 0, 0);
  const uri = canvas.toDataURL("image/png");
  cache.set(key, uri);
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value as string);
  return uri;
}
