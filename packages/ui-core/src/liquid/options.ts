/**
 * Liquid Glass options, framework-neutral: the types, the defaults and their mapping to the
 * `--liquid-*` custom properties that the CSS and the lens engine read. Pure and tiny; the same
 * functions (and numbers) as the React kit's `glass/liquid-options`.
 */
/** How the lens bends the backdrop. See {@link LiquidGlassOptions.profile}. */
export type LiquidProfile = "rim" | "full" | "dome" | "crystal";

/** What the surface does under the pointer. See {@link LiquidGlassOptions.interactive}. */
export type LiquidInteractive = "none" | "press" | "drag";

/** Named spring of the surface motion, or `false` for none. See {@link LiquidGlassOptions.motion}. */
export type LiquidMotion = false | "snappy" | "smooth" | "soft" | "jelly";

/**
 * Everything that shapes a Liquid Glass surface. Every field is optional and maps to one
 * `--liquid-*` custom property (see {@link liquidStyle}), so the same configuration can come from
 * a prop, a scope (`style`, a class) or the theme (`:root { --liquid-frost: 3px }`): the lens
 * engine and the CSS read the same variables, and they inherit.
 *
 * Omitted fields keep the theme's look ({@link LIQUID_DEFAULTS}). The contrast guarantee of the
 * kit (ink 4.5:1 over the supported backdrops) holds for the defaults only: a lower `opacity`, a
 * `tint`, `grain` or a thinner `frost` can leave text without it.
 */
export interface LiquidGlassOptions {
  /**
   * Strength of the bend, 0 to 1, as a fraction of the strongest offset that cannot fold the
   * backdrop back on itself. `0` is flat glass. Default 1. With `profile: "crystal"` the range is
   * 0 to 2: a minifying lens cannot fold, so it can be pushed further (1.67 is a thick lens).
   */
  refraction?: number;
  /**
   * Thickness of the glass edge in px. For `profile: "rim"` it is the width of the refracting
   * band; for `"full"` and `"dome"` it caps the largest offset. Default: derived from the corner
   * radius and the size (up to 24 px for the whole-surface profiles).
   */
  bevelWidth?: number;
  /**
   * `"full"` (default): a superellipse dome over the whole surface. `"dome"`: a rounder,
   * elliptical drop that is flatter in the middle. `"rim"`: only a bevel along the edge, the
   * middle shows the backdrop undisplaced. `"crystal"`: a thick convex lens that minifies the
   * backdrop (it shows a wider area than the surface covers), bending steeply towards the rim;
   * meant to be clear (`frost: 0`, `opacity: 0`) and has no contrast guarantee.
   */
  profile?: LiquidProfile;
  /** Chromatic dispersion, 0 to 0.2: how far apart the colour channels are pulled. Default 0. Small surfaces only. */
  dispersion?: number;
  /** Backdrop blur (frost) in px. Default 2 (regular), 0.6 (clear). */
  frost?: number;
  /** Backdrop saturation, 1 is unchanged. Default 1.5. */
  saturation?: number;
  /** Backdrop brightness, 1 is unchanged. Default 1. */
  brightness?: number;
  /** A colour laid over the glass: `amount` (0 to 1, default 0.2) is its opacity. */
  tint?: { color: string; amount?: number };
  /** Strength of the edge highlight (the lit and the opposite rim), 0 to 2. Default 1. */
  rim?: number;
  /** The highlight on the walls facing the light. `angle` is degrees clockwise from +x (default -120, upper left). */
  specular?: { intensity?: number; angle?: number };
  /** Extra glow that grows towards the edge, 0 to 1. Default 0. */
  fresnel?: number;
  /** Film grain over the glass, 0 to 1. Default 0. */
  grain?: number;
  /** Corner radius in px. Default: the component's own. */
  radius?: number;
  /**
   * Opacity of the legibility veil, 0 to 1. Default 1. Lower values let the backdrop through and
   * drop the contrast guarantee.
   */
  opacity?: number;
  /** Outer shadow: `opacity` multiplies its colour, `spread` adds to its blur (px), `offsetY` drops it (px). */
  shadow?: { opacity?: number; spread?: number; offsetY?: number };
  /**
   * Pointer behaviour. `"press"`: the lens deepens and the surface swells while pressed.
   * `"drag"`: the surface can also be dragged (rubber-banded) and squashes with the speed.
   * `"none"`: static. Default: `"press"` on buttons, links and `data-glass-interactive`
   * elements, `"none"` elsewhere.
   */
  interactive?: LiquidInteractive;
  /** Spring of the motion above, or `false` to turn it off. Default `"snappy"`. */
  motion?: LiquidMotion;
}

