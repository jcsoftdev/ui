// Color math for the theme engine: sRGB hex <-> OKLCH, gamut mapping and WCAG 2 contrast.
// Pure functions; no DOM, no globals.

export interface Oklch {
  /** Lightness, 0 (black) to 1 (white). */
  l: number;
  /** Chroma, roughly 0 to 0.4. */
  c: number;
  /** Hue angle in degrees, [0, 360). */
  h: number;
}

type Rgb = readonly [number, number, number];

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX.test(value.trim());
}

/** Parses #rgb or #rrggbb into 0-255 channels. Throws a TypeError on anything else. */
export function parseHex(value: string): Rgb {
  const m = HEX.exec(value.trim());
  if (!m) throw new TypeError(`Expected a hex color like "#6d28d9", got ${JSON.stringify(value)}`);
  let hex = m[1] as string;
  if (hex.length === 3) hex = [...hex].map((ch) => ch + ch).join("");
  const n = Number.parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toLinear = (v: number) => {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const fromLinear = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

const byte = (v: number) => Math.round(Math.min(1, Math.max(0, fromLinear(v))) * 255);

export function formatHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function hexToOklch(hex: string): Oklch {
  const [r, g, b] = parseHex(hex).map(toLinear) as [number, number, number];
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  const c = Math.hypot(a, bb);
  const h = c < 1e-4 ? 0 : ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
  return { l: L, c, h };
}

function oklchToLinear({ l, c, h }: Oklch): [number, number, number] {
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
}

const EPS = 1e-6;
const inGamut = (rgb: readonly number[]) => rgb.every((v) => v >= -EPS && v <= 1 + EPS);

/**
 * OKLCH to a hex string. Out-of-gamut colors keep their lightness and hue and lose chroma
 * (binary search), which preserves perceived brightness better than clipping channels.
 */
export function oklchToHex(color: Oklch): string {
  const l = Math.min(1, Math.max(0, color.l));
  const h = ((color.h % 360) + 360) % 360;
  let c = Math.max(0, color.c);
  if (!inGamut(oklchToLinear({ l, c, h }))) {
    let lo = 0;
    let hi = c;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inGamut(oklchToLinear({ l, c: mid, h }))) lo = mid;
      else hi = mid;
    }
    c = lo;
  }
  const [r, g, b] = oklchToLinear({ l, c, h });
  return formatHex([byte(r), byte(g), byte(b)]);
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex).map(toLinear) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG 2 contrast ratio between two opaque hex colors, 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

export interface SolveInput {
  hue: number;
  chroma: number;
  /** Lightness to try first. */
  from: number;
  /** +1 searches lighter, -1 darker. */
  direction: 1 | -1;
  /** Backgrounds (or foregrounds) the result must contrast with. */
  against: readonly string[];
  min: number;
}

/**
 * The tone closest to `from`, searching in `direction`, whose hex contrasts at least `min` with every
 * color in `against`. Falls back to black or white when no tone qualifies.
 */
export function solveTone({ hue, chroma, from, direction, against, min }: SolveInput): string {
  const step = 0.004;
  let last = oklchToHex({ l: from, c: chroma, h: hue });
  for (let l = from; l >= -step && l <= 1 + step; l += step * direction) {
    last = oklchToHex({ l: Math.min(1, Math.max(0, l)), c: chroma, h: hue });
    if (against.every((bg) => contrastRatio(last, bg) >= min)) return last;
  }
  return last;
}
