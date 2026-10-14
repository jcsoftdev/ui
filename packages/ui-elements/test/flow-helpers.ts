// Shared by the flow-chart browser tests (sankey, chord, funnel).
import axe from "axe-core";
import { vi } from "vitest";
import { commands, userEvent } from "vitest/browser";
import { frame, mount, wait } from "./setup.ts";

export type FlowChart = HTMLElement & {
  readonly selected: number | null;
  readonly hover: {
    index: number;
    category: number;
    pinned: boolean;
    source: string;
    title?: string;
  } | null;
  readonly chartSnapshot: {
    categories: string[];
    series: Array<{ id: string; text: string[] }>;
    legend?: Array<{ id: string; name: string }>;
  } | null;
  select(index: number | null): void;
  drill(index: number): void;
  describe?(index: number): unknown;
  [key: string]: unknown;
};

/** The real mouse rests on a corner, so a chart mounted under the last test's pointer is not hovered. */
export async function parkMouse(): Promise<void> {
  const park = mount('<i style="position:fixed;right:0;bottom:0;width:6px;height:6px"></i>');
  await userEvent.hover(park.firstElementChild as Element);
}

export const settle = async () => {
  await frame();
  await frame();
  await wait(30);
};

export async function mountChart(
  tag: string,
  attrs: string,
  props: Record<string, unknown> = {},
  width = 520,
): Promise<FlowChart> {
  const host = mount(
    `<div style="width:${width}px"><${tag} locale="en-US" ${attrs}></${tag}></div>`,
  );
  const chart = host.querySelector(tag) as FlowChart;
  Object.assign(chart, props);
  await settle();
  return chart;
}

export const svgOf = (c: Element) => c.querySelector("svg") as SVGSVGElement;
export const drawingOf = (c: Element) => c.querySelector("[data-ui-part=drawing]") as HTMLElement;
export const marksOf = (c: Element) => [...c.querySelectorAll<SVGElement>("svg [role=img]")];

/** Loads the interaction chunk the way a pointer arriving would, without hovering any mark. */
export async function awake(c: Element): Promise<void> {
  drawingOf(c).dispatchEvent(
    new PointerEvent("pointerenter", { clientX: -1000, clientY: -1000, pointerType: "mouse" }),
  );
  await wait(60);
}

export function pointer(
  c: Element,
  type: string,
  x: number,
  y: number,
  pointerType = "mouse",
  id = 1,
) {
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
}
export const tap = (c: Element, x: number, y: number) => {
  pointer(c, "pointerdown", x, y, "touch");
  pointer(c, "pointerup", x, y, "touch");
};

/** Records `chart-hover` indices (`null` for a leave) while `move` runs. */
export function hoverLog(c: Element, move: () => void): Array<number | null> {
  const seen: Array<number | null> = [];
  const on = (e: Event) => seen.push((e as CustomEvent).detail?.index ?? null);
  c.addEventListener("chart-hover", on);
  move();
  c.removeEventListener("chart-hover", on);
  return seen;
}

/** Moves the pointer along a line in 2px steps. */
export function sweep(
  c: Element,
  from: [number, number],
  to: [number, number],
): Array<number | null> {
  return hoverLog(c, () => {
    const steps = Math.max(1, Math.round(Math.hypot(to[0] - from[0], to[1] - from[1]) / 2));
    for (let i = 0; i <= steps; i += 1)
      pointer(
        c,
        "pointermove",
        from[0] + ((to[0] - from[0]) * i) / steps,
        from[1] + ((to[1] - from[1]) * i) / steps,
      );
  });
}

export async function axeViolations(root: Element): Promise<string[]> {
  const result = await axe.run(root, {
    // Contrast needs the page theme; "region" is about the page, not the component.
    rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
  });
  return result.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
  );
}

/** Focuses the chart with Tab and waits for the interaction chunk. */
export async function focusChart(): Promise<void> {
  await userEvent.tab();
  await wait(80);
}

/** How many `element.animate()` calls mounting a chart makes, with and without reduced motion. */
export async function animateCalls(
  make: () => Promise<unknown>,
  reduced: boolean,
): Promise<number> {
  await commands.reducedMotion(reduced ? "reduce" : "no-preference");
  const spy = vi.spyOn(Element.prototype, "animate");
  await make();
  const calls = spy.mock.calls.length;
  spy.mockRestore();
  await commands.reducedMotion("no-preference");
  return calls;
}
