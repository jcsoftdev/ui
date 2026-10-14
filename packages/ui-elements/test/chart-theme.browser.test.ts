import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { themeWatchers } from "../src/internal/chart-canvas.ts";
import { defineTestCanvas } from "./chart-fixture.ts";
import { frame, mount, wait } from "./setup.ts";

beforeAll(() => defineTestCanvas());
afterEach(() => {
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("data-theme");
});

const settle = async () => {
  for (let i = 0; i < 4; i++) await frame();
  await wait(30);
};
const style = document.createElement("style");
style.textContent =
  ":root{--ink-2:rgb(0,0,0)} html[data-theme=dark]{--ink-2:rgb(255,255,255)} html[data-theme=light]{--ink-2:rgb(0,0,0)}";
document.head.append(style);

const pixel = (el: Element) => {
  const canvas = el.querySelector("canvas") as HTMLCanvasElement;
  return [...(canvas.getContext("2d") as CanvasRenderingContext2D).getImageData(2, 2, 1, 1).data];
};

describe("chart theme signal", () => {
  it("repaints a canvas chart after data-theme changes", async () => {
    const host = mount(
      '<div style="width:100px"><ui-test-canvas height="40"></ui-test-canvas></div>',
    );
    const el = host.firstElementChild?.firstElementChild as HTMLElement;
    document.documentElement.setAttribute("data-theme", "light");
    await settle();
    expect(pixel(el).slice(0, 3)).toEqual([0, 0, 0]);
    document.documentElement.setAttribute("data-theme", "dark");
    await settle();
    expect(pixel(el).slice(0, 3)).not.toEqual([0, 0, 0]);
  });

  it("shares one subscription per chart and releases it on disconnect", async () => {
    const before = themeWatchers();
    const host = mount(
      '<div><ui-test-canvas height="40"></ui-test-canvas><ui-test-canvas height="40"></ui-test-canvas></div>',
    );
    await settle();
    expect(themeWatchers()).toBe(before + 2);
    host.replaceChildren();
    await settle();
    expect(themeWatchers()).toBe(before);
  });
});
