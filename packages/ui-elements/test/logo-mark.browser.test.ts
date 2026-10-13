import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { generateMark, serializeMark } from "../src/internal/e15-brand.ts";
import { renderMark } from "../src/internal/e15-brand-dom.ts";
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

  it("takes size through the CSSOM, so it cannot inject CSS", () => {
    const host = mount(
      `<ui-logo-mark name="A" size="10px; background:url(https://evil.example/x)"></ui-logo-mark>`,
    );
    const svg = host.querySelector<UiLogoMark>("ui-logo-mark")?.shadowRoot?.querySelector("svg");
    expect(svg?.getAttribute("style")).not.toMatch(/evil|background/);
    expect(svg?.style.width).toBe("100%");
  });

  it("renders only safe attributes", () => {
    const svg = renderMark(
      {
        viewBox: "0 0 1 1",
        width: 1,
        height: 1,
        label: "x",
        nodes: [{ tag: "path", attrs: { d: "M0 0", onload: "window.__pwn=1", "bad name": "x" } }],
      },
      "50px",
    );
    const path = svg.querySelector("path");
    expect(path?.getAttribute("d")).toBe("M0 0");
    expect(path?.hasAttribute("onload")).toBe(false);
    expect(path?.attributes).toHaveLength(1);
  });
});
