// A minimal chart on the shared base, standing in for the real ones (bar, line...) in tests.
import { bandScale } from "@jcsoftdev/ui-core/chart/scale";
import { defineElement } from "../src/internal/base.ts";
import {
  CHART_ATTRIBUTES,
  ChartElement,
  type DrawContext,
  type DrawResult,
  svg,
} from "../src/internal/chart-base.ts";

export const SALES = [
  { name: "Mon", value: 1200.5 },
  { name: "Tue", value: 800 },
  { name: "Wed", value: 1500 },
  { name: "Thu", value: 400 },
  { name: "Fri", value: 1750 },
  { name: "Sat", value: 900 },
];

export let lastDraw: { animate: boolean; width: number; height: number } | undefined;
export let draws = 0;

class TestBars extends ChartElement {
  static override observedAttributes = [...CHART_ATTRIBUTES];
  data = SALES;

  protected override isEmpty() {
    return this.data.length === 0;
  }

  protected override draw({ svg: root, width, height, format, color, animate }: DrawContext) {
    draws++;
    lastDraw = { animate, width, height };
    const top = Math.max(...this.data.map((d) => d.value));
    const band = bandScale({ count: this.data.length, range: [0, width], paddingInner: 0.2 });
    const marks = this.data.map((d, i) => {
      const h = (d.value / top) * (height - 10);
      root.append(
        svg("rect", {
          x: band.start(i),
          y: height - h,
          width: band.bandwidth,
          height: h,
          "data-series": "sales",
          style: `fill:${color(0)}`,
          "aria-hidden": "true",
        }),
      );
      const el = svg("rect", {
        x: band.start(i) - 4,
        y: 0,
        width: band.step,
        height,
        fill: "transparent",
      });
      root.append(el);
      return { el, label: `${d.name}: ${format(d.value)}` };
    });
    const series = {
      id: "sales",
      name: "Sales",
      color: color(0),
      values: this.data.map((d) => d.value),
      text: this.data.map((d) => format(d.value)),
    };
    const result: DrawResult = {
      summary: `${this.data.length} days, best ${format(top)}`,
      marks,
      snapshot: () => ({
        title: this.getAttribute("label") ?? "Sales",
        categoryHeader: "Day",
        categories: this.data.map((d) => d.name),
        series: [series],
      }),
      hit: (x) => band.indexAt(x),
      hover: (i) => {
        const d = this.data[i];
        return d
          ? {
              title: d.name,
              rows: [{ id: "sales", name: "Sales", value: format(d.value), color: color(0) }],
              x: band.center(i),
              y: height - (d.value / top) * (height - 10),
            }
          : null;
      },
    };
    return result;
  }
}

export const defineTestBars = () => defineElement("test-bars", TestBars);
