import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { defineElement } from "../src/internal/base.ts";
import { defineStepper, UiStep } from "../src/stepper/stepper.ts";
import { ax, mount, wait } from "./setup.ts";

beforeAll(() => {
  defineStepper();
});

afterEach(() => {
  document.body.innerHTML = "";
});

const STEPPER = (
  width = "600px",
) => `<div style="width:${width}"><ui-stepper aria-label="Checkout" current="pay">
  <ui-step value="cart">Cart</ui-step><ui-step value="pay">Payment</ui-step>
  <ui-step value="done">Done</ui-step></ui-stepper></div>`;

describe("ui-stepper", () => {
  it("is a list of numbered steps with aria-current on the current one", async () => {
    const host = mount(STEPPER());
    expect(await ax("list", "Checkout")).toBeTruthy();
    const steps = [...host.querySelectorAll("ui-step")];
    expect(steps.map((step) => step.querySelector("[data-ui-part=marker]")?.textContent)).toEqual([
      "1",
      "2",
      "3",
    ]);
    const current = host.querySelectorAll("[aria-current='step']");
    expect(current).toHaveLength(1);
    expect(current[0]?.textContent).toContain("Payment");
    host.querySelector("ui-stepper")!.setAttribute("current", "done");
    expect(host.querySelector("[aria-current='step']")?.textContent).toContain("Done");
  });

  it("shows only the current label under 420 px but keeps the others for assistive technology", async () => {
    const host = mount(STEPPER("300px"));
    const label = (value: string) =>
      host.querySelector<HTMLElement>(`ui-step[value=${value}] [data-ui-part=label]`)!;
    expect(label("cart").getBoundingClientRect().width).toBeLessThanOrEqual(1);
    expect(label("pay").getBoundingClientRect().width).toBeGreaterThan(20);
    expect(getComputedStyle(label("cart")).display).not.toBe("none");
    expect(label("cart").textContent).toBe("Cart");
    host.firstElementChild!.setAttribute("style", "width:600px");
    await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
    expect(label("cart").getBoundingClientRect().width).toBeGreaterThan(20);
  });

  it("numbers steps that upgrade before the stepper, and renumbers after a removal or a late label", async () => {
    defineElement("step", UiStep, { prefix: "zz" });
    const host =
      mount(`<zz-stepper current="b"><zz-step value="a">A</zz-step><zz-step value="b">B</zz-step>
      <zz-step value="c">C</zz-step></zz-stepper>`);
    defineStepper({ prefix: "zz" });
    const markers = () =>
      [...host.querySelectorAll("[data-ui-part=marker]")].map((m) => m.textContent);
    expect(markers()).toEqual(["1", "2", "3"]);
    expect(host.querySelector("[aria-current='step']")?.textContent).toContain("B");
    host.querySelector("zz-step[value=a]")!.remove();
    await wait(20);
    expect(markers()).toEqual(["1", "2"]);
    host.querySelector("zz-step[value=b]")!.append(" late");
    await wait(20);
    expect(host.querySelector("zz-step[value=b] [data-ui-part=label]")?.textContent).toBe("B late");
  });

  it("registers under a custom prefix", () => {
    expect(defineStepper({ prefix: "acme" })).toBe("acme-stepper");
  });
});
