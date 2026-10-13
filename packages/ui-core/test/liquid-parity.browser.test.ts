// The ported engine must paint what the React kit paints: same filter graph, same maps, same
// backdrop filter, for each feature tier. Both engines run side by side on identical surfaces.
import { afterEach, describe, expect, it } from "vitest";
import { applyGlassRefraction } from "../../ui/src/glass/refraction.ts";
import { attachLiquid } from "../src/liquid/attach.ts";
import { type LiquidGlassOptions, liquidVars } from "../src/liquid/options.ts";
import { crystal } from "../src/liquid/presets/crystal.ts";

const SURFACE =
  "position:relative;width:180px;height:72px;border-radius:24px;" +
  "backdrop-filter:blur(2px) saturate(1.5);--glass-lens-dim:rgba(255,255,255,.45);";

function surface(options: LiquidGlassOptions): HTMLElement {
  const element = document.createElement("div");
  element.style.cssText = SURFACE;
  for (const [name, value] of Object.entries(liquidVars(options)))
    element.style.setProperty(name, value);
  document.body.append(element);
  return element;
}

const until = async (test: () => boolean) => {
  for (let i = 0; i < 200 && !test(); i++) await new Promise((r) => setTimeout(r, 10));
  expect(test()).toBe(true);
};

/** The filter a surface references, with its id normalised. */
function filterOf(element: HTMLElement): string {
  const layer = element.querySelector<HTMLElement>("[data-glass-lens-layer]") ?? element;
  const id = /url\("?#([^)"]+)"?\)/.exec(layer.style.backdropFilter)?.[1];
  expect(id).toBeTruthy();
  const filter = document.getElementById(id as string);
  expect(filter).not.toBeNull();
  return (filter as Element).outerHTML.replaceAll(id as string, "LENS");
}

const backdrop = (element: HTMLElement) => {
  const layer = element.querySelector<HTMLElement>("[data-glass-lens-layer]") ?? element;
  return layer.style.backdropFilter.replace(/url\("?#[^)"]+"?\)/, "url(#LENS)");
};

afterEach(() => {
  document.body.innerHTML = "";
});

/** Name, options, and the number of `feImage` / `feDisplacementMap` nodes that tier paints. */
const tiers: Array<[string, LiquidGlassOptions, number, number]> = [
  ["lens only", { specular: { intensity: 0 }, motion: false }, 1, 1],
  ["lens + specular (the default look)", { motion: false }, 2, 1],
  ["lens + dispersion", { dispersion: 0.12, motion: false }, 2, 3],
  ["crystal preset", { ...crystal, motion: false }, 1, 3],
];

describe("liquid engine parity with the React kit", () => {
  for (const [name, options, images, passes] of tiers) {
    it(name, async () => {
      const react = surface(options);
      const core = surface(options);
      const stopReact = applyGlassRefraction(react, { refraction: "force" });
      const stopCore = attachLiquid(core, { ...options, support: "force" });
      await until(
        () => core.dataset.glassRefraction === "on" && react.dataset.glassRefraction === "on",
      );
      expect(react.dataset.glassRefraction).toBe("on");
      expect(filterOf(core)).toBe(filterOf(react));
      const filter = filterOf(core);
      expect(filter.split("<feImage").length - 1).toBe(images);
      expect(filter.split("<feDisplacementMap").length - 1).toBe(passes);
      expect(backdrop(core)).toBe(backdrop(react));
      for (const name of ["--liquid-size", "--liquid-shadow-auto", "--glass-veil"])
        expect(core.style.getPropertyValue(name)).toBe(react.style.getPropertyValue(name));
      if (options.profile === "crystal") {
        const layer = (el: HTMLElement) =>
          el
            .querySelector<HTMLElement>("[data-glass-lens-layer]")
            ?.style.cssText.replace(/url\("?#[^)"]+"?\)/g, "");
        expect(layer(core)).toBe(layer(react));
      }
      stopReact();
      stopCore();
      expect(core.dataset.glassRefraction).toBeUndefined();
      expect(core.style.backdropFilter).toBe("blur(2px) saturate(1.5)");
      expect(core.querySelector("[data-glass-lens-layer]")).toBeNull();
      expect(core.style.getPropertyValue("--liquid-dispersion")).toBe(
        react.style.getPropertyValue("--liquid-dispersion"),
      );
    });
  }
});
