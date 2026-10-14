import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { defineChordChart } from "../src/chord-chart/chord-chart.ts";
import {
  animateCalls,
  awake,
  axeViolations,
  focusChart,
  hoverLog,
  marksOf,
  mountChart,
  parkMouse,
  pointer,
  settle,
  svgOf,
  sweep,
  tap,
} from "./flow-helpers.ts";
import { ax, wait } from "./setup.ts";

beforeAll(() => defineChordChart());
beforeEach(parkMouse);
afterEach(() => {
  document.body.innerHTML = "";
});

const GROUPS = [
  { id: "a", name: "Alpha" },
  { id: "b", name: "Beta" },
  { id: "c", name: "Gamma" },
];
const MATRIX = [
  [0, 10, 5],
  [8, 0, 3],
  [2, 4, 0],
];
const SIZE = 300; // under 420 wide: no rim labels, so radius = 146 and the ring starts at 132.86
const RADIUS = 146;
const INNER = RADIUS * 0.91;
const C = SIZE / 2;

const chord = (attrs = "") =>
  mountChart(
    "ui-chord-chart",
    `label="Switching" height="${SIZE}" ${attrs}`,
    { groups: GROUPS, matrix: MATRIX },
    SIZE,
  );
const at = (angle: number, r: number): [number, number] => [
  C + r * Math.sin(angle),
  C - r * Math.cos(angle),
];

