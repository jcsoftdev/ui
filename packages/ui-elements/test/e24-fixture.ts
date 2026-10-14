// Helpers shared by the E24 map tests (choropleth, bubble, hex tiles, globe).
import { userEvent } from "vitest/browser";
import { frame, mount, wait } from "./setup.ts";

export const settle = async (ms = 30) => {
  await frame();
  await frame();
  await wait(ms);
};

/** The real mouse rests on a corner, so a chart mounted under the last test's pointer is not hovered. */
export async function parkMouse() {
  const park = mount(
    '<i id="park" style="position:fixed;right:0;bottom:0;width:6px;height:6px"></i>',
  );
  await userEvent.hover(park.firstElementChild as Element);
}

export const svgOf = (c: Element) => c.querySelector("svg") as SVGSVGElement;
export const drawingOf = (c: Element) => c.querySelector("[data-ui-part=drawing]") as HTMLElement;
export const marks = (c: Element) => [...c.querySelectorAll<SVGElement>("svg [role=img]")];

/** Loads the interaction chunk the way a pointer arriving would, without hovering any mark. */
export async function awake(c: Element) {
  drawingOf(c).dispatchEvent(
    new PointerEvent("pointerenter", { clientX: -1000, clientY: -1000, pointerType: "mouse" }),
  );
  // Awaiting the module runs after the chart's own continuation, which attaches the layer.
  await import("../src/internal/chart-interact.ts");
  await frame();
  await frame();
}

/** Sends a pointer event at a viewport point, to the element that is under it. */
export function pointerAt(
  type: string,
  x: number,
  y: number,
  pointerType = "mouse",
  target?: Element | null,
  extra: PointerEventInit = {},
) {
  (target ?? document.elementFromPoint(x, y))?.dispatchEvent(
    new PointerEvent(type, {
      bubbles: type !== "pointerleave",
      cancelable: true,
      clientX: x,
      clientY: y,
      pointerType,
      pointerId: 1,
      isPrimary: true,
      ...extra,
    }),
  );
}

/** A viewport point on every element of `els` that the pointer can really reach (in `els` order). */
export function reachable(els: Element[]): Array<{ index: number; x: number; y: number }> {
  const out: Array<{ index: number; x: number; y: number }> = [];
  els.forEach((el, index) => {
    const box = el.getBoundingClientRect();
    for (let gx = 1; gx < 8; gx += 1)
      for (let gy = 1; gy < 8; gy += 1) {
        const x = box.left + (box.width * gx) / 8;
        const y = box.top + (box.height * gy) / 8;
        const under = document.elementFromPoint(x, y);
        if (under && el.contains(under)) {
          out.push({ index, x, y });
          return;
        }
      }
  });
  return out;
}

export function record(c: Element, type: string) {
  const events: Array<Record<string, unknown> | null> = [];
  c.addEventListener(type, (event) => events.push((event as CustomEvent).detail));
  return events;
}
