// Minimal charts on the shared base, standing in for the real ones (bar, line, scatter...) in tests.
import { bandScale } from "@jcsoftdev/ui-core/chart/scale";
import { defineElement } from "../src/internal/base.ts";
import {
  CHART_ATTRIBUTES,
  ChartElement,
  type DrawContext,
  type DrawResult,
  join,
  svg,
  type VirtualMarks,
} from "../src/internal/chart-base.ts";
import { nearestPoint, nearestX } from "../src/internal/chart-hit.ts";

export const SALES = [
  { name: "Mon", value: 1200.5 },
  { name: "Tue", value: 800 },
  { name: "Wed", value: 1500 },
  { name: "Thu", value: 400 },
  { name: "Fri", value: 1750 },
  { name: "Sat", value: 900 },
];

export const log = {
  phases: [] as string[],
  hadPrevious: [] as boolean[],
  animate: [] as boolean[],
  snapshots: 0,
  setups: 0,
  teardowns: 0,
  signals: [] as AbortSignal[],
  hits: [] as Array<{ x: number; y: number; radius: number; target: string | undefined }>,
};
export const resetLog = () => {
  log.phases = [];
  log.hadPrevious = [];
  log.animate = [];
  log.snapshots = 0;
  log.setups = 0;
  log.teardowns = 0;
  log.signals = [];
  log.hits = [];
};
export const lastDraw = () => ({ animate: log.animate.at(-1) });

/** `rows="N"` makes N rows; `virtual` exposes them as virtual marks; `canvas` draws on a canvas layer. */
class TestBars extends ChartElement {
  static override observedAttributes = [...CHART_ATTRIBUTES, "rows", "virtual", "canvas"];
  data = SALES;
  /** Marks `[data-i]` are tagged so hit() can use the element under the pointer. */
  protected override isEmpty() {
    return this.data.length === 0;
  }

  protected override setup(_svg: SVGSVGElement, signal: AbortSignal) {
    log.setups++;
    log.signals.push(signal);
  }
  protected override teardown() {
    log.teardowns++;
  }

  get rows() {
    const n = Number(this.getAttribute("rows"));
    return n > 0
      ? Array.from({ length: n }, (_, i) => ({ name: `R${i}`, value: 100 + (i % 50) }))
      : this.data;
  }

  protected override draw({
    svg: root,
    width,
    height,
    format,
    color,
    animate,
    phase,
    previous,
    canvas,
  }: DrawContext) {
    log.phases.push(phase);
    log.hadPrevious.push(!!previous);
    log.animate.push(animate);
    const rows = this.rows;
    const top = Math.max(...rows.map((d) => d.value));
    const band = bandScale({ count: rows.length, range: [0, width], paddingInner: 0.2 });
    const series = {
      id: "sales",
      name: "Sales",
      color: color(0),
      values: rows.map((d) => d.value),
      text: rows.map((d) => format(d.value)),
    };
    const base: DrawResult = {
      summary: `${rows.length} days, best ${format(top)}`,
      snapshot: () => {
        log.snapshots++;
        return {
          title: this.getAttribute("label") ?? "Sales",
          categoryHeader: "Day",
          categories: rows.map((d) => d.name),
          series: [series],
        };
      },
      hit: (x, y, target, radius) => {
        log.hits.push({ x, y, radius, target: target?.localName });
        return x < 0 || y < 0 || x > width || y > height ? -1 : band.indexAt(x);
      },
      hover: (i) => {
        const d = rows[i];
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
    if (this.hasAttribute("canvas")) {
      const g = canvas();
      g.fillStyle = color(0);
      rows.forEach((d, i) => {
        const h = (d.value / top) * (height - 10);
        g.fillRect(band.start(i), height - h, Math.max(1, band.bandwidth), h);
      });
    }
    if (this.hasAttribute("virtual")) {
      const marks: VirtualMarks = {
        count: rows.length,
        label: (i) => `${rows[i]?.name}: ${format(rows[i]?.value ?? 0)}`,
        element: (i) => root.querySelector<SVGElement>(`[data-i="${i}"]`),
      };
      return { ...base, marks };
    }
    const marks = rows.map((d, i) => {
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
        "data-i": i,
      });
      root.append(el);
      return { el, label: `${d.name}: ${format(d.value)}` };
    });
    return { ...base, marks };
  }
}

/** A 2px line through six points: hit() snaps to the nearest point within `radius`. */
class TestLine extends ChartElement {
  static override observedAttributes = [...CHART_ATTRIBUTES];
  protected override draw({ svg: root, width, height, format, color }: DrawContext): DrawResult {
    const points = SALES.map((d, i) => ({
      x: 20 + (i * (width - 40)) / (SALES.length - 1),
      y: height - 20 - (d.value / 1750) * (height - 40),
    }));
    root.append(
      svg("polyline", {
        points: points.map((p) => `${p.x},${p.y}`).join(" "),
        fill: "none",
        "stroke-width": 2,
        style: `stroke:${color(0)}`,
      }),
    );
    const marks = SALES.map((d, i) => {
      const el = svg("circle", { cx: points[i]?.x, cy: points[i]?.y, r: 3, "data-i": i });
      root.append(el);
      return { el, label: `${d.name}: ${format(d.value)}` };
    });
    return {
      marks,
      // Pixel-exact on a mouse (radius 12), generous for a finger (the --touch-target token).
      hit: (x, y, _target, radius) => nearestPoint(points, x, y, radius),
      hover: (i) => {
        const d = SALES[i];
        const p = points[i];
        return d && p
          ? {
              title: d.name,
              rows: [{ id: "s", name: "Sales", value: format(d.value), color: color(0) }],
              x: p.x,
              y: p.y,
            }
          : null;
      },
    };
  }
}

/** The same chart for column-wise snapping: `nearestX`. */
export const snapColumn = nearestX;

const dots = (retain: boolean) =>
  class extends ChartElement {
    static override observedAttributes = [...CHART_ATTRIBUTES, "n", "seed"];
    static override retain = retain;
    draws = 0;
    protected override draw({ svg: root, width, height, phase }: DrawContext): DrawResult {
      this.draws++;
      const n = Number(this.getAttribute("n") ?? 1000);
      const seed = Number(this.getAttribute("seed") ?? 0);
      const items = Array.from({ length: n }, (_, i) => ({
        id: i,
        v: (i * 7919 + seed * 31) % 1000,
      }));
      const place = (el: SVGCircleElement, d: { v: number }, i: number) => {
        el.setAttribute("cx", `${(i / n) * width}`);
        el.setAttribute("cy", `${height - (d.v / 1000) * height}`);
      };
      if (retain)
        join(
          root,
          items,
          (d) => d.id,
          () => svg("circle", { r: 1.5 }),
          place,
        );
      else
        root.append(
          ...items.map((d, i) => {
            const el = svg("circle", { r: 1.5 });
            place(el, d, i);
            return el;
          }),
        );
      void phase;
      return { marks: { count: n, label: (i) => `Point ${i}` } };
    }
  };

export const defineTestBars = () => defineElement("test-bars", TestBars);
export const defineTestLine = () => defineElement("test-line", TestLine);
export const defineTestDots = () => {
  defineElement("test-dots", dots(true));
  defineElement("test-dots-fresh", dots(false));
};
