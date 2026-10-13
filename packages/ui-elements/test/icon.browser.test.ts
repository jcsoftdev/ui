import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { defineIcon, loadIcon, registerIcon, type UiIcon } from "../src/icon/icon.ts";
import { ax, mount, wait } from "./setup.ts";

beforeAll(() => {
  defineIcon();
});

afterEach(() => {
  document.body.innerHTML = "";
});

const drawn = (icon: Element) => icon.shadowRoot?.querySelector("svg") as SVGSVGElement;
const ready = (icon: Element) =>
  new Promise<void>((resolve) => icon.addEventListener("load", () => resolve(), { once: true }));
const glyphRequests = () =>
  performance
    .getEntriesByType("resource")
    .map((entry) => entry.name)
    .filter((name) => /\/glyphs\//.test(name));

describe("ui-icon", () => {
  it("draws the named glyph, loading only that glyph", async () => {
    const before = glyphRequests().length;
    const host = mount(`<ui-icon name="bell"></ui-icon>`);
    const icon = host.querySelector<UiIcon>("ui-icon")!;
    await ready(icon);
    const svg = drawn(icon);
    expect(svg.hasAttribute("hidden")).toBe(false);
    expect(svg.querySelectorAll("path").length).toBeGreaterThan(0);
    const fetched = glyphRequests().slice(before);
    expect(fetched.filter((name) => /glyphs\/bell\./.test(name))).toHaveLength(1);
    expect(fetched.filter((name) => /glyphs\//.test(name))).toHaveLength(1);
    expect(svg.getAttribute("width")).toBe("24");
    expect(svg.getAttribute("stroke-width")).toBe("1.8");
  });

  it("is decorative without a label and an image with one", async () => {
    const host = mount(
      `<ui-icon name="check"></ui-icon><ui-icon name="x" label="Close"></ui-icon>`,
    );
    await wait(80);
    expect(await ax("image", "Close")).toBeTruthy();
    const nodes = Array.from(host.querySelectorAll("ui-icon"));
    expect(nodes[0]?.shadowRoot?.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("accepts the React shorthand names, size and the absolute stroke width", async () => {
    const host = mount(`<ui-icon name="close" size="48" absolute-stroke-width></ui-icon>`);
    const icon = host.querySelector<UiIcon>("ui-icon")!;
    await ready(icon);
    const svg = drawn(icon);
    expect(svg.getAttribute("width")).toBe("48");
    expect(Number(svg.getAttribute("stroke-width"))).toBeCloseTo((1.8 * 24) / 48);
    expect(svg.innerHTML).toBe((await loadIcon("x"))?.replace(/\/>/g, "></path>"));
  });

  it("swaps the glyph when the name changes and reports an unknown name", async () => {
    const host = mount(`<ui-icon name="plus"></ui-icon>`);
    const icon = host.querySelector<UiIcon>("ui-icon")!;
    await ready(icon);
    const before = drawn(icon).innerHTML;
    icon.name = "minus";
    await ready(icon);
    expect(drawn(icon).innerHTML).not.toBe(before);
    const failed = vi.fn();
    icon.addEventListener("error", failed);
    icon.name = "no-such-icon";
    await wait(60);
    expect(failed).toHaveBeenCalledOnce();
    expect(drawn(icon).hasAttribute("hidden")).toBe(true);
    icon.name = "../registry";
    await wait(60);
    expect(failed).toHaveBeenCalledTimes(2);
  });

  it("draws glyphs and lazy sets registered by the app, which win over built-ins", async () => {
    const markup = '<circle cx="12" cy="12" r="4"/>';
    registerIcon("logo", markup);
    registerIcon("from-set", async () => ({ default: '<path d="M0 0"/>' }));
    registerIcon("bell", '<rect width="4" height="4"/>');
    const host = mount(
      `<ui-icon name="logo"></ui-icon><ui-icon name="from-set"></ui-icon><ui-icon name="bell"></ui-icon>`,
    );
    await wait(80);
    const [logo, set, bell] = Array.from(host.querySelectorAll("ui-icon"));
    expect(drawn(logo!).querySelector("circle")).toBeTruthy();
    expect(drawn(set!).querySelector("path")?.getAttribute("d")).toBe("M0 0");
    expect(drawn(bell!).querySelector("rect")).toBeTruthy();
  });

  it("shows a slotted svg when it has no name", () => {
    const host = mount(`<ui-icon><svg id="mine" width="10" height="10"></svg></ui-icon>`);
    const icon = host.querySelector("ui-icon")!;
    expect(drawn(icon).hasAttribute("hidden")).toBe(true);
    expect(icon.querySelector("#mine")).toBeTruthy();
  });

  it("registers under a custom prefix", () => {
    expect(defineIcon({ prefix: "acme" })).toBe("acme-icon");
  });
});
