/**
 * Code shared by the polar charts of batch E20 (donut, pie, gauge, radar, radial bar, polar area):
 * reading JSON attributes, the strings the base does not carry, a tween for data-to-data changes,
 * the tooltip side that sticks (no jitter), and the stylesheet that lays the legend beside the
 * drawing in a wide container. Never an element entry.
 */
import type { ValueFormat } from "@jcsoftdev/ui-core/chart/format";
import { adoptStyles, rootOf } from "./base.js";
import type { ChartElement } from "./chart-base.js";
import css from "./e20-polar.css.js";

/** Strings the polar charts show on top of the base's. English defaults; override with `chart.labels`. */
const DEFAULTS = {
  value: "Value",
  share: "Share",
  total: "Total",
  max: "Max",
  category: "Category",
  seats: "Seats",
  majority: "Majority",
};
export type PolarLabelKey = keyof typeof DEFAULTS;

/** A visible string: the chart's `labels` property, else the English default. */
export function text(chart: ChartElement, key: PolarLabelKey): string {
  return (chart.labels as Partial<Record<PolarLabelKey, string>>)[key] ?? DEFAULTS[key];
}

/** Marks the host as a polar chart (legend beside the drawing in a wide container) and adopts the styles. */
export function adoptPolar(host: HTMLElement, ...extra: string[]): void {
  host.setAttribute("data-polar", "");
  adoptStyles(rootOf(host), css);
  for (const sheet of extra) adoptStyles(rootOf(host), sheet);
}

/** A JSON attribute, or `fallback` when it is missing or not valid JSON. */
export function jsonAttr<T>(host: Element, name: string, fallback: T): T {
  const raw = host.getAttribute(name);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** `""`/`"true"` to true, `"false"`/missing to false, anything else to the string itself. */
export function flagOrText(host: Element, name: string): boolean | string {
  const raw = host.getAttribute(name);
  if (raw === null || raw === "false") return false;
  return raw === "" || raw === "true" ? true : raw;
}

export const numberAttr = (host: Element, name: string, fallback: number): number => {
  const raw = host.getAttribute(name);
  const value = raw === null || raw.trim() === "" ? Number.NaN : Number(raw);
  return Number.isFinite(value) ? value : fallback;
};

export const truncate = (value: string, maxChars: number): string =>
  value.length <= maxChars ? value : `${value.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;

export const clamp = (value: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, value));

export const round2 = (value: number): number => Math.round(value * 100) / 100;

/** The chart's `value-format` as a `ValueFormat`: the property, else the preset attribute. */
export function valueFormatOf(chart: ChartElement): ValueFormat | undefined {
  return (
    chart.valueFormat ?? ((chart.getAttribute("value-format") as ValueFormat | null) || undefined)
  );
}

const warned = new WeakSet<Element>();
/**
 * One key per entry: an id used twice gets its position appended, so two entries never share a
 * tween (or a mark identity). Warns once per chart, since the legend still toggles by id.
 */
export function warnDuplicates(host: Element, ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const keys = ids.map((id, i) => {
    if (!seen.has(id)) {
      seen.add(id);
      return id;
    }
    return `${id}#${i}`;
  });
  if (keys.some((key, i) => key !== ids[i]) && !warned.has(host)) {
    warned.add(host);
    console.warn(
      `<${host.localName}>: ids must be unique; duplicates fall back to their position.`,
    );
  }
  return keys;
}

/** The tooltip side that sticks: flips right to left past 65% of the width, back below 55%. */
export class SideKeeper {
  #side: "left" | "right" | undefined;
  pick(x: number, width: number): "left" | "right" {
    const share = width > 0 ? x / width : 0;
    if (this.#side === "left") this.#side = share < 0.55 ? "right" : "left";
    else if (this.#side === "right") this.#side = share > 0.65 ? "left" : "right";
    else this.#side = share > 0.6 ? "left" : "right";
    return this.#side;
  }
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * Eases named numbers towards new targets (the slices of a donut, the value of a gauge). The first
 * target jumps; later ones tween from what is shown. `frame` is called for each step (ask for a
 * transient redraw there); read the shown value with `get()`. Without `animate` it just jumps.
 */
export class Tween {
  #shown = new Map<string, number>();
  #from = new Map<string, number>();
  #target = new Map<string, number>();
  #started = 0;
  #duration = 700;
  #raf = 0;

  get(id: string, fallback = 0): number {
    return this.#shown.get(id) ?? fallback;
  }

  /** True when `targets` differ from the last ones, so a draw for new data should tween. */
  changed(targets: ReadonlyMap<string, number>): boolean {
    if (targets.size !== this.#target.size) return true;
    for (const [id, value] of targets) if (this.#target.get(id) !== value) return true;
    return false;
  }

  /**
   * `from` seeds ids that are not shown yet (a gauge counts up from its minimum on the first draw).
   */
  to(
    targets: ReadonlyMap<string, number>,
    animate: boolean,
    frame: () => void,
    { duration = 700, from }: { duration?: number; from?: number } = {},
  ): void {
    if (!this.changed(targets)) return;
    cancelAnimationFrame(this.#raf);
    this.#target = new Map(targets);
    const first = this.#shown.size === 0;
    if (!animate || (first && from === undefined)) {
      this.#shown = new Map(targets);
      return;
    }
    this.#from = new Map(
      [...targets.keys()].map((id) => [id, this.#shown.get(id) ?? (first ? (from as number) : 0)]),
    );
    this.#shown = new Map(this.#from);
    this.#duration = duration;
    this.#started = performance.now();
    const step = (now: number) => {
      const t = easeOut(clamp((now - this.#started) / this.#duration, 0, 1));
      for (const [id, value] of this.#target) {
        const start = this.#from.get(id) ?? 0;
        this.#shown.set(id, t >= 1 ? value : start + (value - start) * t);
      }
      frame();
      if (t < 1) this.#raf = requestAnimationFrame(step);
    };
    this.#raf = requestAnimationFrame(step);
  }

  stop(): void {
    cancelAnimationFrame(this.#raf);
    this.#raf = 0;
    this.#shown = new Map(this.#target);
  }
}

/** Sets one CSS property from data (a color), never by splicing it into a style string. */
export function paint<T extends SVGElement>(el: T, property: string, value: string): T {
  el.style.setProperty(property, value);
  return el;
}

export const EASE = "cubic-bezier(.22,1,.36,1)";

/** Fades `element` in (entry animation: call it only when `context.animate` is true). */
export function fadeIn(element: Element, duration = 420, delay = 0): void {
  const resting = getComputedStyle(element).opacity || "1";
  element.animate([{ opacity: 0 }, { opacity: resting }], {
    duration,
    delay,
    easing: "ease-out",
    fill: "backwards",
  });
}

/** Signed angle in (-PI, PI], 0 at 12 o'clock, from an angle in [0, TAU). */
export const signed = (angle: number): number => (angle > Math.PI ? angle - 2 * Math.PI : angle);
