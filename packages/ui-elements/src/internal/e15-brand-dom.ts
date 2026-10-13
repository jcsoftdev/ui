import {
  type BrandPalette,
  MARK_FILLS,
  MARK_LAYOUTS,
  MARK_SHAPES,
  type MarkDescription,
  type MarkNode,
  type MarkOptions,
  type WordmarkStyle,
} from "./e15-brand.js";
import { GLYPH_IDS } from "./e15-brand-glyphs.js";

const SVG_NS = "http://www.w3.org/2000/svg";

function renderNode(node: MarkNode): SVGElement {
  const element = document.createElementNS(SVG_NS, node.tag);
  for (const [name, value] of Object.entries(node.attrs))
    if (value !== undefined) element.setAttribute(name, String(value));
  for (const child of node.children ?? []) element.append(renderNode(child));
  if (node.text !== undefined) element.append(node.text);
  return element;
}

/**
 * Builds the `<svg role="img">` of a generated mark from its node tree (no `innerHTML`, so a
 * hostile name can only ever become a text node). `size` is the CSS width; the height follows the
 * aspect ratio.
 */
export function renderMark(mark: MarkDescription, size = "100%"): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", mark.viewBox);
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", mark.label);
  svg.style.cssText = `display:block;max-width:100%;height:auto;width:${size}`;
  for (const node of mark.nodes) svg.append(renderNode(node));
  return svg;
}

const oneOf = <T extends string>(value: string | null, allowed: readonly T[]): T | undefined =>
  allowed.includes(value as T) ? (value as T) : undefined;
const finite = (value: string | null): number | undefined => {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};
const WEIGHTS = [400, 500, 600, 700, 800] as const;
const COUNTS = [1, 2, 3] as const;

/** Generator options from the attributes of a `<ui-logo-mark>`; absent attributes keep the defaults. */
export function markOptionsFromAttributes(element: Element): MarkOptions {
  const attr = (name: string) => element.getAttribute(name);
  const custom: Partial<BrandPalette> = {};
  for (const key of ["primary", "secondary", "ink"] as const) {
    const value = attr(`palette-${key}`);
    if (value) custom[key] = value;
  }
  const options: MarkOptions = { name: attr("name") ?? "" };
  const set = <K extends keyof MarkOptions>(key: K, value: MarkOptions[K] | undefined) => {
    if (value !== undefined) options[key] = value as MarkOptions[K];
  };
  set(
    "palette",
    Object.keys(custom).length
      ? {
          id: "custom",
          label: "Custom",
          primary: "#2f6f5e",
          secondary: "#e3b04b",
          ink: "#10211c",
          ...custom,
        }
      : (attr("palette") ?? undefined),
  );
  set("shape", oneOf(attr("shape"), MARK_SHAPES));
  set("monogram", oneOf(attr("monogram"), ["initials", "glyph"] as const));
  set("glyph", oneOf(attr("glyph"), GLYPH_IDS));
  set("layout", oneOf(attr("layout"), MARK_LAYOUTS));
  set("fill", oneOf(attr("fill"), MARK_FILLS));
  set(
    "initialsCount",
    COUNTS.find((count) => count === finite(attr("initials-count"))),
  );
  set("seed", finite(attr("seed")));
  set("background", attr("background") ?? undefined);
  set("wordmarkColor", attr("wordmark-color") ?? undefined);
  if (element.hasAttribute("tagline")) options.tagline = attr("tagline") ?? "";
  if (element.hasAttribute("initials")) options.initials = attr("initials") ?? "";
  if (element.hasAttribute("ring")) options.ring = attr("ring") !== "false";
  const wordmark: WordmarkStyle = {};
  const weight = WEIGHTS.find((value) => value === finite(attr("weight")));
  const tracking = finite(attr("tracking"));
  if (weight !== undefined) wordmark.weight = weight;
  if (tracking !== undefined) wordmark.tracking = tracking;
  if (element.hasAttribute("uppercase")) wordmark.uppercase = attr("uppercase") !== "false";
  if (Object.keys(wordmark).length) options.wordmark = wordmark;
  return options;
}
