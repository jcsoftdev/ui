import {
  type AttachLiquidOptions,
  attachLiquid,
  type LiquidHandle,
} from "@jcsoftdev/ui-core/liquid";
import type {
  LiquidGlassOptions,
  LiquidMotion,
  LiquidProfile,
} from "@jcsoftdev/ui-core/liquid/options";
import { adoptStyles, rootOf } from "./base.js";
import css from "./liquid.css.js";

export interface LiquidMaterial {
  update(): void;
  stop(): void;
}

const PRESETS: Record<string, () => Promise<LiquidGlassOptions>> = {
  clear: () => import("@jcsoftdev/ui-core/liquid/presets/clear").then((m) => m.clear),
  regular: () => import("@jcsoftdev/ui-core/liquid/presets/regular").then((m) => m.regular),
  thick: () => import("@jcsoftdev/ui-core/liquid/presets/thick").then((m) => m.thick),
  crystal: () => import("@jcsoftdev/ui-core/liquid/presets/crystal").then((m) => m.crystal),
};

const PROFILES = new Set(["rim", "full", "dome", "crystal"]);
const MOTIONS = new Set(["snappy", "smooth", "soft", "jelly"]);

/** The Liquid Glass options an element's attributes describe (pure). */
export function liquidOptionsFrom(host: Element): AttachLiquidOptions {
  const read = (name: string) => host.getAttribute(name);
  const num = (name: string) => {
    const value = Number.parseFloat(read(name) ?? "");
    return Number.isFinite(value) ? value : undefined;
  };
  const options: AttachLiquidOptions = {};
  const set = <K extends keyof AttachLiquidOptions>(
    key: K,
    value: AttachLiquidOptions[K] | undefined,
  ) => {
    if (value !== undefined) options[key] = value;
  };
  set("refraction", num("liquid-refraction"));
  set("frost", num("liquid-frost"));
  set("dispersion", num("liquid-dispersion"));
  set("radius", num("liquid-radius"));
  const profile = read("liquid-profile");
  if (profile && PROFILES.has(profile)) options.profile = profile as LiquidProfile;
  const specular = num("liquid-specular");
  if (specular !== undefined) options.specular = { intensity: specular };
  const motion = read("liquid-motion");
  if (motion === "off" || motion === "false") options.motion = false;
  else if (motion && MOTIONS.has(motion)) options.motion = motion as LiquidMotion;
  const interactive = read("liquid-interactive");
  if (interactive === "none" || interactive === "press" || interactive === "drag")
    options.interactive = interactive;
  if (read("lens") === "off") options.lens = false;
  return options;
}

/**
 * Turns `surface` into a Liquid Glass surface configured by `host`'s attributes: the material CSS
 * (generated from ui-tokens) is adopted into the surface's root, `data-ui-liquid` selects the
 * regular or clear variant, and ui-core's `attachLiquid` loads only the engine features the
 * resolved configuration needs.
 */
export function liquidMaterial(
  host: HTMLElement,
  surface: HTMLElement,
  layerRoot?: ParentNode,
): LiquidMaterial {
  adoptStyles(rootOf(surface), css);
  let handle: LiquidHandle | undefined;
  let stopped = false;
  let revision = 0;
  const own = {
    auto: true,
    layerRoot,
    ownInteractive: surface !== host || host.hasAttribute("data-ui-overlay"),
  };
  const apply = () => {
    const mine = ++revision;
    surface.dataset.uiLiquid =
      host.getAttribute("material") === "liquid-clear" ? "clear" : "regular";
    const preset = PRESETS[host.getAttribute("liquid-preset") ?? ""];
    const options = liquidOptionsFrom(host);
    const run = (base?: LiquidGlassOptions) => {
      if (stopped || mine !== revision) return;
      const next = { ...own, ...options, ...(base ? { preset: base } : {}) };
      if (handle) handle.update(next);
      else handle = attachLiquid(surface, next);
    };
    if (preset) preset().then(run);
    else run();
  };
  apply();
  return {
    update: apply,
    stop() {
      stopped = true;
      handle?.();
      handle = undefined;
      delete surface.dataset.uiLiquid;
    },
  };
}
