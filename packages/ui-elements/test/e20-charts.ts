// Shared helpers of the E20 polar chart tests: mounting, synthetic pointers and axe.
import axe from "axe-core";
import { userEvent } from "vitest/browser";
import { frame, mount, wait } from "./setup.ts";

/** The real mouse rests on a corner, so a chart mounted under the last test's pointer is not hovered. */
export const parkMouse = async () => {
  const park = mount(
    '<i id="park" style="position:fixed;right:0;bottom:0;width:6px;height:6px"></i>',
  );
  await userEvent.hover(park.firstElementChild as Element);
};

export const settle = async () => {
  await frame();
  await frame();
  await wait(40);
};

export type PolarChart = HTMLElement & {
  select(index: number | null): void;
  readonly selected: number | null;
  readonly hover: {
    index: number;
    category: number;
    pinned: boolean;
    source: string;
    x: number;
    y: number;
    side?: string;
  } | null;
  readonly chartSnapshot: {
    series: Array<{ id: string; name: string; text: string[] }>;
    categories: string[];
    legend?: Array<{ id: string; name: string; color: string }>;
  } | null;
  readonly drawing: HTMLElement;
  isHidden(id: string): boolean;
  toggleSeries(id: string): void;
};

export const chart = async (tag: string, attrs = "", inner = "", width = 480) => {
  const host = mount(
    `<div style="width:${width}px"><${tag} id="c" label="Chart" locale="en-US" ${attrs}>${inner}</${tag}></div>`,
  );
  await settle();
  return host.querySelector(tag) as PolarChart;
};

export const svgOf = (c: Element) => c.querySelector("svg") as SVGSVGElement;
export const drawingOf = (c: Element) => c.querySelector("[data-ui-part=drawing]") as HTMLElement;
export const marks = (c: Element) => [...c.querySelectorAll<SVGElement>("svg [role=img]")];

/** Loads the interaction chunk the way a pointer arriving would, without hovering any mark. */
export const awake = async (c: Element) => {
  drawingOf(c).dispatchEvent(
    new PointerEvent("pointerenter", { clientX: -1000, clientY: -1000, pointerType: "mouse" }),
  );
  await wait(60);
};

export const pointer = (
  c: Element,
  type: string,
  x: number,
  y: number,
  pointerType = "mouse",
  id = 1,
) => {
  const box = svgOf(c).getBoundingClientRect();
  drawingOf(c).dispatchEvent(
    new PointerEvent(type, {
      bubbles: type !== "pointerleave",
      clientX: box.left + x,
      clientY: box.top + y,
      pointerType,
      pointerId: id,
      isPrimary: true,
    }),
  );
};
export const tap = (c: Element, x: number, y: number) => {
  pointer(c, "pointerdown", x, y, "touch");
  pointer(c, "pointerup", x, y, "touch");
};

/** Events of one kind a chart emits, as their `detail`. */
export const record = (c: Element, type: string) => {
  const seen: unknown[] = [];
  c.addEventListener(type, (event) => seen.push((event as CustomEvent).detail));
  return seen;
};

export const violations = async (root: Element) =>
  (
    await axe.run(root, {
      // Contrast needs the page theme; "region" is about the page, not the component.
      rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
    })
  ).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);

/** The centre of a chart's ring: the svg's middle. */
export const middle = (c: Element) => {
  const svg = svgOf(c);
  return { x: Number(svg.getAttribute("width")) / 2, y: Number(svg.getAttribute("height")) / 2 };
};
