// A consumer pays only for the liquid features it uses: what the browser fetched after each
// attachLiquid, read from the resource timeline (Vite serves every module as its own request).
// The steps run in order in one page, so each one checks the modules it adds.
import { describe, expect, it } from "vitest";

const FEATURES = ["lens", "specular", "dispersion", "crystal", "motion", "spring"] as const;

function fetched(): Set<string> {
  const names = new Set<string>();
  for (const entry of performance.getEntriesByType("resource")) {
    const match = /\/src\/liquid\/([a-z-]+)\.ts/.exec(entry.name);
    if (match) names.add(match[1] as string);
  }
  return names;
}

const loadedFeatures = () => FEATURES.filter((name) => fetched().has(name));

async function settle() {
  for (let i = 0; i < 30; i++) await new Promise((r) => setTimeout(r, 20));
}

function surface(): HTMLElement {
  const element = document.createElement("div");
  element.style.cssText = "width:160px;height:60px;border-radius:20px;backdrop-filter:blur(2px)";
  document.body.append(element);
  return element;
}

describe("attachLiquid loads per feature", () => {
  it("base frosted material: writes the variables, downloads no engine", async () => {
    const { attachLiquid } = await import("../src/liquid/attach.ts");
    const element = surface();
    const stop = attachLiquid(element, { frost: 6, lens: false });
    await settle();
    expect(element.style.getPropertyValue("--liquid-frost")).toBe("6px");
    expect(loadedFeatures()).toEqual([]);
    stop();
    expect(element.style.getPropertyValue("--liquid-frost")).toBe("");
  });

  it("refraction only: the lens core and nothing else", async () => {
    const { attachLiquid } = await import("../src/liquid/attach.ts");
    const element = surface();
    const stop = attachLiquid(element, {
      specular: { intensity: 0 },
      motion: false,
      support: "force",
    });
    await settle();
    expect(element.dataset.glassRefraction).toBe("on");
    expect(loadedFeatures()).toEqual(["lens"]);
    stop();
  });

  it("the crystal preset adds crystal, dispersion and motion, still no specular", async () => {
    const { attachLiquid } = await import("../src/liquid/attach.ts");
    const { crystal } = await import("../src/liquid/presets/crystal.ts");
    const element = surface();
    const stop = attachLiquid(element, { preset: crystal, support: "force" });
    await settle();
    expect(element.querySelector("[data-glass-lens-layer]")).not.toBeNull();
    expect(loadedFeatures()).toEqual(["lens", "dispersion", "crystal", "motion", "spring"]);
    stop();
    expect(element.querySelector("[data-glass-lens-layer]")).toBeNull();
  });

  it("a feature turned on later by CSS is fetched on demand", async () => {
    const { attachLiquid } = await import("../src/liquid/attach.ts");
    const element = surface();
    const stop = attachLiquid(element, { support: "force", motion: false });
    await settle();
    expect(loadedFeatures()).toContain("specular");
    stop();
  });

  it("lenses through the support probe (Chromium passes it)", async () => {
    const { attachLiquid } = await import("../src/liquid/attach.ts");
    const element = surface();
    // No `support: "force"`: the probe decides; Chromium supports it, so this lenses.
    const stop = attachLiquid(element, { motion: false });
    await settle();
    expect(element.dataset.glassRefraction).toBe("on");
    stop();
  });
});
