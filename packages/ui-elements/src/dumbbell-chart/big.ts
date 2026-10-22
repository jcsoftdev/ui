// The canvas layer of <ui-dumbbell-chart>, loaded the first time a chart passes CANVAS_MARKS rows.
import type { linearScale } from "@jcsoftdev/ui-core/chart/scale";
import { type DrawContext, svg } from "../internal/chart-base.js";
import { colorResolver } from "../internal/e18-canvas-color.js";
import { fitLabel, text } from "../internal/e18-plot.js";
import type { DumbbellMeasure, Row } from "./dumbbell-chart.js";

export interface BigParams {
  ctx: DrawContext;
  drawing: Element;
  plot: SVGGElement;
  rows: Row[];
  measures: ReadonlyArray<Required<DumbbellMeasure>>;
  vertical: boolean;
  left: number;
  top: number;
  column: number;
  rowHeight: number;
  along: number;
  innerWidth: number;
  innerHeight: number;
  scale: ReturnType<typeof linearScale>;
  labelsFit: boolean;
  labelSkip: number;
}

/** Paints every row on the canvas; returns the mover of the one focus band. */
export function paintDumbbell(p: BigParams): (index: number) => SVGElement {
  const { ctx, plot, rows, measures, vertical, left, top, column, rowHeight, along } = p;
  const { innerWidth, innerHeight, scale, labelsFit, labelSkip } = p;
  const resolve = colorResolver(p.drawing);
  const g = ctx.canvas();
  g.save();
  g.translate(left, top);
  const radius = Math.max(0.75, Math.min(6, (vertical ? column : rowHeight) / 2));
  const pointAt = (row: Row, index: number, i: number): [number, number] => {
    const cross = (vertical ? column : rowHeight) * i + (vertical ? column : rowHeight) / 2;
    const at = scale.map(row.values[index] as number);
    return vertical ? [cross, at] : [at, cross];
  };
  g.lineCap = "round";
  g.lineWidth = Math.max(1, Math.min(4, along * 0.4));
  g.strokeStyle = resolve("var(--line-strong)");
  g.beginPath();
  rows.forEach((row, i) => {
    const [x0, y0] = pointAt(row, 0, i);
    const [x1, y1] = pointAt(row, row.values.length - 1, i);
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
  });
  g.stroke();
  for (const [index, measure] of measures.entries()) {
    g.fillStyle = resolve(measure.color);
    g.beginPath();
    rows.forEach((row, i) => {
      if (row.values[index] === undefined) return;
      const [x, y] = pointAt(row, index, i);
      if (radius < 2) g.rect(x - radius, y - radius, radius * 2, radius * 2);
      else {
        g.moveTo(x + radius, y);
        g.arc(x, y, radius, 0, Math.PI * 2);
      }
    });
    g.fill();
  }
  g.restore();

  if (!vertical && labelsFit) {
    const names = svg("g", { "aria-hidden": "true" });
    for (let i = 0; i < rows.length; i += labelSkip)
      names.append(
        text(
          fitLabel((rows[i] as Row).label, left - 14),
          { x: -12, y: i * rowHeight + rowHeight / 2, dy: "0.34em", "text-anchor": "end" },
          "fill:var(--ink-2);font-size:12px;font-weight:600",
        ),
      );
    plot.append(names);
  }

  // One row-shaped band, moved to the mark that has focus or hover.
  const bandNode = svg("rect", { rx: 4, "data-band": "", style: "fill:var(--chart-grid)" });
  plot.prepend(svg("g", { "data-row": "", "aria-hidden": "true" }, bandNode));
  return (i) => {
    const thick = Math.max(2, vertical ? column : rowHeight);
    bandNode.setAttribute("x", String(vertical ? i * column : 0));
    bandNode.setAttribute("y", String(vertical ? 0 : i * rowHeight - (thick - rowHeight) / 2));
    bandNode.setAttribute("width", String(vertical ? thick : innerWidth));
    bandNode.setAttribute("height", String(vertical ? innerHeight : thick));
    return bandNode;
  };
}
