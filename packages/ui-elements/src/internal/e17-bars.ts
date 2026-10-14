// Columns of the cartesian charts: slot planning for grouped and stacked bars, bar geometry with
// its data labels, and the SVG of the bars. Imported only by the bar and combo entries, so a line or
// area chart does not carry it.
import { estimateTextWidth } from "@jcsoftdev/ui-core/chart/axis";
import { type BarEnd, barPath } from "@jcsoftdev/ui-core/chart/path";
import type { StackLayer } from "@jcsoftdev/ui-core/chart/stack";
import { svg } from "./chart-dom.js";
import {
  type BarGeometry,
  type BarKit,
  type BarPlan,
  type CartesianLayout,
  isStackable,
  type ResolvedSeries,
  type SeriesGeometry,
} from "./e17-layout.js";

const clamp = (value: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, value));

export const barKit: BarKit = (series, stack, layers): BarPlan => {
  const columns = series.filter((item) => item.kind === "column");
  const slotKeyOf = (item: ResolvedSeries) =>
    isStackable(item, stack) ? `g:${item.axis}:${item.stackGroup ?? ""}` : `s:${item.id}`;
  const slotKeys: string[] = [];
  for (const item of columns) {
    const key = slotKeyOf(item);
    if (!slotKeys.includes(key)) slotKeys.push(key);
  }
  const anyStacked = columns.some((item) => isStackable(item, stack));
  const outer = new Map<string, { up?: string; down?: string }>();
  for (const item of columns) {
    const layer = layers.get(item.id) as StackLayer | undefined;
    if (!layer) continue;
    const slotKey = slotKeyOf(item);
    layer.y1.forEach((end, index) => {
      const start = layer.y0[index] as number;
      if (end === start) return;
      const entry = outer.get(`${slotKey}:${index}`) ?? {};
      if (end > start) entry.up = item.id;
      else entry.down = item.id;
      outer.set(`${slotKey}:${index}`, entry);
    });
  }

  return {
    multi: slotKeys.length > 1,
    build(item, ctx) {
      const { horizontal, band, bandwidth, dataLabels, innerHeight } = ctx;
      const groupCount = Math.max(1, slotKeys.length);
      const gap = groupCount > 1 ? clamp(bandwidth * 0.08, 2, 6) : 0;
      const barThickness =
        groupCount === 1
          ? Math.min(bandwidth, anyStacked ? 64 : 48)
          : Math.min((bandwidth - gap * (groupCount - 1)) / groupCount, 48);
      const groupWidth = barThickness * groupCount + gap * (groupCount - 1);
      const scale = ctx.scaleOf(item.axis);
      const layer = layers.get(item.id);
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
      const slotKey = slotKeyOf(item);
      const slot = slotKeys.indexOf(slotKey);
      const stacked = isStackable(item, stack);
      const floating = item.from != null;
      const pixelDir = (horizontal ? 1 : -1) * (ctx.reversedOf(item.axis) ? -1 : 1);
      const bars: BarGeometry[] = [];
      const radius = Math.min(ctx.barRadius, barThickness / 2);
      item.data.forEach((raw, index) => {
        if (raw == null || (floating && item.from?.[index] == null)) {
          out.points.push(null);
          return;
        }
        const startValue = startOf(index);
        const endValue = endOf(index) as number;
        const v0 = scale.map(startValue);
        const v1 = scale.map(endValue);
        const valueDown = endValue < startValue;
        const dir = (valueDown ? -1 : 1) * pixelDir;
        const negative = horizontal ? dir < 0 : dir > 0;
        const along =
          band.start(index) + (bandwidth - groupWidth) / 2 + slot * (barThickness + gap);
        const isOuter =
          !stacked || outer.get(`${slotKey}:${index}`)?.[valueDown ? "down" : "up"] === item.id;
        const inset = stacked && startValue !== 0 ? 1.5 : 0;
        let length = Math.abs(v1 - v0);
        if (raw !== 0 && length < 1) length = 1;
        let lo = dir > 0 ? v0 : v0 - length;
        if (dir > 0) lo += inset;
        length = Math.max(0, length - inset);
        let end: BarEnd = "none";
        if (floating) end = "all";
        else if (isOuter)
          end = horizontal ? (dir > 0 ? "right" : "left") : dir > 0 ? "bottom" : "top";
        const color = item.pointColors?.[index];
        const key = `${item.id}-${index}`;
        if (horizontal) {
          bars.push({
            key,
            index,
            x: lo,
            y: along,
            width: length,
            height: barThickness,
            negative,
            color,
            d: barPath(lo, along, length, barThickness, radius, end),
          });
          out.points.push({ x: dir > 0 ? lo + length : lo, y: along + barThickness / 2 });
        } else {
          bars.push({
            key,
            index,
            x: along,
            y: lo,
            width: barThickness,
            height: length,
            negative,
            color,
            d: barPath(along, lo, barThickness, length, radius, end),
          });
          out.points.push({ x: along + barThickness / 2, y: dir > 0 ? lo + length : lo });
        }
      });
      out.bars = bars;
      if (!dataLabels) return out;
      for (const bar of bars) {
        const text = item.format(item.data[bar.index] as number);
        if (stacked) {
          const room = horizontal ? bar.width : bar.height;
          const fits = horizontal
            ? room >= estimateTextWidth(text, 10.5) + 8 && bar.height >= 14
            : room >= 16 && bar.width >= estimateTextWidth(text, 10.5) + 4;
          if (!fits) continue;
          out.labels.push({
            key: bar.key,
            x: bar.x + bar.width / 2,
            y: bar.y + bar.height / 2 + 3.5,
            text,
            anchor: "middle",
            inside: true,
          });
        } else if (horizontal) {
          out.labels.push({
            key: bar.key,
            x: bar.negative ? bar.x - 6 : bar.x + bar.width + 6,
            y: bar.y + bar.height / 2 + 3.5,
            text,
            anchor: bar.negative ? "end" : "start",
            inside: false,
          });
        } else {
          if (bar.width + gap < estimateTextWidth(text, 10.5) && groupCount > 1) continue;
          const outside = bar.negative ? bar.y + bar.height + 13 : bar.y - 6;
          const inside = bar.negative ? outside > innerHeight - 2 : outside < 8;
          out.labels.push({
            key: bar.key,
            x: bar.x + bar.width / 2,
            y: inside ? (bar.negative ? bar.y + bar.height - 6 : bar.y + 14) : outside,
            text,
            anchor: "middle",
            inside: inside && bar.height >= 18,
          });
        }
      }
      return out;
    },
  };
};

