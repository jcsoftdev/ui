import assert from "node:assert/strict";
import { test } from "node:test";
import { loadCases } from "./components/render.mjs";

const glass = await loadCases("glass-cases.ts");
const { material } = await loadCases("material-cases.tsx");

test("no options, no variables: the theme look is untouched", () => {
  assert.deepEqual(glass.liquidVars(), {});
  assert.deepEqual(glass.liquidVars({}), {});
  assert.deepEqual(glass.liquidStyle({}), {});
  assert.equal(glass.materialStyle("liquid"), undefined);
  assert.equal(glass.materialStyle(undefined), undefined);
  assert.equal(glass.withMaterialStyle("glass", { color: "red" }).color, "red");
});

test("every option maps to its --liquid-* variable", () => {
  const vars = glass.liquidVars({
    refraction: 0.5,
    bevelWidth: 18,
    profile: "dome",
    dispersion: 0.08,
    frost: 4,
    saturation: 1.8,
    brightness: 1.1,
    tint: { color: "#3366ff", amount: 0.3 },
    rim: 1.4,
    specular: { intensity: 0.6, angle: -45 },
    fresnel: 0.5,
    grain: 0.4,
    radius: 22,
    opacity: 0.8,
    shadow: { opacity: 0.5, spread: 8, offsetY: 14 },
    interactive: "drag",
    motion: "jelly",
  });
  const expected = {
    "--liquid-refraction": "0.5",
    "--liquid-bevel": "18px",
    "--liquid-profile": "dome",
    "--liquid-dispersion": "0.08",
    "--liquid-frost": "4px",
    "--liquid-saturation": "1.8",
    "--liquid-brightness": "1.1",
    "--liquid-brightness-fn": "brightness(1.1)",
    "--liquid-tint-color": "#3366ff",
    "--liquid-tint-amount": "0.3",
    "--liquid-rim-strength": "1.4",
    "--liquid-specular": "0.6",
    "--liquid-specular-angle": "-45",
    "--liquid-fresnel": "0.5",
    "--liquid-grain": "0.4",
    "--liquid-radius": "22px",
    "--liquid-opacity": "0.8",
    "--liquid-shadow-opacity": "0.5",
    "--liquid-shadow-spread": "8",
    "--liquid-shadow-offset": "14",
    "--liquid-interactive": "drag",
    "--liquid-motion": "jelly",
  };
  for (const [name, value] of Object.entries(expected)) assert.equal(vars[name], value, name);
  // The composite variables the utilities paint.
  assert.match(vars["--liquid-rim-custom"], /^inset .*var\(--liquid-rim-lit/);
  assert.match(vars["--liquid-rim-custom"], /inset 0 0 18px/);
  assert.match(vars["--liquid-shadow-custom"], /var\(--liquid-size, 1\)/);
  assert.match(vars["--glass-noise"], /^url\("data:image\/svg\+xml,/);
  assert.equal(glass.liquidStyle({ radius: 22 }).borderRadius, "var(--liquid-radius)");
});

test("values are clamped to ranges the lens can honour, and bad input is ignored", () => {
  const vars = glass.liquidVars({
    refraction: 7,
    dispersion: 3,
    opacity: -1,
    grain: 9,
    frost: -5,
    bevelWidth: Number.NaN,
    motion: false,
  });
  // The variable takes up to 2 (the crystal lens); the other profiles treat anything above 1 as 1.
  assert.equal(vars["--liquid-refraction"], "2");
  assert.equal(vars["--liquid-dispersion"], "0.2");
  assert.equal(vars["--liquid-opacity"], "0");
  assert.equal(vars["--liquid-grain"], "1");
  assert.equal(vars["--liquid-frost"], "0px");
  assert.equal("--liquid-bevel" in vars, false);
  assert.equal(vars["--liquid-motion"], "off");
});

test("a tint without an amount gets the default; grain 0 paints no noise", () => {
  assert.equal(glass.liquidVars({ tint: { color: "teal" } })["--liquid-tint-amount"], "0.2");
  assert.equal("--glass-noise" in glass.liquidVars({ grain: 0 }), false);
});

test("the rim follows the light: the lit wall is on the side the angle points to", () => {
  const upperLeft = glass.liquidRim(1, -120);
  const lowerRight = glass.liquidRim(1, 60);
  assert.match(upperLeft, /^inset 1px 1\.732px/);
  assert.match(lowerRight, /^inset -1px -1\.732px/);
  assert.equal(glass.liquidRim(1, -120, 0).includes("18px"), false);
});

test("presets sit under explicit fields, grouped fields merge one level deep", () => {
  const merged = glass.liquidOptionsOf({
    type: "liquid",
    preset: "thick",
    frost: 1,
    shadow: { offsetY: 2 },
  });
  assert.equal(merged.frost, 1);
  assert.equal(merged.bevelWidth, 32);
  assert.deepEqual(merged.shadow, { opacity: 1.2, spread: 12, offsetY: 2 });
});

test("the defaults describe the theme look", () => {
  const d = glass.LIQUID_DEFAULTS;
  assert.equal(d.refraction, 1);
  assert.equal(d.profile, "full");
  assert.equal(d.opacity, 1);
  assert.equal(d.dispersion, 0);
  assert.deepEqual(d.specular, { intensity: 1, angle: -120 });
});

test("a liquid material object picks its class and writes its variables on the component", () => {
  const spec = { type: "liquid-clear", frost: 3 };
  assert.equal(material.materialClass(spec, "surface-solid"), "liquid-clear");
  assert.equal(material.materialClass({ type: "liquid" }, "surface-solid"), "liquid");
  assert.equal(material.materialClass("liquid", "surface-solid"), "liquid");
  assert.deepEqual(glass.materialStyle(spec), { "--liquid-frost": "3px" });
  assert.match(material.cardStyle(spec), /--liquid-frost:3px/);
  assert.match(material.cardStyle(spec, { color: "red" }), /--liquid-frost:3px;color:red/);
  assert.match(material.cardClass(spec), /\bliquid-clear\b/);
  assert.match(material.actionBarStyle(spec), /--liquid-frost:3px/);
  assert.match(material.topbarStyle(spec), /--liquid-frost:3px/);
});

test("the default shadow is built from the themed tokens, an explicit one from its numbers", () => {
  const themed = glass.liquidShadow();
  assert.match(themed, /var\(--liquid-shadow-drop, 10px\)/);
  assert.match(themed, /var\(--liquid-shadow-blur, 30px\)/);
  assert.match(themed, /var\(--liquid-shadow-contact, \.4\)/);
  const explicit = glass.liquidShadow({ offsetY: 16, spread: 12 });
  assert.match(explicit, /calc\(16px \* var\(--liquid-size, 1\)\) calc\(42px \*/);
  assert.doesNotMatch(explicit, /--liquid-shadow-(drop|blur)/);
});

test("the crystal preset is a clear thick lens: no frost, no veil, no tint, rim aberration, refraction past 1", () => {
  const crystal = glass.LIQUID_PRESETS.crystal;
  assert.equal(crystal.profile, "crystal");
  assert.equal(crystal.refraction, 1.67);
  assert.equal(crystal.dispersion, 0.05);
  assert.equal(crystal.frost, 0);
  assert.equal(crystal.opacity, 0);
  assert.equal(crystal.tint.amount, 0);
  assert.equal(crystal.specular.intensity, 0);
  assert.equal(crystal.fresnel, 1);
  const vars = glass.liquidVars(crystal);
  assert.equal(vars["--liquid-refraction"], "1.67");
  assert.equal(vars["--liquid-profile"], "crystal");
  assert.equal(vars["--liquid-frost"], "0px");
  assert.equal(vars["--liquid-opacity"], "0");
  // Refraction reaches 2 and no further.
  assert.equal(glass.liquidVars({ refraction: 5 })["--liquid-refraction"], "2");
  // The defaults are untouched: the regular preset sets nothing.
  assert.deepEqual(glass.liquidVars(glass.LIQUID_PRESETS.regular), {});
  assert.equal(glass.LIQUID_DEFAULTS.refraction, 1);
  assert.equal(glass.LIQUID_DEFAULTS.profile, "full");
});
