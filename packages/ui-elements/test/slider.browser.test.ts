import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { defineSlider, type UiSlider } from "../src/slider/slider.ts";
import { ax, frame, mount } from "./setup.ts";

beforeAll(() => {
  defineSlider();
});

afterEach(() => {
  document.body.innerHTML = "";
});

const thumbs = (slider: UiSlider) => [
  ...(slider.shadowRoot?.querySelectorAll<HTMLElement>("[role=slider]") ?? []),
];
const track = (slider: UiSlider) => slider.shadowRoot?.querySelector("[part=track]") as HTMLElement;

/** A mouse drag along the track, at fractions (0..1) of its physical width. */
function drag(slider: UiSlider, fractions: number[]) {
  const rect = track(slider).getBoundingClientRect();
  const at = (fraction: number) => ({
    clientX: rect.left + rect.width * fraction,
    clientY: rect.top + rect.height / 2,
    pointerId: 7,
    pointerType: "mouse",
    button: 0,
    bubbles: true,
    composed: true,
  });
  const [first, ...rest] = fractions as [number, ...number[]];
  track(slider).dispatchEvent(new PointerEvent("pointerdown", at(first)));
  for (const fraction of rest)
    track(slider).dispatchEvent(new PointerEvent("pointermove", at(fraction)));
  track(slider).dispatchEvent(new PointerEvent("pointerup", at(rest.at(-1) ?? first)));
}

describe("ui-slider", () => {
  it("exposes slider semantics, one per thumb of a range", async () => {
    mount(`<ui-slider aria-label="Volume" value="40" min="0" max="200" step="10"></ui-slider>
      <ui-slider aria-label="Price" value="20,80" show-value></ui-slider>`);
    await frame();
    const single = await ax("slider", "Volume");
    expect(single?.properties).toMatchObject({
      valuemin: 0,
      valuemax: 200,
      orientation: "horizontal",
    });
    expect(single?.value).toBe(40);
    expect(await ax("slider", "Price (min)")).toBeTruthy();
    expect(await ax("slider", "Price (max)")).toBeTruthy();
  });

  it("follows the keyboard: arrows, page keys, Home and End, with input and change", async () => {
    const host = mount(`<ui-slider aria-label="Volume" value="50" step="5"></ui-slider>`);
    const slider = host.querySelector<UiSlider>("ui-slider")!;
    const input = vi.fn();
    const change = vi.fn();
    slider.addEventListener("input", input);
    slider.addEventListener("change", change);
    slider.focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(slider.value).toBe("55");
    await userEvent.keyboard("{ArrowDown}{PageUp}");
    expect(slider.value).toBe("100");
    await userEvent.keyboard("{Home}");
    expect(slider.value).toBe("0");
    await userEvent.keyboard("{End}");
    expect(slider.value).toBe("100");
    expect(thumbs(slider)[0]!.getAttribute("aria-valuenow")).toBe("100");
    expect(input).toHaveBeenCalledTimes(5);
    expect(change).toHaveBeenCalledTimes(5);
  });

  it("drags with the pointer: input while moving, one change at the end", async () => {
    const host = mount(`<ui-slider aria-label="Volume" style="width:200px"></ui-slider>`);
    const slider = host.querySelector<UiSlider>("ui-slider")!;
    const input = vi.fn();
    const change = vi.fn();
    slider.addEventListener("input", input);
    slider.addEventListener("change", change);
    drag(slider, [0.25, 0.5, 0.75]);
    expect(slider.value).toBe("75");
    expect(input).toHaveBeenCalledTimes(3);
    expect(change).toHaveBeenCalledTimes(1);
  });

  it("mirrors the physical pointer ratio and the arrows in RTL", async () => {
    const host = mount(
      `<div dir="rtl"><ui-slider aria-label="Volume" style="width:200px"></ui-slider></div>`,
    );
    const slider = host.querySelector<UiSlider>("ui-slider")!;
    drag(slider, [0.25]);
    expect(slider.value).toBe("75");
    slider.focus();
    await userEvent.keyboard("{ArrowLeft}");
    expect(slider.value).toBe("76");
  });

  it("grabs the nearest thumb of a range and keeps the gap", () => {
    const host = mount(`<ui-slider aria-label="Price" value="20,80" min-gap="10"
      style="width:200px"></ui-slider>`);
    const slider = host.querySelector<UiSlider>("ui-slider")!;
    drag(slider, [0.9]);
    expect(slider.value).toBe("20,90");
    drag(slider, [0.1, 0.95]);
    expect(slider.value).toBe("80,90");
    expect(slider.values).toEqual([80, 90]);
  });

  it("submits under name (a range as name-min and name-max), resets and follows a fieldset", () => {
    const host = mount(`<form><fieldset>
      <ui-slider name="vol" value="30"></ui-slider>
      <ui-slider name="price" value="10,60"></ui-slider></fieldset></form>`);
    const form = host.querySelector("form")!;
    const [vol, price] = host.querySelectorAll<UiSlider>("ui-slider") as unknown as UiSlider[];
    let data = new FormData(form);
    expect(data.get("vol")).toBe("30");
    expect(data.get("price-min")).toBe("10");
    expect(data.get("price-max")).toBe("60");
    vol!.value = "70";
    price!.value = "0,100";
    expect(new FormData(form).get("vol")).toBe("70");
    form.reset();
    data = new FormData(form);
    expect(data.get("vol")).toBe("30");
    expect(data.get("price-max")).toBe("60");
    host.querySelector("fieldset")!.disabled = true;
    expect(thumbs(vol!)[0]!.getAttribute("aria-disabled")).toBe("true");
    drag(vol!, [0.9]);
    expect(vol!.value).toBe("30");
  });

  it("registers under a custom prefix", () => {
    expect(defineSlider({ prefix: "acme" })).toBe("acme-slider");
  });
});
