// The canvas layer of <ui-bullet-chart>, loaded the first time a chart passes CANVAS_MARKS rows.
import { bulletBands } from "@jcsoftdev/ui-core/chart/bullet";
import { type DrawContext, svg } from "../internal/chart-base.js";
import { colorResolver } from "../internal/e18-canvas-color.js";
import type { BulletItem } from "./bullet-chart.js";

export interface BigParams {
  ctx: DrawContext;
  drawing: Element;
  plot: SVGGElement;
  items: readonly BulletItem[];
  vertical: boolean;
  left: number;
  top: number;
  slot: number;
  thick: number;
  innerWidth: number;
  innerHeight: number;
  bandCount: number;
  color: string;
  toPx: (item: BulletItem, value: number) => number;
  bandFill: (index: number, count: number) => string;
}

/** Paints every row on the canvas; returns the mover of the one focus band. */
export function paintBullet(p: BigParams): (index: number) => SVGElement {
  const { ctx, plot, items, vertical, left, top, slot, thick, innerWidth, innerHeight } = p;
  const { bandCount, toPx } = p;
  const resolve = colorResolver(p.drawing);
  const g = ctx.canvas();
  g.save();
  g.translate(left, top);
  const bands: Path2D[] = Array.from({ length: bandCount }, () => new Path2D());
  const bars = new Path2D();
  const ticks = new Path2D();
  const barThick = Math.max(1, thick * 0.34);
  const bandThick = Math.max(1, thick);
  items.forEach((item, i) => {
    const centre = i * slot + slot / 2;
    for (const band of bulletBands(item.ranges)) {
      const a = toPx(item, band.from);
      const b = toPx(item, band.to);
      const path = bands[band.index] as Path2D;
      if (vertical) path.rect(centre - bandThick / 2, Math.min(a, b), bandThick, Math.abs(a - b));
      else path.rect(Math.min(a, b), centre - bandThick / 2, Math.abs(a - b), bandThick);
    }
    const actual = toPx(item, item.actual);
    if (vertical)
      bars.rect(centre - barThick / 2, actual, barThick, Math.max(1, innerHeight - actual));
    else bars.rect(0, centre - barThick / 2, Math.max(1, actual), barThick);
    if (item.target != null) {
      const target = toPx(item, item.target);
      const half = Math.max(1, thick * 0.36);
      if (vertical) {
        ticks.moveTo(centre - half, target);
        ticks.lineTo(centre + half, target);
      } else {
        ticks.moveTo(target, centre - half);
        ticks.lineTo(target, centre + half);
      }
    }
  });
  bands.forEach((path, index) => {
    g.fillStyle = resolve(p.bandFill(index, bandCount));
    g.fill(path);
  });
  g.fillStyle = resolve(p.color);
  g.fill(bars);
  g.strokeStyle = resolve("var(--ink)");
  g.lineWidth = Math.max(1, Math.min(3, thick * 0.3));
  g.stroke(ticks);
  g.restore();

  // One row-shaped band, moved to the mark that has focus or hover.
  const bandNode = svg("rect", { rx: 4, "data-band": "", style: "fill:var(--chart-grid)" });
  plot.prepend(svg("g", { "data-row": "", "aria-hidden": "true" }, bandNode));
  return (i) => {
    const size = Math.max(2, slot);
    const start = i * slot - (size - slot) / 2;
    bandNode.setAttribute("x", String(vertical ? start : 0));
    bandNode.setAttribute("y", String(vertical ? 0 : start));
    bandNode.setAttribute("width", String(vertical ? size : innerWidth));
    bandNode.setAttribute("height", String(vertical ? innerHeight : size));
    return bandNode;
  };
}
