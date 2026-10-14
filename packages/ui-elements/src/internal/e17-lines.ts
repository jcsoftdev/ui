// Lines and areas of the cartesian charts: path geometry, data labels, LTTB sampling of dense data
// and the SVG of the series. Imported only by the line, area and combo entries, so a bar chart does
// not carry it.
import { sharedSampleIndices } from "@jcsoftdev/ui-core/chart/downsample";
import { areaPath, linePath } from "@jcsoftdev/ui-core/chart/path";
import { uid } from "./base.js";
import { svg } from "./chart-dom.js";
import type { CartesianLayout, LineContext, LineKit, Point, SeriesGeometry } from "./e17-layout.js";

const labelEvery = (spacing: number) => Math.max(1, Math.ceil(34 / Math.max(1, spacing)));

export const lineKit: LineKit = {
  build(item, ctx, layer) {
    const { positions, curve, scale, count, innerWidth } = ctx;
    const startOf = (index: number) => layer?.y0[index] ?? item.from?.[index] ?? 0;
    const endOf = (index: number) => (layer ? (layer.y1[index] as number) : item.data[index]);
    const out: SeriesGeometry = {
      id: item.id,
      kind: item.kind,
      color: item.color,
      dashed: item.dashed,
      points: [],
      labels: [],
    };
    const points: Array<Point | null> = item.data.map((raw, index) => {
      const value = endOf(index);
      if (raw == null || value == null) return null;
      return { x: positions[index] as number, y: scale.map(value) };
    });
    out.points = points;
    out.line = linePath(points, curve);
    if (item.kind === "area") {
      const baseline = ctx.baseline;
      const bottomEdge = points.map((point, index) => ({
        x: point?.x ?? (positions[index] as number),
        y: layer ? scale.map(startOf(index)) : baseline,
      }));
      out.area = areaPath(points, bottomEdge, curve);
    }
    if (ctx.dataLabels) {
      const spacing = count > 1 ? innerWidth / (count - 1) : innerWidth;
      const every = labelEvery(spacing);
      points.forEach((point, index) => {
        if (!point || index % every !== 0) return;
        out.labels.push({
          key: `${item.id}-${index}`,
          x: point.x,
          y: point.y - 10,
          text: item.format(item.data[index] as number),
          anchor: "middle",
          inside: false,
        });
      });
    }
    return out;
  },

  sample: (data, max) => sharedSampleIndices(data, max),

  paint(plot, defs, layout, options) {
    const { kind, clipId, markers, stacked, gradient } = options;
    const gradientIds = new Map<string, string>();
    if (kind === "area" && gradient)
      for (const item of layout.geometry)
        if (item.kind === "area") {
          const id = uid("area");
          gradientIds.set(item.id, id);
          defs.append(
            svg(
              "linearGradient",
              { id, x1: 0, y1: 0, x2: 0, y2: 1 },
              svg("stop", {
                offset: "0%",
                style: `stop-color:${item.color};stop-opacity:${stacked ? 0.55 : 0.36}`,
              }),
              svg("stop", {
                offset: "100%",
                style: `stop-color:${item.color};stop-opacity:${stacked ? 0.22 : 0.02}`,
              }),
            ),
          );
        }
    const group = svg("g", { "clip-path": `url(#${clipId})` });
    for (const item of layout.geometry)
      if (item.kind === kind) group.append(seriesGroup(item, markers, stacked, gradientIds));
    plot.append(group);
  },
};

function seriesGroup(
  item: SeriesGeometry,
  markersOn: boolean,
  stacked: boolean,
  gradientIds: ReadonlyMap<string, string>,
) {
  const group = svg("g", { "data-series": item.id });
  if (item.area)
    group.append(
      svg("path", {
        d: item.area,
        style: gradientIds.has(item.id)
          ? `fill:url(#${gradientIds.get(item.id)})`
          : `fill:${item.color};fill-opacity:${stacked ? 0.42 : 0.16}`,
      }),
    );
  if (item.line)
    group.append(
      svg("path", {
        d: item.line,
        fill: "none",
        "stroke-width": item.kind === "area" ? 2 : 2.5,
        "stroke-linecap": "round",
        "stroke-linejoin": "round",
        "stroke-dasharray": item.dashed ? "6 6" : undefined,
        style: `stroke:${item.color}`,
      }),
    );
  if (markersOn)
    for (const point of item.points)
      if (point)
        group.append(
          svg("circle", {
            cx: point.x,
            cy: point.y,
            r: 3.25,
            "stroke-width": 2,
            style: `fill:var(--surface);stroke:${item.color}`,
          }),
        );
  return group;
}

export type { CartesianLayout };
