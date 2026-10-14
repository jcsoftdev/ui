// Shared helpers of the E19 chart tests: mounting, pointer and tap simulation, axe.
import axe from "axe-core";
import { frame, mount, wait } from "./setup.ts";

export { ax, frame, mount, wait } from "./setup.ts";

export const settle = async () => {
  await frame();
  await frame();
  await wait(40);
};

/** Mounts `<tag>` in a box `width` wide and returns it once drawn. */
export async function chartOf<T extends HTMLElement>(
  tag: string,
  attrs: string,
  width = 480,
  inner = "",
): Promise<T> {
  const host = mount(
    `<div style="width:${width}px"><${tag} ${attrs.includes("locale=") ? "" : 'locale="en-US"'} ${attrs.includes("label=") ? "" : 'label="Chart"'} ${attrs}>${inner}</${tag}></div>`,
  );
  await settle();
  return host.querySelector(tag) as T;
}

export const drawingOf = (c: Element) => c.querySelector("[data-ui-part=drawing]") as HTMLElement;
export const svgOf = (c: Element) => c.querySelector("svg") as SVGSVGElement;

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
export const sweep = (c: Element, x: number, y: number) => pointer(c, "pointermove", x, y);
export const tap = (c: Element, x: number, y: number, pointerType = "touch") => {
  pointer(c, "pointerdown", x, y, pointerType);
  pointer(c, "pointerup", x, y, pointerType);
};

/** The `index` of every `chart-hover` the chart emits, `null` for a clear. */
export const hoverLog = (c: Element): Array<number | null> => {
  const events: Array<number | null> = [];
  c.addEventListener("chart-hover", (e) => events.push((e as CustomEvent).detail?.index ?? null));
  return events;
};

/** axe violations of `root` (contrast needs the page theme, "region" is about pages). */
export const violations = async (root: Element) =>
  (
    await axe.run(root, {
      rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
    })
  ).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
