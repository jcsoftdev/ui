// Shared by the E18 chart tests: mounting, the pointer/touch dispatch the base listens to, and the
// four checks every chart gets (hover sweep without flicker, keyboard, tap-to-pin, axe).
import axe from "axe-core";
import { expect } from "vitest";
import { userEvent } from "vitest/browser";
import { frame, mount, wait } from "./setup.ts";

export interface E18Chart extends HTMLElement {
  [key: string]: unknown;
  select(index: number | null): void;
  readonly selected: number | null;
  readonly hover: { index: number; category: number; pinned: boolean; source: string } | null;
  readonly chartSnapshot: {
    categories: string[];
    series: Array<{ id: string; name: string; text: string[] }>;
    legend?: Array<{ id: string; name: string }>;
  } | null;
  readonly drawing: HTMLElement;
}

export const settle = async () => {
  await frame();
  await frame();
  await wait(40);
};

/** The real mouse rests on a corner, so a chart mounted under the last test's pointer is not hovered. */
export async function parkMouse(): Promise<void> {
  const park = mount(
    '<i id="park" style="position:fixed;right:0;bottom:0;width:6px;height:6px"></i>',
  );
  await userEvent.hover(park.firstElementChild as Element);
}

/** Mounts `<tag ...attrs>inner</tag>` in a box of `width` px, runs `setup` on it, and settles. */
export async function chart(
  tag: string,
  {
    attrs = "",
    inner = "",
    width = 520,
    setup,
  }: { attrs?: string; inner?: string; width?: number; setup?: (c: E18Chart) => void } = {},
): Promise<E18Chart> {
  const host = mount(
    `<div style="width:${width}px"><${tag} id="c" label="Test chart" ${attrs.includes("locale") ? "" : 'locale="en-US"'} ${attrs}>${inner}</${tag}></div>`,
  );
  const c = host.querySelector(tag) as E18Chart;
  setup?.(c);
  await settle();
  return c;
}

export const svgOf = (c: Element) => c.querySelector("svg") as SVGSVGElement;
export const marks = (c: Element) => [...c.querySelectorAll<SVGElement>("svg [role=img]")];
export const drawingOf = (c: Element) => c.querySelector("[data-ui-part=drawing]") as HTMLElement;

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

/** Loads the interaction chunk the way a pointer arriving would, without hovering any mark. */
export const awake = async (c: Element) => {
  drawingOf(c).dispatchEvent(
    new PointerEvent("pointerenter", { clientX: -1000, clientY: -1000, pointerType: "mouse" }),
  );
  await wait(80);
};

/**
 * Moves the mouse over `points` (drawing coordinates) and returns the mark index of each
 * `chart-hover` event (null for a leave), so a test can assert one enter per mark, in order.
 */
export async function sweep(c: E18Chart, points: ReadonlyArray<[number, number]>) {
  await awake(c);
  const seen: Array<number | null> = [];
  c.addEventListener("chart-hover", (e) => seen.push((e as CustomEvent).detail?.index ?? null));
  for (const [x, y] of points) {
    pointer(c, "pointermove", x, y);
    // Twice on the same spot: still one event.
    pointer(c, "pointermove", x + 0.5, y);
  }
  return seen;
}

/** Tab into the chart, walk the marks with `next`, and come back with Home/End and Escape. */
export async function walkKeys(c: E18Chart, next: string, count: number) {
  const m = marks(c);
  expect(m).toHaveLength(count);
  expect(m.filter((x) => x.tabIndex === 0)).toHaveLength(1);
  await userEvent.tab();
  await wait(80);
  expect(document.activeElement).toBe(m[0]);
  expect(c.hover?.index).toBe(0);
  await userEvent.keyboard(`{${next}}`);
  expect(document.activeElement).toBe(m[Math.min(1, count - 1)]);
  await userEvent.keyboard("{End}");
  expect(document.activeElement).toBe(m[count - 1]);
  await userEvent.keyboard("{Home}");
  expect(document.activeElement).toBe(m[0]);
  await userEvent.keyboard("{Escape}");
  expect(c.hover).toBeNull();
}

/** A tap pins the mark under the finger; a second tap on it clears the pin. */
export async function pinByTap(c: E18Chart, x: number, y: number, index: number) {
  await awake(c);
  const picked: Array<number | null> = [];
  c.addEventListener("chart-select", (e) => picked.push((e as CustomEvent).detail?.index ?? null));
  tap(c, x, y);
  await wait(30);
  expect(c.selected).toBe(index);
  expect(c.hover?.pinned).toBe(true);
  tap(c, x, y);
  await wait(30);
  expect(c.selected).toBeNull();
  expect(picked).toEqual([index, null]);
}

/** The accessibility violations of `root`, as `id: target` strings. */
export async function violations(root: Element): Promise<string[]> {
  const result = await axe.run(root, {
    // Contrast needs the page theme; "region" is about the page, not the component.
    rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
  });
  return result.violations.map(
    (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
  );
}
