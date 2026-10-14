import { adoptStyles, type DefineOptions, defineElement, rootOf } from "../internal/base.js";
import { CHART_EVENT, type ChartHost } from "../internal/chart-protocol.js";
import { upgradeProperties } from "../internal/e10.js";
import { CartesianElement } from "../internal/e17-cartesian.js";
import css from "../internal/e23-crossfilter.css.js";
import {
  type CrossfilterTexts,
  createHeader,
  DEFAULT_TEXTS,
  DIMMED,
  type DimensionValue,
  defineSettings,
  followHeading,
  type Group,
  isSelected,
  linkProvider,
  type ProviderLink,
} from "../internal/e23-crossfilter.js";

/**
 * `<ui-crossfilter-bar>`: bars per category of one dimension of the `<ui-crossfilter>` it sits in.
 * Click a bar (or press Enter) to filter by it, click again to undo, several bars add up. The light
 * bars are the totals, the accent ones what the OTHER charts leave in; categories outside this
 * chart's own filter are dimmed. A click filters and never pins a bar.
 *
 * Attributes: `dimension` (a key of the provider's `dimensions`), `heading` (title above the
 * chart, also the accessible name unless `label` is set), `orientation` (`vertical`, `horizontal`),
 * plus the chart attributes. Properties: `keys` (categories in display order), `keyLabel(key)`,
 * `measure(record)` (add this instead of counting records), `texts`.
 */
export class UiCrossfilterBar extends CartesianElement {
  static override observedAttributes = [
    ...CartesianElement.observedAttributes,
    "dimension",
    "heading",
  ];
  protected readonly kind = "column" as const;

  declare keys: readonly DimensionValue[] | undefined;
  declare keyLabel: (key: DimensionValue) => string;
  declare measure: ((record: never) => number) | undefined;
  declare texts: Partial<CrossfilterTexts>;

  #link: ProviderLink | undefined;
  #header = createHeader();
  #groups: readonly Group[] = [];
  readonly #name = followHeading(this);

  constructor() {
    super();
    this.addEventListener(CHART_EVENT.select, (event) => {
      // Filtering replaces pinning: the selection never reaches the page.
      event.stopImmediatePropagation();
      const detail = (event as CustomEvent<{ index: number } | null>).detail;
      if (!detail) return;
      const group = this.#groups[detail.index];
      if (group) this.#link?.api?.toggle(this.getAttribute("dimension") ?? "", group.key);
      (this as unknown as ChartHost).select(null);
    });
  }

  override connectedCallback(): void {
    adoptStyles(rootOf(this), css);
    this.dataset.ui = "crossfilter-bar";
    super.connectedCallback();
    this.prepend(this.#header.el);
    upgradeProperties(this, ["keys", "keyLabel", "measure", "texts"]);
    this.#link = linkProvider(this, () => this.sync());
    // The provider may already hold data (the chart was added later): draw it now.
    this.sync();
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#link?.stop();
    this.#link = undefined;
    this.#header.el.remove();
  }

  override attributeChangedCallback(name: string): void {
    super.attributeChangedCallback(name);
    if (name === "dimension" || name === "heading") this.sync();
  }

  /** Reads the provider again and redraws. Call after changing `keys`, `keyLabel`, `measure` or `texts`. */
  sync(): void {
    const api = this.#link?.api;
    const dimension = this.getAttribute("dimension") ?? "";
    const heading = this.getAttribute("heading") ?? "";
    const texts = { ...DEFAULT_TEXTS, ...this.texts };
    this.#name(heading);
    if (!api || !api.accessors[dimension]) {
      this.#groups = [];
      this.categories = [];
      this.series = [];
      this.#header.update({
        heading,
        count: "",
        own: false,
        clearLabel: texts.clear,
        onClear() {},
      });
      return;
    }
    const measure = this.measure as ((record: unknown) => number) | undefined;
    const options = { keys: this.keys, value: measure };
    const all = api.groupAll(dimension, options);
    const keys = this.keys ?? all.map((group) => group.key);
    const inContext = api.group(dimension, { ...options, keys });
    const read = (group: Group) => (measure ? group.sum : group.count);
    const totals = new Map(all.map((group) => [group.key, group]));
    const own = api.filters[dimension];
    const shown = inContext.reduce((sum, group) => sum + group.count, 0);
    this.#groups = inContext;
    this.#header.update({
      heading,
      count: texts.count(own ? api.filtered.length : shown, api.total),
      own: own != null,
      clearLabel: texts.clear,
      onClear: () => api.clear(dimension),
    });
    this.categories = inContext.map((group) => this.keyLabel(group.key));
    this.series = [
      {
        id: "total",
        name: texts.total,
        color: "var(--line-strong)",
        data: inContext.map((group) => read(totals.get(group.key) ?? group)),
      },
      {
        id: "filtered",
        name: texts.filtered,
        color: "var(--accent)",
        data: inContext.map(read),
        colors: inContext.map((group) =>
          isSelected(api.filters, dimension, group.key) ? undefined : DIMMED,
        ),
      },
    ];
  }
}

defineSettings(UiCrossfilterBar, {
  keys: undefined,
  keyLabel: String,
  measure: undefined,
  texts: {},
});

/** Registers `<ui-crossfilter-bar>` (or `<prefix>-crossfilter-bar`) and returns the tag. */
export function defineCrossfilterBar(options?: DefineOptions): string {
  return defineElement("crossfilter-bar", UiCrossfilterBar, options);
}
