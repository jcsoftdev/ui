import type { MarkShape } from "./chart-protocol.js";

const SVG_NS = "http://www.w3.org/2000/svg";

type Attr = string | number | boolean | null | undefined;

/**
 * Builds an SVG element: `svg("rect", { x: 1, width: 4 }, child)`. `undefined`, `null` and `false`
 * attributes are skipped. Colors go through `style`/`fill` as CSS `var()` references.
 */
export function svg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, Attr> = {},
  ...children: Array<Node | string>
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs))
    if (value != null && value !== false) node.setAttribute(name, value === true ? "" : `${value}`);
  node.append(...children);
  return node;
}

/** The small color key of a legend item or tooltip row: a stroke sample or a filled square or dot. */
export function swatch(color: string, shape: MarkShape = "square"): Element {
  if (shape === "line" || shape === "dashed")
    return svg(
      "svg",
      { width: 16, height: 8, "aria-hidden": "true", "data-ui-part": "swatch" },
      svg("line", {
        x1: 1,
        x2: 15,
        y1: 4,
        y2: 4,
        "stroke-width": 2.5,
        "stroke-linecap": "round",
        "stroke-dasharray": shape === "dashed" ? "3 3.5" : undefined,
        style: `stroke:${color}`,
      }),
    );
  const node = document.createElement("span");
  node.dataset.uiPart = "swatch";
  node.dataset.shape = shape;
  node.setAttribute("aria-hidden", "true");
  node.style.background = color;
  return node;
}
