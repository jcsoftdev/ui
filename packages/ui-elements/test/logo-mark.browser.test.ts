import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { generateMark, serializeMark } from "../src/internal/e15-brand.ts";
import { defineLogoMark, type UiLogoMark } from "../src/logo-mark/logo-mark.ts";
import { ax, mount } from "./setup.ts";

beforeAll(() => {
  defineLogoMark();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ui-logo-mark", () => {
  it("is an image named after the mark", async () => {
    mount(`<ui-logo-mark name="Barbería Don Lucho" tagline="Desde 1998"></ui-logo-mark>`);
    expect(await ax("image", "Barbería Don Lucho - Desde 1998")).toBeTruthy();
  });

  it("draws exactly what the generator produces for its attributes", () => {
    const host = mount(
      `<ui-logo-mark name="Barbería Don Lucho" shape="shield" monogram="initials" palette="navaja" layout="stacked" fill="gradient" seed="3" size="200px"></ui-logo-mark>`,
    );
    const mark = host.querySelector<UiLogoMark>("ui-logo-mark")!;
    const expected = generateMark({
      name: "Barbería Don Lucho",
      shape: "shield",
      monogram: "initials",
      palette: "navaja",
      layout: "stacked",
      fill: "gradient",
      seed: 3,
    });
    expect(mark.mark).toEqual(expected);
    expect(mark.toSvg()).toBe(serializeMark(expected));
    const svg = mark.shadowRoot?.querySelector("svg");
    expect(svg?.getAttribute("viewBox")).toBe(expected.viewBox);
    expect(svg?.style.width).toBe("200px");
  });

  it("re-renders on attribute change, and a hostile name stays text", () => {
    const host = mount(`<ui-logo-mark name="A"></ui-logo-mark>`);
    const mark = host.querySelector<UiLogoMark>("ui-logo-mark")!;
    mark.setAttribute("name", '"><script>window.__pwn=1</script>');
    expect(mark.shadowRoot?.querySelector("script")).toBeNull();
    expect(mark.toSvg()).not.toContain("<script");
  });
});
