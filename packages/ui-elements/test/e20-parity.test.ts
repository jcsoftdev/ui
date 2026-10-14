import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SideKeeper } from "../src/internal/e20-polar.ts";

// The React logic is loaded by path at runtime, so the package never depends on it statically.
const REACT = fileURLToPath(new URL("../../ui/src/charts/", import.meta.url));
const react = (path: string) => import(/* @vite-ignore */ `/@fs${REACT}${path}`);

describe("E20 ports match the React kit", () => {
  it("slices, arcs and label spreading", async () => {
    const [ui, core] = await Promise.all([
      react("core/polar.ts"),
      import("@jcsoftdev/ui-core/chart/polar"),
    ]);
    const values = [120, 80, 60, 40, 0, 7];
    expect(core.sliceAngles(values, { padAngle: 0.02, startAngle: 0.4 })).toEqual(
      ui.sliceAngles(values, { padAngle: 0.02, startAngle: 0.4 }),
    );
    const spec = {
      cx: 100,
      cy: 90,
      innerRadius: 40,
      outerRadius: 80,
      startAngle: 0.3,
      endAngle: 2.2,
      cornerRadius: 6,
    };
    expect(core.arcPath(spec)).toBe(ui.arcPath(spec));
    expect(core.arcLine(100, 90, 60, 0.2, 4)).toBe(ui.arcLine(100, 90, 60, 0.2, 4));
    for (const angle of [-1, 0, 1.5, 3.3, 7])
      for (const count of [3, 5, 8])
        expect(core.slotAt(angle, count, 0.4)).toBe(ui.slotAt(angle, count, 0.4));
  });

  it("hemicycle layout and seat sharing", async () => {
    const [ui, core] = await Promise.all([
      react("core/units.ts"),
      import("@jcsoftdev/ui-core/chart/parliament"),
    ]);
    for (const total of [1, 7, 60, 199, 650]) {
      expect(core.parliamentLayout(total, { innerRatio: 0.4 })).toEqual(
        ui.parliamentLayout(total, { innerRatio: 0.4 }),
      );
      expect(core.parliamentLayout(total, { rows: 5, innerRatio: 0.5 })).toEqual(
        ui.parliamentLayout(total, { rows: 5, innerRatio: 0.5 }),
      );
    }
    expect(core.assignUnits([3, 0, 2])).toEqual(ui.assignUnits([3, 0, 2]));
    expect(core.largestRemainder([5, 3, 2], 7)).toEqual(ui.largestRemainder([5, 3, 2], 7));
  });

  it("gauge layout and rounded radar maximum", async () => {
    const [ui, core, radar, polar] = await Promise.all([
      react("gauge-chart/gauge-layout.ts"),
      import("@jcsoftdev/ui-core/chart/gauge"),
      react("radar-chart/radar-chart.tsx"),
      import("@jcsoftdev/ui-core/chart/polar"),
    ]);
    if (ui)
      for (const key of Object.keys(ui))
        expect(typeof (core as Record<string, unknown>)[key]).toBe(typeof ui[key]);
    if (radar)
      for (const v of [0, 3, 47, 120, 999])
        expect(polar.niceRadarMax(v, 4)).toBe(radar.niceRadarMax(v, 4));
  });

  it("tooltip side sticks: right until 65% of the width, left until 55%", async () => {
    const ui = await react("core/tooltip.tsx");
    const keeper = new SideKeeper();
    const width = 400;
    const sides: string[] = [];
    let previous: "left" | "right" | undefined;
    for (const x of [100, 220, 255, 262, 270, 230, 218, 215, 150, 300]) {
      const mine = keeper.pick(x, width);
      sides.push(mine);
      if (ui) {
        previous = ui.chooseTooltipSide(previous, x, 0, width);
        expect(mine).toBe(previous);
      }
    }
    expect(sides).toEqual([
      "right",
      "right",
      "right",
      "left",
      "left",
      "left",
      "right",
      "right",
      "right",
      "left",
    ]);
  });
});
