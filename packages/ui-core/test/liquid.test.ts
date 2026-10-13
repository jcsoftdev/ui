// The liquid engine is a port: these pin its maths to the React kit's sources, value for value.
import { describe, expect, it } from "vitest";
import * as reactCrystal from "../../ui/src/glass/crystal-map.ts";
import * as reactMaps from "../../ui/src/glass/displacement-map.ts";
import * as reactOptions from "../../ui/src/glass/liquid-options.ts";
import * as reactSpecular from "../../ui/src/glass/specular-map.ts";
import * as reactSpring from "../../ui/src/glass/spring.ts";
import { liquidFeaturesFor } from "../src/liquid/attach.ts";
import { computeCrystalField, crystalAmplitude, crystalMargin } from "../src/liquid/crystal.ts";
import { computeDisplacementField, type LensCoverage, scaleFor } from "../src/liquid/lens-map.ts";
import { type LiquidGlassOptions, liquidVars, mergeLiquid } from "../src/liquid/options.ts";
import { clear } from "../src/liquid/presets/clear.ts";
import { crystal } from "../src/liquid/presets/crystal.ts";
import { regular } from "../src/liquid/presets/regular.ts";
import { thick } from "../src/liquid/presets/thick.ts";
import { computeSpecularField } from "../src/liquid/specular.ts";
import { createSpring, SPRINGS, squashTarget, stepSpring } from "../src/liquid/spring.ts";

let seed = 11;
const rand = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};

/** Byte equality of two rasterised fields (toEqual on large typed arrays is slow). */
function expectSameField(
  a: { width: number; height: number; data: Uint8ClampedArray },
  b: { width: number; height: number; data: Uint8ClampedArray },
) {
  expect([a.width, a.height]).toEqual([b.width, b.height]);
  expect(Buffer.from(a.data.buffer).equals(Buffer.from(b.data.buffer))).toBe(true);
}

describe("liquid options parity", () => {
  it("ships the React kit's presets", () => {
    expect({ clear, regular, thick, crystal }).toEqual(reactOptions.LIQUID_PRESETS);
  });

  it("maps options to the same custom properties", () => {
    const profiles = ["rim", "full", "dome", "crystal"] as const;
    for (let i = 0; i < 300; i++) {
      const options: LiquidGlassOptions = {
        refraction: rand() * 2.4 - 0.2,
        bevelWidth: rand() > 0.5 ? rand() * 140 : undefined,
        profile: profiles[Math.floor(rand() * 4)],
        dispersion: rand() * 0.3,
        frost: rand() * 50,
        saturation: rand() * 5,
        brightness: rand() > 0.5 ? rand() * 3 : undefined,
        tint: rand() > 0.5 ? { color: "#abc", amount: rand() } : undefined,
        rim: rand() > 0.3 ? rand() * 2.5 : undefined,
        specular: rand() > 0.5 ? { intensity: rand() * 2, angle: rand() * 360 - 180 } : undefined,
        fresnel: rand() > 0.5 ? rand() : undefined,
        grain: rand() > 0.7 ? rand() : undefined,
        radius: rand() > 0.5 ? rand() * 40 : undefined,
        opacity: rand(),
        shadow:
          rand() > 0.5
            ? { opacity: rand() * 2, spread: rand() * 90, offsetY: rand() * 100 - 50 }
            : undefined,
        interactive: rand() > 0.5 ? "drag" : undefined,
        motion: rand() > 0.8 ? false : "jelly",
      };
      expect(liquidVars(options)).toEqual(reactOptions.liquidVars(options));
    }
    expect(mergeLiquid(thick, { shadow: { opacity: 2 } })).toEqual(
      reactOptions.mergeLiquid(reactOptions.LIQUID_PRESETS.thick, { shadow: { opacity: 2 } }),
    );
  });
});

describe("lens maps parity", () => {
  it("builds the same displacement fields for every profile", () => {
    const coverages: LensCoverage[] = ["rim", "full", "dome"];
    for (let i = 0; i < 24; i++) {
      const options = {
        width: 20 + Math.round(rand() * 220),
        height: 20 + Math.round(rand() * 120),
        radius: rand() * 40,
        bezel: 4 + rand() * 30,
        coverage: coverages[i % 3],
        soft: rand() > 0.5 ? rand() * 20 : undefined,
        cap: rand() > 0.5 ? 10 + rand() * 20 : undefined,
        dpr: 1 + Math.round(rand() * 2) / 2,
      };
      expectSameField(
        computeDisplacementField(options),
        reactMaps.computeDisplacementField(options),
      );
      expect(
        scaleFor(options.width, options.height, options.bezel, options.coverage, options.cap),
      ).toBe(
        reactMaps.scaleFor(
          options.width,
          options.height,
          options.bezel,
          options.coverage,
          options.cap,
        ),
      );
    }
  });

  it("builds the same specular and crystal fields", () => {
    for (let i = 0; i < 12; i++) {
      const width = 30 + Math.round(rand() * 160);
      const height = 30 + Math.round(rand() * 90);
      const spec = { width, height, radius: rand() * 30, dpr: 1 + (i % 2), angle: rand() * 360 };
      expectSameField(computeSpecularField(spec), reactSpecular.computeSpecularField(spec));
      const refraction = rand() * 2;
      const amplitude = crystalAmplitude(width, height, refraction);
      expect(amplitude).toBe(reactCrystal.crystalAmplitude(width, height, refraction));
      const crystalOptions = {
        width,
        height,
        amplitude,
        margin: crystalMargin(amplitude, 0.03),
        room: i % 2 ? { left: 10, top: 0 } : undefined,
        reach: 1.03,
      };
      expectSameField(
        computeCrystalField(crystalOptions),
        reactCrystal.computeCrystalField(crystalOptions),
      );
    }
  });
});

describe("springs parity", () => {
  it("steps the same", () => {
    for (const name of Object.keys(SPRINGS) as Array<keyof typeof SPRINGS>) {
      const a = createSpring(0, 1);
      const b = reactSpring.createSpring(0, 1);
      for (let frame = 0; frame < 60; frame++) {
        const dt = 1 / (30 + (frame % 4) * 30);
        stepSpring(a, SPRINGS[name], dt);
        reactSpring.stepSpring(b, reactSpring.SPRINGS[name], dt);
      }
      expect(a).toEqual(b);
    }
    expect(squashTarget(900, -300)).toEqual(reactSpring.squashTarget(900, -300));
  });
});

describe("liquidFeaturesFor", () => {
  const read = (vars: Record<string, string>) => (name: string) => vars[name] ?? "";
  it("loads specular and motion by default, as the React engine applies them", () => {
    expect(liquidFeaturesFor(read({}), 10_000)).toEqual(["specular", "motion"]);
  });
  it("loads only what the resolved values turn on", () => {
    const flat = read({ "--liquid-specular": "0", "--liquid-motion": "off" });
    expect(liquidFeaturesFor(flat, 10_000)).toEqual([]);
    const crystalVars = read(
      Object.fromEntries(
        Object.entries(liquidVars(crystal)).map(([name, value]) => [name, String(value)]),
      ),
    );
    expect(liquidFeaturesFor(crystalVars, 10_000)).toEqual(["dispersion", "crystal", "motion"]);
    // Dispersion stays off over its area budget, like the engine.
    expect(liquidFeaturesFor(crystalVars, 200_000)).toEqual(["crystal", "motion"]);
    expect(liquidFeaturesFor(read({ "--glass-lens-coverage": "crystal" }), 1)).toContain("crystal");
  });
});
