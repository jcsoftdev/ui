/**
 * The donut and the pie (`<ui-donut-chart>`, `<ui-pie-chart>`) are one drawing: a ring of slices
 * with rounded corners and a gap, a centre total that follows the hovered slice, optional labels
 * and drill-down. This module holds it; each tag's entry is a thin subclass. Never an element entry.
 */
import { formatPercent, resolveFormat, type ValueFormat } from "@jcsoftdev/ui-core/chart/format";
import { monochromeByValue } from "@jcsoftdev/ui-core/chart/palette";
import {
  angleOf,
  arcPath,
  degToRad,
  fitCenterText,
  normalizeAngle,
  polarPoint,
  sliceAngles,
  spreadLabels,
  TAU,
} from "@jcsoftdev/ui-core/chart/polar";
import { uid } from "./base.js";
import {
  CHART_ATTRIBUTES,
  CHART_EVENT,
  ChartElement,
  type DrawContext,
  type DrawResult,
  type SnapshotSeries,
  svg,
} from "./chart-base.js";
import {
  adoptPolar,
  clamp,
  flagOrText,
  jsonAttr,
  listAttr,
  numberAttr,
  seedHidden,
  Tween,
  text,
  truncate,
} from "./e20-polar.js";

export interface DonutDatum {
  /** Stable identity, used for the legend and for hiding a slice. */
  id: string;
  name: string;
  value: number;
  /** CSS color; defaults to the palette slot of the datum. */
  color?: string;
  /** Overrides the chart `value-format` for this slice. */
  format?: ValueFormat;
  /** Sub-slices: clicking the slice opens them in the same ring (see `drilldown`). */
  children?: readonly DonutDatum[];
}

export interface DonutCrumb {
  id: string;
  name: string;
}

type Fill = "solid" | "gradient" | "pattern";
type Outside = "name" | "percent" | "both";

interface Item {
  datum: DonutDatum;
  color: string;
  format: (value: number) => string;
}

/** Everything the centre readout and the hover content need from the last draw. */
interface View {
  items: readonly Item[];
  visible: readonly number[];
  slices: ReadonlyArray<{ fraction: number; start: number; end: number; mid: number }>;
  sum: number;
  cx: number;
  cy: number;
  inner: number;
  radius: number;
  explode: number;
  width: number;
  height: number;
  semi: boolean;
  showCenter: boolean;
  centerLabel: string;
  centerValue: string | undefined;
  format: (value: number) => string;
  locale: string;
  parts: { value: SVGTextElement; caption: SVGTextElement } | undefined;
}

const EASE = "cubic-bezier(.22,1,.36,1)";
const LABEL_ELBOW = 14;
const LABEL_RUN = 30;
const PATTERNS = 5;
const CHAR_WIDTH = 0.6;
const FILL_RATIO = 0.92;
const BREADCRUMB = '[data-ui="chart-breadcrumb"]';

/**
 * Where a horizontal label sits inside a ring slice, relative to the centre, or null when the text
 * does not fit: its box is projected on the radial and the tangential direction of the slice and
 * must stay within the ring thickness and the arc length at the middle radius.
 */
function fitSliceLabel(
  inner: number,
  radius: number,
  start: number,
  end: number,
  chars: number,
  fontSize: number,
): { x: number; y: number } | null {
  const mid = (start + end) / 2;
  const at = inner <= 0 ? radius * 0.62 : (inner + radius) / 2;
  const thickness = inner <= 0 ? radius * 0.7 : radius - inner;
  const arc = (end - start) * at;
  const width = chars * fontSize * CHAR_WIDTH;
  const height = fontSize * 1.1;
  const rx = Math.sin(mid);
  const ry = -Math.cos(mid);
  const radial = width * Math.abs(rx) + height * Math.abs(ry);
  const tangent = width * Math.abs(ry) + height * Math.abs(rx);
  if (radial > thickness * FILL_RATIO || tangent > arc * FILL_RATIO) return null;
  return { x: at * rx, y: at * ry };
}

