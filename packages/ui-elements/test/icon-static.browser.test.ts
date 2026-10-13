import { afterEach, beforeAll, describe, expect, it } from "vitest";
import "../src/icon/glyphs/chevron-down.ts";
import { defineIcon, type UiIcon } from "../src/icon/icon.ts";
import { mount } from "./setup.ts";

beforeAll(() => {
  defineIcon();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ui-icon static glyphs", () => {
  it("draws a pre-registered glyph synchronously, without fetching the registry or any glyph", () => {
    const before = performance.getEntriesByType("resource").length;
    const host = mount(`<ui-icon name="chevron-down"></ui-icon>`);
    const icon = host.querySelector<UiIcon>("ui-icon")!;
    const svg = icon.shadowRoot!.querySelector("svg")!;
    expect(svg.hasAttribute("hidden")).toBe(false);
    expect(svg.querySelector("path")).toBeTruthy();
    const fetched = performance
      .getEntriesByType("resource")
      .slice(before)
      .map((entry) => entry.name);
    expect(fetched.filter((name) => /registry|glyphs\//.test(name))).toEqual([]);
  });

  it("still falls back to the lazy registry for names that were not registered", async () => {
    const host = mount(`<ui-icon name="bell"></ui-icon>`);
    const icon = host.querySelector<UiIcon>("ui-icon")!;
    await new Promise((resolve) => icon.addEventListener("load", resolve, { once: true }));
    expect(icon.shadowRoot!.querySelector("svg path")).toBeTruthy();
    expect(
      performance.getEntriesByType("resource").some((entry) => /registry/.test(entry.name)),
    ).toBe(true);
  });
});
