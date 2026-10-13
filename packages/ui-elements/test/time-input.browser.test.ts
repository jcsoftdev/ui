import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { userEvent } from "vitest/browser";
import { defineTimeInput, type UiTimeInput } from "../src/time-input/time-input.ts";
import { ax, frame, mount } from "./setup.ts";

beforeAll(() => {
  defineTimeInput();
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("ui-time-input", () => {
  it("is a named text field with the HH:MM placeholder", async () => {
    mount(`<ui-time-input aria-label="Starts at" value="9:30"></ui-time-input>`);
    await frame();
    const field = await ax("textbox", "Starts at");
    expect(field?.value).toBe("09:30");
  });

  it("masks typing and commits only a valid time", async () => {
    const host = mount(`<ui-time-input aria-label="Starts at"></ui-time-input>`);
    const time = host.querySelector<UiTimeInput>("ui-time-input")!;
    const change = vi.fn();
    time.addEventListener("change", change);
    time.focus();
    await userEvent.keyboard("93");
    expect(time.input.value).toBe("93");
    expect(time.value).toBe("");
    await userEvent.keyboard("0");
    expect(time.input.value).toBe("93:0");
    await userEvent.keyboard("{Backspace}{Backspace}{Backspace}{Backspace}{Backspace}0930");
    expect(time.input.value).toBe("09:30");
    expect(time.value).toBe("09:30");
    expect(change).toHaveBeenCalledTimes(1);
  });

  it("falls back to the committed time when a half-typed one is left", async () => {
    const host = mount(`<ui-time-input aria-label="Starts at" value="08:15"></ui-time-input>`);
    const time = host.querySelector<UiTimeInput>("ui-time-input")!;
    await userEvent.fill(time.input, "12");
    time.input.blur();
    expect(time.input.value).toBe("08:15");
    expect(time.value).toBe("08:15");
  });

  it("steps the segment under the caret: hours by 1, minutes by step, wrapping", async () => {
    const host = mount(
      `<ui-time-input aria-label="Starts at" value="23:55" step="10"></ui-time-input>`,
    );
    const time = host.querySelector<UiTimeInput>("ui-time-input")!;
    time.input.focus();
    time.input.setSelectionRange(1, 1);
    await userEvent.keyboard("{ArrowUp}");
    expect(time.value).toBe("00:55");
    time.input.setSelectionRange(4, 4);
    await userEvent.keyboard("{ArrowUp}");
    expect(time.value).toBe("01:05");
    await userEvent.keyboard("{ArrowDown}{ArrowDown}");
    expect(time.value).toBe("00:45");
  });

  it("submits, resets, validates required and follows a disabled fieldset", () => {
    const host =
      mount(`<form><fieldset><ui-time-input name="at" value="10:00" required></ui-time-input>
      </fieldset></form>`);
    const form = host.querySelector("form")!;
    const time = host.querySelector<UiTimeInput>("ui-time-input")!;
    expect(new FormData(form).get("at")).toBe("10:00");
    time.value = "";
    expect(time.validity.valueMissing).toBe(true);
    expect(time.input.value).toBe("");
    time.value = "1530";
    expect(time.value).toBe("15:30");
    expect(time.input.value).toBe("15:30");
    form.reset();
    expect(time.input.value).toBe("10:00");
    host.querySelector("fieldset")!.disabled = true;
    expect(time.input.disabled).toBe(true);
    expect(new FormData(form).has("at")).toBe(false);
  });

  it("submits and validates the normalized time, not the raw text", () => {
    const host = mount(`<form><ui-time-input name="at" value="930" required></ui-time-input>
      <ui-time-input name="bad" value="9999" required></ui-time-input></form>`);
    const [ok, bad] = host.querySelectorAll<UiTimeInput>(
      "ui-time-input",
    ) as unknown as UiTimeInput[];
    const data = new FormData(host.querySelector("form")!);
    expect(data.get("at")).toBe("09:30");
    expect(data.has("bad")).toBe(false);
    expect(ok!.checkValidity()).toBe(true);
    expect(bad!.validity.valueMissing).toBe(true);
  });

  it("does not leak the native input event while typing", async () => {
    const host = mount(`<ui-time-input aria-label="At"></ui-time-input>`);
    const time = host.querySelector<UiTimeInput>("ui-time-input")!;
    const seen = vi.fn();
    host.addEventListener("input", seen);
    time.focus();
    await userEvent.keyboard("093");
    expect(seen).not.toHaveBeenCalled();
    await userEvent.keyboard("0");
    expect(seen).toHaveBeenCalledTimes(1);
    expect(time.value).toBe("09:30");
  });
});
