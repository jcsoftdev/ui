import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import {
  BARBER_SILHOUETTES,
  definePictogramChart,
  PICTOGRAM_SILHOUETTES,
} from "../src/pictogram-chart/pictogram-chart.ts";
import { ax, wait } from "./setup.ts";
import {
  awake,
  focusFirst,
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

  it("closes the details over the empty slots of a row, and moves to the next category by row", async () => {
    const c = await pictogram('per-unit="5" layout="rows" columns="6"');
    await awake(c);
    const seen = hoverLog(c);
    const units = unitBoxes(c);
    const first = units[0] as (typeof units)[number];
    const pitch = (units[1]?.x ?? 0) - first.x;
    // Row 1 (adults) has five icons in six columns: the sixth slot is empty and shows nothing.
    pointer(c, "pointermove", first.cx, first.cy);
    pointer(c, "pointermove", first.cx + 5 * pitch, first.cy);
    expect(seen).toEqual([0, null]);
    expect(c.hover).toBeNull();
    pointer(c, "pointermove", first.cx + 5 * pitch, first.cy + pitch);
    expect(seen).toEqual([0, null]);
    pointer(c, "pointermove", first.cx, first.cy + pitch);
    expect(seen).toEqual([0, null, 1]);
    // Leaving the plot never leaves a held category behind.
    pointer(c, "pointerleave", 0, 0);
    expect(c.hover).toBeNull();
  });

  it("navigates in two dimensions over the rows", async () => {
    const c = await pictogram('per-unit="5" layout="rows"');
    await focusFirst(c);
    expect(await keys(c, ["{ArrowDown}", "{ArrowUp}", "{ArrowRight}", "{Home}", "{End}"])).toEqual([
      1, 0, 1, 0, 1,
    ]);
  });

  it("keeps capacity as empty icons that show nothing", async () => {
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
    expect(seen).toEqual([1, null]);
    // A tap on an empty slot does not pin anything.
    tap(c, empty.cx, empty.cy);
    expect(c.selected).toBeNull();
    expect(c.hover).toBeNull();
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

  it("never lets a url() colour reach the network, and drops it", async () => {
    const asked: string[] = [];
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) asked.push(entry.name);
    });
    observer.observe({ type: "resource", buffered: false });
    const payload = "url(https://evil.test/leak.png)";
    const c = await pictogram('per-unit="5"', [
      { id: "a", name: "Adults", value: 23, color: payload },
      { id: "b", name: "Kids", value: 12 },
    ]);
    await wait(150);
    observer.disconnect();
    expect(asked.filter((name) => name.includes("evil.test"))).toEqual([]);
    expect(c.innerHTML).not.toContain("evil.test");
    const fill = (c.querySelector("svg [data-cat='0'] [data-unit] path") as SVGElement).style.fill;
    expect(fill).not.toContain("url");
  });

  it("caps a huge value at 2000 icons and still draws quickly", async () => {
    const start = performance.now();
    const c = await pictogram('per-unit="1"', [{ id: "a", name: "Adults", value: 120000 }]);
    expect(unitBoxes(c).length).toBeLessThanOrEqual(2000);
    expect(unitBoxes(c).length).toBeGreaterThan(0);
    expect(performance.now() - start).toBeLessThan(3000);
  });

  it("shows a fractional unit exactly in the key, loads other icons lazily and exports the names", async () => {
    const c = await pictogram('per-unit="0.25" show-key="false"');
    expect(c.querySelector("[data-ui-part=unit-key]")).toBeNull();
    const keyed = await pictogram('per-unit="0.25" icon="heart"');
    expect(keyed.querySelector("[data-ui-part=unit-key]")?.textContent).toBe("= 0.25 clients");
    await vi.waitFor(() =>
      expect(keyed.querySelector("svg [data-unit] path")?.getAttribute("d")).not.toBe(
        c.querySelector("svg [data-unit] path")?.getAttribute("d"),
      ),
    );
    expect(PICTOGRAM_SILHOUETTES).toContain("heart");
    expect(BARBER_SILHOUETTES).toContain("scissors");
  });
});