/** A texture swatch for one slice: the color with a surface-colored motif on top. */
function pattern(id: string, kind: number, color: string): SVGPatternElement {
  const motif = "fill:var(--surface);fill-opacity:.5";
  const line = "fill:none;stroke:var(--surface);stroke-opacity:.5";
  const which = kind % PATTERNS;
  const node = svg("pattern", {
    id,
    patternUnits: "userSpaceOnUse",
    width: 8,
    height: 8,
    patternTransform: which === 0 || which === 3 ? "rotate(45)" : undefined,
  });
  node.append(svg("rect", { width: 8, height: 8, style: `fill:${color}` }));
  if (which === 0) node.append(svg("rect", { width: 8, height: 3, style: motif }));
  if (which === 1) node.append(svg("circle", { cx: 4, cy: 4, r: 1.6, style: motif }));
  if (which === 2)
    node.append(svg("path", { d: "M0 0H8M0 0V8", "stroke-width": 1.4, style: line }));
  if (which === 3) node.append(svg("rect", { width: 8, height: 1.4, y: 3.3, style: motif }));
  if (which === 4)
    node.append(
      svg("rect", { width: 4, height: 4, style: motif }),
      svg("rect", { x: 4, y: 4, width: 4, height: 4, style: motif }),
    );
  return node;
}

const positive = (value: number): number => (Number.isFinite(value) && value > 0 ? value : 0);
const off = (host: Element, name: string): boolean =>
  host.getAttribute(name) === "off" || host.getAttribute(name) === "false";

/**
 * Donut, pie and semi-donut. Slices have rounded corners and a pixel gap; the one under the pointer
 * (or the keyboard cursor, or the legend item) steps out and the centre shows its value. Optional
 * labels sit on leader lines (with collision avoidance) or inside the ring. A slice with `children`
 * opens them in the same ring on click or Enter, with a path a `ui-chart-breadcrumb` placed inside
 * the chart keeps. Pointer events never reach the slices: the chart hit-tests the resting geometry,
 * which has no gap between slices, so the slice that steps out can never lose the pointer.
 */
export class UiDonutBase extends ChartElement {
  static override observedAttributes = [
    ...CHART_ATTRIBUTES,
    "data",
    "variant",
    "semi",
    "inner-radius",
    "corner-radius",
    "gap",
    "explode",
    "start-angle",
    "monochrome",
    "fill",
    "drilldown",
    "root-label",
    "outside-labels",
    "slice-labels",
    "center-label",
    "center-value",
  ];
  #data: readonly DonutDatum[] | undefined;
  #trail: string[] = [];
  #tween = new Tween();
  #tweenLevel = "";
  #view: View | undefined;
  #lit: string | null = null;
  #crumbs = "";
  #seeded = false;
  readonly #uid = uid("donut");

