import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { defineIsotypeRows } from "../src/isotype-rows/isotype-rows.ts";
import { ax, wait } from "./setup.ts";
import {
  awake,
  hoverLog,
  keys,
  marksOf,
  mountChart,
  parkMouse,
  pointer,
  svgOf,
  tap,
  unitBoxes,
  violations,
} from "./unit-chart-helpers.ts";

beforeAll(() => defineIsotypeRows());
beforeEach(parkMouse);
afterEach(() => {
  document.body.innerHTML = "";
});

const DATA = [
  { id: "cut", name: "Haircuts", value: 12 },
  { id: "beard", name: "Beard trims", value: 7 },
  { id: "color", name: "Colour", value: 3 },
];
const rows = (attrs = "", data: unknown = DATA) =>
  mountChart("ui-isotype-rows", `unit-label="services" ${attrs}`, data, 400);

describe("ui-isotype-rows", () => {
  it("is as tall as its rows, one icon per unit, with the name and the value on each row", async () => {
    const c = await rows('per-icon="2"');
    expect(svgOf(c).getAttribute("height")).toBe(`${3 * 34}`);
    // 12 / 2, 7 / 2 = 3.5 and 3 / 2 = 1.5 icons.
    expect(marksOf(c).map((m) => m.querySelectorAll("[data-unit]").length)).toEqual([6, 4, 2]);
    expect([...c.querySelectorAll("[data-unit-value]")].map((node) => node.textContent)).toEqual([
      "12",
      "7",
      "3",
    ]);
    expect(c.querySelector("[data-ui-part=unit-key]")?.textContent).toBe("= 2 services");
    expect(await ax("image", "Beard trims: 7 services")).toBeTruthy();
    const tall = await rows('row-height="50"');
    expect(svgOf(tall).getAttribute("height")).toBe("150");
  });

  it("holds the hover along a whole row band and changes only at the next row", async () => {
    const c = await rows();
    await awake(c);
    const seen = hoverLog(c);
    const box = svgOf(c).getBoundingClientRect();
    for (let x = 0; x < box.width; x += 1) pointer(c, "pointermove", x, 17);
    expect(seen).toEqual([0]);
    for (let y = 0; y < 3 * 34; y += 1) pointer(c, "pointermove", unitBoxes(c)[0]?.cx ?? 80, y);
    expect(seen).toEqual([0, 1, 2]);
    pointer(c, "pointerleave", 0, 0);
    expect(seen.at(-1)).toBeNull();
  });

  it("navigates in two dimensions: up and down are the rows above and below", async () => {
    const c = await rows();
    await userEvent.tab();
    await wait(80);
    expect(await keys(c, ["{ArrowDown}", "{ArrowDown}", "{ArrowDown}", "{ArrowUp}"])).toEqual([
      1, 2, 2, 1,
    ]);
    expect(await keys(c, ["{Home}", "{End}"])).toEqual([0, 2]);
  });

  it("pins a row on a tap", async () => {
    const c = await rows();
    await awake(c);
    tap(c, 120, 34 + 10);
    expect(c.selected).toBe(1);
    expect(c.hover?.pinned).toBe(true);
  });

  it("passes axe", async () => {
    expect(await violations(await rows())).toEqual([]);
  });
});
