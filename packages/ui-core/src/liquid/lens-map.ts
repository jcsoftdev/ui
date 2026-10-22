/**
 * The lens maps of the refraction core: the displacement field of the `rim`, `full` and `dome`
 * profiles (pure, runs anywhere) and its rasterised form. Same maths as the React kit.
 */
import { cached } from "./raster.js";

export interface DisplacementMapOptions {
  width: number;
  height: number;
  /** Corner radius of the glass shape, in px. */
  radius: number;
  /** Width of the refracting bevel, in px, for `coverage: "rim"`; the centre stays undistorted. */
  bezel: number;
  /**
   * `"full"` (default) bends the backdrop over the whole surface, strongest at the rim and
   * gentle but never zero towards the centre (a squarish pillow); `"dome"` does the same with
   * round contours, a drop that is flatter in the middle; `"rim"` only across the bevel.
   */
  coverage?: LensCoverage;
  /** Width of the rim, in px, over which the veil and the blur ease off (blue channel). Default: `bezel`. */
  soft?: number;
  /** Largest offset of the whole-surface profiles, in px. Default {@link FULL_CAP}. */
  cap?: number;
  /** Device pixel ratio the map is rasterised at. Default 1, capped at 2. */
  dpr?: number;
}

export type LensCoverage = "full" | "rim" | "dome" | "crystal";
/** The shape of the lens; `coverage` is the older name of the same option. */
export type LensProfile = LensCoverage;

/** Whether a profile bends the whole surface (everything but the rim band). */
export const isWhole = (coverage: LensCoverage) => coverage !== "rim" && coverage !== "crystal";

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

export const clamp = (value: number, min: number, max: number, ceil = Number.POSITIVE_INFINITY) =>
  Math.min(Math.max(value, min), max, ceil);

/** How much of the legibility veil is left at the very edge of the rim. */
export const VEIL_FLOOR = 0.5;

/**
 * Bevel width of a surface, in px. `"rim"`: a little more than its corner radius, so the bend
 * reads as a drop. `"full"`: half the short side, the whole surface.
 */
export function bezelFor(
  radius: number,
  width: number,
  height: number,
  coverage: LensCoverage = "full",
): number {
  const short = Math.min(width, height);
  if (coverage === "full" || coverage === "dome") return Math.max(1, short / 2);
  return clamp(radius * 1.2, 14, Math.max(8, short * 0.45), 56);
}

/**
 * Largest source offset of the lens, as a fraction of the bevel width (`"rim"`). The profile falls
 * at most 1.5 times its amplitude per bevel width, so 0.58 keeps the mapping `depth +
 * offset(depth)` strictly increasing (slope 0.87 < 1). Above 1 it folds back on itself: several
 * output pixels then sample the same source pixels in reverse order, and straight stripes break
 * into a repeating sawtooth along the walls. That fold, not the map resolution, was the serrated
 * edge of the first lenses.
 */
export const MAX_OFFSET = 0.58;

/**
 * Full coverage is a dome over a superellipse radial coordinate: with `u = x / hx`, `v = y / hy`
 * and `r = (|u|^N + |v|^N)^(1/N)`, a pixel is pulled towards the centre along the gradient of `r` in
 * the normalised (u, v) plane (perpendicular to the contours of the superellipse) by `A (r / r_corner)^1.5`. The gradient is
 * continuous everywhere except the exact centre, where the pull is zero, so there is no crease:
 * a field built from the distance to the nearest edge, or from each axis on its own, has its
 * pull flip direction along the diagonals of the shape and the glass reads as a four-faced
 * pyramid. `N = 3` keeps the contours between an ellipse (a round drop) and a rounded rectangle
 * (a slab). The slope of the pull is at most 2A / (r_corner^2 h) along an axis, so A is at most
 * 0.55 of the smaller half size (fold-free), and at most {@link FULL_CAP} px so a large surface
 * does not smear.
 */
export const FULL_FRACTION = 0.55;
/** Exponent of the superellipse radial coordinate of the full lens. */
export const FULL_EXPONENT = 3;
/** Largest offset of the full lens, in px. */
export const FULL_CAP = 24;
/**
 * Shape of the two whole-surface profiles: the exponent `N` of the radial coordinate
 * `(|u|^N + |v|^N)^(1/N)` (3: squarish, 2: round) and the power `p` of the pull `A t^p`, with
 * `t` the radial coordinate over its value at the corners.
 */
export const WHOLE_SHAPES = {
  full: { exponent: FULL_EXPONENT, power: 1.5 },
  dome: { exponent: 2, power: 2 },
} as const;

/** Offset amplitude of the lens along each axis, in px. */
export function lensAmplitude(
  width: number,
  height: number,
  bezel: number,
  coverage: LensCoverage = "full",
  cap: number = FULL_CAP,
): { x: number; y: number } {
  if (coverage === "rim" || coverage === "crystal") {
    const a = MAX_OFFSET * bezel;
    return { x: a, y: a };
  }
  const a = Math.min((Math.min(width, height) / 2) * FULL_FRACTION, Math.max(cap, 1));
  return { x: a, y: a };
}

/** `scale` of the displacement filter: the offset is half of it (128 is neutral). */
export function scaleFor(
  width: number,
  height: number,
  bezel: number,
  coverage: LensCoverage = "full",
  cap: number = FULL_CAP,
): number {
  const { x, y } = lensAmplitude(width, height, bezel, coverage, cap);
  return (2 * Math.max(x, y, 1) * 255) / 254;
}

const PROFILE_SAMPLES = 64;

let profile: Float32Array | undefined;
let quadratic: Float32Array | undefined;

