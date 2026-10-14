import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { defineHierarchyMorph } from "../src/hierarchy-morph/hierarchy-morph.ts";
import {
  awake,
  centerOf,
  hoverLog,
  marksOf,
  mountChart,
  parkMouse,
  pointer,
  settle,
  svgOf,
  tap,
  violations,
} from "./hierarchy-helpers.ts";
import { wait } from "./setup.ts";

beforeAll(() => defineHierarchyMorph());
beforeEach(parkMouse);
afterEach(() => {
  document.body.innerHTML = "";
});

const TAG = "ui-hierarchy-morph";
const focused = () => document.activeElement?.getAttribute("aria-label")?.split(":")[0];

describe("ui-hierarchy-morph", () => {
  it("makes a mark per shape, shallow first", async () => {
    const c = await mountChart(TAG);
    const labels = marksOf(c).map((m) => m.getAttribute("aria-label"));
    expect(labels.slice(0, 3).map((l) => l?.split(":")[0])).toEqual([
      "Engineering",
      "Sales",
      "Support",
    ]);
    expect(labels).toHaveLength(8);
  });

  it("cannot drill: no hint, and the zoom attributes are ignored", async () => {
    const c = await mountChart(TAG, 'focus-id="root/Sales" breadcrumb="nope" drill-down="on"');
    await awake(c);
    const labels = marksOf(c).map((m) => m.getAttribute("aria-label"));
    expect(labels[0]).toMatch(/^Engineering/);
    const [x, y] = centerOf(c, "Engineering:");
    pointer(c, "pointermove", x, y);
    const rows = (c.hover as unknown as { rows: Array<{ id: string }> }).rows;
    expect(rows.some((row) => row.id === "hint")).toBe(false);
  });

  it("does not make shapes too small to see focusable", async () => {
    const c = await mountChart(TAG);
    c.data = {
      name: "Co",
      children: [
        { name: "Big", value: 100000 },
        { name: "Tiny", value: 1 },
      ],
    };
    await settle();
    const labels = marksOf(c).map((m) => m.getAttribute("aria-label") ?? "");
    expect(labels.some((l) => l.startsWith("Big"))).toBe(true);
    expect(labels.some((l) => l.startsWith("Tiny"))).toBe(false);
  });

  it("switches view with the buttons, morphs the paths and announces nothing new", async () => {
    const c = await mountChart(TAG);
    const modes: string[] = [];
    c.addEventListener("mode-change", (e) => modes.push((e as CustomEvent).detail.mode));
    const before = marksOf(c)[0]?.getAttribute("d");
    const buttons = [...c.querySelectorAll<HTMLButtonElement>("[data-ui-part=switch] button")];
    expect(buttons.map((b) => b.getAttribute("aria-pressed"))).toEqual(["true", "false"]);
    buttons[1]?.click();
    await wait(1100);
    expect(modes).toEqual(["sunburst"]);
    expect(c.getAttribute("mode")).toBe("sunburst");
    expect(marksOf(c)[0]?.getAttribute("d")).not.toBe(before);
    expect(buttons.map((b) => b.getAttribute("aria-pressed"))).toEqual(["false", "true"]);
  });

  it("jumps at once without motion", async () => {
    const c = await mountChart(TAG, 'animate="off"');
    c.setAttribute("mode", "sunburst");
    await settle();
    const d = marksOf(c)[0]?.getAttribute("d") ?? "";
    c.setAttribute("mode", "treemap");
    await settle();
    expect(marksOf(c)[0]?.getAttribute("d")).not.toBe(d);
  });

  it("hover sweep through the shapes never reports nothing inside the drawing", async () => {
    const c = await mountChart(TAG, 'animate="off"');
    await awake(c);
    const events = hoverLog(c);
    const box = svgOf(c).getBoundingClientRect();
    const y = box.height * 0.5;
    for (let x = 1; x < box.width - 1; x += 2) pointer(c, "pointermove", x, y);
    expect(events.length).toBeGreaterThan(2);
    for (let i = 1; i < events.length; i += 1) expect(events[i]).not.toBe(events[i - 1]);
    // Null only at the ends, where the row leaves the shapes.
    expect(events.slice(1, -1).filter((e) => e === null).length).toBeLessThanOrEqual(1);
  });

  it("keeps the hover through a redraw", async () => {
    const c = await mountChart(TAG, 'animate="off"');
    await awake(c);
    const events = hoverLog(c);
    const [x, y] = centerOf(c, "Engineering ›");
    pointer(c, "pointermove", x, y);
    const first = c.hover?.index;
    c.requestDraw();
    await settle();
    expect(c.hover?.index).toBe(first);
    expect(events).toEqual([first]);
  });

  it("walks the hierarchy with the arrows", async () => {
    const c = await mountChart(TAG, 'animate="off"');
    marksOf(c)[0]?.focus();
    await wait(80);
    expect(focused()).toBe("Engineering");
    await userEvent.keyboard("{ArrowDown}");
    expect(focused()).toBe("Engineering › Platform");
    await userEvent.keyboard("{ArrowRight}");
    expect(focused()).toBe("Engineering › Mobile");
    await userEvent.keyboard("{ArrowUp}");
    expect(focused()).toBe("Engineering");
    await userEvent.keyboard("{ArrowRight}");
    expect(focused()).toBe("Sales");
  });

  it("pins on tap and never drills", async () => {
    const c = await mountChart(TAG, 'animate="off"');
    await awake(c);
    const [x, y] = centerOf(c, "Sales:");
    tap(c, x, y);
    tap(c, x, y);
    await settle();
    expect(c.focusId).toBe("root");
  });

  it("passes axe", async () => {
    const c = await mountChart(TAG);
    expect(await violations(c)).toEqual([]);
  });
});
