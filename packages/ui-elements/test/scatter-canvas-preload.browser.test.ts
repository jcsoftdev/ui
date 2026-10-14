import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { defineScatterChart } from "../src/scatter-chart/scatter-chart.ts";
import { frame, wait } from "./setup.ts";

beforeAll(() => defineScatterChart());
afterEach(() => {
  document.body.innerHTML = "";
});

const SERIES = [
  {
    id: "a",
    name: "A",
    points: Array.from({ length: 200 }, (_, i) => ({ x: i, y: (i * 7) % 50 })),
  },
];
const mountScatter = async (renderer: string) => {
  const el = document.createElement("ui-scatter-chart") as any;
  el.setAttribute("height", "200");
  if (renderer) el.setAttribute("renderer", renderer);
  el.series = SERIES;
  const wrap = document.createElement("div");
  wrap.style.width = "400px";
  wrap.append(el);
  document.body.append(wrap);
  for (let i = 0; i < 4; i++) await frame();
  await wait(300);
  return el;
};
const canvasFetched = () =>
  performance.getEntriesByType("resource").some((entry) => entry.name.includes("chart-canvas"));

describe("scatter canvas preload", () => {
  it("never fetches the canvas chunk for an SVG scatter", async () => {
    const el = await mountScatter("");
    expect(el.querySelector("svg circle")).not.toBeNull();
    expect(canvasFetched()).toBe(false);
  });

  it("draws a canvas scatter once on first paint", async () => {
    const draw = vi.spyOn(
      Object.getPrototypeOf(customElements.get("ui-scatter-chart")?.prototype),
      "draw",
    );
    const el = await mountScatter("canvas");
    expect(el.querySelector("canvas")).not.toBeNull();
    const first = draw.mock.calls.filter(([context]) => !(context as any).transient);
    expect(first).toHaveLength(1);
    expect(canvasFetched()).toBe(true);
    draw.mockRestore();
  });
});