/**
 * `"full"`: the table of the dome, `(x / half size)^2` from the centre (0) to the edge (1).
 *
 * `"rim"`: lateral displacement across the bevel, 1 at the outer edge and 0 at the inner one: `1 -
 * smoothstep(x)`, with x running from the outer edge inwards. It starts flat (the outermost
 * pixels show one clean shifted copy of the backdrop, like the rim of a drop), bends most at the
 * middle of the bevel and eases to zero, so the lens meets the clear centre without a seam. Its
 * slope never exceeds 1.5, which is what keeps {@link MAX_OFFSET} fold-free.
 */
export function lensProfile(coverage: LensCoverage = "rim"): Float32Array {
  if (coverage !== "rim") {
    if (quadratic) return quadratic;
    quadratic = new Float32Array(PROFILE_SAMPLES).map((_, i) => (i / (PROFILE_SAMPLES - 1)) ** 2);
    return quadratic;
  }
  if (profile) return profile;
  const out = new Float32Array(PROFILE_SAMPLES);
  for (let i = 0; i < PROFILE_SAMPLES; i++) {
    const x = i / (PROFILE_SAMPLES - 1);
    out[i] = 1 - x * x * (3 - 2 * x);
  }
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
  coverage = "rim",
  soft,
  cap,
  dpr = 1,
}: DisplacementMapOptions): DisplacementField {
  const ratio = clamp(dpr, 1, 2);
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  const full = isWhole(coverage);
  const shape = WHOLE_SHAPES[coverage === "dome" ? "dome" : "full"];
  const corner = 2 ** (1 / shape.exponent);
  const rim = clamp(full ? (soft ?? bezelFor(radius, w, h, "rim")) : bezel, 1, Math.min(w, h) / 2);
  const r = clamp(radius, 0, Math.min(w, h) / 2);
  const pw = Math.max(1, Math.round(w * ratio));
  const ph = Math.max(1, Math.round(h * ratio));
  // Rounding makes the real pixels-per-px a hair off `ratio`: positions use the effective ones.
  const rx = pw / w;
  const ry = ph / h;
  const data = new Uint8ClampedArray(pw * ph * 4);
  // Neutral everywhere (128, 128, 255, 255), then only the rim is computed: rows between the
  // rims are visited at their two ends. Little-endian packing of R, G, B, A.
  new Uint32Array(data.buffer).fill(0xffff8080);
  const band = Math.min(pw, Math.ceil(rim * ratio) + 1);
  const table = lensProfile("rim");
  const last = table.length - 1;
  const hx = w / 2;
  const hy = h / 2;
  const amp = lensAmplitude(w, h, bezel, coverage, cap);
  const norm = Math.max(amp.x, amp.y, 1);
  // The whole-surface terms of a column are the same on every row: computed once per column.
  const columnPull = new Float64Array(full ? pw : 0);
  const columnShape = new Float64Array(full ? pw : 0);
  for (let i = 0; full && i < pw; i++) {
    const px = (i + 0.5) / rx - hx;
    const au = Math.abs(px) / hx;
    columnPull[i] = Math.sign(px) * au ** (shape.exponent - 1);
    columnShape[i] = au ** shape.exponent;
  }
  for (let j = 0; j < ph; j++) {
    const py = (j + 0.5) / ry - hy;
    const inner = Math.abs(py) < hy - rim;
    const av = Math.abs(py) / hy;
    const gv = full ? Math.sign(py) * av ** (shape.exponent - 1) : 0;
    const vn = av ** shape.exponent;
    for (let i = 0; i < pw; i++) {
      if (!full && inner && i === band) i = Math.max(band, pw - band);
      const px = (i + 0.5) / rx - hx;
      const o = (j * pw + i) * 4;
      if (full) {
        const gx = columnPull[i] as number;
        const g = Math.hypot(gx, gv);
        const t = Math.min(((columnShape[i] as number) + vn) ** (1 / shape.exponent) / corner, 1);
        const pull = g > 0 ? t ** shape.power / g : 0;
        data[o] = 128 - gx * pull * 127 * (amp.x / norm);
        data[o + 1] = 128 - gv * pull * 127 * (amp.y / norm);
        data[o + 3] = 255;
        if (inner && Math.abs(px) < hx - rim) {
          data[o + 2] = 255;
          continue;
        }
      }
      const qx = Math.abs(px) - (hx - r);
      const qy = Math.abs(py) - (hy - r);
      const out = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
      const depth = r - (out + Math.min(Math.max(qx, qy), 0));
      let dx = 0;
      let dy = 0;
      let veil = 1;
      if (full) {
        if (depth > 0 && depth < rim) {
          const x = depth / rim;
          veil = x * x * (3 - 2 * x);
        }
        data[o + 2] = veil * 255;
        continue;
      }
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
      data[o] = 128 + dx * 127 * (amp.x / norm);
      data[o + 1] = 128 + dy * 127 * (amp.y / norm);
      data[o + 2] = veil * 255;
      data[o + 3] = 255;
    }
  }
  return { width: pw, height: ph, data };
}

/**
 * Displacement map for `feDisplacementMap`, as a PNG `data:` URI for `feImage`. Browser only
 * (it rasterises on a canvas); results are kept in a small cache, so reopening a dialog of the
 * same size costs nothing.
 */
export function createDisplacementMap(options: DisplacementMapOptions): string {
  const key = [
    options.width,
    options.height,
    options.radius,
    options.bezel,
    options.soft ?? 0,
    // The offset is encoded relative to the largest one, so it only shows in the map below 1 px.
    Math.min(
      lensAmplitude(options.width, options.height, options.bezel, options.coverage, options.cap).x,
      1,
    ),
    options.dpr ?? 1,
  ]
    .map((n) => Math.round(n * 100) / 100)
    .join("x");
  return cached(`d${options.coverage ?? "rim"}${key}`, () => computeDisplacementField(options));
}
