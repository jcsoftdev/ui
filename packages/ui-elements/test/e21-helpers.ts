// Shared by the hierarchy chart tests (sunburst, treemap, icicle, hierarchy morph).
import axe from "axe-core";
import { userEvent } from "vitest/browser";
import { frame, mount, wait } from "./setup.ts";

export const ORG = {
  name: "Company",
  children: [
    {
      name: "Engineering",
      children: [
        { name: "Platform", value: 400 },
        { name: "Mobile", value: 300 },
        { name: "Data", value: 200 },
      ],
    },
    {
      name: "Sales",
      children: [
        { name: "EMEA", value: 250 },
        { name: "APAC", value: 150 },
      ],
    },
    { name: "Support", value: 120 },
  ],
};

export type HierarchyEl = HTMLElement & {
  data: unknown;
  readonly selected: number | null;
  readonly hover: { index: number; pinned: boolean; source: string; title?: string } | null;
  readonly focusId: string;
  readonly path: ReadonlyArray<{ id: string; name: string }>;
  readonly drawing: HTMLElement;
  zoomTo(id: string): boolean;
  zoomOut(): boolean;
  drill(index: number): void;
  select(index: number | null): void;
  requestDraw(kind?: string): void;
};

export const settle = async () => {
  await frame();
  await frame();
  await wait(40);
};

/** The real mouse rests on a corner, so a chart mounted under the last test's pointer is not hovered. */
export async function parkMouse() {
  const park = mount(
    '<i id="park" style="position:fixed;right:0;bottom:0;width:6px;height:6px"></i>',
  );
  await userEvent.hover(park.firstElementChild as Element);
}

export async function mountChart(tag: string, attrs = "", inner = "", width = 480) {
  const host = mount(
    `<div style="width:${width}px"><${tag} label="Headcount" height="320" locale="en-US" ${attrs}>${inner}</${tag}></div>`,
  );
  const chart = host.querySelector(tag) as HierarchyEl;
  chart.data = ORG;
  await settle();
  return chart;
}

export const svgOf = (c: Element) => c.querySelector("svg") as SVGSVGElement;
export const drawingOf = (c: Element) => c.querySelector("[data-ui-part=drawing]") as HTMLElement;
export const marksOf = (c: Element) => [...c.querySelectorAll<SVGElement>("svg [role=img]")];

export const pointer = (
  c: Element,
  type: string,
  x: number,
  y: number,
  pointerType = "mouse",
  id = 1,
) => {
  const box = svgOf(c).getBoundingClientRect();
  (type === "pointerleave" ? drawingOf(c) : svgOf(c)).dispatchEvent(
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
export const tap = (c: Element, x: number, y: number, pointerType = "touch") => {
  pointer(c, "pointerdown", x, y, pointerType);
  pointer(c, "pointerup", x, y, pointerType);
};

/** Wakes the interaction chunk without hovering any mark. */
export const awake = async (c: Element) => {
  drawingOf(c).dispatchEvent(
    new PointerEvent("pointerenter", { clientX: -1000, clientY: -1000, pointerType: "mouse" }),
  );
  await wait(60);
};

/** Marks' centers in drawing units, by label start. */
export const centerOf = (c: Element, label: string): [number, number] => {
  const mark = marksOf(c).find((el) => el.getAttribute("aria-label")?.startsWith(label));
  if (!mark) throw new Error(`no mark ${label}`);
  const box = mark.getBoundingClientRect();
  const root = svgOf(c).getBoundingClientRect();
  return [box.left + box.width / 2 - root.left, box.top + box.height / 2 - root.top];
};

export const violations = async (root: Element) =>
  (
    await axe.run(root, {
      rules: { "color-contrast": { enabled: false }, region: { enabled: false } },
    })
  ).violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`);

export const hoverLog = (c: Element) => {
  const events: Array<number | null> = [];
  c.addEventListener("chart-hover", (e) => events.push((e as CustomEvent).detail?.index ?? null));
  return events;
};