  constructor() {
    super();
    this.addEventListener(CHART_EVENT.hover, () => this.#paintCenter());
    this.addEventListener(CHART_EVENT.series, (event) => {
      const detail = (event as CustomEvent<{ highlight?: string | null }>).detail;
      if (detail && "highlight" in detail) {
        this.#lit = detail.highlight ?? null;
        this.#paintCenter();
      }
    });
    this.addEventListener(CHART_EVENT.select, (event) => {
      const detail = (event as CustomEvent<{ category: number } | null>).detail;
      const datum = detail ? this.#levelData().data[detail.category] : undefined;
      if (datum?.children?.length && this.drillable) {
        this.#trail = [...this.#trail, datum.id];
        this.select(null);
        this.requestDraw();
      }
    });
    this.addEventListener("select", (event) => {
      const from = event.target as Element | null;
      const id = (event as CustomEvent<{ id?: string }>).detail?.id;
      if (id !== undefined && from?.closest?.(BREADCRUMB) && this.contains(from)) this.goTo(id);
    });
  }

  get data(): readonly DonutDatum[] {
    return this.#data ?? jsonAttr<DonutDatum[]>(this, "data", []);
  }
  set data(value: readonly DonutDatum[]) {
    this.#data = value;
    this.#trail = [];
    this.requestDraw();
  }

  /** Defaults that a subclass (the pie) changes. */
  protected variant(): "donut" | "pie" {
    return this.getAttribute("variant") === "pie" ? "pie" : "donut";
  }
  protected defaultCorner = 6;

  get drillable(): boolean {
    return !off(this, "drilldown") && this.data.some((datum) => datum.children?.length);
  }

  /** The path of the open level, root first: what a `ui-chart-breadcrumb` shows. */
  get crumbs(): readonly DonutCrumb[] {
    return this.#levelData().crumbs;
  }
  /** Goes back to the crumb `id` (the root is `""`). */
  goTo(id: string): void {
    const at = this.crumbs.findIndex((crumb) => crumb.id === id);
    if (at < 0) return;
    this.#trail = this.crumbs.slice(1, at + 1).map((crumb) => crumb.id);
    this.select(null);
    this.requestDraw();
  }

  override connectedCallback(): void {
    this.dataset.ui = this.variant() === "pie" ? "pie-chart" : "donut-chart";
    adoptPolar(this);
    super.connectedCallback();
    if (!this.#seeded) {
      this.#seeded = true;
      seedHidden(this, listAttr(this, "initial-hidden"));
    }
  }

  override disconnectedCallback(): void {
    this.#tween.stop();
    super.disconnectedCallback();
  }

  protected override teardown(): void {
    this.#view = undefined;
  }

  protected override isEmpty(): boolean {
    return this.#levelData().data.every((datum) => !(datum.value > 0));
  }

  /** The datum list of the open level and the path that leads to it. */
  #levelData(): {
    data: readonly DonutDatum[];
    crumbs: DonutCrumb[];
    baseIndex: number;
    override: string | undefined;
  } {
    const crumbs: DonutCrumb[] = [
      { id: "", name: this.getAttribute("root-label") ?? this.getAttribute("label") ?? "" },
    ];
    let current = this.data;
    let baseIndex = -1;
    let override: string | undefined;
    if (this.drillable) {
      const kept: string[] = [];
      for (const id of this.#trail) {
        const index = current.findIndex((datum) => datum.id === id);
        const next = current[index];
        if (!next?.children?.length) break;
        crumbs.push({ id, name: next.name });
        kept.push(id);
        baseIndex = index;
        override = next.color;
        current = next.children;
      }
      this.#trail = kept;
    }
    return { data: current, crumbs, baseIndex, override };
  }

  /** Index of the datum the centre and the legend point at: the details shown, else the legend item. */
  #focus(): number | null {
    const view = this.#view;
    if (!view) return null;
    const info = this.hover;
    if (info) return info.category;
    if (this.#lit) {
      const at = view.items.findIndex((item) => item.datum.id === this.#lit);
      return at >= 0 ? at : null;
    }
    return null;
  }

