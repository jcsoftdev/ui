import { funnelStages } from "@jcsoftdev/ui-core/chart/funnel";
import { adoptStyles, type DefineOptions, defineElement, rootOf } from "../internal/base.js";
import {
  CHART_ATTRIBUTES,
  CHART_EVENT,
  ChartElement,
  type ChartLabels,
  type DrawContext,
  type DrawResult,
  type HoverInfo,
  svg,
  type TooltipRow,
} from "../internal/chart-base.js";
import { cachedJson, numberAttr, percentText } from "../internal/e21b-flow.js";
import css from "./funnel-chart.css.js";

export interface FunnelDatum {
  id: string;
  name: string;
  value: number;
  /** CSS color; defaults to the palette (or the accent ramp). */
  color?: string;
}

/** Visible strings of the funnel chart (English defaults). */
export interface FunnelLabels {
  category: string;
  value: string;
  share: string;
  /** Tooltip and table header of the step-to-step conversion. */
  conversion: string;
  /** `{count}` stages, `{first}` and `{last}` values, `{rate}` overall conversion. */
  summary: string;
}

const DEFAULTS: FunnelLabels = {
  category: "Stage",
  value: "Value",
  share: "Share",
  conversion: "Conversion",
  summary: "{count} stages, {first} to {last} ({rate} overall)",
};
const EASE = "cubic-bezier(.22,1,.36,1)";
const PAD = 4;
const PILL = 44;

const truncate = (text: string, max: number): string =>
  text.length <= max ? text : `${text.slice(0, Math.max(1, max - 1)).trimEnd()}…`;

interface Shape {
  color: string;
  opacity: number;
  cx: number;
  cy: number;
  joint: { x: number; y: number } | null;
}

/**
 * `<ui-funnel-chart>`: funnel and pyramid on the chart base. Stage widths follow the value, the
 * outline stays continuous between stages and the conversion rate sits on each joint. Vertical or
 * horizontal; labels shrink and truncate in narrow containers and the tooltip carries the detail.
 * Hovering anywhere along a stage's span (gaps included) shows that stage, so the tooltip never
 * blinks between stages. Arrow keys walk the stages, Enter or a tap pins one, Shift+Enter drills.
 *
 * Attributes: `stages` (JSON `[{ id, name, value, color? }]`), `variant` (`funnel`, `pyramid`),
 * `orientation` (`vertical`, `horizontal`), `tapered="off"`, `neck` (0-1, default 0.72),
 * `show-conversion="off"`, `tone` (`categorical`, `accent`), `gap` (px, default 4), plus the chart
 * attributes. Height defaults to 360 (vertical) or 280 (horizontal). Properties: `stages`,
 * `labels` (`category`, `value`, `share`, `conversion`, `summary`). Stages are legend items:
 * `ui-chart-legend` toggles them.
 */
export class UiFunnelChart extends ChartElement {
  static override observedAttributes = [
    ...CHART_ATTRIBUTES,
    "stages",
    "variant",
    "orientation",
    "tapered",
    "neck",
    "show-conversion",
    "tone",
    "gap",
  ];
  override labels: Partial<ChartLabels & FunnelLabels> = {};
  #stages: readonly FunnelDatum[] | undefined;
  readonly #json = cachedJson(this);
  #view: { fills: Element[][] } | undefined;

  constructor() {
    super();
    this.addEventListener(CHART_EVENT.hover, (event) =>
      this.#light((event as CustomEvent<HoverInfo | null>).detail?.index ?? null),
    );
  }

  get stages(): readonly FunnelDatum[] {
    return this.#stages ?? this.#json<FunnelDatum[]>("stages") ?? [];
  }
  set stages(value: readonly FunnelDatum[]) {
    this.#stages = value;
    this.requestDraw();
  }

  override connectedCallback(): void {
    this.dataset.ui = "funnel-chart";
    adoptStyles(rootOf(this), css);
    if (!this.hasAttribute("height") && !this.hasAttribute("aspect-ratio"))
      this.setAttribute(
        "height",
        this.getAttribute("orientation") === "horizontal" ? "280" : "360",
      );
    super.connectedCallback();
  }

  protected override isEmpty(): boolean {
    const stages = this.stages;
    return stages.length === 0 || stages.every((stage) => !(stage.value > 0));
  }

