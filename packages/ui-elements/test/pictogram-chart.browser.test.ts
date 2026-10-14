import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { definePictogramChart } from "../src/pictogram-chart/pictogram-chart.ts";
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

beforeAll(() => definePictogramChart());
beforeEach(parkMouse);
afterEach(() => {
  document.body.innerHTML = "";
});

const DATA = [
  { id: "a", name: "Adults", value: 23 },
  { id: "b", name: "Kids", value: 12 },
];
const pictogram = (attrs = 'per-unit="5"', data: unknown = DATA) =>
  mountChart("ui-pictogram-chart", `height="200" unit-label="clients" ${attrs}`, data);

describe("ui-pictogram-chart", () => {
  it("draws one icon per unit, cuts the last one to its remainder and explains the icon", async () => {
    const c = await pictogram();
    expect(marksOf(c).map((m) => m.querySelectorAll("[data-unit]").length)).toEqual([5, 3]);
    // 23 / 5 = 4.6 and 12 / 5 = 2.4: two clipped icons.
    expect(svgOf(c).querySelectorAll("clipPath")).toHaveLength(2);
    expect(c.querySelector("[data-ui-part=unit-key]")?.textContent).toBe("= 5 clients");
    expect(await ax("image", "Adults: 23 (65.7%)")).toBeTruthy();
    const plain = await pictogram('per-unit="1"');
    expect(plain.querySelector("[data-ui-part=unit-key]")).toBeNull();
  });

  it("holds the hover across the gaps between icons of one category", async () => {
    const c = await pictogram();
    await awake(c);
    const seen = hoverLog(c);
    const units = unitBoxes(c);
    const last = units.at(-1) as (typeof units)[number];
    const pitch = (units[1]?.x ?? 0) - (units[0]?.x ?? 0);
    expect(pitch).toBeGreaterThan(units[0]?.width ?? 0);
    // Every pixel along the row, the gutters between the icons included.
    for (let x = 0; x < last.x + last.width; x += 1) pointer(c, "pointermove", x, last.cy);
    expect(seen).toEqual([0, 1]);
    // Beyond the last icon the pointer is off the plot.
    pointer(c, "pointermove", last.x + pitch, last.cy);
    expect(seen).toEqual([0, 1, null]);
  });

  it("holds the category over the empty slots of a row, and moves to the next category by row", async () => {
    const c = await pictogram('per-unit="5" layout="rows" columns="6"');
    await awake(c);
    const seen = hoverLog(c);
    const units = unitBoxes(c);
    const first = units[0] as (typeof units)[number];
    const pitch = (units[1]?.x ?? 0) - first.x;
    // Row 1 (adults) has five icons in six columns: the sixth slot is empty and still adults.
    pointer(c, "pointermove", first.cx, first.cy);
    pointer(c, "pointermove", first.cx + 5 * pitch, first.cy);
    expect(seen).toEqual([0]);
    pointer(c, "pointermove", first.cx + 5 * pitch, first.cy + pitch);
    expect(seen).toEqual([0, 1]);
  });

  it("navigates in two dimensions over the rows", async () => {
    const c = await pictogram('per-unit="5" layout="rows"');
    await userEvent.tab();
    await wait(80);
    expect(await keys(c, ["{ArrowDown}", "{ArrowUp}", "{ArrowRight}", "{Home}", "{End}"])).toEqual([
      1, 0, 1, 0, 1,
    ]);
  });

  it("keeps capacity as empty icons that do not leave the category", async () => {
    const c = await pictogram('per-unit="5" total="60"');
    expect(unitBoxes(c)).toHaveLength(12);
    const kid = unitBoxes(c, "svg [data-cat='1'] [data-unit]")[0] as ReturnType<
      typeof unitBoxes
    >[number];
    const spare = unitBoxes(c, "svg > g:first-child [data-unit]");
    expect(spare).toHaveLength(4);
    const empty = spare.at(-1) as ReturnType<typeof unitBoxes>[number];
    await awake(c);
    const seen = hoverLog(c);
    pointer(c, "pointermove", kid.cx, kid.cy);
    pointer(c, "pointermove", empty.cx, empty.cy);
    expect(seen).toEqual([1]);
  });

  it("pins a category on a tap", async () => {
    const c = await pictogram();
    await awake(c);
    const last = unitBoxes(c).at(-1) as ReturnType<typeof unitBoxes>[number];
    tap(c, last.cx, last.cy);
    expect(c.selected).toBe(1);
    expect(c.hover).toMatchObject({ pinned: true, source: "touch" });
  });

  it("passes axe", async () => {
    expect(await violations(await pictogram())).toEqual([]);
  });
});
