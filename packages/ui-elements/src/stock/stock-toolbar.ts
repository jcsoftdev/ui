import { adoptStyles, rootOf } from "../internal/base.js";
import type { StockSeriesType, StockTool } from "../internal/e23-stock.js";
import type { UiStock } from "./stock.js";
import css from "./stock-toolbar.css.js";

const RANGES = ["1w", "1m", "3m", "6m", "1y", "ytd", "all"];
const RANGE_NAMES: Record<string, string> = {
  "1w": "1W",
  "1m": "1M",
  "3m": "3M",
  "6m": "6M",
  "1y": "1Y",
  ytd: "YTD",
  all: "All",
};
const DEFAULT_RANGES = ["1w", "1m", "3m", "6m", "1y", "all"];
const TYPES: StockSeriesType[] = [
  "candle",
  "ohlc",
  "line",
  "area",
  "column",
  "heikin-ashi",
  "renko",
];
const TYPE_NAMES: Record<StockSeriesType, string> = {
  candle: "Candles",
  ohlc: "OHLC",
  line: "Line",
  area: "Area",
  column: "Columns",
  "heikin-ashi": "Heikin-Ashi",
  renko: "Renko",
};
const TOOLS: StockTool[] = ["cursor", "trend", "horizontal", "range", "fib", "measure"];
const TOOL_NAMES: Record<StockTool, string> = {
  cursor: "Select",
  trend: "Trend line",
  horizontal: "Horizontal line",
  range: "Range box",
  fib: "Fibonacci",
  measure: "Measure",
};

export interface StockToolbar {
  readonly element: HTMLElement;
  /** Re-reads the attributes, texts and state of the chart. */
  update(): void;
}

const words = (value: string | null): string[] => (value ?? "").split(/[\s,]+/).filter(Boolean);

/**
 * The chart's toolbar: range presets (`ranges`, default `1w 1m 3m 6m 1y all`), series types
 * (`series-types`, default all seven) and drawing tools (`tools`, none by default; `all` offers
 * every one, with a button that deletes the selected drawing). A lazy part of `<ui-stock>`, loaded
 * only while `toolbar` is not `off`, so it adds nothing to the chart's first load.
 */
export function mountStockToolbar(host: UiStock): StockToolbar {
  adoptStyles(rootOf(host), css);
  const element = document.createElement("div");
  element.dataset.uiPart = "toolbar";
  const ranges = document.createElement("fieldset");
  const types = document.createElement("fieldset");
  const tools = document.createElement("fieldset");
  ranges.dataset.group = "range";
  types.dataset.group = "series-type";
  tools.dataset.group = "tool";
  element.append(ranges, types, tools);
  const shown = { ranges: "", types: "", tools: "" };

  const fill = (
    group: HTMLFieldSetElement,
    key: keyof typeof shown,
    legend: string,
    list: readonly string[],
    attribute: string,
    label: (id: string) => string,
    extra?: HTMLButtonElement,
  ) => {
    group.hidden = list.length === 0;
    const signature = `${legend}|${list.map((id) => `${id}=${label(id)}`).join()}`;
    if (shown[key] !== signature) {
      shown[key] = signature;
      const heading = document.createElement("legend");
      heading.textContent = legend;
      group.replaceChildren(
        heading,
        ...list.map((id) => {
          const button = document.createElement("button");
          button.type = "button";
          button.dataset[attribute] = id;
          button.textContent = label(id);
          return button;
        }),
        ...(extra ? [extra] : []),
      );
    }
  };
  const remove = document.createElement("button");
  remove.type = "button";
  remove.dataset.action = "delete";
  remove.textContent = "×";

  const update = () => {
    const texts = host.resolvedTexts;
    const rangeList = words(host.getAttribute("ranges")).filter((id) => RANGES.includes(id));
    const typeList = words(host.getAttribute("series-types")).filter((id) =>
      TYPES.includes(id as StockSeriesType),
    );
    const toolAttr = words(host.getAttribute("tools"));
    const toolList = (toolAttr.includes("all") ? TOOLS : toolAttr).filter((id) =>
      TOOLS.includes(id as StockTool),
    );
    const rangeName = (id: string) => texts.rangeNames?.[id] ?? RANGE_NAMES[id] ?? id;
    const typeName = (id: string) =>
      texts.seriesTypeNames?.[id as StockSeriesType] ?? TYPE_NAMES[id as StockSeriesType];
    const toolName = (id: string) =>
      texts.toolNames?.[id as StockTool] ?? TOOL_NAMES[id as StockTool];
    const rangeSource = host.hasAttribute("ranges") ? rangeList : DEFAULT_RANGES;
    const typeSource = host.hasAttribute("series-types") ? typeList : TYPES;
    fill(ranges, "ranges", texts.ranges ?? "Range", rangeSource, "range", rangeName);
    fill(
      types,
      "types",
      texts.seriesTypes ?? "Series type",
      typeSource.length > 1 ? typeSource : [],
      "type",
      typeName,
    );
    remove.title = texts.deleteDrawing ?? "Delete selected drawing";
    remove.setAttribute("aria-label", remove.title);
    fill(tools, "tools", texts.tools ?? "Drawing tools", toolList, "tool", toolName, remove);
    const range = host.getAttribute("range") ?? "all";
    for (const button of ranges.querySelectorAll<HTMLElement>("[data-range]"))
      button.setAttribute("aria-pressed", String(button.dataset.range === range));
    for (const button of types.querySelectorAll<HTMLElement>("[data-type]"))
      button.setAttribute("aria-pressed", String(button.dataset.type === host.seriesType));
    // Comparisons put the chart in percent mode, where the series type does not apply.
    types.disabled = host.comparisons.length > 0;
    for (const button of tools.querySelectorAll<HTMLElement>("[data-tool]"))
      button.setAttribute("aria-pressed", String(button.dataset.tool === host.tool));
    remove.disabled = host.selectedDrawing == null;
  };

  element.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLElement>("button");
    if (!button) return;
    if (button.dataset.range) host.setAttribute("range", button.dataset.range);
    else if (button.dataset.type) host.seriesType = button.dataset.type as StockSeriesType;
    else if (button.dataset.tool) host.tool = button.dataset.tool as StockTool;
    else if (button.dataset.action === "delete") host.removeSelectedDrawing();
    update();
  });
  for (const type of ["stock-select", "stock-tool", "stock-drawings"])
    host.addEventListener(type, update);
  update();
  return { element, update };
}
