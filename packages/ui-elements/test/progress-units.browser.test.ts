import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { defineProgressUnits } from "../src/progress-units/progress-units.ts";
import { ax } from "./setup.ts";
import { mountChart, parkMouse, svgOf, violations } from "./unit-chart-helpers.ts";

beforeAll(() => defineProgressUnits());
beforeEach(parkMouse);
afterEach(() => {
  document.body.innerHTML = "";
});

const progress = (attrs: string, width = 220) =>
  mountChart("ui-progress-units", `label="Rating" ${attrs}`, undefined, width);

describe("ui-progress-units", () => {
  it("is one image named by its label and described by its value", async () => {
    const c = await progress('value="4.5"');
    expect(await ax("image", "Rating")).toBeTruthy();
    const svg = svgOf(c);
    expect(c.querySelector(`#${svg.getAttribute("aria-describedby")}`)?.textContent).toBe(
      "4.5 / 5",
    );
    expect(svg.querySelectorAll("[data-unit]")).toHaveLength(5);
    // The half star is clipped, the full ones are not.
    expect(svg.querySelectorAll("clipPath")).toHaveLength(1);
    expect(svg.getAttribute("height")).toBe("24");
    expect(c.querySelectorAll("[tabindex]")).toHaveLength(0);
  });

  it("rounds to a step, draws segments, and takes the locale", async () => {
    const stepped = await progress('value="4.3" step="0.5"');
    expect(svgOf(stepped).querySelector("[data-unit-value]")?.textContent).toBe("4.5 / 5");
    const segments = await progress('value="60" max="100" count="10" variant="segments" size="12"');
    expect(svgOf(segments).querySelectorAll("[data-unit]")).toHaveLength(10);
    expect(svgOf(segments).querySelector("[data-unit-value]")?.textContent).toBe("60 / 100");
    const de = await progress('value="4.5" locale="de-DE"');
    expect(svgOf(de).querySelector("[data-unit-value]")?.textContent).toBe("4,5 / 5");
    const hidden = await progress('value="3" show-value="off"');
    expect(svgOf(hidden).querySelector("[data-unit-value]")).toBeNull();
  });

  it("shows the empty state without a usable value", async () => {
    const c = await progress('value="oops"');
    expect(c.querySelector("svg")).toBeNull();
  });

  it("passes axe", async () => {
    expect(await violations(await progress('value="3.5"'))).toEqual([]);
  });

  it("caps a huge count and drops a hostile colour", async () => {
    const start = performance.now();
    const c = await progress('value="5" max="10" count="120000" variant="segments"');
    expect(svgOf(c).querySelectorAll("[data-unit]").length).toBeLessThanOrEqual(2000);
    expect(performance.now() - start).toBeLessThan(3000);
    const hostile = await progress('value="3" color="url(https://evil.test/x.png)"');
    expect(hostile.innerHTML).not.toContain("evil.test");
  });

  it("treats an unknown tone like toString as no tone and false as off", async () => {
    const c = await progress('value="3" tone="toString" show-value="false"');
    expect(svgOf(c).querySelectorAll("[data-unit]")).toHaveLength(5);
    expect(svgOf(c).querySelector("[data-unit-value]")).toBeNull();
  });
});
