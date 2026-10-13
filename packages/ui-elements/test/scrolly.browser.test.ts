import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { defineScrolly, type UiScrolly } from "../src/scrolly/scrolly.ts";
import { ax, mount } from "./setup.ts";

beforeAll(() => {
  defineScrolly();
});

afterEach(() => {
  document.body.innerHTML = "";
});

const story = (attrs = "", dir = "ltr") => {
  const host = mount(
    `<div id="scroller" dir="${dir}" style="height:400px;width:800px;overflow:auto">
      <ui-scrolly label="Story" root="#scroller" ${attrs}>
        <ui-scrolly-graphic>chart</ui-scrolly-graphic>
        <ui-scrolly-step min-height="400px"><h3>One</h3></ui-scrolly-step>
        <ui-scrolly-step min-height="400px"><h3>Two</h3></ui-scrolly-step>
        <ui-scrolly-step min-height="400px"><h3>Three</h3></ui-scrolly-step>
      </ui-scrolly></div>`,
  );
  return {
    root: host.querySelector<HTMLElement>("#scroller")!,
    el: host.querySelector<UiScrolly>("ui-scrolly")!,
  };
};

const steps = (el: Element) => [...el.querySelectorAll<HTMLElement>("ui-scrolly-step")];

describe("ui-scrolly", () => {
  it("marks the first step current and labels the narrative", async () => {
    const { el } = story();
    expect(await ax("region", "Story")).toBeTruthy();
    const [one, two] = steps(el);
    expect(one!.getAttribute("role")).toBe("article");
    expect(one!.getAttribute("aria-current")).toBe("step");
    expect(one!.hasAttribute("data-active")).toBe(true);
    expect(two!.hasAttribute("aria-current")).toBe(false);
    expect(el.dataset.step).toBe("0");
  });

  it("follows the step that crosses the trigger line and reports it", async () => {
    const { root, el } = story();
    const change = vi.fn();
    el.addEventListener("change", change);
    const [, two, three] = steps(el);
    root.scrollTop = two!.offsetTop - 100;
    await vi.waitFor(() => expect(el.step).toBe(1));
    expect(change).toHaveBeenLastCalledWith(
      expect.objectContaining({ detail: { step: 1, previous: 0 } }),
    );
    expect(two!.getAttribute("aria-current")).toBe("step");
    expect(el.dataset.previous).toBe("0");
    expect(el.style.getPropertyValue("--ui-scrolly-step")).toBe("1");
    root.scrollTop = three!.offsetTop - 100;
    await vi.waitFor(() => expect(el.step).toBe(2));
    root.scrollTop = 0;
    await vi.waitFor(() => expect(el.step).toBe(0));
  });

  it("shows a forced step while scrolling only reports", async () => {
    const { root, el } = story('step="2"');
    expect(el.step).toBe(2);
    expect(steps(el)[2]!.getAttribute("aria-current")).toBe("step");
    const change = vi.fn();
    el.addEventListener("change", change);
    root.scrollTop = steps(el)[1]!.offsetTop - 100;
    await vi.waitFor(() => expect(change).toHaveBeenCalled());
    expect(el.step).toBe(2);
    el.step = null;
    expect(el.step).toBe(1);
  });

  it("puts the graphic beside the steps in a wide container and mirrors it in right-to-left", () => {
    const column = (el: Element) =>
      getComputedStyle(el.querySelector("ui-scrolly-graphic")!).gridColumnStart;
    expect(column(story().el)).toBe("2");
    document.body.innerHTML = "";
    expect(column(story("", "rtl").el)).toBe("1");
    document.body.innerHTML = "";
    expect(column(story('graphic-side="start"').el)).toBe("1");
  });

  it("pins the graphic above the steps in a narrow container", () => {
    const host = mount(
      `<div style="width:300px"><ui-scrolly><ui-scrolly-graphic>g</ui-scrolly-graphic><ui-scrolly-step>s</ui-scrolly-step></ui-scrolly></div>`,
    );
    const graphic = host.querySelector("ui-scrolly-graphic")!;
    expect(getComputedStyle(graphic).position).toBe("sticky");
    expect(getComputedStyle(graphic).gridColumnStart).toBe("auto");
  });

  it("registers under a custom prefix", () => {
    expect(defineScrolly({ prefix: "acme" })).toBe("acme-scrolly");
  });
});
