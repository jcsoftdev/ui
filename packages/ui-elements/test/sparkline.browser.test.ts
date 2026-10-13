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
    // The pill is built (and its code fetched) on the first hover, not before.
    expect(s.querySelector("[data-ui-part=value]")).toBeNull();
    // The first pointer arrival loads the interaction chunk, then catches up with where it is.
    drawing.dispatchEvent(
      new PointerEvent("pointerenter", {
        clientX: box.left + 2,
        clientY: box.top + 10,
        pointerType: "mouse",
      }),
    );
    await wait(80);
    const pill = s.querySelector("[data-ui-part=value]") as HTMLElement;
    expect(pill.hidden).toBe(false);
    drawing.dispatchEvent(new PointerEvent("pointerleave", { pointerType: "mouse" }));
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
    const s = await spark('label="Trend" explore data="5,,7"');
    const proxy = s.querySelector("[data-ui-part=proxy]") as HTMLElement;
    expect(proxy.getAttribute("role")).toBe("listbox");
    await userEvent.tab();
    await wait(80);
    expect(document.activeElement).toBe(proxy);
    const option = () => s.querySelector("[role=option]") as HTMLElement;
    expect(option().textContent).toBe("1: 5");
    expect((s.querySelector("[data-ui-part=value]") as HTMLElement).textContent).toBe("5");
    await userEvent.keyboard("{ArrowRight}");
    expect(option().textContent).toBe("2: -"); // a gap is still a stop, and says so
    await userEvent.keyboard("{ArrowRight}");
    expect(option().textContent).toBe("3: 7");
    await wait(20);
    expect((s.querySelector("[data-ui-part=value]") as HTMLElement).textContent).toBe("7");
  });

  it("keeps an inline width the author set, and gives each instance its own gradient id", async () => {
    const host = mount(
      `<div style="width:300px"><ui-sparkline locale="en-US" type="area" label="a" data="1,2,3" style="width:120px"></ui-sparkline>
       <ui-sparkline locale="en-US" type="area" label="b" data="3,2,1" width="90"></ui-sparkline>
       <ui-sparkline locale="en-US" type="area" label="c" data="2,2,5"></ui-sparkline></div>`,
    );
    await settle();
    const [a, b, c] = [...host.querySelectorAll<HTMLElement>("ui-sparkline")];
    expect(a?.style.width).toBe("120px");
    expect(b?.style.width).toBe("90px");
    b?.removeAttribute("width");
    a?.removeAttribute("width");
    await settle();
    expect(b?.style.width).toBe("");
    expect(a?.style.width).toBe("120px"); // not ours to clear
    const ids = [a, b, c].map((s) => s?.querySelector("linearGradient")?.id);
    expect(new Set(ids).size).toBe(3);
    expect(a?.querySelector("path[style*=url]")?.getAttribute("style")).toContain(`#${ids[0]}`);
  });

  it("a tap pins the nearest point's value", async () => {
    const s = await spark('label="x" data="10,20,30,40" value-format="integer"');
    const drawing = s.querySelector("[data-ui-part=drawing]") as HTMLElement;
    const box = drawing.getBoundingClientRect();
    const fire = (type: string) =>
      drawing.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          clientX: box.left + 150,
          clientY: box.top + 12,
          pointerType: "touch",
          pointerId: 4,
        }),
      );
    fire("pointerenter");
    fire("pointerdown");
    fire("pointerup");
    await wait(80);
    expect((s.querySelector("[data-ui-part=value]") as HTMLElement).textContent).toBe("40");
  });

  it("shows the empty state when there is nothing to plot", async () => {
    const s = await spark('label="x" data=""');
    expect(s.textContent).toContain("No data to show");
  });
});
