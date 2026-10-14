// Shared by the browser tests of the unit charts (waffle, pictogram, isotype rows, progress units).
import axe from "axe-core";
import { expect, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { frame, mount, wait } from "./setup.ts";

export type UnitChart = HTMLElement & {
  data: unknown;
  select(index: number | null): void;
  toggleSeries(id: string): void;
  readonly selected: number | null;
  readonly chartSnapshot: { legend?: Array<{ id: string }> } | null;
  isHidden(id: string): boolean;
  readonly hover: { index: number; category: number; pinned: boolean; source: string } | null;
};

export const settle = async () => {
  await frame();
  await frame();
  await wait(30);
};

/** The real mouse rests on a corner, so a chart mounted under the last test's pointer is not hovered. */
export const parkMouse = async () => {
  const park = mount(
    '<i id="park" style="position:fixed;right:0;bottom:0;width:6px;height:6px"></i>',
  );
  await userEvent.hover(park.firstElementChild as Element);
};

export const mountChart = async (tag: string, attrs: string, data?: unknown, width = 400) => {
  const host = mount(
    `<div style="width:${width}px"><${tag} ${attrs.includes("label=") ? "" : 'label="Chart"'} ${attrs.includes("locale") ? "" : 'locale="en-US"'} ${attrs}></${tag}></div>`,
  );
  const chart = host.querySelector(tag) as UnitChart;
  if (data !== undefined) chart.data = data;
  await settle();
  return chart;
};

export const svgOf = (c: Element) => c.querySelector("svg") as SVGSVGElement;
export const drawingOf = (c: Element) => c.querySelector("[data-ui-part=drawing]") as HTMLElement;
export const marksOf = (c: Element) => [...c.querySelectorAll<SVGElement>("svg [data-cat]")];

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

/**
 * Loads the interaction chunk the way a pointer arriving would, and waits until it is live: a probe
 * move over the first mark must show its details, then the pointer leaves.
 */
export const awake = async (c: Element) => {
  const probe = c.querySelector("svg [data-cat]") as SVGElement;
  const at = (probe.querySelector("[data-unit]") ?? probe).getBoundingClientRect();
  const origin = svgOf(c).getBoundingClientRect();
  const x = at.left - origin.left + at.width / 2;
  const y = at.top - origin.top + at.height / 2;
  pointer(c, "pointerenter", x, y);
  await vi.waitFor(() => {
    pointer(c, "pointermove", x, y);
    expect((c as UnitChart).hover).not.toBeNull();
  });
  pointer(c, "pointerleave", 0, 0);
  expect((c as UnitChart).hover).toBeNull();
};

/** Tabs into the chart and waits for the first mark's details. */
export const focusFirst = async (c: UnitChart) => {
  await userEvent.tab();
  await vi.waitFor(() => expect(c.hover?.index).toBe(0));
};

/** The mark index of every `chart-hover` event (null when the details close). */
export const hoverLog = (c: Element) => {
  const seen: Array<number | null> = [];
  c.addEventListener("chart-hover", (event) =>
    seen.push((event as CustomEvent).detail?.index ?? null),
  );
  return seen;
};

/** axe, after the screen-reader table (built a quarter of a second after the data) exists. */
export const violations = async (root: Element) => {
  await wait(350);
  return (
    await axe.run(root, {
      rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
    })
  ).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);
};

/** Keys pressed one by one, returning the mark index shown after each. */
export const keys = async (c: UnitChart, sequence: string[]) => {
  const shown: Array<number | undefined> = [];
  for (const key of sequence) {
    await userEvent.keyboard(key);
    await frame();
    shown.push(c.hover?.index);
  }
  return shown;
};

/** Box of every unit (`[data-unit]`) of the drawing in document order, relative to the svg. */
export const unitBoxes = (c: Element, selector = "svg [data-unit]") => {
  const origin = svgOf(c).getBoundingClientRect();
  return [...c.querySelectorAll(selector)].map((unit) => {
    const box = unit.getBoundingClientRect();
    return {
      x: box.left - origin.left,
      y: box.top - origin.top,
      width: box.width,
      height: box.height,
      cx: box.left - origin.left + box.width / 2,
      cy: box.top - origin.top + box.height / 2,
    };
  });
};