/** What each field resolves to when nothing sets it. `undefined` means "derived at run time". */
export const LIQUID_DEFAULTS = {
  refraction: 1,
  bevelWidth: undefined,
  profile: "full",
  dispersion: 0,
  frost: 2,
  saturation: 1.5,
  brightness: 1,
  tint: { color: "transparent", amount: 0.2 },
  rim: 1,
  specular: { intensity: 1, angle: -120 },
  fresnel: 0,
  grain: 0,
  radius: undefined,
  opacity: 1,
  shadow: { opacity: 1, spread: 0, offsetY: 10 },
  interactive: undefined,
  motion: "snappy",
} as const satisfies LiquidGlassOptions;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const round = (value: number) => Math.round(value * 1000) / 1000;
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

/** Names of the motion springs, in the order a control lists them. */
export const LIQUID_MOTIONS = ["snappy", "smooth", "soft", "jelly"] as const;

/** Merges a preset under explicit options (one level deep for the grouped fields). */
export function mergeLiquid(
  base: LiquidGlassOptions | undefined,
  over: LiquidGlassOptions | undefined,
): LiquidGlassOptions {
  const out: LiquidGlassOptions = { ...base, ...over };
  if (base?.specular || over?.specular) out.specular = { ...base?.specular, ...over?.specular };
  if (base?.shadow || over?.shadow) out.shadow = { ...base?.shadow, ...over?.shadow };
  if (base?.tint || over?.tint)
    out.tint = { ...base?.tint, ...over?.tint } as LiquidGlassOptions["tint"];
  return out;
}

/** Highlight alphas are themed tokens (`--liquid-rim-lit|back|ring`); this scales them. */
export function liquidRim(strength = 1, angle = -120, fresnel = 0): string {
  const radians = (angle * Math.PI) / 180;
  const x = round(-Math.cos(radians) * 2);
  const y = round(-Math.sin(radians) * 2);
  const s = round(clamp(strength, 0, 2));
  const white = (alpha: string) =>
    `color-mix(in srgb, white min(100%, calc(${alpha} * 100%)), transparent)`;
  const layers = [
    `inset ${x}px ${y}px 0 -.5px ${white(`var(--liquid-rim-lit, .95) * ${s}`)}`,
    `inset ${-x}px ${-y}px 0 -.5px ${white(`var(--liquid-rim-back, .7) * ${s}`)}`,
    `inset 0 0 0 1px ${white(`var(--liquid-rim-ring, .5) * ${s}`)}`,
  ];
  const f = clamp(fresnel, 0, 1);
  if (f > 0) layers.push(`inset 0 0 18px ${white(String(round(f * 0.4)))}`);
  return layers.join(", ");
}

/**
 * The outer shadow of a surface. Its blur and drop scale with `--liquid-size`, which the lens
 * engine sets from the size of the surface (a bigger piece of glass is thicker, so its shadow is
 * deeper); without the engine the variable is 1. What is not configured comes from the themed
 * tokens (`--liquid-shadow-drop`, `-blur`, `-contact`, `-ink`, `-alpha`), so the shadow the
 * engine paints is the one the theme's `--liquid-shadow` describes, in light and in dark.
 */
