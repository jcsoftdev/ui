// Golden parity: the ported math must agree with the React kit's. The React modules are imported by
// path at runtime, never statically, so ui-elements does not depend on packages/ui.
import { describe, expect, it } from "vitest";
import { computeLayout, type LayoutInput } from "../src/internal/e17-layout.ts";

const react = async (rel: string) => {
  const url = new URL(`../../ui/src/charts/core/${rel}`, import.meta.url).href;
  return import(/* @vite-ignore */ url);
};

const round = <T>(value: T): T =>
  JSON.parse(
    JSON.stringify(value, (_k, v) => (typeof v === "number" ? Math.round(v * 1e6) / 1e6 : v)),
  );

describe("e17 layout parity with the React kit", () => {
  it("cartesian layouts agree (bars, stacked, two axes, horizontal)", async () => {
    const theirs = await react("cartesian/layout.ts");
    const categories = ["Mon", "Tue", "Wed", "Thu", "Fri"];
    const series = (extra = {}) => [
      {
        id: "a",
        name: "A",
        data: [10, 22, 14, 30, 18],
        type: "bar",
        axis: "left",
        color: "var(--c1)",
        ...extra,
      },
      {
        id: "b",
        name: "B",
        data: [4, 9, 6, 12, 7],
        type: "line",
        axis: "right",
        color: "var(--c2)",
      },
    ];
    const base = {
      width: 640,
      height: 320,
      categories,
      orientation: "vertical" as const,
      stack: "none" as const,
      curve: "linear" as const,
      dataLabels: false,
      barRadius: 4,
      xScale: "auto" as const,
      xLabel: (v: unknown) => String(v),
      yAxis: {},
      rightAxis: {},
      annotations: [],
      locale: "es-PE",
    };
    const axisFormat = (format: unknown) => (value: number) => {
      void format;
      return String(value);
    };
    for (const variant of [
      {},
      { orientation: "horizontal" as const },
      { stack: "normal" as const },
    ]) {
      const input = { ...base, ...variant, series: series() } as never;
      const a = computeLayout({ ...(input as LayoutInput), axisFormat } as LayoutInput);
      const b = theirs.computeLayout(input);
      expect(round(a.margin)).toEqual(round(b.margin));
      expect(round(a.positions)).toEqual(round(b.positions));
      expect(round(a.valueScale.domain)).toEqual(round(b.valueScale.domain));
      expect(a.valueTicks.map((t) => t.position.toFixed(3))).toEqual(
        b.valueTicks.map((t: { position: number }) => t.position.toFixed(3)),
      );
    }
  });
});
