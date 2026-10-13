import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { userEvent } from "vitest/browser";
import { defineSparkline } from "../src/sparkline/sparkline.ts";
import { ax, frame, mount, wait } from "./setup.ts";

beforeAll(() => defineSparkline());
afterEach(() => {
  document.body.innerHTML = "";
});

const settle = async () => {
  await frame();
  await frame();
  await wait(30);
};
const spark = async (attrs: string, width = 160) => {
  const host = mount(
    `<div style="width:${width}px"><ui-sparkline locale="en-US" ${attrs}></ui-sparkline></div>`,
  );
  await settle();
  return host.firstElementChild?.firstElementChild as HTMLElement;
};

describe("ui-sparkline", () => {
  it("is one image: the label is the name and first, last, min and max the description", async () => {
    const s = await spark('label="Sales, last 7 days" data="10,14,9,22,18,25,30"');
    expect(await ax("image", "Sales, last 7 days")).toBeTruthy();
    const svg = s.querySelector("svg") as SVGSVGElement;
    expect(s.querySelector(`#${svg.getAttribute("aria-describedby")}`)?.textContent).toBe(
      "10 → 30 (min 9, max 30)",
    );
    expect(svg.getAttribute("height")).toBe("36");
    expect(svg.getAttribute("width")).toBe("160");
    expect(s.querySelectorAll("table")).toHaveLength(0);
  });

  it("draws lines, areas and bars from the same data, with gaps for empty entries", async () => {
    const line = await spark('label="x" data="1,,3,4"');
    expect(line.querySelectorAll("svg path")).toHaveLength(1);
    expect(line.querySelector("[data-last]")).not.toBeNull();
    const area = await spark('label="x" type="area" data="1,2,3"');
    expect(area.querySelectorAll("svg path")).toHaveLength(2);
    const bar = await spark('label="x" type="bar" data="1,-2,3" highlight-index="2"');
    expect(bar.querySelectorAll("[data-bar]")).toHaveLength(3);
    expect(bar.querySelectorAll("[data-bar][data-dim]")).toHaveLength(2);
    const noLast = await spark('label="x" last="off" data="1,2,3"');
    expect(noLast.querySelector("[data-last]")).toBeNull();
  });

  it("shows the hovered value inline and hides it on leave", async () => {
    const s = await spark('label="x" data="10,20,30,40" value-format="integer"');
    const drawing = s.querySelector("[data-ui-part=drawing]") as HTMLElement;
    const box = drawing.getBoundingClientRect();
    const pill = s.querySelector("[data-ui-part=value]") as HTMLElement;
    expect(pill.hidden).toBe(true);
    drawing.dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        clientX: box.left + 2,
        clientY: box.top + 10,
        pointerType: "mouse",
      }),
    );
    expect(pill.hidden).toBe(false);
    expect(pill.textContent).toBe("10");
    drawing.dispatchEvent(new PointerEvent("pointerleave", { pointerType: "mouse" }));
    expect(pill.hidden).toBe(true);
  });

  it("explore adds arrow-key access to every point as one tab stop", async () => {
    const s = await spark('label="Trend" explore data="5,6,7"');
    const marks = [...s.querySelectorAll<SVGElement>("svg [role=img]")];
    expect(marks.map((m) => m.getAttribute("aria-label"))).toEqual(["1: 5", "2: 6", "3: 7"]);
    await userEvent.tab();
    expect(document.activeElement).toBe(marks[0]);
    await userEvent.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(marks[1]);
    expect((s.querySelector("[data-ui-part=value]") as HTMLElement).textContent).toBe("6");
  });

  it("shows the empty state when there is nothing to plot", async () => {
    const s = await spark('label="x" data=""');
    expect(s.textContent).toContain("No data to show");
  });
});