  #paintCenter(): void {
    const view = this.#view;
    const parts = view?.parts;
    if (!view || !parts) return;
    const focus = this.#focus();
    const item = focus != null ? view.items[focus] : undefined;
    const slice = focus != null ? view.slices[focus] : undefined;
    const main = item ? item.format(item.datum.value) : (view.centerValue ?? view.format(view.sum));
    const caption = item
      ? `${item.datum.name}${slice ? ` · ${formatPercent(slice.fraction, { decimals: 0, locale: view.locale })}` : ""}`
      : view.centerLabel;
    const fit = fitCenterText(view.inner, main.length, caption.length, view.semi);
    const top = view.semi ? view.cy - 6 - fit.block : view.cy - fit.block / 2;
    parts.value.textContent = main;
    parts.value.setAttribute("y", `${top + fit.valueSize * 0.82}`);
    parts.value.style.fontSize = `${fit.valueSize}px`;
    parts.caption.textContent = fit.captionChars > 0 ? truncate(caption, fit.captionChars) : "";
    parts.caption.setAttribute("y", `${top + fit.valueSize + 4 + fit.captionSize * 0.82}`);
    parts.caption.style.fontSize = `${fit.captionSize}px`;
  }

  #syncCrumbs(): void {
    if (!this.drillable) return;
    const json = JSON.stringify(
      this.crumbs.map((crumb, i) => (i === 0 && !crumb.name ? { ...crumb, name: "Chart" } : crumb)),
    );
    if (json === this.#crumbs) return;
    this.#crumbs = json;
    for (const breadcrumb of this.querySelectorAll(BREADCRUMB))
      breadcrumb.setAttribute("items", json);
  }

  /** Backspace on a drilled slice goes one level up. */
  #up(): void {
    if (this.#trail.length === 0) return;
    this.#trail = this.#trail.slice(0, -1);
    this.select(null);
    this.requestDraw();
  }

  protected override draw(ctx: DrawContext): DrawResult {
    const { svg: root, width, height, locale } = ctx;
    const variant = this.variant();
    const semi = this.hasAttribute("semi") && !off(this, "semi");
    const explode = Math.max(0, numberAttr(this, "explode", 8));
    const gap = numberAttr(this, "gap", 3);
    const cornerRadius = numberAttr(this, "corner-radius", this.defaultCorner);
    const innerRatio = numberAttr(this, "inner-radius", 0.62);
    const fill = (
      ["gradient", "pattern"].includes(this.getAttribute("fill") ?? "")
        ? this.getAttribute("fill")
        : "solid"
    ) as Fill;
    const monochrome = flagOrText(this, "monochrome");
    const outsideAttr = flagOrText(this, "outside-labels");
    const sliceLabels = flagOrText(this, "slice-labels");
    const currency = this.getAttribute("currency") || undefined;

    // Level and colors ---------------------------------------------------------------------
    const level = this.#levelData();
    const base = level.baseIndex >= 0 ? ctx.color(level.baseIndex, level.override) : undefined;
    const hue = typeof monochrome === "string" ? monochrome : base;
    const shades =
      monochrome || base
        ? monochromeByValue(
            level.data.map((datum) => positive(datum.value)),
            hue,
          )
        : null;
    const items: Item[] = level.data.map((datum, index) => ({
      datum,
      color: datum.color ?? shades?.[index] ?? ctx.color(index),
      format: datum.format ? resolveFormat(datum.format, { locale, currency }) : ctx.format,
    }));
    const levelKey = this.#trail.join("/");
    if (levelKey !== this.#tweenLevel) {
      this.#tween.stop();
      this.#tween = new Tween();
      this.#tweenLevel = levelKey;
    }
    if (!ctx.transient)
      this.#tween.to(
        new Map(items.map((item) => [item.datum.id, positive(item.datum.value)])),
        ctx.motion && ctx.phase === "update",
        () => this.requestDraw("transient"),
      );
    const shown = items.map((item) => this.#tween.get(item.datum.id, positive(item.datum.value)));

    // Geometry -----------------------------------------------------------------------------
    // Narrow charts drop the outside labels: the legend carries the names.
    const outside: Outside | null =
      width < 440 || !outsideAttr
        ? null
        : outsideAttr === true
          ? "both"
          : ["name", "percent", "both"].includes(outsideAttr)
            ? (outsideAttr as Outside)
            : "both";
    const visible = items
      .map((_, index) => index)
      .filter((index) => !this.isHidden(items[index]?.datum.id ?? "") && (shown[index] ?? 0) > 0);
    const sum = visible.reduce((acc, index) => acc + (shown[index] ?? 0), 0);
    const edge = explode + 6;
    const labelSpace = outside ? Math.min(170, Math.max(96, width * 0.28)) : 0;
    const fitWidth = width / 2 - labelSpace - edge;
    const fitHeight = semi ? height - edge * 2 - 4 : height / 2 - edge - (outside ? 6 : 0);
    const radius = Math.max(24, Math.min(fitWidth, fitHeight));
    const cx = width / 2;
    const cy = semi ? (height + radius) / 2 : height / 2;
    const inner = variant === "pie" ? 0 : radius * clamp(innerRatio, 0.2, 0.9);
    const from = semi ? -Math.PI / 2 : degToRad(numberAttr(this, "start-angle", 0));
    const to = semi ? Math.PI / 2 : from + TAU;
    const pad = gap / Math.max(1, (inner + radius) / (variant === "pie" ? 1.6 : 2));
    const values = items.map((_, index) => (visible.includes(index) ? (shown[index] ?? 0) : 0));
    const slices = sliceAngles(values, { startAngle: from, endAngle: to, padAngle: pad });
    // Hit areas leave no gap between neighbours, so crossing from one slice to the next never
    // passes through "nothing".
    const hits = sliceAngles(values, { startAngle: from, endAngle: to });

    // Slices -------------------------------------------------------------------------------
    if (fill !== "solid") {
      const defs = svg("defs");
      items.forEach((item, index) => {
        const id = `${this.#uid}-${index}`;
        if (fill === "pattern") defs.append(pattern(id, index, item.color));
        else
          defs.append(
            svg(
              "radialGradient",
              { id, gradientUnits: "userSpaceOnUse", cx, cy, r: Math.max(1, radius) },
              svg("stop", {
                offset: Math.min(0.95, inner / Math.max(1, radius)),
                style: `stop-color:color-mix(in oklab, ${item.color} 42%, var(--surface))`,
              }),
              svg("stop", { offset: 1, style: `stop-color:${item.color}` }),
            ),
          );
      });
      root.append(defs);
    }
    const group = svg("g", { "data-slices": "" });
    const paths = new Map<number, SVGPathElement>();
    for (const index of visible) {
      const slice = slices[index];
      const item = items[index];
      if (!slice || !item) continue;
      const shift = polarPoint(0, 0, explode, slice.mid);
      const path = svg("path", {
        "data-slice": "",
        "data-series": item.datum.id,
        d: arcPath({
          cx,
          cy,
          innerRadius: inner,
          outerRadius: radius,
          startAngle: slice.start,
          endAngle: slice.end,
          cornerRadius,
        }),
        style: `fill:${fill === "solid" ? item.color : `url(#${this.#uid}-${index})`};--ui-dx:${shift.x.toFixed(2)}px;--ui-dy:${shift.y.toFixed(2)}px;transform-origin:${cx}px ${cy}px`,
      });
      paths.set(index, path);
      group.append(path);
    }
    root.append(group);

    // Labels -------------------------------------------------------------------------------
    const fades: SVGElement[] = [];
    if (sliceLabels) {
      const labels = svg("g", { "data-pointer-none": "", "data-fade": "" });
      for (const index of visible) {
        const slice = slices[index];
        const item = items[index];
        if (!slice || !item) continue;
        const label =
          sliceLabels === "value"
            ? item.format(item.datum.value)
            : formatPercent(slice.fraction, { decimals: 0, locale });
        const fit = fitSliceLabel(inner, radius, slice.start, slice.end, label.length, 11);
        if (!fit) continue;
        labels.append(
          svg(
            "text",
            {
              x: cx + fit.x,
              y: cy + fit.y,
              "text-anchor": "middle",
              "dominant-baseline": "central",
              "aria-hidden": "true",
              style:
                "fill:var(--surface);font-size:11px;font-weight:700;font-variant-numeric:tabular-nums",
            },
            label,
          ),
        );
      }
      root.append(labels);
      fades.push(labels);
    }
    if (outside) {
      const lines = outside === "both" ? 2 : 1;
      const boxHeight = lines === 2 ? 30 : 15;
      const sides: Record<"1" | "-1", Array<{ index: number; side: 1 | -1; y: number }>> = {
        "1": [],
        "-1": [],
      };
      for (const index of visible) {
        const slice = slices[index];
        if (!slice || slice.fraction < 0.02) continue;
        const side: 1 | -1 = Math.sin(slice.mid) >= 0 ? 1 : -1;
        sides[String(side) as "1" | "-1"].push({
          index,
          side,
          y: polarPoint(cx, cy, radius + LABEL_ELBOW, slice.mid).y,
        });
      }
      const labels = svg("g", { "data-pointer-none": "", "data-fade": "", "aria-hidden": "true" });
      for (const entries of Object.values(sides)) {
        const ys = spreadLabels(
          entries.map((entry) => ({ y: entry.y, height: boxHeight })),
          4,
          height - 4,
          3,
        );
        entries.forEach((entry, i) => {
          const slice = slices[entry.index];
          const item = items[entry.index];
          if (!slice || !item) return;
          const y = ys[i] ?? entry.y;
          const x = cx + entry.side * (radius + LABEL_RUN);
          const anchor = polarPoint(cx, cy, radius + 2, slice.mid);
          const elbow = polarPoint(cx, cy, radius + LABEL_ELBOW, slice.mid);
          const room = Math.max(24, (entry.side > 0 ? width - x : x) - 6);
          const maxChars = Math.floor(room / (11 * 0.58));
          const pct = formatPercent(slice.fraction, { decimals: 0, locale });
          const tail = `${x - entry.side * 4},${y}`;
          const label = svg(
            "g",
            { "data-series": item.datum.id },
            svg("polyline", {
              fill: "none",
              "stroke-width": 1,
              "stroke-linecap": "round",
              "stroke-linejoin": "round",
              points: `${anchor.x},${anchor.y} ${elbow.x},${elbow.y} ${tail}`,
              style: "stroke:var(--ink-3);stroke-opacity:.55",
            }),
          );
          const textNode = svg("text", {
            x,
            y,
            "text-anchor": entry.side > 0 ? "start" : "end",
            style: "font-size:11px",
          });
          if (lines === 2)
            textNode.append(
              svg(
                "tspan",
                { x, dy: "-0.25em", style: "fill:var(--ink-2);font-weight:500" },
                truncate(item.datum.name, maxChars),
              ),
              svg(
                "tspan",
                {
                  x,
                  dy: "1.35em",
                  style: "fill:var(--ink);font-weight:700;font-variant-numeric:tabular-nums",
                },
                pct,
              ),
            );
          else
            textNode.append(
              svg(
                "tspan",
                {
                  dy: "0.34em",
                  style:
                    outside === "percent"
                      ? "fill:var(--ink);font-weight:700;font-variant-numeric:tabular-nums"
                      : "fill:var(--ink-2);font-weight:500;font-variant-numeric:tabular-nums",
                },
                outside === "percent" ? pct : truncate(item.datum.name, maxChars),
              ),
            );
          label.append(textNode);
          labels.append(label);
        });
      }
      root.append(labels);
      fades.push(labels);
    }

    // Centre -------------------------------------------------------------------------------
    const showCenter = variant === "donut" && inner > 18;
    let parts: View["parts"];
    if (showCenter) {
      const center = svg("g", {
        "data-pointer-none": "",
        "data-fade": "",
        "aria-hidden": "true",
        "text-anchor": "middle",
      });
      parts = {
        value: svg("text", {
          x: cx,
          style: "fill:var(--ink);font-weight:700;font-variant-numeric:tabular-nums",
        }),
        caption: svg("text", { x: cx, style: "fill:var(--ink-3);font-weight:600" }),
      };
      center.append(parts.value, parts.caption);
      root.append(center);
      fades.push(center);
    }
    this.#view = {
      items,
      visible,
      slices,
      sum,
      cx,
      cy,
      inner,
      radius,
      explode,
      width,
      height,
      semi,
      showCenter,
      centerLabel: this.getAttribute("center-label") ?? text(this, "total"),
      centerValue: this.getAttribute("center-value") ?? undefined,
      format: ctx.format,
      locale,
      parts,
    };
    this.#paintCenter();
    this.#syncCrumbs();

    // Entry --------------------------------------------------------------------------------
    if (ctx.animate) {
      [...paths.values()].forEach(
        (path, i) =>
          void path.animate(
            [
              { opacity: 0, transform: "rotate(-24deg) scale(.88)" },
              { opacity: 1, transform: "rotate(0deg) scale(1)" },
            ],
            { duration: 760, delay: i * 70, easing: EASE, fill: "backwards" },
          ),
      );
      for (const node of fades)
        node.animate([{ opacity: 0 }, { opacity: 1 }], {
          duration: 420,
          delay: 420,
          easing: "ease-out",
          fill: "backwards",
        });
    }

    // Result -------------------------------------------------------------------------------
    const total = items.reduce((acc, item) => acc + positive(item.datum.value), 0);
    const share = (fraction: number, decimals = 1) => formatPercent(fraction, { decimals, locale });
    let side: "left" | "right" = "right";
    return {
      summary: `${text(this, "total")}: ${ctx.format(total)}`,
      marks: visible.flatMap((index) => {
        const el = paths.get(index);
        const slice = slices[index];
        const item = items[index];
        return el && slice && item
          ? [
              {
                el,
                label: `${item.datum.name}: ${item.format(item.datum.value)}, ${share(slice.fraction)}`,
              },
            ]
          : [];
      }),
      hit: (x, y, _target, pointerRadius) => {
        const dx = x - cx;
        const dy = y - cy;
        const r = Math.hypot(dx, dy);
        // A finger may miss the ring by a few pixels; a mouse may not.
        const slack = pointerRadius > 12 ? 16 : 0;
        if (r > radius + explode + slack || r < inner - slack) return -1;
        const angle = angleOf(0, 0, dx, dy);
        for (let position = 0; position < visible.length; position += 1) {
          const slice = hits[visible[position] as number];
          if (!slice || slice.fraction <= 0) continue;
          if (normalizeAngle(angle - slice.start) < slice.end - slice.start) return position;
        }
        return -1;
      },
      hover: (position) => {
        const index = visible[position];
        const item = index != null ? items[index] : undefined;
        const slice = index != null ? slices[index] : undefined;
        if (index == null || !item || !slice) return null;
        // The card sits past the ring edge of the slice, lifted above or below the centre line,
        // so the total in the middle stays readable.
        const point = polarPoint(cx, cy, radius + explode + 6, slice.mid);
        const dead = Math.max(8, width * 0.03);
        // Left of the middle opens left, right of it opens right; near the middle it keeps its side.
        if (point.x < cx - dead) side = "left";
        else if (point.x > cx + dead) side = "right";
        return {
          rows: [
            {
              id: item.datum.id,
              name: item.datum.name,
              value: item.format(item.datum.value),
              color: item.color,
              shape: "dot",
              note: share(slice.fraction),
            },
          ],
          x: point.x,
          y: clamp(point.y + (point.y <= cy ? -44 : 44), 20, height - 20),
          side,
          category: index,
        };
      },
      nav: (position, intent) => {
        const count = visible.length;
        if (intent === "parent") {
          this.#up();
          return undefined;
        }
        if (intent === "home") return 0;
        if (intent === "end") return count - 1;
        if (intent === "left" || intent === "up") return (position - 1 + count) % count;
        if (intent === "right" || intent === "down") return (position + 1) % count;
        return undefined;
      },
      maxHoverRows: 1,
      snapshot: () => {
        const columns: SnapshotSeries[] = [
          {
            id: "value",
            name: text(this, "value"),
            color: items[0]?.color ?? "",
            values: items.map((item) => item.datum.value),
            text: items.map((item) => item.format(item.datum.value)),
          },
          {
            id: "share",
            name: text(this, "share"),
            color: items[0]?.color ?? "",
            values: items.map((item) => (total > 0 ? positive(item.datum.value) / total : 0)),
            text: items.map((item) => share(total > 0 ? positive(item.datum.value) / total : 0)),
          },
        ];
        return {
          title: this.getAttribute("label") ?? "",
          categoryHeader: text(this, "category"),
          categories: items.map((item) => item.datum.name),
          series: columns,
          legend: items.map((item) => ({
            id: item.datum.id,
            name: item.datum.name,
            color: item.color,
            shape: "dot" as const,
          })),
        };
      },
    };
  }
}