export function liquidShadow({
  opacity = 1,
  spread,
  offsetY,
}: NonNullable<LiquidGlassOptions["shadow"]> = {}): string {
  const a = round(clamp(opacity, 0, 2));
  const alpha = "var(--liquid-shadow-alpha, .2)";
  const ink = (factor: string) =>
    `color-mix(in srgb, var(--liquid-shadow-ink, black) min(100%, calc(${alpha} * ${factor} * 100%)), transparent)`;
  const k = "var(--liquid-size, 1)";
  const drop = offsetY === undefined ? "var(--liquid-shadow-drop, 10px)" : `${round(offsetY)}px`;
  const blur = spread === undefined ? "var(--liquid-shadow-blur, 30px)" : `${round(30 + spread)}px`;
  return [
    `0 calc(${drop} * ${k}) calc(${blur} * ${k}) -6px ${ink(String(a))}`,
    `0 calc(2px * ${k}) calc(6px * ${k}) ${ink(`${a} * var(--liquid-shadow-contact, .4)`)}`,
  ].join(", ");
}

/** A tiling film-grain image for `--glass-noise`: white speckle whose opacity follows `amount`. */
export function liquidGrain(amount: number): string {
  const a = round(clamp(amount, 0, 1) * 0.5);
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'>` +
    `<feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='2' stitchTiles='stitch'/>` +
    `<feColorMatrix values='0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 ${a} 0 0 0 0'/></filter>` +
    `<rect width='100%' height='100%' filter='url(#n)'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

export type LiquidVars = Record<string, string>;

/**
 * The custom properties of a configuration, only for the fields that are set. Spread them into a
 * `style` prop (or a class, or `:root`). The numeric ones are what the lens engine reads; the
 * composite ones (`--liquid-rim-custom`, `--liquid-shadow-custom`, `--glass-noise`) are what the
 * CSS utilities paint.
 */
export function liquidVars(options: LiquidGlassOptions = {}): LiquidVars {
  const out: LiquidVars = {};
  const set = (name: string, value: string | number | undefined) => {
    if (value !== undefined) out[`--liquid-${name}`] = String(value);
  };
  const num = (value: unknown, min: number, max: number) =>
    finite(value) ? round(clamp(value, min, max)) : undefined;
  set("refraction", num(options.refraction, 0, 2));
  const bevel = num(options.bevelWidth, 0, 120);
  if (bevel !== undefined) set("bevel", `${bevel}px`);
  if (options.profile) set("profile", options.profile);
  set("dispersion", num(options.dispersion, 0, 0.2));
  const frost = num(options.frost, 0, 40);
  if (frost !== undefined) set("frost", `${frost}px`);
  set("saturation", num(options.saturation, 0, 4));
  const brightness = num(options.brightness, 0, 3);
  set("brightness", brightness);
  // The filter takes the whole function so that an unset option leaves no `brightness(1)` behind.
  if (brightness !== undefined) set("brightness-fn", `brightness(${brightness})`);
  if (options.tint) {
    set("tint-color", options.tint.color);
    set("tint-amount", num(options.tint.amount ?? LIQUID_DEFAULTS.tint.amount, 0, 1));
  }
  const rim = num(options.rim, 0, 2);
  set("rim-strength", rim);
  const intensity = num(options.specular?.intensity, 0, 2);
  set("specular", intensity);
  const angle = finite(options.specular?.angle) ? round(options.specular.angle) : undefined;
  set("specular-angle", angle);
  const fresnel = num(options.fresnel, 0, 1);
  set("fresnel", fresnel);
  if (rim !== undefined || angle !== undefined || fresnel !== undefined)
    set("rim-custom", liquidRim(rim ?? 1, angle ?? -120, fresnel ?? 0));
  const grain = num(options.grain, 0, 1);
  set("grain", grain);
  if (grain) out["--glass-noise"] = liquidGrain(grain);
  const radius = num(options.radius, 0, 999);
  if (radius !== undefined) set("radius", `${radius}px`);
  set("opacity", num(options.opacity, 0, 1));
  if (options.shadow) {
    const { opacity, spread, offsetY } = options.shadow;
    set("shadow-opacity", num(opacity, 0, 2));
    set("shadow-spread", num(spread, 0, 80));
    set("shadow-offset", num(offsetY, -40, 80));
    set(
      "shadow-custom",
      liquidShadow({
        opacity: num(opacity, 0, 2),
        spread: num(spread, 0, 80),
        offsetY: num(offsetY, -40, 80),
      }),
    );
  }
  if (options.interactive) set("interactive", options.interactive);
  if (options.motion !== undefined)
    set("motion", options.motion === false ? "off" : options.motion);
  return out;
}
