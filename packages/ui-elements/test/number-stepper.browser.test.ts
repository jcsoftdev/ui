import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { defineNumberStepper, type UiNumberStepper } from "../src/number-stepper/number-stepper.ts";
import { ax, frame, mount, wait } from "./setup.ts";

beforeAll(() => {
  defineNumberStepper();
});

afterEach(() => {
  document.body.innerHTML = "";
});

const part = (stepper: UiNumberStepper, name: string) =>
  stepper.shadowRoot?.querySelector(`[part=${name}]`) as HTMLElement;
const press = (target: HTMLElement, type: "pointerdown" | "pointerup") =>
  target.dispatchEvent(
    new PointerEvent(type, { pointerId: 3, pointerType: "mouse", button: 0, bubbles: true }),
  );

describe("ui-number-stepper", () => {
  it("is a named spinbutton with limits and a unit", async () => {
    mount(
      `<ui-number-stepper aria-label="Quantity" value="3" min="1" max="9" unit="min"></ui-number-stepper>`,
    );
    await frame();
    const spin = await ax("spinbutton", "Quantity");
    expect(spin?.properties).toMatchObject({ valuemin: 1, valuemax: 9 });
    expect(spin?.value).toBe(3);
    expect(await ax("button", "Decrease")).toBeTruthy();
    expect(await ax("button", "Increase")).toBeTruthy();
  });

  it("steps with the keys, snaps a typed value on Enter and blur, and clamps", async () => {
    const host = mount(
      `<ui-number-stepper aria-label="Qty" value="2" min="0" max="10" step="2"></ui-number-stepper>`,
    );
    const stepper = host.querySelector<UiNumberStepper>("ui-number-stepper")!;
    const change = vi.fn();
    stepper.addEventListener("change", change);
    stepper.focus();
    await userEvent.keyboard("{ArrowUp}");
    expect(stepper.value).toBe("4");
    await userEvent.keyboard("{End}");
    expect(stepper.value).toBe("10");
    await userEvent.keyboard("{Home}");
    expect(stepper.value).toBe("0");
    const input = part(stepper, "input") as HTMLInputElement;
    await userEvent.fill(input, "5,2");
    await userEvent.keyboard("{Enter}");
    expect(stepper.value).toBe("6");
    await userEvent.fill(input, "99");
    input.blur();
    expect(stepper.value).toBe("10");
    expect(input.value).toBe("10");
    expect(change).toHaveBeenCalledTimes(5);
    expect(part(stepper, "increment").getAttribute("aria-disabled")).toBe("true");
  });

  it("repeats while a button is held and stops on release", async () => {
    const host = mount(`<ui-number-stepper aria-label="Qty" value="0"></ui-number-stepper>`);
    const stepper = host.querySelector<UiNumberStepper>("ui-number-stepper")!;
    const up = part(stepper, "increment");
    press(up, "pointerdown");
    expect(stepper.value).toBe("1");
    await wait(650);
    press(up, "pointerup");
    const held = Number(stepper.value);
    expect(held).toBeGreaterThan(2);
    await wait(250);
    expect(Number(stepper.value)).toBe(held);
  });

  it("submits, resets and follows a disabled fieldset; a label focuses the field", async () => {
    const host = mount(`<form><fieldset><label for="q">Qty</label>
      <ui-number-stepper id="q" name="qty" value="4"></ui-number-stepper></fieldset></form>`);
    const form = host.querySelector("form")!;
    const stepper = host.querySelector<UiNumberStepper>("ui-number-stepper")!;
    expect(new FormData(form).get("qty")).toBe("4");
    expect(await ax("spinbutton", "Qty")).toBeTruthy();
    host.querySelector("label")!.click();
    expect(stepper.shadowRoot?.activeElement).toBe(part(stepper, "input"));
    stepper.value = "8";
    form.reset();
    expect(new FormData(form).get("qty")).toBe("4");
    host.querySelector("fieldset")!.disabled = true;
    press(part(stepper, "increment"), "pointerdown");
    expect(stepper.value).toBe("4");
    expect(new FormData(form).has("qty")).toBe(false);
  });
});
