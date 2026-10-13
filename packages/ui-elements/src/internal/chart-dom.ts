import type { MarkShape } from "./chart-protocol.js";

/** Inline style of the visually hidden parts (description, listbox proxy, live region, fallback table). */
export const SR_ONLY =
  "position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap";

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

const joined = new WeakMap<Element, Map<string | number, Element>>();

/**
 * Keyed data join for retained rendering: makes `parent` hold exactly one element per item, in item
 * order, reusing the element of an item whose key is still present. `enter` builds an element for a
 * new key, `update` (called for new and kept elements) sets its attributes, and `exit` handles an
 * element whose key is gone (default: remove it). `parent` must belong to this join alone.
 * Returns the elements in item order.
 */
export function join<T, E extends Element>(
  parent: Element,
  items: readonly T[],
  key: (item: T, index: number) => string | number,
  enter: (item: T, index: number) => E,
  update: (element: E, item: T, index: number) => void,
  exit: (element: E) => void = (element) => element.remove(),
): E[] {
  const previous = (joined.get(parent) ?? new Map()) as Map<string | number, E>;
  const next = new Map<string | number, E>();
  const out: E[] = [];
  let cursor = parent.firstChild;
  items.forEach((item, index) => {
    const k = key(item, index);
    const element = previous.get(k) ?? enter(item, index);
    previous.delete(k);
    next.set(k, element);
    update(element, item, index);
    if (element === cursor) cursor = cursor.nextSibling;
    else parent.insertBefore(element, cursor);
    out.push(element);
  });
  for (const element of previous.values()) exit(element);
  joined.set(parent, next);
  return out;
}
