import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { defineTestNatural, sizing } from "./chart-fixture.ts";
import { frame, mount, wait } from "./setup.ts";

beforeAll(() => defineTestNatural());
afterEach(() => {
  document.body.innerHTML = "";
});

const settle = async () => {
  for (let i = 0; i < 4; i++) await frame();
  await wait(30);
};
const chart = async (attrs = "") => {
  sizing.draws = 0;
  const host = mount(`<div style="width:200px"><ui-test-natural ${attrs}></ui-test-natural></div>`);
  await settle();
  return host.firstElementChild?.firstElementChild as HTMLElement;
};
const heightOf = (el: HTMLElement) =>
  Math.round(
    el.querySelector<HTMLElement>("[data-ui-part=drawing]")!.getBoundingClientRect().height,
  );

describe("chart natural height", () => {
  it("applies defaultHeight without writing host attributes", async () => {
    const el = await chart();
    expect(heightOf(el)).toBe(60);
    expect(el.hasAttribute("height")).toBe(false);
    expect([...el.attributes].map((a) => a.name).sort()).toEqual(["data-ui-chart"]);
  });

  it("applies DrawResult.naturalHeight and a data-driven one beats defaultHeight", async () => {
    const el = await chart('natural="140"');
    expect(heightOf(el)).toBe(140);
    expect(el.hasAttribute("height")).toBe(false);
  });

  it("lets an explicit height or aspect-ratio win", async () => {
    expect(heightOf(await chart('height="90" natural="140"'))).toBe(90);
    expect(heightOf(await chart('aspect-ratio="2" natural="140"'))).toBe(100);
  });

  it("re-evaluates when an attribute changes", async () => {
    const el = await chart();
    el.setAttribute("orientation", "wide");
    await settle();
    expect(heightOf(el)).toBe(100);
    el.setAttribute("natural", "50");
    await settle();
    expect(heightOf(el)).toBe(50);
    el.setAttribute("height", "80");
    await settle();
    expect(heightOf(el)).toBe(80);
  });

  it("settles without a resize loop", async () => {
    const el = await chart('natural="140"');
    const draws = sizing.draws;
    expect(draws).toBeLessThanOrEqual(3);
    await wait(200);
    expect(sizing.draws).toBe(draws);
    expect(heightOf(el)).toBe(140);
  });

  it("paints its first frame at the natural height, never at the default first", async () => {
    sizing.draws = 0;
    const seen: string[] = [];
    const host = mount(
      '<div style="width:200px"><ui-test-natural natural="140"></ui-test-natural></div>',
    );
    const el = host.firstElementChild?.firstElementChild as HTMLElement;
    const drawing = el.querySelector("[data-ui-part=drawing]") as HTMLElement;
    new MutationObserver(() => seen.push(drawing.style.height)).observe(drawing, {
      attributes: true,
      attributeFilter: ["style"],
    });
    await settle();
    expect(seen.every((h) => h === "140px")).toBe(true);
    expect(seen.length).toBeGreaterThan(0);
  });

  it("falls back to the default when the natural height is removed", async () => {
    const el = await chart('natural="140"');
    expect(heightOf(el)).toBe(140);
    el.removeAttribute("natural");
    await settle();
    expect(heightOf(el)).toBe(60);
  });

  it("treats an invalid height or aspect-ratio as unset", async () => {
    expect(heightOf(await chart('height="abc" natural="140"'))).toBe(140);
    expect(heightOf(await chart('aspect-ratio="0" natural="140"'))).toBe(140);
  });
});