  /** Dims every stage but `index` (all clear for `null`). */
  #light(index: number | null): void {
    const view = this.#view;
    if (!view) return;
    view.fills.forEach((els, i) => {
      for (const el of els) el.toggleAttribute("data-dim", index !== null && index !== i);
    });
  }

  protected draw({
    svg: root,
    width,
    height,
    format,
    color,
    animate,
    locale,
    hover,
  }: DrawContext): DrawResult {
    const text = { ...DEFAULTS, ...this.labels };
    const all = this.stages;
    const stages = all.filter((stage) => !this.isHidden(stage.id));
    const vertical = this.getAttribute("orientation") !== "horizontal";
    const pyramid = this.getAttribute("variant") === "pyramid";
    const tapered = this.getAttribute("tapered") !== "off";
    const neck = numberAttr(this, "neck", 0.72);
    const gap = Math.max(0, numberAttr(this, "gap", 4));
    const accent = this.getAttribute("tone") === "accent";
    const showConversion = this.getAttribute("show-conversion") !== "off";
    const pct = (value: number) => percentText(value, locale, 1, false);

    const side = vertical ? Math.round(Math.min(200, Math.max(96, width * 0.36))) : 0;
    const head = vertical ? 0 : 42;
    const area = {
      x: PAD,
      y: head + PAD,
      w: vertical ? Math.max(60, width - side - 12 - PAD * 2) : width - PAD * 2,
      h: height - head - PAD * 2,
    };
    const length = vertical ? area.h : area.w;
    const layout = funnelStages(
      stages.map((stage) => stage.value),
      {
        length,
        thickness: vertical ? area.w : area.h,
        gap,
        variant: pyramid ? "pyramid" : "funnel",
        tapered,
        neck,
      },
    );
    const crossCenter = vertical ? area.x + area.w / 2 : area.y + area.h / 2;
    const place = (t: number, c: number): [number, number] =>
      vertical
        ? [crossCenter + c, area.y + (pyramid ? length - t : t)]
        : [area.x + t, crossCenter + c];
    const r2 = (n: number) => Math.round(n * 100) / 100;
    const count = stages.length;

    const shapes: Shape[] = layout.map((stage, i) => {
      const datum = stages[i] as FunnelDatum;
      const [mx, my] = place((stage.from + stage.to) / 2, 0);
      const [jx, jy] = place(stage.from - gap / 2, 0);
      return {
        color: accent
          ? (datum.color ?? "var(--accent-word)")
          : color(all.indexOf(datum), datum.color),
        opacity: accent && count > 1 ? 1 - (0.55 * i) / (count - 1) : 1,
        cx: mx,
        cy: my,
        joint: i > 0 ? { x: jx, y: jy } : null,
      };
    });

    const stageSize = layout[0] ? layout[0].to - layout[0].from : 0;
    const polygons = layout.map((stage, i) => {
      const shape = shapes[i] as Shape;
      const corners = [
        place(stage.from, -stage.widthFrom / 2),
        place(stage.from, stage.widthFrom / 2),
        place(stage.to, stage.widthTo / 2),
        place(stage.to, -stage.widthTo / 2),
      ];
      return svg("polygon", {
        points: corners.map(([x, y]) => `${r2(x)},${r2(y)}`).join(" "),
        "data-stage": "",
        "data-series": (stages[i] as FunnelDatum).id,
        "stroke-width": 2,
        "stroke-linejoin": "round",
        style: `fill:${shape.color};stroke:${shape.color};fill-opacity:${shape.opacity};stroke-opacity:${shape.opacity}`,
      });
    });
    root.append(...polygons);

    const labelEls: Element[][] = stages.map(() => []);
    const fades: Element[] = [];
    stages.forEach((datum, i) => {
      const shape = shapes[i] as Shape;
      const stage = layout[i] as (typeof layout)[number];
      let group: SVGGElement;
      if (vertical) {
        const x = width - side;
        const max = Math.max(5, Math.floor((side - 4) / 6.2));
        group = svg(
          "g",
          { "data-fade": "", "data-label": "", "aria-hidden": "true" },
          svg("line", {
            x1: Math.min(x - 8, shape.cx + stage.widthFrom / 2 + 6),
            x2: x - 6,
            y1: shape.cy,
            y2: shape.cy,
            "stroke-width": 1,
            "stroke-dasharray": "2 3",
            style: "stroke:var(--ink-3);stroke-opacity:.5",
          }),
          svg(
            "text",
            { x, y: shape.cy - 3, style: "fill:var(--ink-2);font-size:11px;font-weight:500" },
            truncate(datum.name, max),
          ),
          svg(
            "text",
            { x, y: shape.cy + 12, style: "font-size:12px" },
            svg(
              "tspan",
              { style: "fill:var(--ink);font-weight:700;font-variant-numeric:tabular-nums" },
              format(datum.value),
            ),
            svg(
              "tspan",
              { style: "fill:var(--ink-3);font-size:11px;font-variant-numeric:tabular-nums" },
              ` ${percentText(stage.ofFirst, locale, 0)}`,
            ),
          ),
        );
      } else {
        const max = Math.max(3, Math.floor((stageSize - 6) / 6.2));
        group = svg(
          "g",
          { "data-fade": "", "data-label": "", "aria-hidden": "true" },
          svg(
            "text",
            {
              x: shape.cx,
              y: 16,
              "text-anchor": "middle",
              style: "fill:var(--ink-2);font-size:11px;font-weight:500",
            },
            truncate(datum.name, max),
          ),
          svg(
            "text",
            {
              x: shape.cx,
              y: 32,
              "text-anchor": "middle",
              style:
                "fill:var(--ink);font-size:12px;font-weight:700;font-variant-numeric:tabular-nums",
            },
            truncate(format(datum.value), max + 2),
          ),
        );
      }
      root.append(group);
      fades.push(group);
      labelEls[i]?.push(group);
    });

    if (showConversion)
      layout.forEach((stage, i) => {
        const joint = (shapes[i] as Shape).joint;
        if (!joint || stage.conversion == null) return;
        if (vertical && stageSize < 30) return;
        const pill = svg(
          "g",
          { "data-fade": "", "aria-hidden": "true" },
          svg("rect", {
            x: joint.x - PILL / 2,
            y: joint.y - 9,
            width: PILL,
            height: 18,
            rx: 9,
            "stroke-width": 1,
            style: "fill:var(--surface);stroke:var(--line)",
          }),
          svg(
            "text",
            {
              x: joint.x,
              y: joint.y + 4,
              "text-anchor": "middle",
              style:
                "fill:var(--ink-2);font-size:10.5px;font-weight:700;font-variant-numeric:tabular-nums",
            },
            percentText(stage.conversion, locale, 0),
          ),
        );
        root.append(pill);
        fades.push(pill);
      });

    if (animate) {
      for (const [i, node] of polygons.entries())
        node.animate(
          [
            { opacity: 0, transform: vertical ? "translateY(-10px)" : "translateX(-10px)" },
            { opacity: 1, transform: "translate(0,0)" },
          ],
          { duration: 600, delay: i * 90, easing: EASE, fill: "backwards" },
        );
      for (const node of fades)
        node.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 400,
          delay: 350,
          easing: "ease-out",
          fill: "backwards",
        });
    }

    this.#view = { fills: polygons.map((p, i) => [p, ...(labelEls[i] ?? [])]) };
    this.#light(hover);

    const rowsOf = (i: number): TooltipRow[] => {
      const stage = layout[i] as (typeof layout)[number];
      const tone = (shapes[i] as Shape).color;
      return [
        {
          id: "value",
          name: text.value,
          value: format((stages[i] as FunnelDatum).value),
          color: tone,
        },
        { id: "share", name: text.share, value: pct(stage.ofFirst), color: tone },
        ...(stage.conversion != null
          ? [{ id: "conversion", name: text.conversion, value: pct(stage.conversion), color: tone }]
          : []),
      ];
    };
    const last = layout[count - 1];
    const first = stages[0];
    return {
      summary:
        last && first
          ? text.summary
              .replace("{count}", `${count}`)
              .replace("{first}", format(first.value))
              .replace("{last}", format((stages[count - 1] as FunnelDatum).value))
              .replace("{rate}", pct(last.ofFirst))
          : undefined,
      marks: polygons.map((el, i) => ({
        el,
        label: `${(stages[i] as FunnelDatum).name}: ${format((stages[i] as FunnelDatum).value)}, ${pct((layout[i] as (typeof layout)[number]).ofFirst)}${
          (layout[i] as (typeof layout)[number]).conversion != null
            ? `, ${text.conversion} ${pct((layout[i] as (typeof layout)[number]).conversion as number)}`
            : ""
        }`,
      })),
      maxHoverRows: 3,
      // Along the main axis the pointer belongs to the stage whose span holds it, or to the nearest
      // one in a gap: moving between stages never passes through "nothing".
      hit: (x, y) => {
        if (count === 0 || x < 0 || y < 0 || x > width || y > height) return -1;
        const raw = vertical ? y - area.y : x - area.x;
        const t = vertical && pyramid ? length - raw : raw;
        let best = 0;
        let distance = Number.POSITIVE_INFINITY;
        for (const stage of layout) {
          const d = t < stage.from ? stage.from - t : t > stage.to ? t - stage.to : 0;
          if (d < distance) {
            distance = d;
            best = stage.index;
          }
        }
        return best;
      },
      hover: (i) => {
        const datum = stages[i];
        const shape = shapes[i];
        return datum && shape
          ? { title: datum.name, rows: rowsOf(i), x: shape.cx, y: shape.cy }
          : null;
      },
      snapshot: () => ({
        title: this.getAttribute("label") ?? text.category,
        categoryHeader: text.category,
        categories: stages.map((stage) => stage.name),
        series: [
          {
            id: "value",
            name: text.value,
            color: color(0),
            values: stages.map((stage) => stage.value),
            text: stages.map((stage) => format(stage.value)),
          },
          {
            id: "share",
            name: text.share,
            color: color(0),
            values: layout.map((stage) => stage.ofFirst),
            text: layout.map((stage) => pct(stage.ofFirst)),
          },
          {
            id: "conversion",
            name: text.conversion,
            color: color(0),
            values: layout.map((stage) => stage.conversion),
            text: layout.map((stage) => (stage.conversion == null ? "" : pct(stage.conversion))),
          },
        ],
        legend: all.map((stage, i) => ({
          id: stage.id,
          name: stage.name,
          color: accent ? (stage.color ?? "var(--accent-word)") : color(i, stage.color),
        })),
      }),
    };
  }
}

/** Registers `<ui-funnel-chart>` (or `<prefix>-funnel-chart`) and returns the tag. */
export function defineFunnelChart(options?: DefineOptions): string {
  return defineElement("funnel-chart", UiFunnelChart, options);
}
