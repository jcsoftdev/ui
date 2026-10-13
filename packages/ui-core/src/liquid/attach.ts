import type { LensOptions, LiquidFeatureName, LiquidFeatures } from "./lens.js";
import { type LiquidGlassOptions, liquidVars, mergeLiquid } from "./options.js";
import { supportsBackdropRefraction } from "./support.js";

export interface AttachLiquidOptions extends LiquidGlassOptions {
  /** Starting point (one of `@jcsoftdev/ui-core/liquid/presets/*`); the fields given here win. */
  preset?: LiquidGlassOptions;
  /**
   * `false`: the base frosted material only (the `--liquid-*` variables the CSS paints); the
   * refraction engine is never downloaded. Default true.
   */
  lens?: boolean;
  /**
   * Only refract while the surface resolves to a liquid material (the `--glass-lens: 1` flag the
   * liquid CSS sets, not under a `[data-glass-lens="off"]`). Default false.
   */
  auto?: boolean;
  /** Read the pointer mode only from the element itself (overlays: dialog, popover). Default false. */
  ownInteractive?: boolean;
  /** Where the crystal layer goes (a shadow root for a shadow-DOM host). Default: the element. */
  layerRoot?: ParentNode;
  /** `"force"` skips the engine support check (never the accessibility ones). Default `"auto"`. */
  support?: "auto" | "force";
}

/** A cleanup function that can also re-apply new options to the same surface. */
export type LiquidHandle = (() => void) & {
  update(options: AttachLiquidOptions): void;
};

/** Preferences under which the lens is never applied (the plain material stays). */
const OFF_QUERIES = [
  "(prefers-reduced-transparency: reduce)",
  "(prefers-contrast: more)",
  "(forced-colors: active)",
  "(prefers-reduced-motion: reduce)",
];
/** What can change whether a surface resolves to a liquid material. */
const WATCHED = [
  "class",
  "data-glass",
  "data-glass-lens",
  "data-style",
  "data-theme",
  "data-ui-liquid",
];
/** Largest surface (CSS px squared) that gets chromatic dispersion (the engine's budget). */
const DISPERSION_AREA = 100_000;

const loaders: Record<LiquidFeatureName, () => Promise<unknown>> = {
  specular: () => import("./specular.js"),
  dispersion: () => import("./dispersion.js"),
  crystal: () => import("./crystal.js"),
  motion: () => import("./motion.js"),
};

const number = (value: string) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/**
 * The optional engine features a surface needs, from its resolved custom properties (options,
 * scope and theme alike) and its area. Pure: `read` returns a property's computed value.
 */
export function liquidFeaturesFor(
  read: (name: string) => string,
  area: number,
): LiquidFeatureName[] {
  const needed: LiquidFeatureName[] = [];
  if ((number(read("--liquid-specular")) ?? 1) > 0) needed.push("specular");
  const dispersion =
    number(read("--liquid-dispersion")) ?? number(read("--glass-lens-dispersion")) ?? 0;
  if (dispersion > 0 && area <= DISPERSION_AREA) needed.push("dispersion");
  if ((read("--liquid-profile") || read("--glass-lens-coverage")) === "crystal")
    needed.push("crystal");
  if (read("--liquid-motion") !== "off") needed.push("motion");
  return needed;
}

/** Writes the `--liquid-*` variables of `options` inline; returns what puts the old values back. */
function writeVars(element: HTMLElement, options: LiquidGlassOptions): () => void {
  const vars = liquidVars(options);
  if (vars["--liquid-radius"]) vars["border-radius"] = "var(--liquid-radius)";
  const previous = Object.keys(vars).map(
    (name) => [name, element.style.getPropertyValue(name)] as const,
  );
  for (const [name, value] of Object.entries(vars)) element.style.setProperty(name, value);
  return () => {
    for (const [name, value] of previous)
      value ? element.style.setProperty(name, value) : element.style.removeProperty(name);
  };
}

/**
 * Liquid Glass on any element, lazily and per feature. The `--liquid-*` variables of the options
 * are written at once (the base frosted material is CSS: `@jcsoftdev/ui-elements` ships it, the
 * React kit's `liquid` utilities are the same). The refraction engine is imported only while the
 * surface can refract (a Chromium engine, no reduced transparency, contrast or motion
 * preference); each optional feature (specular rim light, dispersion, crystal lens, motion) only
 * when the resolved configuration turns it on. Returns the cleanup.
 */
export function attachLiquid(
  element: HTMLElement,
  options: AttachLiquidOptions = {},
): LiquidHandle {
  let restoreVars = writeVars(element, mergeLiquid(options.preset, options));
  let current = options;
  let stopLens: (() => void) | undefined;
  let loading = false;
  let gone = false;

  const cleanup = (() => {
    gone = true;
    observer?.disconnect();
    for (const list of lists) list.removeEventListener("change", check);
    stopLens?.();
    stopLens = undefined;
    restoreVars();
  }) as LiquidHandle;
  cleanup.update = (next) => {
    if (gone) return;
    restoreVars();
    current = next;
    restoreVars = writeVars(element, mergeLiquid(next.preset, next));
    check();
  };

  const canPaint = typeof document !== "undefined" && typeof matchMedia === "function";
  const wants = () => {
    if (!canPaint || current.lens === false || !element.isConnected) return false;
    if (OFF_QUERIES.some((query) => matchMedia(query).matches)) return false;
    if (current.support !== "force" && !supportsBackdropRefraction()) return false;
    if (!current.auto) return true;
    return (
      !element.closest('[data-glass-lens="off"]') &&
      getComputedStyle(element).getPropertyValue("--glass-lens").trim() === "1"
    );
  };

  const features: LiquidFeatures = {};
  const load = (name: LiquidFeatureName) =>
    loaders[name]().then((module) => {
      (features as Record<string, unknown>)[name] = module;
    });

  function check() {
    if (gone) return;
    if (!wants()) {
      stopLens?.();
      stopLens = undefined;
      return;
    }
    if (stopLens || loading) return;
    loading = true;
    const computed = getComputedStyle(element);
    const needed = liquidFeaturesFor(
      (name) => computed.getPropertyValue(name).trim(),
      element.offsetWidth * element.offsetHeight,
    ).filter((name) => !(name in features));
    // The lens and the features it needs arrive together, so the first frame is already right.
    Promise.all([import("./lens.js"), ...needed.map(load)]).then(
      ([lens]) => {
        loading = false;
        // It may have stopped being wanted while the modules loaded; the next change re-checks.
        if (gone || !wants()) return;
        const lensOptions: LensOptions = {
          auto: current.auto,
          ownInteractive: current.ownInteractive,
          layerRoot: current.layerRoot,
          features,
          load,
          ...(current.support === "force" ? { refraction: "force" as const } : {}),
        };
        stopLens = lens.applyLens(element, lensOptions);
      },
      () => {
        // A chunk failed to load (offline, deploy in between): the next change tries again.
        loading = false;
      },
    );
  }

  const observer =
    canPaint && typeof MutationObserver === "function" ? new MutationObserver(check) : undefined;
  for (let node: Element | null = element; node; node = node.parentElement)
    observer?.observe(node, { attributes: true, attributeFilter: WATCHED });
  const lists = canPaint ? OFF_QUERIES.map((query) => matchMedia(query)) : [];
  for (const list of lists) list.addEventListener("change", check);
  check();
  return cleanup;
}