/** Above this many bars in a series one merged path replaces one element per bar. */
const MERGE_ABOVE = 1500;

/** Draws every column series into `plot`; returns the bar paths (for the entry animation). */
export function drawBars(plot: SVGGElement, layout: CartesianLayout): SVGElement[] {
  const horizontal = layout.horizontal;
  const bars: SVGElement[] = [];
  for (const item of layout.geometry) {
    if (item.kind !== "column") continue;
    const group = svg("g", { "data-series": item.id });
    const list = item.bars ?? [];
    if (list.length > MERGE_ABOVE) {
      // Dense data: bars are hairlines, so one path per series (and per color) is what the eye gets.
      const byColor = new Map<string, string[]>();
      for (const bar of list) {
        const color = bar.color ?? item.color;
        const parts = byColor.get(color);
        if (parts) parts.push(bar.d);
        else byColor.set(color, [bar.d]);
      }
      for (const [color, parts] of byColor)
        group.append(
          svg("path", {
            d: parts.join(""),
            style: `fill:${color}${item.dashed ? ";fill-opacity:.35" : ""}`,
          }),
        );
      plot.append(group);
      continue;
    }
    for (const bar of list) {
      const path = svg("path", {
        d: bar.d,
        "data-bar": bar.index,
        style: `fill:${bar.color ?? item.color};${item.dashed ? "fill-opacity:.35;" : ""}transform-box:fill-box;transform-origin:${
          horizontal
            ? bar.negative
              ? "right center"
              : "left center"
            : bar.negative
              ? "center top"
              : "center bottom"
        }`,
      });
      bars.push(path);
      group.append(path);
    }
    plot.append(group);
  }
  return bars;
}