describe("ui-chord-chart", () => {
  it("draws the same ribbons as the React layout and exposes groups then ribbons as images", async () => {
    const c = await chord();
    const core = await import(/* @vite-ignore */ "../../ui/src/charts/core/chord.ts");
    const rad = (deg: number) => (deg * Math.PI) / 180;
    const layout = core.chordLayout(MATRIX, {
      padAngle: rad(3),
      startAngle: 0,
      sortGroups: "input",
      sortSubgroups: "descending",
    });
    const drawn = [...c.querySelectorAll("path[data-ribbon]")].map((p) => p.getAttribute("d"));
    expect(drawn).toEqual(
      layout.chords.map((ch: Parameters<typeof core.ribbonPath>[0]) =>
        core.ribbonPath(ch, INNER - 2),
      ),
    );
    expect(marksOf(c)).toHaveLength(GROUPS.length + layout.chords.length);
    expect(await ax("group", "Switching")).toBeTruthy();
    expect(await ax("image", "Alpha: Out 15, In 10. Beta 10, Gamma 5")).toBeTruthy();
    expect(c.chartSnapshot?.series.map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("passes axe", async () => {
    const c = await chord("");
    expect(await axeViolations(c)).toEqual([]);
  });

  it("hover never blinks: around the ring each group is entered once, ribbons are snapped inside", async () => {
    const c = await chord();
    await awake(c);
    const mid = (INNER + RADIUS) / 2;
    // The gaps between groups snap to the nearer group; the ring is walked clockwise from 12 o'clock.
    const events = hoverLog(c, () => {
      for (let a = 0.03; a < Math.PI * 2 - 0.08; a += 0.01) {
        const [x, y] = at(a, mid);
        pointer(c, "pointermove", x, y);
      }
    });
    expect(events).toEqual([0, 1, 2]);
    // Straight through the middle: only ribbons, never nothing.
    const across = sweep(c, [C - 100, C + 2], [C + 100, C + 2]);
    expect(across.includes(null)).toBe(false);
    expect(across.every((i) => (i as number) >= GROUPS.length)).toBe(true);
    // Just outside the ring is still the group; far outside is nothing.
    const [ox, oy] = at(0.2, RADIUS + 3);
    pointer(c, "pointermove", ox, oy);
    expect(c.hover?.index).toBe(0);
    expect(sweep(c, [ox, oy], [C + RADIUS + 60, C]).at(-1)).toBeNull();
  });

  it("lights a group's ribbons and dims the rest while it is hovered", async () => {
    const c = await chord();
    await awake(c);
    const [x, y] = at(0.3, (INNER + RADIUS) / 2);
    pointer(c, "pointermove", x, y);
    expect(c.hover?.title).toBe("Alpha");
    expect(c.querySelectorAll("path[data-arc][data-dim]")).toHaveLength(0); // all three touch Alpha's ribbons
    const lit = c.querySelectorAll("path[data-ribbon]:not([data-dim])").length;
    expect(lit).toBe(2); // Alpha-Beta and Alpha-Gamma; Beta-Gamma is dimmed
    pointer(c, "pointerleave", 0, 0);
    expect(c.querySelectorAll("[data-dim]")).toHaveLength(0);
  });

  it("walks group to group and into a group's ribbons from the keyboard", async () => {
    const c = await chord();
    await focusChart();
    const at0 = () => (c.hover as { index: number }).index;
    const mark = (i: number) => (c.describe as (i: number) => Record<string, unknown>)(i);
    expect(mark(at0())).toMatchObject({ kind: "group", id: "a" });
    await userEvent.keyboard("{ArrowRight}");
    expect(mark(at0())).toMatchObject({ id: "b" });
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    expect(mark(at0())).toMatchObject({ id: "a" }); // wraps
    await userEvent.keyboard("{ArrowLeft}");
    expect(mark(at0())).toMatchObject({ id: "c" });
    await userEvent.keyboard("{Home}{ArrowDown}");
    const first = mark(at0());
    expect(first).toMatchObject({ kind: "ribbon", from: 0, to: 1 }); // the largest flow of Alpha
    await userEvent.keyboard("{ArrowRight}");
    expect(mark(at0())).toMatchObject({ kind: "ribbon", from: 0, to: 2 });
    await userEvent.keyboard("{ArrowUp}");
    expect(mark(at0())).toMatchObject({ kind: "group", id: "a" });
    await userEvent.keyboard("{End}");
    expect(mark(at0())).toMatchObject({ id: "c" });
  });

  it("a tap pins the group under the finger", async () => {
    const c = await chord();
    await awake(c);
    const [x, y] = at(5.7, (INNER + RADIUS) / 2);
    tap(c, x, y);
    expect(c.selected).toBe(2);
    expect(c.hover).toMatchObject({ pinned: true, source: "touch", title: "Gamma" });
    tap(c, x, y);
    expect(c.selected).toBeNull();
  });

  it("hides a group from the matrix when its legend item is toggled, and uses the locale", async () => {
    const c = await chord('locale="de-DE" value-format="number"');
    c.setAttribute("locale", "de-DE");
    (c as unknown as { matrix: unknown }).matrix = MATRIX.map((row) => row.map((v) => v * 1000));
    await settle();
    expect(marksOf(c).some((m) => /15\.000/.test(m.getAttribute("aria-label") ?? ""))).toBe(true);
    (c as unknown as { toggleSeries(id: string): void }).toggleSeries("c");
    await wait(80);
    await settle();
    expect(c.querySelectorAll("path[data-arc]")).toHaveLength(2);
    expect(svgOf(c)).toBeTruthy();
  });

  it("plays the entry animation only when motion is allowed", async () => {
    expect(await animateCalls(() => chord(), true)).toBe(0);
    expect(await animateCalls(() => chord(), false)).toBeGreaterThan(0);
  });

  it("writes no height on the host", async () => {
    const c = await mountChart("ui-chord-chart", 'label="Switching"', {
      groups: GROUPS,
      matrix: MATRIX,
    });
    expect(c.hasAttribute("height")).toBe(false);
  });

  it("shows the empty state for no groups and for an all-zero matrix", async () => {
    const none = await mountChart("ui-chord-chart", `label="Switching" height="${SIZE}"`, {
      groups: [],
      matrix: MATRIX,
    });
    const zero = await mountChart("ui-chord-chart", `label="Switching" height="${SIZE}"`, {
      groups: GROUPS,
      matrix: MATRIX.map((row) => row.map(() => 0)),
    });
    for (const c of [none, zero]) {
      expect(c.querySelector("[role=status]")).toBeTruthy();
      expect(c.querySelectorAll("path[data-arc]")).toHaveLength(0);
    }
  });

  it("never prints NaN or Infinity for flows that are not finite", async () => {
    const c = await mountChart(
      "ui-chord-chart",
      `label="Switching" height="${SIZE}"`,
      {
        groups: GROUPS,
        matrix: [
          [0, Number.NaN, 5],
          [8, 0, Number.POSITIVE_INFINITY],
          [2, 4, 0],
        ],
      },
      SIZE,
    );
    const text = [
      ...marksOf(c).map((m) => m.getAttribute("aria-label")),
      ...(c.chartSnapshot?.series.flatMap((s) => s.text) ?? []),
    ].join(" ");
    expect(marksOf(c).length).toBeGreaterThan(0);
    expect(text).not.toMatch(/NaN|Infinity|∞/);
  });
});
