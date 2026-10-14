// The base of the category-based unit charts (waffle, pictogram, isotype rows): the `data`
// property, the formats, the default height and the sentence screen readers get.
import {
  formatNumber,
  formatPercent,
  resolveFormat,
  type ValueFormatter,
} from "@jcsoftdev/ui-core/chart/format";
import { adoptStyles, rootOf } from "./base.js";
import { CHART_ATTRIBUTES, ChartElement, type DrawContext } from "./chart-base.js";
import css from "./e22-units.css.js";
import type { UnitIcon } from "./unit-shapes.js";

/** A category of a unit chart: one color, optionally its own icon. */
export interface UnitCategory {
  id: string;
  name: string;
  value: number;
  /** CSS color; the palette slot of the category by default. */
  color?: string;
  /** Icon of this category; the chart `icon` by default. */
  icon?: UnitIcon;
}

export const UNIT_ATTRIBUTES = [...CHART_ATTRIBUTES, "data", "category-header", "unit-label"];

/** `[{ "id": "a", "name": "A", "value": 3 }]` to categories; a malformed or empty text gives none. */
function parse(text: string | null): UnitCategory[] {
  if (!text) return [];
  try {
    const list: unknown = JSON.parse(text);
    return Array.isArray(list) ? list.map(normalize) : [];
  } catch {
    return [];
  }
}

function normalize(item: Partial<UnitCategory>, index: number): UnitCategory {
  const name = String(item.name ?? item.id ?? index + 1);
  return { ...item, id: String(item.id ?? name), name, value: Number(item.value) || 0 };
}

export abstract class UnitChartElement extends ChartElement {
  static override observedAttributes = UNIT_ATTRIBUTES;
  /** `data-ui` of the element, for its CSS. */
  protected abstract readonly kind: string;
  /** Height in pixels when the author set none. */
  protected readonly defaultHeight: number = 200;
  #data: readonly UnitCategory[] | undefined;
  #parsed: { text: string | null; list: UnitCategory[] } | undefined;

  get data(): readonly UnitCategory[] {
    if (this.#data) return this.#data;
    const text = this.getAttribute("data");
    if (this.#parsed?.text !== text) this.#parsed = { text, list: parse(text) };
    return this.#parsed.list;
  }
  set data(value: readonly UnitCategory[]) {
    this.#data = value.map(normalize);
    this.requestDraw();
  }

  /** What the values count ("clients"), for the key and the tooltip. */
  protected get unitLabel(): string {
    return this.getAttribute("unit-label") ?? "units";
  }

  override connectedCallback(): void {
    this.dataset.ui = this.kind;
    this.toggleAttribute("data-unit-chart", true);
    adoptStyles(rootOf(this), css);
    if (!this.hasAttribute("height") && !this.hasAttribute("aspect-ratio"))
      this.setAttribute("height", `${this.defaultHeight}`);
    super.connectedCallback();
  }

  protected override isEmpty(): boolean {
    return this.data.every((item) => !(item.value > 0));
  }

  protected total(): number {
    return this.data.reduce((acc, item) => acc + Math.max(0, item.value), 0);
  }

  /** Integer counts unless the author picked a format. */
  protected unitFormat({ format, locale }: DrawContext): ValueFormatter {
    return this.valueFormat || this.hasAttribute("value-format")
      ? format
      : resolveFormat("integer", { locale });
  }

  protected percent({ locale }: DrawContext, fraction: number): string {
    return formatPercent(fraction, { locale });
  }

  /** A plain count, up to two decimals (the key line: 0.25 stays 0.25). */
  protected key({ locale }: DrawContext, value: number): string {
    return formatNumber(value, { locale });
  }

  protected number({ locale }: DrawContext, value: number): string {
    return formatNumber(value, { locale, maximumFractionDigits: 1 });
  }
}
