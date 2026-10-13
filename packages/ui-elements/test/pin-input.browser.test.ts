import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { definePinInput, type UiPinInput } from "../src/pin-input/pin-input.ts";
import { ax, frame, mount, wait } from "./setup.ts";

beforeAll(() => {
  definePinInput();
});

afterEach(() => {
  document.body.innerHTML = "";
});

const inner = (pin: UiPinInput) =>
  pin.shadowRoot?.querySelector("input[part=input]") as HTMLInputElement;
const cells = (pin: UiPinInput) => [
  ...pin.shadowRoot!.querySelectorAll<HTMLInputElement>("[part=cell]"),
];

describe("ui-pin-input", () => {
  it("is a masked, named input announced through a live region", async () => {
    const host = mount(`<ui-pin-input length="4" label="Access code"></ui-pin-input>`);
    const pin = host.querySelector<UiPinInput>("ui-pin-input")!;
    await frame();
    expect(inner(pin).type).toBe("password");
    expect(inner(pin).autocomplete).toBe("off");
    expect(await ax("textbox", "Access code")).toBeTruthy();
    pin.focus();
    await userEvent.keyboard("12");
    const status = pin.shadowRoot!.querySelector("[part=status]")!;
    expect(status.getAttribute("aria-live")).toBe("polite");
    expect(status.textContent).toBe("2 of 4 digits entered");
    expect(pin.shadowRoot!.querySelectorAll("[part=dot][data-filled]")).toHaveLength(2);
  });

  it("keeps only the allowed characters, up to the length, and completes", async () => {
    const host = mount(`<ui-pin-input length="4" name="pin"></ui-pin-input>`);
    const pin = host.querySelector<UiPinInput>("ui-pin-input")!;
    const complete = vi.fn();
    const input = vi.fn();
    pin.addEventListener("complete", (event) => complete((event as CustomEvent).detail));
    pin.addEventListener("input", input);
    await userEvent.fill(inner(pin), "1a2b3c4d5");
    expect(pin.value).toBe("1234");
    expect(complete).toHaveBeenCalledWith({ value: "1234" });
    expect(input).toHaveBeenCalled();
  });

  it("charset alphanumeric accepts letters", async () => {
    const host = mount(`<ui-pin-input length="5" charset="alphanumeric"></ui-pin-input>`);
    const pin = host.querySelector<UiPinInput>("ui-pin-input")!;
    await userEvent.fill(inner(pin), "a1-b2!c3");
    expect(pin.value).toBe("a1b2c");
  });

  it("is form-associated: submits, resets, required and too short", async () => {
    const host = mount(`<form><fieldset><ui-pin-input name="pin" length="4" value="12" required>
      </ui-pin-input></fieldset></form>`);
    const form = host.querySelector("form")!;
    const pin = host.querySelector<UiPinInput>("ui-pin-input")!;
    expect(new FormData(form).get("pin")).toBe("12");
    expect(pin.validity.tooShort).toBe(true);
    await userEvent.fill(inner(pin), "1234");
    expect(pin.checkValidity()).toBe(true);
    await userEvent.fill(inner(pin), "");
    expect(pin.validity.valueMissing).toBe(true);
    form.reset();
    expect(pin.value).toBe("12");
    host.querySelector("fieldset")!.disabled = true;
    expect(inner(pin).disabled).toBe(true);
    expect(new FormData(form).has("pin")).toBe(false);
  });

  describe("variant cells", () => {
    it("advances while typing, spreads a paste, steps back on Backspace", async () => {
      const host = mount(
        `<ui-pin-input variant="cells" length="6" label="Code" name="otp"></ui-pin-input>`,
      );
      const pin = host.querySelector<UiPinInput>("ui-pin-input")!;
      await frame();
      await wait(50);
      expect(cells(pin)).toHaveLength(6);
      expect(await ax("group", "Code")).toBeTruthy();
      expect(cells(pin)[0]!.autocomplete).toBe("one-time-code");
      const complete = vi.fn();
      pin.addEventListener("complete", complete);
      pin.focus();
      await userEvent.keyboard("12");
      expect(pin.value).toBe("12");
      expect(pin.shadowRoot!.activeElement).toBe(cells(pin)[2]);
      await userEvent.keyboard("{Backspace}");
      expect(pin.value).toBe("1");
      const data = new DataTransfer();
      data.setData("text", "98-76 54x");
      cells(pin)[0]!.dispatchEvent(
        new ClipboardEvent("paste", {
          clipboardData: data,
          bubbles: true,
          composed: true,
          cancelable: true,
        }),
      );
      expect(pin.value).toBe("987654");
      expect(cells(pin).map((cell) => cell.value)).toEqual(["9", "8", "7", "6", "5", "4"]);
      expect(complete).toHaveBeenCalledTimes(1);
    });

    it("writes an outside value into the cells and submits it", async () => {
      const host = mount(
        `<form><ui-pin-input variant="cells" length="4" name="otp"></ui-pin-input></form>`,
      );
      const pin = host.querySelector<UiPinInput>("ui-pin-input")!;
      pin.value = "4321";
      expect(
        cells(pin)
          .map((cell) => cell.value)
          .join(""),
      ).toBe("4321");
      expect(new FormData(host.querySelector("form")!).get("otp")).toBe("4321");
    });
  });
});
