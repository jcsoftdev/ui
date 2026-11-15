import assert from "node:assert/strict";
import { describe, it } from "node:test";
import vm from "node:vm";
import {
  DIALS,
  PRESET_STORAGE_KEY,
  presetInitScript,
  readDials,
  sanitizePreset,
  setDial,
  THEME_STORAGE_KEY,
} from "../src/lib/preset-script.mjs";

/** Runs the inline <head> script against a fake <html> and storage, returning the resulting dataset. */
function runInit(stored, { prefersLight = false } = {}) {
  const dataset = {};
  const context = {
    document: { documentElement: { dataset } },
    localStorage: { getItem: (key) => stored[key] ?? null },
    matchMedia: () => ({ matches: prefersLight }),
  };
  vm.runInNewContext(presetInitScript, context);
  return { ...dataset };
}

describe("sanitizePreset", () => {
  it("keeps a preset stored before the density, radius and glass additions", () => {
    assert.deepEqual(
      sanitizePreset({ style: "brutal", accent: "menta", density: "", radius: "full" }),
      { style: "brutal", accent: "menta", radius: "full" },
    );
  });

  it("accepts the new positions: touch and auto density, sm and lg radius, liquid glass", () => {
    assert.deepEqual(sanitizePreset({ density: "touch", radius: "sm", glass: "liquid-thick" }), {
      density: "touch",
      radius: "sm",
      glass: "liquid-thick",
    });
    assert.deepEqual(sanitizePreset({ density: "auto", radius: "lg" }), {
      density: "auto",
      radius: "lg",
    });
  });

  it("drops defaults, unknown keys, unknown values and non-objects", () => {
    assert.deepEqual(
      sanitizePreset({ style: "soft", accent: "coral", radius: "huge", theme: "dark", x: 1 }),
      {},
    );
    assert.deepEqual(sanitizePreset(null), {});
    assert.deepEqual(sanitizePreset("brutal"), {});
  });
});

describe("setDial and readDials", () => {
  it("sets a non-default value and removes the attribute for the default", () => {
    const root = { dataset: {} };
    assert.equal(setDial(root, "radius", "lg"), "lg");
    assert.equal(root.dataset.radius, "lg");
    assert.equal(setDial(root, "radius", DIALS.radius.default), "auto");
    assert.equal("radius" in root.dataset, false);
  });

  it("treats an unknown value as the default", () => {
    const root = { dataset: { glass: "liquid" } };
    assert.equal(setDial(root, "glass", "liquid-crystal"), "frosted");
    assert.equal("glass" in root.dataset, false);
  });

  it("fills every dial with its default", () => {
    assert.deepEqual(readDials({ dataset: { density: "touch" } }), {
      style: "soft",
      accent: "coral",
      density: "touch",
      radius: "auto",
      glass: "frosted",
    });
  });
});

describe("presetInitScript", () => {
  it("restores an old stored preset and the theme before paint", () => {
    const dataset = runInit({
      [THEME_STORAGE_KEY]: "light",
      [PRESET_STORAGE_KEY]: JSON.stringify({ style: "glass", accent: "", density: "compact" }),
    });
    assert.deepEqual(dataset, { theme: "light", style: "glass", density: "compact" });
  });

  it("restores the new dials and ignores values outside the dial set", () => {
    const dataset = runInit({
      [PRESET_STORAGE_KEY]: JSON.stringify({ glass: "liquid-clear", radius: "sm", style: "x" }),
    });
    assert.deepEqual(dataset, { theme: "dark", glass: "liquid-clear", radius: "sm" });
  });

  it("falls back to the system theme and survives corrupt storage", () => {
    const dataset = runInit({ [PRESET_STORAGE_KEY]: "{not json" }, { prefersLight: true });
    assert.deepEqual(dataset, { theme: "light" });
  });
});
