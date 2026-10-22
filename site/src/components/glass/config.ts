import {
  LIQUID_PRESETS,
  type LiquidGlassOptions,
  type LiquidInteractive,
  type LiquidMotion,
  type LiquidPresetName,
  type LiquidProfile,
  liquidVars,
  mergeLiquid,
} from "@jcsoftdev/ui/glass";

/** Every field of `LiquidGlassOptions` as a plain value a control can show, plus the surface's size and label. */
export interface PlaygroundConfig {
  type: "liquid" | "liquid-clear";
  profile: LiquidProfile;
  refraction: number;
  /** 0 means "derived from the size and the radius". */
  bevelWidth: number;
  dispersion: number;
  frost: number;
  saturation: number;
  brightness: number;
  tintColor: string;
  tintAmount: number;
  rim: number;
  specularIntensity: number;
  specularAngle: number;
  fresnel: number;
  grain: number;
  radius: number;
  opacity: number;
  shadowOpacity: number;
  shadowSpread: number;
  shadowOffsetY: number;
  interactive: LiquidInteractive;
  motion: Exclude<LiquidMotion, false> | "off";
  width: number;
  height: number;
  label: "light" | "ink" | "none";
}

/** What each control shows when the option is not set (the library's `LIQUID_DEFAULTS`, as numbers). */
export const BASE: PlaygroundConfig = {
  type: "liquid",
  profile: "full",
  refraction: 1,
  bevelWidth: 0,
  dispersion: 0,
  frost: 2,
  saturation: 1.5,
  brightness: 1,
  tintColor: "#ffffff",
  tintAmount: 0,
  rim: 1,
  specularIntensity: 1,
  specularAngle: -120,
  fresnel: 0,
  grain: 0,
  radius: 28,
  opacity: 1,
  shadowOpacity: 1,
  shadowSpread: 0,
  shadowOffsetY: 10,
  interactive: "none",
  motion: "snappy",
  width: 300,
  height: 96,
  label: "light",
};

export type PresetKey = LiquidPresetName;
export const PRESET_ORDER: PresetKey[] = ["crystal", "regular", "clear", "thick"];
export const PRESET_LABEL: Record<PresetKey, string> = {
  crystal: "Crystal",
  regular: "Regular",
  clear: "Clear",
  thick: "Thick",
};

/** A preset on top of the defaults. Size, radius, pointer mode, motion and label are the surface's, not the preset's. */
export function applyPreset(current: PlaygroundConfig, name: PresetKey): PlaygroundConfig {
  const p = mergeLiquid(undefined, LIQUID_PRESETS[name]);
  const keep = {
    type: current.type,
    radius: name === "crystal" && current.radius < 40 ? 48 : current.radius,
    interactive: current.interactive,
    motion: current.motion,
    width: current.width,
    height: current.height,
    label: name === "crystal" ? "light" : current.label,
  } as const;
  return {
    ...BASE,
    ...keep,
    profile: p.profile ?? BASE.profile,
    refraction: p.refraction ?? BASE.refraction,
    bevelWidth: p.bevelWidth ?? BASE.bevelWidth,
    dispersion: p.dispersion ?? BASE.dispersion,
    frost: p.frost ?? BASE.frost,
    saturation: p.saturation ?? BASE.saturation,
    brightness: p.brightness ?? BASE.brightness,
    tintColor: p.tint?.color && p.tint.color !== "transparent" ? p.tint.color : BASE.tintColor,
    tintAmount: p.tint?.amount ?? BASE.tintAmount,
    rim: p.rim ?? BASE.rim,
    specularIntensity: p.specular?.intensity ?? BASE.specularIntensity,
    specularAngle: p.specular?.angle ?? BASE.specularAngle,
    fresnel: p.fresnel ?? BASE.fresnel,
    grain: p.grain ?? BASE.grain,
    opacity: p.opacity ?? BASE.opacity,
    shadowOpacity: p.shadow?.opacity ?? BASE.shadowOpacity,
    shadowSpread: p.shadow?.spread ?? BASE.shadowSpread,
    shadowOffsetY: p.shadow?.offsetY ?? BASE.shadowOffsetY,
  };
}

export const DEFAULT_PRESET: PresetKey = "crystal";
export const initialConfig = (): PlaygroundConfig => ({
  ...applyPreset({ ...BASE, radius: 48, interactive: "drag" }, DEFAULT_PRESET),
});

/** The options that drive the live surface: every control's value, explicit. */
export function liveOptions(c: PlaygroundConfig): LiquidGlassOptions {
  return {
    profile: c.profile,
    refraction: c.refraction,
    bevelWidth: c.bevelWidth > 0 ? c.bevelWidth : undefined,
    dispersion: c.dispersion,
    frost: c.frost,
    saturation: c.saturation,
    brightness: c.brightness,
    tint: { color: c.tintColor, amount: c.tintAmount },
    rim: c.rim,
    specular: { intensity: c.specularIntensity, angle: c.specularAngle },
    fresnel: c.fresnel,
    grain: c.grain,
    radius: c.radius,
    opacity: c.opacity,
    shadow: { opacity: c.shadowOpacity, spread: c.shadowSpread, offsetY: c.shadowOffsetY },
    interactive: c.interactive,
    motion: c.motion === "off" ? false : c.motion,
  };
}

/** The options to copy: only what differs from the defaults, so the snippet stays short. */
export function copyOptions(c: PlaygroundConfig): LiquidGlassOptions {
  const out: LiquidGlassOptions = {};
  if (c.profile !== BASE.profile) out.profile = c.profile;
  if (c.refraction !== BASE.refraction) out.refraction = c.refraction;
  if (c.bevelWidth > 0) out.bevelWidth = c.bevelWidth;
  if (c.dispersion !== BASE.dispersion) out.dispersion = c.dispersion;
  if (c.frost !== BASE.frost) out.frost = c.frost;
  if (c.saturation !== BASE.saturation) out.saturation = c.saturation;
  if (c.brightness !== BASE.brightness) out.brightness = c.brightness;
  if (c.tintAmount !== BASE.tintAmount) out.tint = { color: c.tintColor, amount: c.tintAmount };
  if (c.rim !== BASE.rim) out.rim = c.rim;
  if (c.specularIntensity !== BASE.specularIntensity || c.specularAngle !== BASE.specularAngle) {
    out.specular = {};
    if (c.specularIntensity !== BASE.specularIntensity)
      out.specular.intensity = c.specularIntensity;
    if (c.specularAngle !== BASE.specularAngle) out.specular.angle = c.specularAngle;
  }
  if (c.fresnel !== BASE.fresnel) out.fresnel = c.fresnel;
  if (c.grain !== BASE.grain) out.grain = c.grain;
  out.radius = c.radius;
  if (c.opacity !== BASE.opacity) out.opacity = c.opacity;
  if (
    c.shadowOpacity !== BASE.shadowOpacity ||
    c.shadowSpread !== BASE.shadowSpread ||
    c.shadowOffsetY !== BASE.shadowOffsetY
  ) {
    out.shadow = {};
    if (c.shadowOpacity !== BASE.shadowOpacity) out.shadow.opacity = c.shadowOpacity;
    if (c.shadowSpread !== BASE.shadowSpread) out.shadow.spread = c.shadowSpread;
    if (c.shadowOffsetY !== BASE.shadowOffsetY) out.shadow.offsetY = c.shadowOffsetY;
  }
  if (c.interactive !== "none") out.interactive = c.interactive;
  if (c.motion !== BASE.motion) out.motion = c.motion === "off" ? false : c.motion;
  return out;
}

const q = (value: unknown): string =>
  typeof value === "string" ? JSON.stringify(value) : String(value);

function literal(value: unknown, indent: string): string {
  if (value && typeof value === "object") {
    const inner = Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${indent}  ${k}: ${literal(v, `${indent}  `)},`)
      .join("\n");
    return `{\n${inner}\n${indent}}`;
  }
  return q(value);
}

/** The `material` and `style` props for a Card, Dialog, Popover and the other components with a glass `material`. */
export function materialSnippet(c: PlaygroundConfig): string {
  const body = literal(copyOptions(c), "");
  return `<Card material="${c.type}" style={liquidStyle(${body})}>\n  Liquid Glass\n</Card>`;
}

/** The same configuration as CSS custom properties (a class, a scope or `:root`). */
export function cssSnippet(c: PlaygroundConfig): string {
  const vars = liquidVars({ ...copyOptions(c) });
  const lines = Object.entries(vars).map(([k, v]) => `  ${k}: ${v};`);
  return `.my-glass {\n${lines.join("\n")}\n}\n/* with class="${c.type}" on the element */`;
}
